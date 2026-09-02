import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseCheck — Engagement Rate Checker",
  description: "Analisis engagement rate Instagram, TikTok, dan YouTube dalam satu dashboard.",
  applicationName: "PulseCheck",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PulseCheck",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
