import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Use Case Catalog",
  description: "Your product work, indexed for recall.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
