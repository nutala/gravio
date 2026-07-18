package com.gravio.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class RestTimerAlarmReceiver extends BroadcastReceiver {
    static final String CHANNEL_ID = "rest-alarm-v2";

    @Override
    public void onReceive(Context context, Intent intent) {
        createChannel(context);
        // Single end emitter shared with the foreground service (guarded
        // against duplicates by RestTimerAlarmSound.endHandled).
        RestTimerAlarmSound.fireEndAlarm(context);
    }

    private static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Rest Timer Alarm",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Timer de repos terminé");
            channel.enableVibration(true);
            channel.setBypassDnd(true);
            // The actual audible alarm is played explicitly via Ringtone (see
            // playAlarmRingtone); keep the channel itself silent to avoid a
            // doubled sound.
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            nm.createNotificationChannel(channel);
        }
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
            if (existing == null) {
                createChannel(context);
            }
        }
    }

    /**
     * Schedule the reliable, Doze-proof wake-up alarm even when called from a
     * non-Activity context (e.g. the foreground service fallback). Used as a
     * backup if the foreground service itself fails to start.
     */
    static void scheduleExact(Context context, long delayMs) {
        try {
            ensureChannel(context);
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent intent = new Intent(context, RestTimerAlarmReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(
                context, 3001, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            long trigger = System.currentTimeMillis() + Math.max(0, delayMs);
            boolean canExact = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                canExact = am.canScheduleExactAlarms();
            }
            if (canExact) {
                AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(trigger, pi);
                am.setAlarmClock(info, pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi);
            }
        } catch (Throwable t) {
            Log.e("RestTimerAlarm", "scheduleExact failed", t);
        }
    }

    /** Cancel the backup alarm (e.g. when the foreground service finishes first). */
    static void cancelExact(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent intent = new Intent(context, RestTimerAlarmReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(
                context, 3001, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            am.cancel(pi);
            pi.cancel();
        } catch (Throwable ignored) { }
    }

    private void showNotification(Context context) {
        // Retained for API compatibility; the actual end alarm is emitted via
        // RestTimerAlarmSound.fireEndAlarm (called from onReceive) so it stays
        // a single, duplicate-free source shared with the foreground service.
    }
}
