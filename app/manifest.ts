import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "360 - Center of Research",
    short_name: "360 Research",
    description: "Workspace terpusat untuk project dan kolaborasi riset.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ed",
    theme_color: "#193246",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon.png", sizes: "any", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "any", type: "image/png", purpose: "maskable" },
    ],
  };
}
