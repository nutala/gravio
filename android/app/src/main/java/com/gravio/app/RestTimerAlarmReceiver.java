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
    static final String CHANNEL_ID = "rest-alarm-plugin";
    private static final int NOTIFICATION_ID = 2001;

    @Override
    public void onReceive(Context context, Intent intent) {
        createChannel(context);
        showNotification(context);
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

    private void showNotification(Context context) {
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(
            context.getPackageName()
        );
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int iconRes = context.getResources().getIdentifier(
            "ic_stat_icon", "drawable", context.getPackageName()
        );
        if (iconRes == 0) {
            iconRes = android.R.drawable.ic_lock_idle_alarm;
        }

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(context);
            builder.setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE);
        }

        builder.setSmallIcon(iconRes)
            .setContentTitle("⏱ Repos terminé !")
            .setContentText("C'est reparti pour une série !")
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(Notification.PRIORITY_HIGH)
            .setVibrate(new long[]{400, 150, 400, 150, 200, 150, 600, 200, 600})
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC);

        NotificationManager nm = context.getSystemService(NotificationManager.class);
        nm.notify(NOTIFICATION_ID, builder.build());
    }
}
