package com.gravio.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

/**
 * Shared, stoppable alarm sound. The foreground service and the AlarmManager
 * backup both play through here so a single reference is kept and can be
 * stopped from the JS side (dismiss / tap) via the plugin.
 *
 * Also acts as the single "end of rest" emitter: both the foreground service
 * and the AlarmManager backup call {@link #fireEndAlarm(Context)} guarded by a
 * static flag, so the user never gets two identical end notifications.
 */
public final class RestTimerAlarmSound {
    private static Ringtone current;
    private static boolean endHandled = false;

    private RestTimerAlarmSound() { }

    /** Reset the "already fired" guard when a new rest starts. */
    static void resetEnd() {
        endHandled = false;
    }

    static void play(Context ctx) {
        stop();
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) {
                uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            Ringtone r = RingtoneManager.getRingtone(ctx, uri);
            if (r != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    r.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
                }
                current = r;
                r.play();
            }
        } catch (Throwable t) {
            Log.e("RestTimerAlarm", "play failed", t);
        }
    }

    static void stop() {
        try {
            if (current != null && current.isPlaying()) current.stop();
        } catch (Throwable ignored) { }
        current = null;
    }

    /**
     * Short, discreet "ding" used for the rest-timer end (instead of the full
     * morning-alarm ringtone). Synthesised so it never depends on the user's
     * alarm sound and stays brief + pleasant.
     */
    static void playShortBeep(Context ctx) {
        stop();
        try {
            int sr = 44100;
            int len = sr; // ~1s
            short[] pcm = new short[len];
            for (int i = 0; i < len; i++) {
                double t = (double) i / sr;
                // Two-tone pleasant chime with a quick fade-out.
                double env = Math.max(0, 1.0 - t / 0.9);
                double s = Math.sin(2 * Math.PI * 880 * t) + 0.6 * Math.sin(2 * Math.PI * 1175 * t);
                pcm[i] = (short) (s * 0.5 * env * 32767);
            }
            AudioFormat fmt = new AudioFormat.Builder()
                .setSampleRate(sr)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build();
            AudioTrack track = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build())
                .setAudioFormat(fmt)
                .setBufferSizeInBytes(len * 2)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build();
            track.write(pcm, 0, len);
            track.play();
            // Release after it finishes.
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(
                track::release, 1500);
        } catch (Throwable t) {
            Log.e("RestTimerAlarm", "playShortBeep failed", t);
        }
    }

    /**
     * Single entry point for the end-of-rest alarm. Played by BOTH the
     * foreground service and the AlarmManager backup receiver, but guarded by a
     * static flag so only the first call actually posts the notification +
     * sound (prevents two identical notifications when both paths race).
     */
    static void fireEndAlarm(Context ctx) {
        if (endHandled) return;
        endHandled = true;
        try {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.cancel(2002); // clear the live countdown notif

            int iconRes = ctx.getResources().getIdentifier(
                "ic_stat_icon", "drawable", ctx.getPackageName());
            if (iconRes == 0) iconRes = android.R.drawable.ic_lock_idle_alarm;

            Intent launchIntent = ctx.getPackageManager()
                .getLaunchIntentForPackage(ctx.getPackageName());
            android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
                ctx, 0, launchIntent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    | android.app.PendingIntent.FLAG_IMMUTABLE);

            Notification.Builder b = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(ctx, "rest-alarm-v2")
                : new Notification.Builder(ctx);
            b.setSmallIcon(iconRes)
                .setContentTitle("\u23F1 Repos termin\u00E9 !")
                .setContentText("C'est reparti pour une s\u00E9rie !")
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setOngoing(false)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setPriority(Notification.PRIORITY_MAX);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                b.setVibrate(new long[]{400, 150, 400, 150, 200, 150});
            }

            if (nm != null) nm.notify(2001, b.build());

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Vibrator v = ctx.getSystemService(Vibrator.class);
                if (v != null) v.vibrate(VibrationEffect.createWaveform(
                    new long[]{0, 400, 150, 400, 150, 200, 150}, -1));
            }

            playChosenOrBeep(ctx);

            try {
                ctx.sendBroadcast(new Intent(RestTimerPlugin.ACTION_FINISHED));
            } catch (Throwable ignored) { }
        } catch (Throwable t) {
            Log.e("RestTimerAlarm", "fireEndAlarm failed", t);
        }
    }

    /**
     * Play the user-chosen ringtone if one is set (persisted in the
     * "rest-timer" SharedPreferences under KEY_RINGTONE_URI), otherwise fall
     * back to the short synthesised chime. The chosen ringtone is played on the
     * ALARM stream so it is audible when locked / in Doze.
     */
    static void playChosenOrBeep(Context ctx) {
        String uriStr = null;
        try {
            android.content.SharedPreferences sp =
                ctx.getSharedPreferences("rest-timer", Context.MODE_PRIVATE);
            uriStr = sp.getString("ringtoneUri", null);
        } catch (Throwable ignored) { }
        if (uriStr == null || uriStr.isEmpty() || "default".equals(uriStr)) {
            playShortBeep(ctx);
            return;
        }
        try {
            android.net.Uri uri = android.net.Uri.parse(uriStr);
            Ringtone r = RingtoneManager.getRingtone(ctx, uri);
            if (r == null) {
                playShortBeep(ctx);
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                r.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            }
            current = r;
            r.play();
        } catch (Throwable t) {
            Log.e("RestTimerAlarm", "playChosen failed, fallback beep", t);
            playShortBeep(ctx);
        }
    }
}
