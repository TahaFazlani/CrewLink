import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrewLink",
  description: "Union announcement and callout slice",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Browser extensions inject attributes here before hydration. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
