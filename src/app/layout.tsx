import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Caveat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { getCurrentUser } from "@/lib/session";
import { demoMode, getWalletBalance } from "@/lib/data/repo";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tempo.ng";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["600", "700", "800"],
});
const body = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  weight: ["400", "500", "600", "700"],
});
const accent = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["600", "700"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Tempo — Find a facility, book a facility, join a game in Lagos",
    template: "%s · Tempo",
  },
  description:
    "Tempo helps players in Lagos find verified sports facilities, book a slot in under a minute, and join open games with real players. Built in Lagos, for Lagos.",
  keywords: [
    "sport Lagos",
    "book a facility Lagos",
    "find a game Lagos",
    "5-a-side Lagos",
    "7-a-side Lagos",
    "astro turf Lagos",
    "Lekki sports facility",
    "Ikoyi sport",
  ],
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: "Tempo",
    title: "Tempo — Lagos sport, finally organised",
    description:
      "Find verified facilities, book instantly, and join open games with real players across Lagos.",
    url: SITE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Tempo — Lagos sport, finally organised",
    description: "Find a facility, book a facility, join a game.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE },
};

export const viewport: Viewport = {
  themeColor: "#0b0f0c",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const isDemo = demoMode();
  const walletBalanceKobo = user ? await getWalletBalance(user.id) : 0;

  return (
    <html
      lang="en-NG"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable} ${accent.variable} ${mono.variable}`}
    >
      <body className="antialiased">
        <script
          // Runs before paint so a returning visitor's saved theme applies
          // immediately — no flash of the wrong theme. Kept tiny and inline
          // deliberately; this is the one script allowed to run before React.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("tempo-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-green focus:px-4 focus:py-2 focus:font-semibold focus:text-[#051530]"
        >
          Skip to content
        </a>

        <Nav user={user} isDemo={isDemo} walletBalanceKobo={walletBalanceKobo} />

        <main id="main" className="pt-[71px]">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
