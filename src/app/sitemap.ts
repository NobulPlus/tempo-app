import type { MetadataRoute } from "next";
import { listPitches, listGames, listProfiles } from "@/lib/data/repo";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tempo.ng";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pitches, games, players] = await Promise.all([
    listPitches(),
    listGames(),
    listProfiles(),
  ]);

  const staticRoutes = [
    "",
    "/pitches",
    "/games",
    "/players",
    "/host",
    "/signup",
    "/legal/terms",
    "/legal/privacy",
    "/legal/refunds",
    "/legal/community",
  ].map((path) => ({
    url: `${SITE}${path}`,
    lastModified: new Date(),
    changeFrequency: (path === "" || path === "/games" ? "daily" : "weekly") as
      | "daily"
      | "weekly",
    priority: path === "" ? 1 : 0.8,
  }));

  return [
    ...staticRoutes,
    ...pitches.map((p) => ({
      url: `${SITE}/pitches/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...games.map((g) => ({
      url: `${SITE}/games/${g.slug}`,
      lastModified: new Date(g.createdAt),
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
    ...players.map((p) => ({
      url: `${SITE}/players/${p.handle}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
