import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { AccentProvider } from "@/components/providers/accent-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CaliTrack — Suivi de performance calisthénie",
  description:
    "Suis tes séances de calisthénie, tes variantes de progression (full planche, straddle, tuck...) et visualise tes performances avec des tableaux de bord détaillés.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  other: {
    "theme-color": "#18181b",
  },
  keywords: [
    "calisthenics",
    "calisthénie",
    "suivi séance",
    "planche",
    "front lever",
    "poids du corps",
    "progression",
  ],
  authors: [{ name: "CaliTrack" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <AccentProvider>
              <QueryProvider>
                {children}
                <SonnerToaster position="top-center" richColors closeButton />
              </QueryProvider>
            </AccentProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
