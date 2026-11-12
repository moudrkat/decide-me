package com.moudrkat.decideme;

import android.os.SystemClock;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.*;

/** Serializes loading, generation, verification and cleanup off the UI thread. */
@CapacitorPlugin(name = "Vision")
public class VisionPlugin extends Plugin {
    static { System.loadLibrary("decide_vision"); }
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private long handle;
    private static native long nativeLoad(String path, String projector);
    private static native byte[] nativeDescribe(long handle, byte[] jpeg);
    private static native void nativeUnload(long handle);
    private interface Task { JSObject run() throws Exception; }
    private void submit(PluginCall call, Task task) {
        worker.execute(() -> {
            try { call.resolve(task.run()); }
            catch (Exception | LinkageError e) { call.reject(e.getMessage() == null ? e.toString() : e.getMessage()); }
        });
    }
    @PluginMethod public void load(PluginCall call) {
        submit(call, () -> {
            if (handle != 0) { nativeUnload(handle); handle = 0; }
            handle = nativeLoad(call.getString("path"), call.getString("projector"));
            return new JSObject();
        });
    }
    @PluginMethod public void describe(PluginCall call) {
        submit(call, () -> {
            String data = call.getString("image", "");
            if (!data.startsWith("data:image/jpeg;base64,") || data.length() > 12*1024*1024) throw new IOException("Expected a JPEG data URL");
            long start = SystemClock.elapsedRealtime();
            byte[] result = nativeDescribe(handle, Base64.decode(data.substring(data.indexOf(',') + 1), Base64.DEFAULT));
            JSObject out = new JSObject();
            out.put("json", new String(result, StandardCharsets.UTF_8));
            out.put("wallMs", SystemClock.elapsedRealtime() - start);
            return out;
        });
    }
    @PluginMethod public void verify(PluginCall call) {
        submit(call, () -> {
            String path = call.getString("path", "");
            File file = new File(path).getCanonicalFile();
            String root = getContext().getFilesDir().getCanonicalPath() + File.separator;
            if (!file.getPath().startsWith(root)) throw new IOException("Model must be in app data");
            MessageDigest hash = MessageDigest.getInstance("SHA-256");
            try (InputStream input = new BufferedInputStream(new FileInputStream(file))) {
                byte[] buffer = new byte[1024*1024]; int n;
                while ((n = input.read(buffer)) != -1) hash.update(buffer, 0, n);
            }
            StringBuilder hex = new StringBuilder();
            for (byte b : hash.digest()) hex.append(String.format("%02x", b & 255));
            JSObject out = new JSObject(); out.put("valid", hex.toString().equals(call.getString("sha256"))); return out;
        });
    }
    @PluginMethod public void unload(PluginCall call) {
        submit(call, () -> { if (handle != 0) { nativeUnload(handle); handle = 0; } return new JSObject(); });
    }
    @Override protected void handleOnDestroy() {
        worker.execute(() -> { if (handle != 0) { nativeUnload(handle); handle = 0; } });
        worker.shutdown();
    }
}
