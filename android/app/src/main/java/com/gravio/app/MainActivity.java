package com.gravio.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RestTimerPlugin.class);
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);

            NotificationChannel alarmChannel = new NotificationChannel(
                RestTimerAlarmReceiver.CHANNEL_ID,
                "Rest Timer Alarm",
                NotificationManager.IMPORTANCE_HIGH
            );
            alarmChannel.setDescription("Alarme de fin de repos");
            alarmChannel.enableVibration(true);
            alarmChannel.setBypassDnd(true);
            nm.createNotificationChannel(alarmChannel);

            NotificationChannel restAlarm = nm.getNotificationChannel("rest-alarm");
            if (restAlarm == null) {
                restAlarm = new NotificationChannel(
                    "rest-alarm",
                    "Rest Timer (Legacy)",
                    NotificationManager.IMPORTANCE_HIGH
                );
                restAlarm.setDescription("Timer de repos terminé (legacy)");
                restAlarm.enableVibration(true);
                restAlarm.setBypassDnd(true);
                nm.createNotificationChannel(restAlarm);
            }

            NotificationChannel restCountdown = nm.getNotificationChannel("rest-countdown");
            if (restCountdown == null) {
                restCountdown = new NotificationChannel(
                    "rest-countdown",
                    "Rest Timer Countdown",
                    NotificationManager.IMPORTANCE_LOW
                );
                restCountdown.setDescription("Compte à rebours du repos");
                nm.createNotificationChannel(restCountdown);
            }
        }
    }
}
