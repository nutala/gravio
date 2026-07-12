package com.gravio.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RestTimer")
public class RestTimerPlugin extends Plugin {

    private static final int ALARM_REQUEST_CODE = 3001;

    // ── Battery optimization exemption (critical on Samsung / Xiaomi / etc.) ──

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        Context context = getContext();
        boolean ignoring = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            ignoring = pm != null && pm.isIgnoringBatteryOptimizations(context.getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("ignoring", ignoring);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            ret.put("ignoring", true);
            call.resolve(ret);
            return;
        }

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean ignoring = pm != null && pm.isIgnoringBatteryOptimizations(context.getPackageName());
        ret.put("ignoring", ignoring);

        if (!ignoring) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } catch (Exception e) {
                // Fallback: open the generic battery optimization settings list.
                try {
                    Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                } catch (Exception ignored) { }
            }
        }

        call.resolve(ret);
    }

    // ── Foreground service (primary, most reliable) ──

    @PluginMethod
    public void startForegroundTimer(PluginCall call) {
        Double delayMs = call.getDouble("delayMs");
        if (delayMs == null || delayMs < 0) {
            call.reject("delayMs must be a positive number");
            return;
        }

        try {
            Context context = getContext();
            Intent intent = new Intent(context, RestTimerForegroundService.class);
            intent.putExtra("totalMs", delayMs.longValue());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            call.resolve();
        } catch (Throwable t) {
            // Surface the real cause so we can diagnose remote crashes.
            call.reject("startForegroundTimer failed: " + t.getMessage());
        }
    }

    @PluginMethod
    public void stopForegroundTimer(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, RestTimerForegroundService.class);
        context.stopService(intent);
        call.resolve();
    }

    // ── Legacy AlarmManager backup ──

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        Double delayMs = call.getDouble("delayMs");
        if (delayMs == null || delayMs < 0) {
            call.reject("delayMs must be a positive number");
            return;
        }

        try {
            Context context = getContext();
            RestTimerAlarmReceiver.ensureChannel(context);

            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            Intent intent = new Intent(context, RestTimerAlarmReceiver.class);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                ALARM_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            long triggerTime = System.currentTimeMillis() + delayMs.longValue();

            boolean canExact = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                canExact = alarmManager.canScheduleExactAlarms();
            }

            if (canExact) {
                // Exact, Doze-proof alarm (requires USE_EXACT_ALARM, granted at install).
                AlarmManager.AlarmClockInfo alarmClock = new AlarmManager.AlarmClockInfo(
                    triggerTime,
                    pendingIntent
                );
                alarmManager.setAlarmClock(alarmClock, pendingIntent);
            } else {
                // Fallback: inexact but crash-free if exact-alarm perm is missing.
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
            }

            call.resolve();
        } catch (Exception e) {
            call.reject("scheduleAlarm failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        Intent intent = new Intent(context, RestTimerAlarmReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        alarmManager.cancel(pendingIntent);
        pendingIntent.cancel();

        call.resolve();
    }
}
