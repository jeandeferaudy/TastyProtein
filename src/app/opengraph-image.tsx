import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "The Steak Kitchen";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(circle at top, rgba(210,166,63,0.16), transparent 34%), linear-gradient(135deg, #050505 0%, #121212 48%, #1a1813 100%)",
          color: "#f5efe1",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.14,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "64px 74px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              color: "#d4af37",
              textTransform: "uppercase",
              letterSpacing: 4,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            <div
              style={{
                width: 66,
                height: 2,
                background: "#d4af37",
                opacity: 0.88,
              }}
            />
            Premium Quality
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 22,
              maxWidth: 900,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 0.94,
                textTransform: "uppercase",
                fontWeight: 800,
                color: "#d4af37",
                textShadow: "0 10px 30px rgba(0,0,0,0.4)",
              }}
            >
              <span style={{ fontSize: 44, letterSpacing: 5 }}>The</span>
              <span style={{ fontSize: 100, letterSpacing: 2 }}>Steak Kitchen</span>
            </div>

            <div
              style={{
                display: "flex",
                fontSize: 38,
                lineHeight: 1.24,
                color: "#f5efe1",
                maxWidth: 860,
              }}
            >
              Great steaks and delicious food delivered to your home.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "rgba(245,239,225,0.82)",
              fontSize: 24,
              letterSpacing: 1,
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <span>Premium cuts</span>
              <span style={{ color: "#d4af37" }}>•</span>
              <span>Delivered chilled or frozen</span>
            </div>
            <div style={{ color: "#d4af37", fontWeight: 700 }}>The Steak Kitchen</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
