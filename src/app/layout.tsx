import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeToggle from "./components/ThemeToggle";
import ChartTooltipDismiss from "./components/ChartTooltipDismiss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Turiec pod Lupou — transparentnosť hospodárenia mesta Martin",
  description:
    "Verejná kontrola hospodárenia mesta Martin a jeho podnikov: zmluvy z CRZ, dodávatelia, mestské podniky, eurofondy, kontroly NKÚ a sľuby politikov — z overených verejných registrov.",
};

// Runs before paint to set the theme class → no flash of wrong theme (FOUC).
const themeInit = `(function(){try{var m=localStorage.getItem('theme');var d=m==='dark'||((!m||m==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sk"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ThemeToggle />
        <ChartTooltipDismiss />
      </body>
    </html>
  );
}
