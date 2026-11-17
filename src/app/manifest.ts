import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tempo — Book a facility, join a game",
    short_name: "Tempo",
    description:
      "Find verified sports facilities, book a slot in under a minute, and join open games with real players across Lagos.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0b0f0c",
    theme_color: "#0b0f0c",
    categories: ["sports", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
