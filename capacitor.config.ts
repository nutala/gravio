import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.calistrack.app',
  appName: 'Gravio',
  webDir: 'native-assets',
  server: {
    url: process.env.CAP_SERVER_URL || "https://gravio.onrender.com",
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#10b981',
    },
  },
};

export default config;
