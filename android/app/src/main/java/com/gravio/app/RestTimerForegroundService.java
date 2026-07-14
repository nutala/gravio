package com.gravio.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.CountDownTimer;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.widget.Toast;

import java.io.FileWriter;
import java.io.PrintWriter;

public class RestTimerForegroundService extends Service {

    private static final String CHANNEL_COUNTDOWN = "rest-fg-countdown";
    private static final String CHANNEL_ALARM = "rest-alarm-v2";
    private static final int NOTIF_COUNTDOWN = 2002;
    private static final int NOTIF_ALARM = 2003;
    private static final String TAG = "RestTimerFGS";

    private CountDownTimer timer;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannels(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            long totalMs = intent != null ? intent.getLongExtra("totalMs", 0) : 0;
            if (totalMs <= 0) {
                stopSelf();
                return START_NOT_STICKY;
            }

            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.cancel(NOTIF_ALARM);

            // Promote to a foreground service IMMEDIATELY (before anything that
            // could throw) so the system never raises
            // ForegroundServiceDidNotStartInTimeException.
            startForegroundSafe(NOTIF_COUNTDOWN, buildCountdownNotification(this, totalMs));

            if (timer != null) timer.cancel();
            timer = new CountDownTimer(totalMs, 1000L) {
                @Override
                public void onTick(long millisUntilFinished) {
                    try {
                        NotificationManager n = getSystemService(NotificationManager.class);
                        if (n != null) {
                            n.notify(NOTIF_COUNTDOWN, buildCountdownNotification(
                                RestTimerForegroundService.this, millisUntilFinished));
                        }
                    } catch (Throwable t) {
                        logError("onTick", t);
                    }
                }

                @Override
                public void onFinish() {
                    onTimerFinished(RestTimerForegroundService.this);
                    stopSelf();
                }
            }.start();
        } catch (Throwable t) {
            logError("onStartCommand", t);
            showToast("FGS err: " + t.getClass().getSimpleName() + " " + t.getMessage());
            // Fallback: guarantee the timer still rings even if the service fails.
            long totalMs = intent != null ? intent.getLongExtra("totalMs", 0) : 0;
            if (totalMs > 0) RestTimerAlarmReceiver.scheduleExact(this, totalMs);
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (timer != null) timer.cancel();
        // NOTE: do NOT stop the alarm sound here — the ringtone is meant to
        // keep playing (until the user dismisses it) even after this service
        // stops. stopSelf() is called right after the ringtone starts, so
        // stopping here would cut the alarm instantly.
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void startForegroundSafe(int id, Notification notif) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(id, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(id, notif);
        }
    }

    // ── helpers ──

    private static void createChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel countdown = new NotificationChannel(
            CHANNEL_COUNTDOWN, "Rest Timer",
            NotificationManager.IMPORTANCE_LOW
        );
        countdown.setDescription("Compte à rebours du repos");
        countdown.setShowBadge(false);
        countdown.setSound(null, null);
        nm.createNotificationChannel(countdown);

        NotificationChannel alarm = new NotificationChannel(
            CHANNEL_ALARM, "Rest Timer Alarm",
            NotificationManager.IMPORTANCE_HIGH
        );
        alarm.setDescription("Alarme de fin de repos");
        alarm.enableVibration(true);
        alarm.setBypassDnd(true);
        // The audible alarm is played explicitly via Ringtone; keep the channel
        // silent to avoid a doubled sound.
        nm.createNotificationChannel(alarm);
    }

    private static String formatTime(long ms) {
        int sec = (int) Math.ceil(ms / 1000.0);
        int m = sec / 60;
        int s = sec % 60;
        return String.format("%02d:%02d", m, s);
    }

    private static int getIconRes(Context ctx) {
        int icon = ctx.getResources().getIdentifier(
            "ic_stat_icon", "drawable", ctx.getPackageName()
        );
        return icon != 0 ? icon : android.R.drawable.ic_lock_idle_alarm;
    }

    private static PendingIntent buildTapIntent(Context ctx) {
        Intent tapIntent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (tapIntent == null) {
            // Fallback: a no-op intent so PendingIntent.getActivity never gets null.
            tapIntent = new Intent(ctx, MainActivity.class);
            tapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }
        return PendingIntent.getActivity(
            ctx, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static Notification buildCountdownNotification(Context ctx, long ms) {
        String time = formatTime(ms);

        Notification.Builder b = new Notification.Builder(ctx, CHANNEL_COUNTDOWN)
            .setSmallIcon(getIconRes(ctx))
            .setContentTitle("⏱ " + time)
            .setContentText("Temps restant : " + time)
            .setContentIntent(buildTapIntent(ctx))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_PROGRESS)
            .setVisibility(Notification.VISIBILITY_PUBLIC);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            // pre-O: channel id is ignored
        }
        return b.build();
    }

    private static void onTimerFinished(Context ctx) {
        try {
            // Cancel the Doze-proof backup alarm: the foreground service is
            // handling the end itself, so we don't want the AlarmManager
            // backup to also fire (would double the notification/sound).
            RestTimerAlarmReceiver.cancelExact(ctx);

            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.cancel(NOTIF_COUNTDOWN);

            Notification.Builder b = new Notification.Builder(ctx, CHANNEL_ALARM)
                .setSmallIcon(getIconRes(ctx))
                .setContentTitle("⏱ Repos terminé !")
                .setContentText("C'est reparti pour une série !")
                .setContentIntent(buildTapIntent(ctx))
                .setAutoCancel(true)
                .setOngoing(false)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setPriority(Notification.PRIORITY_MAX);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                b.setVibrate(new long[]{400, 150, 400, 150, 200, 150, 600, 200, 600});
            } else {
                b.setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE);
            }

            if (nm != null) nm.notify(NOTIF_ALARM, b.build());

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Vibrator v = ctx.getSystemService(Vibrator.class);
                if (v != null) v.vibrate(VibrationEffect.createWaveform(
                    new long[]{0, 400, 150, 400, 150, 200, 150, 600, 200, 600}, -1
                ));
            }

            // Play the alarm sound explicitly through the ALARM stream so it is
            // audible even when the device is locked / in Doze (notification
            // channel sound is unreliable across OEMs). This is the actual
            // audible alarm; the notification above is the visual + vibration.
            RestTimerAlarmSound.play(ctx);

            // Tell the WebView the timer ended so the in-app UI completes even
            // if its JS timers were frozen while backgrounded.
            try {
                ctx.sendBroadcast(new Intent(RestTimerPlugin.ACTION_FINISHED));
            } catch (Throwable ignored) { }
        } catch (Throwable t) {
            Log.e(TAG, "onTimerFinished failed", t);
        }
    }
    // ── diagnostics ──

    private void showToast(final String msg) {
        try {
            new Handler(Looper.getMainLooper()).post(() ->
                Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
            );
        } catch (Throwable ignored) { }
    }

    private static void logError(String where, Throwable t) {
        Log.e(TAG, where + " failed", t);
        try {
            java.io.File f = new java.io.File(
                "/sdcard/Android/data/com.gravio.app/files/resttimer_fgs_crash.txt"
            );
            FileWriter fw = new FileWriter(f, true);
            PrintWriter pw = new PrintWriter(fw);
            pw.println("[" + where + "] " + t.getClass().getName() + ": " + t.getMessage());
            t.printStackTrace(pw);
            pw.close();
        } catch (Throwable ignored) { }
    }
}
