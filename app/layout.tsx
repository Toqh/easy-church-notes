import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyChurchNotes — A little space for the Word",
  description: "Thoughtful notes for sermons, quiet time, and everything God is teaching you.",
  applicationName: "EasyChurchNotes",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "EasyChurchNotes", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};
export const viewport:Viewport={themeColor:[{media:"(prefers-color-scheme: light)",color:"#FBFBF9"},{media:"(prefers-color-scheme: dark)",color:"#131d2b"}]};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
