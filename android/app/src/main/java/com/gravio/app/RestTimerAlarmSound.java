package com.gravio.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

/**
 * Shared, stoppable alarm sound. The foreground service and the AlarmManager
 * backup both play through here so a single reference is kept and can be
 * stopped from the JS side (dismiss / tap) via the plugin.
 */
public final class RestTimerAlarmSound {
    private static Ringtone current;

    private RestTimerAlarmSound() { }

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
}
