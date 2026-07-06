import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "./_components/layout/ThemeProvider";
import BackgroundEffects from "./_components/common/ParticleBg";
import DanmakuBackground from "./_components/layout/DanmakuBackground";
import ClickEffect from "./_components/common/ClickEffect";
import SplashScreen from "./_components/layout/SplashScreen";
import MaskOverlay from "./_components/common/MaskOverlay";
import Live2DWidget from "./_components/Live2DWidgetWrapper";
import { siteConfig } from "@/lib/siteConfig";
import { defaultOgImage, SITE_KEYWORDS, SITE_URL } from "@/lib/seo";
import BackgroundSlider from "@/app/_components/layout/BackgroundSwitcher";

const geistSans = localFont({
  src: "../public/fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "../public/fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const notoSerif = localFont({
  src: "../public/fonts/noto-serif-sc-latin.woff2",
  variable: "--font-serif",
  weight: "400 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: siteConfig.title, template: `%s | ${siteConfig.title}` },
  description: siteConfig.seoDescription,
  keywords: SITE_KEYWORDS,
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.seoDescription,
    siteName: siteConfig.title,
    type: "website",
    locale: "zh_CN",
    images: [{ url: defaultOgImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.seoDescription,
    images: [defaultOgImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              #app-mount-root { opacity: 0; visibility: hidden; pointer-events: none; }
              html.splash-seen #app-mount-root { opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (sessionStorage.getItem('hasSeenSplash') === 'true') {
                  document.documentElement.classList.add('splash-seen');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="w-full overflow-y-scroll min-h-full flex flex-col relative transition-colors duration-1000 bg-slate-50 dark:bg-slate-950 font-serif">
        <ThemeProvider>
          <SplashScreen />
          <div id="app-mount-root" className="flex-1 flex flex-col min-h-0 transition-opacity duration-1000">
            {/* Background layers */}
            <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
              <BackgroundSlider />
              <MaskOverlay />
              <div
                className="absolute inset-0 z-[-8] opacity-60 dark:opacity-20 mix-blend-color transition-opacity duration-1000 transform-gpu"
                style={{
                  background: "linear-gradient(-45deg, #a18cd1, #fbc2eb, #a1c4fd, #c2e9fb)",
                  backgroundSize: "400% 400%",
                  animation: "gradientMove 15s ease infinite",
                }}
              />
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/40 dark:bg-indigo-900/20 blur-[100px] rounded-full z-[-7] md:mix-blend-overlay" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/30 dark:bg-purple-900/30 blur-[100px] rounded-full z-[-7] md:mix-blend-overlay" />
              <div className="hidden md:block absolute inset-0 w-full h-full">
                <BackgroundEffects />
              </div>
            </div>

            {/* Content */}
            <div className="hidden md:block">
              <DanmakuBackground />
            </div>
            <div className="relative z-10 flex-1 flex flex-col min-h-0">{children}</div>
            <ClickEffect />
            <Live2DWidget />
          </div>

          <style
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: `
              @keyframes gradientMove {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
            `,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
