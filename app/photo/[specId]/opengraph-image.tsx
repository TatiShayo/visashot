import { ImageResponse } from "next/og";
import { getSpec, formatDimensions } from "@/data/photo-specs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: { specId: string } }) {
  const spec = getSpec(params.specId);
  const title = spec ? spec.displayName : "VisaShot";
  const dims = spec ? formatDimensions(spec) : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#2563eb", letterSpacing: -1, fontWeight: 700 }}>
          VISASHOT
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            color: "#1b2a4a",
            fontWeight: 700,
            marginTop: 24,
            letterSpacing: -2,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        {dims && (
          <div style={{ display: "flex", fontSize: 32, color: "#44506b", marginTop: 24, fontFamily: "monospace" }}>
            {dims} · App-approved · $4.99
          </div>
        )}
      </div>
    ),
    {
      ...size,
      // Spec pages are static content — let CDNs cache the OG image for a day
      // instead of re-rendering it per crawler hit.
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
