import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #00e676, #00c853)",
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#06210f">
          <path d="M4 9a3 3 0 0 1 3-3h9.5a3.5 3.5 0 1 1 0 7H15l-2.2 3.3A3 3 0 0 1 10.3 18H7a3 3 0 0 1-3-3V9zm12.5 2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
