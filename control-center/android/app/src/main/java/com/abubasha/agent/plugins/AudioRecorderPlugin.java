package com.abubasha.agent.plugins;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.MediaRecorder;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.annotation.Permission;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

@CapacitorPlugin(
    name = "AudioRecorder",
    permissions = {
        @Permission(
            alias = "microphone",
            strings = { Manifest.permission.RECORD_AUDIO }
        )
    }
)
public class AudioRecorderPlugin extends Plugin {
    private static final long MAX_DURATION_MS = 60_000L;
    private static final long MAX_OUTPUT_BYTES = 8L * 1024L * 1024L;

    private MediaRecorder recorder;
    private File outputFile;
    private long recordingStartedAt = 0L;
    private boolean recording = false;

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (recording) {
            call.reject(
                "A recording is already active",
                "RECORDING_ALREADY_ACTIVE"
            );
            return;
        }

        if (getContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias(
                "microphone",
                call,
                "microphonePermissionCallback"
            );
            return;
        }

        startRecordingInternal(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject(
                "Microphone permission is required",
                "MICROPHONE_PERMISSION_DENIED"
            );
            return;
        }

        startRecordingInternal(call);
    }

    private void startRecordingInternal(PluginCall call) {
        try {
            File dir = new File(
                getContext().getCacheDir(),
                "abu-basha-audio"
            );

            if (!dir.exists() && !dir.mkdirs()) {
                call.reject(
                    "Unable to create recording directory",
                    "RECORDING_STORAGE_FAILED"
                );
                return;
            }

            outputFile = File.createTempFile("stt-", ".m4a", dir);
            outputFile.setReadable(true, true);
            outputFile.setWritable(true, true);

            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setOutputFile(outputFile.getAbsolutePath());
            recorder.setMaxDuration((int) MAX_DURATION_MS);

            recorder.setOnInfoListener((mr, what, extra) -> {
                if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) {
                    stopAndReturn(null);
                }
            });

            recorder.prepare();
            recorder.start();

            recordingStartedAt = System.currentTimeMillis();
            recording = true;

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("type", "audio_recording_started");
            result.put("mimeType", "audio/mp4");
            result.put("maxDurationMs", MAX_DURATION_MS);

            call.resolve(result);
        } catch (Exception error) {
            releaseRecorder();
            deleteOutputFile();

            call.reject(
                error.getMessage() == null
                    ? "Unable to start microphone recording"
                    : error.getMessage(),
                "RECORDING_START_FAILED"
            );
        }
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        if (!recording || recorder == null || outputFile == null) {
            call.reject(
                "No active recording",
                "NO_ACTIVE_RECORDING"
            );
            return;
        }

        stopAndReturn(call);
    }

    private synchronized void stopAndReturn(PluginCall call) {
        File file = outputFile;

        try {
            if (recorder != null) {
                try {
                    recorder.stop();
                } catch (RuntimeException error) {
                    releaseRecorder();
                    deleteFile(file);

                    if (call != null) {
                        call.reject(
                            "Recording contained no valid audio",
                            "RECORDING_EMPTY"
                        );
                    }
                    return;
                }
            }

            releaseRecorder();

            if (file == null || !file.isFile() || file.length() <= 0L) {
                deleteFile(file);

                if (call != null) {
                    call.reject(
                        "Recording produced no audio",
                        "RECORDING_EMPTY"
                    );
                }
                return;
            }

            byte[] bytes = readFile(file);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("type", "audio_recording_ready");
            result.put("mimeType", "audio/mp4");
            result.put("extension", "m4a");
            result.put(
                "durationMs",
                Math.min(
                    recordingStartedAt > 0L
                        ? System.currentTimeMillis() - recordingStartedAt
                        : 0L,
                    MAX_DURATION_MS
                )
            );
            result.put("sizeBytes", bytes.length);
            result.put(
                "base64",
                android.util.Base64.encodeToString(
                    bytes,
                    android.util.Base64.NO_WRAP
                )
            );

            deleteFile(file);

            if (call != null) {
                call.resolve(result);
            }
        } catch (Exception error) {
            releaseRecorder();
            deleteFile(file);

            if (call != null) {
                call.reject(
                    error.getMessage() == null
                        ? "Unable to finalize recording"
                        : error.getMessage(),
                    "RECORDING_FINALIZE_FAILED"
                );
            }
        } finally {
            outputFile = null;
            recordingStartedAt = 0L;
            recording = false;
        }
    }

    @PluginMethod
    public void cancelRecording(PluginCall call) {
        File file = outputFile;

        try {
            releaseRecorder();
            deleteFile(file);

            outputFile = null;
            recordingStartedAt = 0L;
            recording = false;

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("type", "audio_recording_cancelled");

            call.resolve(result);
        } catch (Exception error) {
            call.reject(
                error.getMessage() == null
                    ? "Unable to cancel recording"
                    : error.getMessage(),
                "RECORDING_CANCEL_FAILED"
            );
        }
    }

    private byte[] readFile(File file) throws IOException {
        long length = file.length();

        if (length <= 0L || length > MAX_OUTPUT_BYTES) {
            throw new IOException(
                "Recording exceeds the 8MB transport limit"
            );
        }

        byte[] bytes = new byte[(int) length];

        try (FileInputStream input = new FileInputStream(file)) {
            int offset = 0;

            while (offset < bytes.length) {
                int read = input.read(
                    bytes,
                    offset,
                    bytes.length - offset
                );

                if (read < 0) {
                    break;
                }

                offset += read;
            }

            if (offset != bytes.length) {
                throw new IOException("Incomplete recording read");
            }
        }

        return bytes;
    }

    private void releaseRecorder() {
        recording = false;

        if (recorder != null) {
            try {
                recorder.reset();
            } catch (Exception ignored) {
            }

            try {
                recorder.release();
            } catch (Exception ignored) {
            }

            recorder = null;
        }
    }

    private void deleteOutputFile() {
        deleteFile(outputFile);
        outputFile = null;
    }

    private void deleteFile(File file) {
        if (file != null && file.exists()) {
            try {
                file.delete();
            } catch (Exception ignored) {
            }
        }
    }
}
