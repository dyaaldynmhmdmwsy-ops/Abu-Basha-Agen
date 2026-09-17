package com.abubasha.agent;

import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "AbuBashaRuntime";

    private static final String TERMUX_PACKAGE = "com.termux";
    private static final String RUN_COMMAND_SERVICE =
            "com.termux.app.RunCommandService";
    private static final String RUN_COMMAND_ACTION =
            "com.termux.RUN_COMMAND";

    private static final String EXTRA_COMMAND_PATH =
            "com.termux.RUN_COMMAND_PATH";
    private static final String EXTRA_ARGUMENTS =
            "com.termux.RUN_COMMAND_ARGUMENTS";
    private static final String EXTRA_WORKDIR =
            "com.termux.RUN_COMMAND_WORKDIR";
    private static final String EXTRA_BACKGROUND =
            "com.termux.RUN_COMMAND_BACKGROUND";
    private static final String EXTRA_COMMAND_LABEL =
            "com.termux.RUN_COMMAND_COMMAND_LABEL";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        startProductionRuntime();
        super.onCreate(savedInstanceState);
    }

    private void startProductionRuntime() {
        Intent intent = new Intent();
        intent.setComponent(new ComponentName(
                TERMUX_PACKAGE,
                RUN_COMMAND_SERVICE
        ));
        intent.setAction(RUN_COMMAND_ACTION);

        intent.putExtra(EXTRA_COMMAND_PATH,
                "~/../usr/bin/node");
        intent.putExtra(EXTRA_ARGUMENTS,
                new String[]{"src/startup.js"});
        intent.putExtra(EXTRA_WORKDIR,
                "~/agent-lab/agent");
        intent.putExtra(EXTRA_BACKGROUND, true);
        intent.putExtra(EXTRA_COMMAND_LABEL,
                "Abu Basha AI Runtime");

        try {
            startService(intent);
            Log.i(TAG, "Production runtime start requested");
        } catch (SecurityException e) {
            Log.e(TAG,
                    "Termux RUN_COMMAND permission is not granted",
                    e);
        } catch (Exception e) {
            Log.e(TAG,
                    "Failed to request production runtime",
                    e);
        }
    }
}
