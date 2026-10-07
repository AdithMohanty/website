import type { Metadata } from "next";
import { Geist, Newsreader } from "next/font/google";
import "./globals.css";
import Grid from "./Grid";
import NowPlaying from "./NowPlaying";
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);if(sessionStorage.getItem('rainbow')==='on')document.documentElement.setAttribute('data-rainbow','');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-news",
  subsets: ["latin"],
  weight: "500",
});

// What search results and link previews show. Change the text here.
const title = "Adith Mohanty";
const description =
  "Adith Mohanty — Data Science and Applied Math at UC Berkeley. Building AI products across infrastructure, finance, and developer tools; previously at IBM and Cisco.";

// Structured data so search engines tie this site to the same person as the profiles below.
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: title,
  url: "https://adithmohanty.com",
  alumniOf: { "@type": "CollegeOrUniversity", name: "University of California, Berkeley" },
  sameAs: [
    "https://linkedin.com/in/adithmohanty",
    "https://github.com/adithmohanty",
    "https://www.instagram.com/adithjm/",
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://adithmohanty.com"),
  title: { default: title, template: `%s · ${title}` },
  description,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: title,
    type: "website",
  },
  twitter: { card: "summary", title, description },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body>
        {children}
        <Grid />
        <NowPlaying />
      </body>
    </html>
  );
}
