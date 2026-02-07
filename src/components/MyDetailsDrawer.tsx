"use client";

import * as React from "react";
import { AppButton } from "@/components/ui";
import { supabase } from "@/lib/supabase";

type Props = {
  isOpen: boolean;
  topOffset: number;
  userId: string | null;
  backgroundStyle?: React.CSSProperties;
  onClose: () => void;
};

type Draft = {
  first_name: string;
  last_name: string;
  phone: string;
  attention_to: string;
  line1: string;
  line2: string;
  barangay: string;
  city: string;
  province: string;
  postal_code: string;
  delivery_note: string;
  country: string;
};

const EMPTY_DRAFT: Draft = {
  first_name: "",
  last_name: "",
  phone: "",
  attention_to: "",
  line1: "",
  line2: "",
  barangay: "",
  city: "",
  province: "",
  postal_code: "",
  delivery_note: "",
  country: "Philippines",
};

export default function MyDetailsDrawer({
  isOpen,
  topOffset,
  userId,
  backgroundStyle,
  onClose,
}: Props) {
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [isWideDesktop, setIsWideDesktop] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const lastSavedRef = React.useRef<string>("");

  React.useEffect(() => {
    const onResize = () => setIsWideDesktop(window.innerWidth >= 1280);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    if (!isOpen || !userId) return;
    setSaved(false);
    setError("");
    setLoading(true);
    setHasLoaded(false);

    const loadProfile = async () => {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(
          "first_name,last_name,phone,attention_to,address_line1,address_line2,barangay,city,province,postal_code,delivery_note,country"
        )
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setDraft(EMPTY_DRAFT);
        setLoading(false);
        return;
      }

      setDraft({
        first_name: data?.first_name ?? "",
        last_name: data?.last_name ?? "",
        phone: data?.phone ?? "",
        attention_to: data?.attention_to ?? "",
        line1: data?.address_line1 ?? "",
        line2: data?.address_line2 ?? "",
        barangay: data?.barangay ?? "",
        city: data?.city ?? "",
        province: data?.province ?? "",
        postal_code: data?.postal_code ?? "",
        delivery_note: data?.delivery_note ?? "",
        country: "Philippines",
      });
      lastSavedRef.current = JSON.stringify({
        first_name: data?.first_name ?? "",
        last_name: data?.last_name ?? "",
        phone: data?.phone ?? "",
        attention_to: data?.attention_to ?? "",
        line1: data?.address_line1 ?? "",
        line2: data?.address_line2 ?? "",
        barangay: data?.barangay ?? "",
        city: data?.city ?? "",
        province: data?.province ?? "",
        postal_code: data?.postal_code ?? "",
        delivery_note: data?.delivery_note ?? "",
        country: "Philippines",
      });
      setHasLoaded(true);
      setLoading(false);
    };

    loadProfile();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;
  const rowStyle = isWideDesktop ? styles.fieldRowDesktop : styles.fieldRowMobile;
  const labelStyle = isWideDesktop ? styles.labelDesktop : styles.label;
  const textAreaRowStyle = isWideDesktop
    ? { ...styles.fieldRowDesktop, alignItems: "start" }
    : styles.fieldRowMobile;

  const setField = (k: keyof Draft, v: string) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [k]: v }));
  };

  const saveIfChanged = async () => {
    if (!isOpen || !userId || !hasLoaded) return;
    const draftSnapshot = JSON.stringify(draft);
    if (draftSnapshot === lastSavedRef.current) return;

    setError("");
    setLoading(true);

    const payload = {
      first_name: draft.first_name || null,
      last_name: draft.last_name || null,
      phone: draft.phone || null,
      attention_to: draft.attention_to || null,
      address_line1: draft.line1 || null,
      address_line2: draft.line2 || null,
      barangay: draft.barangay || null,
      city: draft.city || null,
      province: draft.province || null,
      postal_code: draft.postal_code || null,
      delivery_note: draft.delivery_note || null,
      country: "Philippines",
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
      setSaved(false);
    } else {
      setSaved(true);
      lastSavedRef.current = draftSnapshot;
      window.setTimeout(() => setSaved(false), 1200);
    }
    setLoading(false);
  };

  return (
    <>
      <div
        style={{
          ...styles.backdrop,
          ...(backgroundStyle ?? null),
          top: panelTop,
          height: panelHeight,
        }}
      />
      <aside
        className="tp-drawer-slide-up"
        style={{
          ...styles.panel,
          ...(backgroundStyle ?? null),
          top: panelTop,
          height: panelHeight,
        }}
      >
        <div style={styles.topRow}>
          <AppButton variant="ghost" style={styles.backBtn} onClick={onClose}>
            BACK
          </AppButton>
          <div style={styles.title}>PROFILE</div>
        </div>

        <div
          style={{
            ...styles.content,
            ...(isMobileViewport ? { padding: "8px 10px 20px" } : null),
          }}
        >
          <div style={styles.card}>
            <div style={styles.row2}>
              <div style={rowStyle}>
                <label style={labelStyle}>First name</label>
                <input style={styles.input} value={draft.first_name} onChange={(e) => setField("first_name", e.target.value)} onBlur={saveIfChanged} />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Last name</label>
                <input style={styles.input} value={draft.last_name} onChange={(e) => setField("last_name", e.target.value)} onBlur={saveIfChanged} />
              </div>
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Attention to</label>
              <input style={styles.input} value={draft.attention_to} onChange={(e) => setField("attention_to", e.target.value)} onBlur={saveIfChanged} />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Phone number</label>
              <input style={styles.input} value={draft.phone} onChange={(e) => setField("phone", e.target.value)} onBlur={saveIfChanged} />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Line 1</label>
              <input style={styles.input} value={draft.line1} onChange={(e) => setField("line1", e.target.value)} onBlur={saveIfChanged} />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Line 2</label>
              <input style={styles.input} value={draft.line2} onChange={(e) => setField("line2", e.target.value)} onBlur={saveIfChanged} />
            </div>

            <div style={styles.row2}>
              <div style={rowStyle}>
                <label style={labelStyle}>Barangay</label>
                <input style={styles.input} value={draft.barangay} onChange={(e) => setField("barangay", e.target.value)} onBlur={saveIfChanged} />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>City</label>
                <input style={styles.input} value={draft.city} onChange={(e) => setField("city", e.target.value)} onBlur={saveIfChanged} />
              </div>
            </div>

            <div style={styles.row2}>
              <div style={rowStyle}>
                <label style={labelStyle}>Province</label>
                <input style={styles.input} value={draft.province} onChange={(e) => setField("province", e.target.value)} onBlur={saveIfChanged} />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Postal code</label>
                <input style={styles.input} value={draft.postal_code} onChange={(e) => setField("postal_code", e.target.value)} onBlur={saveIfChanged} />
              </div>
            </div>

            <div style={textAreaRowStyle}>
              <label style={labelStyle}>Delivery note</label>
              <textarea
                style={styles.textarea}
                value={draft.delivery_note}
                onChange={(e) => setField("delivery_note", e.target.value)}
                onBlur={saveIfChanged}
                placeholder="Gate code, landmark, preferred time, etc."
              />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Country</label>
              <input style={{ ...styles.input, opacity: 0.8 }} value={draft.country} disabled />
            </div>

            <div style={styles.footer}>
              {error ? <div style={styles.error}>{error}</div> : null}
              <div
                aria-live="polite"
                style={{
                  ...styles.savedToast,
                  opacity: saved ? 1 : 0,
                  transform: saved ? "translateY(0)" : "translateY(6px)",
                }}
              >
                SAVED
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    left: 0,
    right: 0,
    background: "transparent",
    zIndex: 860,
  },
  panel: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    width: "var(--tp-rail-width)",
    background: "transparent",
    zIndex: 910,
    display: "flex",
    flexDirection: "column",
    boxShadow: "none",
    border: "none",
  },
  topRow: {
    minHeight: 64,
    display: "flex",
    alignItems: "center",
    gap: 40,
    padding: "18px 0 15px",
  },
  backBtn: {
    width: 68,
    minWidth: 68,
    height: 36,
    padding: 0,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 1,
    border: "none",
    background: "transparent",
    justifyContent: "flex-start",
    textAlign: "left",
  },
  title: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 2,
    color: "var(--tp-text-color)",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 0 44px 108px",
  },
  card: {
    maxWidth: "min(1120px, 100%)",
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: 0,
    color: "var(--tp-text-color)",
  },
  row2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    columnGap: 20,
    rowGap: 10,
  },
  fieldRowMobile: {
    display: "grid",
    gap: 0,
  },
  fieldRowDesktop: {
    display: "grid",
    gridTemplateColumns: "140px 1fr",
    alignItems: "center",
    columnGap: 16,
    marginTop: 4,
  },
  label: {
    display: "block",
    fontSize: 15,
    opacity: 0.85,
    marginTop: 10,
    marginBottom: 6,
  },
  labelDesktop: {
    display: "block",
    fontSize: 15,
    opacity: 0.85,
    marginTop: 0,
    marginBottom: 0,
    whiteSpace: "nowrap",
  },
  input: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 15px",
  },
  textarea: {
    width: "100%",
    minHeight: 92,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "10px 15px",
    resize: "vertical",
  },
  footer: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 54,
  },
  error: {
    fontSize: 15,
    color: "#ff9f9f",
    maxWidth: 420,
    marginBottom: 8,
    textAlign: "center",
  },
  savedToast: {
    minWidth: 84,
    height: 27,
    borderRadius: 7,
    background: "rgba(34, 163, 74, 0.5)",
    color: "var(--tp-text-color)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1,
    transition: "opacity 220ms ease, transform 220ms ease",
    pointerEvents: "none",
  },
};
