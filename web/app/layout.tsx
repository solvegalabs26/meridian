import type { Metadata } from "next";
import "./globals.css";

// TODO: update favicon with official Meridian Arc beacon mark
export const metadata: Metadata = {
  title: "Meridian Arc — The home screen of your life",
  description: "Meridian Arc — Persistent Objective State intelligence platform by Solvega Labs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
