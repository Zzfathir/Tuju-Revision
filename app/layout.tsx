import type { Metadata, Viewport } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./tokens.css";
import "./wireframe.css";
import "./journey.css";
import "./landing.css";
import "./map-first.css";
import "./presentation.css";
import "./cruise.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Jalan Pulang",
  description: "Plan your balik kampung drive from Kuala Lumpur to Ipoh.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true },
  icons: { apple: "/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#f5faf8", viewportFit: "cover" };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <AppShell />
    <div className="presentation-stage">
      <div className="presentation-phone" data-testid="presentation-phone">
        <div className="presentation-screen" data-testid="presentation-screen">{children}</div>
      </div>
    </div>
  </body></html>;
}
