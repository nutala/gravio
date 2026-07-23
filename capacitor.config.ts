import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gravio.app',
  appName: 'Gravio',
  webDir: 'native-assets',
  server: {
    url: process.env.CAP_SERVER_URL || "https://gravio.onrender.com",
    cleartext: true,
    allowNavigation: [
      "accounts.google.com",
      "google.com",
      "*.google.com",
      "gravio.onrender.com",
      "*.gravio.onrender.com",
    ],
  },
  plugins: {
    Keyboard: {
      resize: "body",
      style: "DARK",
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#10b981',
    },
    SocialLogin: {
      providers: {
        google: true,
        apple: false,
        facebook: false,
        twitter: false,
      },
    },
  },
};

export default config;
