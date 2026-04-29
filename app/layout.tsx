import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Ignit",
  description:
    "A personalized micro-action planner that turns overwhelming tasks into safe, low-resistance starts."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
