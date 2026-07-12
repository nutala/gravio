package com.gravio.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.CountDownTimer;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;

public class RestTimerForegroundService extends Service {

    private static final String CHANNEL_COUNTDOWN = "rest-fg-countdown";
    private static final String CHANNEL_ALARM = "rest-alarm-plugin";
    private static final int NOTIF_COUNTDOWN = 2002;
    private static final int NOTIF_ALARM = 2003;

    private CountDownTimer timer;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannels(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        long totalMs = intent.getLongExtra("totalMs", 0);
        if (totalMs <= 0) {
            stopSelf();
            return START_NOT_STICKY;
        }

        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.cancel(NOTIF_ALARM);

        startForeground(NOTIF_COUNTDOWN, buildCountdownNotification(this, totalMs));

        timer = new CountDownTimer(totalMs, 1000L) {
            @Override
            public void onTick(long millisUntilFinished) {
                NotificationManager nm = getSystemService(NotificationManager.class);
                nm.notify(NOTIF_COUNTDOWN, buildCountdownNotification(
                    RestTimerForegroundService.this, millisUntilFinished
                ));
            }

            @Override
            public void onFinish() {
                onTimerFinished(RestTimerForegroundService.this);
                stopSelf();
            }
        }.start();

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (timer != null) timer.cancel();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── helpers ──

    private static void createChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);

        NotificationChannel countdown = new NotificationChannel(
            CHANNEL_COUNTDOWN, "Rest Timer",
            NotificationManager.IMPORTANCE_LOW
        );
        countdown.setDescription("Compte à rebours du repos");
        countdown.setShowBadge(false);
        nm.createNotificationChannel(countdown);

        NotificationChannel alarm = new NotificationChannel(
            CHANNEL_ALARM, "Rest Timer Alarm",
            NotificationManager.IMPORTANCE_HIGH
        );
        alarm.setDescription("Alarme de fin de repos");
        alarm.enableVibration(true);
        alarm.setBypassDnd(true);
        nm.createNotificationChannel(alarm);
    }

    private static String formatTime(long ms) {
        int sec = (int) Math.ceil(ms / 1000.0);
        int m = sec / 60;
        int s = sec % 60;
        return String.format("%02d:%02d", m, s);
    }

    private static Notification buildCountdownNotification(Context ctx, long ms) {
        String time = formatTime(ms);

        Intent tapIntent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = PendingIntent.getActivity(
            ctx, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder b = new Notification.Builder(ctx, CHANNEL_COUNTDOWN)
            .setSmallIcon(getIconRes(ctx))
            .setContentTitle("⏱ " + time)
            .setContentText("Temps restant : " + time)
            .setContentIntent(pi)
            .setOngoing(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b.setChannelId(CHANNEL_COUNTDOWN);
        }
        return b.build();
    }

    private static void onTimerFinished(Context ctx) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        nm.cancel(NOTIF_COUNTDOWN);

        Intent tapIntent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = PendingIntent.getActivity(
            ctx, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder b = new Notification.Builder(ctx, CHANNEL_ALARM)
            .setSmallIcon(getIconRes(ctx))
            .setContentTitle("⏱ Repos terminé !")
            .setContentText("C'est reparti pour une série !")
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setVibrate(new long[]{400, 150, 400, 150, 200, 150, 600, 200, 600})
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setPriority(Notification.PRIORITY_HIGH);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b.setChannelId(CHANNEL_ALARM);
        } else {
            b.setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE);
        }

        nm.notify(NOTIF_ALARM, b.build());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Vibrator v = ctx.getSystemService(Vibrator.class);
            if (v != null) v.vibrate(VibrationEffect.createWaveform(
                new long[]{0, 400, 150, 400, 150, 200, 150, 600, 200, 600}, -1
            ));
        }
    }

    private static int getIconRes(Context ctx) {
        int icon = ctx.getResources().getIdentifier(
            "ic_stat_icon", "drawable", ctx.getPackageName()
        );
        return icon != 0 ? icon : android.R.drawable.ic_lock_idle_alarm;
    }
}
