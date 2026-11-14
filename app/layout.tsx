import type { Metadata, Viewport } from "next";
import "github-markdown-css/github-markdown-dark.css";
import "highlight.js/styles/github-dark.css";
import "./print-light.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "MD Studio - Markdown viewer & editor",
  description: "A fast, dark, developer-friendly markdown editor with live preview and on-page annotations.",
};
export const viewport: Viewport = { themeColor: "#0b0f14", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
