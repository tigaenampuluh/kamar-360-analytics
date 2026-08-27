import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "360 - Center of Research — Project Workspace",
  description: "Workspace terpusat untuk melacak, menjadwalkan, dan mengarsipkan project riset.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
