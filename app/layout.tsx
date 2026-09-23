import type { Metadata } from "next";
import { Geist, Newsreader } from "next/font/google";
import "./globals.css";
import Grid from "./Grid";
import NowPlaying from "./NowPlaying";
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-news",
  subsets: ["latin"],
  weight: "500",
});

export const metadata: Metadata = {
  title: "Adith Mohanty",
  description:
    "Adith Mohanty, builder working on AI systems, developer tools, and full-stack products. Data Science and Applied Math at UC Berkeley.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Grid />
        <NowPlaying />
      </body>
    </html>
  );
}
