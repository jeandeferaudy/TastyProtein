// src/components/ui.tsx
"use client";

import * as React from "react";

export const TOPBAR_FONT_SIZE_DESKTOP = 16;
export const TOPBAR_FONT_SIZE_MOBILE = 15;
export const TOPBAR_FONT_SIZE = TOPBAR_FONT_SIZE_DESKTOP;

export const UI = {
  // Primary dark button style (matches cart Checkout button)
  btn: {
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--tp-border-color)",
    background: "var(--tp-control-bg)",
    color: "var(--tp-text-color)",
    padding: "15px 15px",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 900 as const,
    letterSpacing: 0.1,
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    userSelect: "none" as const,
    WebkitTapHighlightColor: "transparent",
  },

  // Compact dark button for +/- and compact controls
  btnGhost: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 900 as const,
    letterSpacing: 0.1,
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    userSelect: "none" as const,
    WebkitTapHighlightColor: "transparent",
  },

  // Inverted button style for light backgrounds (navbar)
  btnNav: {
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--tp-nav-fg)",
    background: "transparent",
    color: "var(--tp-nav-fg)",
    padding: "10px 15px",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700 as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    whiteSpace: "nowrap" as const,
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    userSelect: "none" as const,
    WebkitTapHighlightColor: "transparent",
  },

  btnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};

type AppButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "ghost" | "nav";
};

export function AppButton({
  variant = "solid",
  disabled,
  style,
  ...props
}: AppButtonProps) {
  const base =
    variant === "ghost" ? UI.btnGhost : variant === "nav" ? UI.btnNav : UI.btn;

  return (
    <button
      {...props}
      disabled={disabled}
      type={props.type ?? "button"}
      style={{
        ...base,
        ...(disabled ? UI.btnDisabled : null),
        ...(style ?? null),
      }}
    />
  );
}

type PenIconProps = {
  size?: number;
};

export function PenIcon({ size = 16 }: PenIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M4 20h3.7l10-10-3.7-3.7-10 10V20Zm12.6-12.6 1.2-1.2a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-1.2 1.2-3-3Z"
        fill="currentColor"
      />
    </svg>
  );
}

type GearIconProps = {
  size?: number;
};

export function GearIcon({ size = 16 }: GearIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="2.2" fill="currentColor" />
      <circle cx="15" cy="12" r="2.2" fill="currentColor" />
      <circle cx="11" cy="17" r="2.2" fill="currentColor" />
    </svg>
  );
}

type QtyIconProps = {
  type: "plus" | "minus";
};

// Shared glyph for all cart qty controls. The mark is always 50% of button size.
export function QtyIcon({ type }: QtyIconProps) {
  return (
    <svg viewBox="0 0 24 24" width="50%" height="50%" aria-hidden="true">
      <path
        d={type === "plus" ? "M12 5v14M5 12h14" : "M5 12h14"}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

type RemoveIconProps = {
  size?: number;
};

export function RemoveIcon({ size = 16 }: RemoveIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default AppButton;
