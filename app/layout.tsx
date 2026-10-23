import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyChurchNotes — A little space for the Word",
  description: "Thoughtful notes for sermons, quiet time, and everything God is teaching you.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

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
