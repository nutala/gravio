package com.gravio.app;

import android.app.AlarmManager;
import android.app.Application;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import java.io.FileWriter;
import java.io.PrintWriter;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RestTimer")
public class RestTimerPlugin extends Plugin {

    static final String ACTION_FINISHED = "com.gravio.app.REST_TIMER_FINISHED";

    private static final int ALARM_REQUEST_CODE = 3001;
    private static final String PREFS = "rest-timer";
    private static final String KEY_ENDS_AT = "endsAt";

    private BroadcastReceiver finishReceiver;

    @Override
    public void load() {
        super.load();
        try {
            finishReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    notifyListeners("restTimerFinished", new JSObject());
                }
            };
            getContext().registerReceiver(finishReceiver, new IntentFilter(ACTION_FINISHED));
        } catch (Throwable t) {
            Log.e("RestTimer", "register finishReceiver failed", t);
        }

        // When the app returns to the foreground, if a rest timer has already
        // ended (its WebView JS was frozen / the app was killed while in the
        // background), force the completion so the in-app UI never stays stuck
        // on 0s. The native alarm (sound + notification) still fired on time.
        try {
            final Application app = (Application) getContext().getApplicationContext();
            app.registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
                @Override public void onActivityResumed(android.app.Activity a) {
                    try {
                        SharedPreferences sp = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                        long endsAt = sp.getLong(KEY_ENDS_AT, 0);
                        if (endsAt > 0 && System.currentTimeMillis() >= endsAt) {
                            notifyListeners("restTimerFinished", new JSObject());
                        }
                    } catch (Throwable ignored) { }
                }
                @Override public void onActivityCreated(android.app.Activity a, android.os.Bundle b) { }
                @Override public void onActivityStarted(android.app.Activity a) { }
                @Override public void onActivityPaused(android.app.Activity a) { }
                @Override public void onActivityStopped(android.app.Activity a) { }
                @Override public void onActivitySaveInstanceState(android.app.Activity a, android.os.Bundle b) { }
                @Override public void onActivityDestroyed(android.app.Activity a) { }
            });
        } catch (Throwable t) {
            Log.e("RestTimer", "register lifecycle callback failed", t);
        }
    }

    private static void storeEndsAt(Context ctx, long delayMs) {
        try {
            SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            long ends = System.currentTimeMillis() + Math.max(0, delayMs);
            long existing = sp.getLong(KEY_ENDS_AT, 0);
            // Keep the latest (largest) end time if several timers overlap.
            if (ends > existing) sp.edit().putLong(KEY_ENDS_AT, ends).apply();
        } catch (Throwable ignored) { }
    }

    private static void clearEndsAt(Context ctx) {
        try {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_ENDS_AT).apply();
        } catch (Throwable ignored) { }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (finishReceiver != null) getContext().unregisterReceiver(finishReceiver);
        } catch (Throwable ignored) { }
        super.handleOnDestroy();
    }

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
            storeEndsAt(context, delayMs.longValue());
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
        RestTimerAlarmSound.stop();
        clearEndsAt(context);
        call.resolve();
    }

    @PluginMethod
    public void stopAlarmSound(PluginCall call) {
        RestTimerAlarmSound.stop();
        clearEndsAt(getContext());
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
            storeEndsAt(context, delayMs.longValue());

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
        RestTimerAlarmSound.stop();
        clearEndsAt(context);

        call.resolve();
    }

    // ── JS error capture (diagnostics) ──

    @PluginMethod
    public void logError(PluginCall call) {
        String message = call.getString("message", "");
        Log.e("RestTimerJS", message);
        try {
            java.io.File f = new java.io.File(
                "/sdcard/Android/data/com.gravio.app/files/resttimer_js_crash.txt"
            );
            FileWriter fw = new FileWriter(f, true);
            PrintWriter pw = new PrintWriter(fw);
            pw.println(message);
            pw.close();
        } catch (Throwable ignored) { }
        try {
            final String msg = message;
            new Handler(Looper.getMainLooper()).post(() ->
                Toast.makeText(getContext(), "JS err: " + msg, Toast.LENGTH_LONG).show()
            );
        } catch (Throwable ignored) { }
        call.resolve();
    }
}
