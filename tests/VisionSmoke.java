package com.moudrkat.decideme;

import java.nio.file.*;
import java.nio.charset.StandardCharsets;

// Host-only JNI fixture: exercises the exact Android inference implementation.
class VisionPlugin {
    static { System.loadLibrary("decide_vision"); }
    static native long nativeLoad(String model, String projector);
    static native byte[] nativeDescribe(long handle, byte[] jpeg);
    static native void nativeUnload(long handle);
}
public class VisionSmoke {
    public static void main(String[] args) throws Exception {
        long handle = VisionPlugin.nativeLoad(args[0], args[1]);
        try {
            for (int i = 2; i < args.length; i++) {
                long start = System.nanoTime();
                String result = new String(VisionPlugin.nativeDescribe(handle, Files.readAllBytes(Path.of(args[i]))), StandardCharsets.UTF_8);
                System.out.println(result);
                System.err.printf("%s: %.2f s%n", args[i], (System.nanoTime() - start) / 1e9);
            }
        } finally { VisionPlugin.nativeUnload(handle); }
    }
}
