"use client";

import * as React from "react";

type Props = {
  rating: number;
  size?: number;
  color?: string;
  emptyColor?: string;
};

function Star({ filled, size, color, emptyColor }: { filled: boolean; size: number; color: string; emptyColor: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 3.6l2.62 5.3 5.85.85-4.23 4.12 1 5.82L12 16.9l-5.24 2.79 1-5.82L3.53 9.75l5.85-.85L12 3.6Z"
        fill={filled ? color : "none"}
        stroke={filled ? color : emptyColor}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ReviewStars({
  rating,
  size = 16,
  color = "#d9ad4d",
  emptyColor = "rgba(255,255,255,0.28)",
}: Props) {
  const safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          filled={index < safeRating}
          size={size}
          color={color}
          emptyColor={emptyColor}
        />
      ))}
    </div>
  );
}
