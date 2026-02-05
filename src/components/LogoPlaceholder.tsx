"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  style?: React.CSSProperties;
};

let cachedLogoUrl: string | null | undefined;
let logoLoadPromise: Promise<string | null> | null = null;

function readThemeMode(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-tp-mode");
  if (attr === "light" || attr === "dark") return attr;
  const stored = window.localStorage.getItem("tp_theme_mode");
  return stored === "light" ? "light" : "dark";
}

function readModeLogoFromLocalStorage(mode: "dark" | "light"): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("tp_logo_urls_by_mode");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<"dark" | "light", string>>;
    const url = String(parsed?.[mode] ?? "").trim();
    return url || null;
  } catch {
    return null;
  }
}

async function loadLogoUrl(): Promise<string | null> {
  if (cachedLogoUrl !== undefined) return cachedLogoUrl;
  if (logoLoadPromise) return logoLoadPromise;
  logoLoadPromise = (async () => {
    const { data } = await supabase
      .from("ui_branding")
      .select("logo_url")
      .limit(1)
      .maybeSingle();
    cachedLogoUrl = (data?.logo_url as string | null) ?? null;
    return cachedLogoUrl;
  })();
  const url = await logoLoadPromise;
  logoLoadPromise = null;
  return url;
}

export default function LogoPlaceholder({ style }: Props) {
  const [logoUrl, setLogoUrl] = React.useState<string | null | undefined>(
    cachedLogoUrl
  );
  const [mode, setMode] = React.useState<"dark" | "light">("dark");

  React.useEffect(() => {
    const applyFromMode = (nextMode: "dark" | "light") => {
      setMode(nextMode);
      const byMode = readModeLogoFromLocalStorage(nextMode);
      if (byMode) {
        setLogoUrl(byMode);
        return;
      }
      if (logoUrl === undefined) {
        void loadLogoUrl().then((url) => setLogoUrl(url));
      }
    };

    applyFromMode(readThemeMode());

    const observer = new MutationObserver(() => {
      applyFromMode(readThemeMode());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-tp-mode"],
    });

    const onStorage = () => applyFromMode(readThemeMode());
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onStorage);
    };
  }, [logoUrl]);

  return (
    <div style={{ ...styles.wrap, ...(style ?? null) }} aria-hidden>
      {logoUrl ? (
        <img src={logoUrl} alt="" style={styles.logoImg} />
      ) : (
        <div
          style={{
            ...styles.wordmark,
            color: mode === "light" ? "black" : "white",
          }}
        >
          MERVILLE PRIME
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    background: "transparent",
  },
  wordmark: {
    fontSize: 13,
    letterSpacing: 2.2,
    fontWeight: 900,
    color: "white",
    textAlign: "center",
    lineHeight: 1.2,
    userSelect: "none",
    opacity: 0.5,
  },
  logoImg: {
    width: "auto",
    height: "50%",
    maxWidth: "80%",
    objectFit: "contain",
    opacity: 0.5,
    userSelect: "none",
    pointerEvents: "none",
  },
};
