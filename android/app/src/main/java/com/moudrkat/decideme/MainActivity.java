package com.moudrkat.decideme;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(VisionPlugin.class);
        super.onCreate(state);
    }
}
