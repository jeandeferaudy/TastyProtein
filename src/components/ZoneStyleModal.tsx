"use client";

import * as React from "react";
import { AppButton } from "@/components/ui";

export type ZoneStyleDraft = {
  bg_type: "color" | "image";
  bg_color: string;
  bg_image_url: string;
};

type Props = {
  isOpen: boolean;
  zoneLabel: string;
  initial: ZoneStyleDraft;
  saving?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (next: ZoneStyleDraft) => void;
  onUploadFile?: (file: File) => Promise<string>;
  themeMode?: "dark" | "light";
  onThemeModeChange?: (next: "dark" | "light") => void;
};

export default function ZoneStyleModal({
  isOpen,
  zoneLabel,
  initial,
  saving = false,
  error = "",
  onClose,
  onSave,
  onUploadFile,
  themeMode,
  onThemeModeChange,
}: Props) {
  const [draft, setDraft] = React.useState<ZoneStyleDraft>(initial);
  const [localError, setLocalError] = React.useState<string>("");

  React.useEffect(() => {
    if (isOpen) {
      setDraft(initial);
      setLocalError("");
    }
  }, [initial, isOpen]);

  if (!isOpen) return null;
  const isLight = themeMode === "light";
  const modalThemeStyle: React.CSSProperties = isLight
    ? styles.modalLight
    : styles.modalDark;
  const activeBlueBtn: React.CSSProperties = styles.modeBtnActiveBlue;

  const previewStyle: React.CSSProperties =
    draft.bg_type === "image" && draft.bg_image_url.trim()
      ? {
          backgroundImage: `url("${draft.bg_image_url.trim()}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundColor: draft.bg_color || "#000000",
        }
      : { backgroundColor: draft.bg_color || "#000000" };

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={{ ...styles.modal, ...modalThemeStyle }}>
        <div style={styles.top}>
          <div style={styles.title}>STYLE {zoneLabel.toUpperCase()}</div>
          <AppButton variant="ghost" style={styles.closeBtn} onClick={onClose}>
            CLOSE
          </AppButton>
        </div>

        {themeMode && onThemeModeChange ? (
          <>
            <label style={styles.label}>Text & border mode</label>
            <div style={styles.row}>
              <AppButton
                variant="ghost"
                style={{
                  ...styles.modeBtn,
                  ...(themeMode === "dark" ? activeBlueBtn : null),
                }}
                onClick={() => onThemeModeChange("dark")}
              >
                DARK
              </AppButton>
              <AppButton
                variant="ghost"
                style={{
                  ...styles.modeBtn,
                  ...(themeMode === "light" ? activeBlueBtn : null),
                }}
                onClick={() => onThemeModeChange("light")}
              >
                LIGHT
              </AppButton>
            </div>
          </>
        ) : null}

        <div style={styles.row}>
          <AppButton
            variant="ghost"
            style={{
              ...styles.modeBtn,
              ...(draft.bg_type === "color" ? activeBlueBtn : null),
            }}
            onClick={() => setDraft((prev) => ({ ...prev, bg_type: "color" }))}
          >
            COLOR
          </AppButton>
          <AppButton
            variant="ghost"
            style={{
              ...styles.modeBtn,
              ...(draft.bg_type === "image" ? activeBlueBtn : null),
            }}
            onClick={() => setDraft((prev) => ({ ...prev, bg_type: "image" }))}
          >
            IMAGE
          </AppButton>
        </div>

        <label style={styles.label}>Background color</label>
        <div style={styles.colorRow}>
          <input
            type="color"
            value={draft.bg_color || "#000000"}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, bg_color: e.target.value }))
            }
            style={styles.colorInput}
          />
          <input
            type="text"
            value={draft.bg_color}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, bg_color: e.target.value }))
            }
            placeholder="#000000"
            style={styles.input}
          />
        </div>

        {draft.bg_type === "image" ? (
          <>
            <label style={styles.label}>Image URL</label>
            <input
              type="text"
              value={draft.bg_image_url}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, bg_image_url: e.target.value }))
              }
              placeholder="https://..."
              style={styles.input}
            />
            {onUploadFile ? (
              <div style={styles.uploadRow}>
                <label style={styles.uploadBtn}>
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setLocalError("");
                        const url = await onUploadFile(file);
                        setDraft((prev) => ({ ...prev, bg_image_url: url }));
                      } catch (err) {
                        setLocalError(
                          err instanceof Error ? err.message : "Upload failed."
                        );
                      }
                    }}
                  />
                </label>
              </div>
            ) : null}
          </>
        ) : null}

        <label style={styles.label}>Preview</label>
        <div style={{ ...styles.preview, ...previewStyle }} />

        {localError ? <div style={styles.error}>{localError}</div> : null}
        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.footer}>
          <AppButton variant="ghost" style={styles.footerBtn} onClick={onClose}>
            CANCEL
          </AppButton>
          <AppButton variant="ghost" style={styles.footerBtn} onClick={() => onSave(draft)} disabled={saving}>
            {saving ? "SAVING..." : "SAVE"}
          </AppButton>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    zIndex: 1300,
  },
  modal: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(92vw, 520px)",
    background: "#111",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 14,
    padding: 16,
    zIndex: 1310,
    color: "white",
  },
  modalDark: {
    background: "#111",
    borderColor: "rgba(255,255,255,0.18)",
    color: "#fff",
  },
  modalLight: {
    background: "#f7f7f7",
    borderColor: "rgba(17,17,17,0.22)",
    color: "#111",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 1.4,
  },
  closeBtn: {
    height: 34,
    borderRadius: 8,
    padding: "0 10px",
    fontSize: 13,
    letterSpacing: 0.8,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 10,
  },
  modeBtn: {
    height: 36,
    borderRadius: 8,
    padding: "0 10px",
    fontSize: 13,
    letterSpacing: 0.8,
  },
  modeBtnActiveBlue: {
    borderColor: "#3aaaf5",
    background: "rgba(58,170,245,0.18)",
    color: "#7fd1ff",
  },
  label: {
    display: "block",
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 6,
    marginTop: 8,
  },
  colorRow: {
    display: "grid",
    gridTemplateColumns: "48px 1fr",
    gap: 8,
  },
  colorInput: {
    width: 48,
    height: 40,
    border: "1px solid var(--tp-border-color)",
    borderRadius: 8,
    background: "transparent",
    padding: 0,
  },
  input: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 12px",
  },
  preview: {
    height: 90,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
  },
  uploadRow: {
    marginTop: 8,
  },
  uploadBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 10px",
    fontSize: 13,
    letterSpacing: 0.8,
    cursor: "pointer",
  },
  error: {
    marginTop: 8,
    color: "#ff9f9f",
    fontSize: 13,
  },
  footer: {
    marginTop: 14,
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
  footerBtn: {
    height: 36,
    minWidth: 88,
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
};
