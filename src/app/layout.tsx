import type { Metadata, Viewport } from "next";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const display = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
});

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Mint Finance",
  title: "Mint Finance",
  description:
    "Connect banks with Plaid, save transactions in MongoDB, and filter by institution.",
  appleWebApp: {
    capable: true,
    title: "Mint",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f6a4f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <head>
        {/* Next emits mobile-web-app-capable; keep the Apple-prefixed tag for iOS Home Screen. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
