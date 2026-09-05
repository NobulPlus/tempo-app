import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://playtempo11.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/bookings/", "/setup", "/login", "/venue"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
