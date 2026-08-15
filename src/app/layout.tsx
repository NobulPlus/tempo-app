import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { getCurrentUser } from "@/lib/session";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tempo.ng";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Tempo — Find a pitch, book a pitch, join a game in Lagos",
    template: "%s · Tempo",
  },
  description:
    "Tempo helps footballers in Lagos find verified pitches, book a slot in under a minute, and join open games with real players. Built in Lagos, for Lagos.",
  keywords: [
    "football Lagos",
    "book a pitch Lagos",
    "5-a-side Lagos",
    "7-a-side Lagos",
    "astro turf Lagos",
    "Lekki football pitch",
    "Ikoyi football",
  ],
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: "Tempo",
    title: "Tempo — Lagos football, finally organised",
    description:
      "Find verified pitches, book instantly, and join open games with real players across Lagos.",
    url: SITE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Tempo — Lagos football, finally organised",
    description: "Find a pitch, book a pitch, join a game.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1c",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="en-NG">
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-green focus:px-4 focus:py-2 focus:font-semibold focus:text-[#04150c]"
        >
          Skip to content
        </a>

        <Nav user={user} />

        <main id="main" className="pt-[71px]">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
