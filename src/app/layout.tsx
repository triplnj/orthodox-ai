import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { productCopy } from "@/lib/productCopy";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "OrthodoxAI",
  description: productCopy.heroSubtitle,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-950 antialiased">
  <div className="flex min-h-screen flex-col">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <Navbar />

    <div id="main-content" tabIndex={-1} className="flex-1">{children}</div>

    <Footer />
  </div>
</body>
    </html>
  );
}
