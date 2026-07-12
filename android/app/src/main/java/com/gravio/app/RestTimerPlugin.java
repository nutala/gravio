package com.gravio.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RestTimer")
public class RestTimerPlugin extends Plugin {

    private static final int ALARM_REQUEST_CODE = 3001;

    // ── Foreground service (primary, most reliable) ──

    @PluginMethod
    public void startForegroundTimer(PluginCall call) {
        Double delayMs = call.getDouble("delayMs");
        if (delayMs == null || delayMs < 0) {
            call.reject("delayMs must be a positive number");
            return;
        }

        Context context = getContext();
        Intent intent = new Intent(context, RestTimerForegroundService.class);
        intent.putExtra("totalMs", delayMs.longValue());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
        call.resolve();
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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            AlarmManager.AlarmClockInfo alarmClock = new AlarmManager.AlarmClockInfo(
                triggerTime,
                pendingIntent
            );
            alarmManager.setAlarmClock(alarmClock, pendingIntent);
        } else {
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
        }

        call.resolve();
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
