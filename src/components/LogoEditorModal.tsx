"use client";

import * as React from "react";
import { AppButton } from "@/components/ui";

type Props = {
  isOpen: boolean;
  initialUrl: string;
  saving?: boolean;
  error?: string;
  themeMode?: "dark" | "light";
  onThemeModeChange?: (next: "dark" | "light") => void;
  onClose: () => void;
  onSave: (nextUrl: string) => void;
  onUploadFile: (file: File) => Promise<string>;
};

export default function LogoEditorModal({
  isOpen,
  initialUrl,
  saving = false,
  error = "",
  themeMode,
  onThemeModeChange,
  onClose,
  onSave,
  onUploadFile,
}: Props) {
  const [url, setUrl] = React.useState<string>(initialUrl);
  const [uploading, setUploading] = React.useState<boolean>(false);
  const [localError, setLocalError] = React.useState<string>("");

  React.useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl);
      setLocalError("");
      setUploading(false);
    }
  }, [initialUrl, isOpen]);

  if (!isOpen) return null;
  const isLight = themeMode === "light";
  const modalThemeStyle: React.CSSProperties = isLight
    ? styles.modalLight
    : styles.modalDark;

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={{ ...styles.modal, ...modalThemeStyle }}>
        <div style={styles.top}>
          <div style={styles.title}>EDIT LOGO</div>
          <AppButton variant="ghost" style={styles.closeBtn} onClick={onClose}>
            CLOSE
          </AppButton>
        </div>

        {themeMode && onThemeModeChange ? (
          <>
            <label style={styles.label}>Logo mode</label>
            <div style={styles.row}>
              <AppButton
                variant="ghost"
                style={{
                  ...styles.modeBtn,
                  ...(themeMode === "dark" ? styles.modeBtnActiveBlue : null),
                }}
                onClick={() => onThemeModeChange("dark")}
              >
                DARK
              </AppButton>
              <AppButton
                variant="ghost"
                style={{
                  ...styles.modeBtn,
                  ...(themeMode === "light" ? styles.modeBtnActiveBlue : null),
                }}
                onClick={() => onThemeModeChange("light")}
              >
                LIGHT
              </AppButton>
            </div>
          </>
        ) : null}

        <label style={styles.label}>Logo URL</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          style={styles.input}
        />

        <div style={styles.uploadRow}>
          <label style={styles.uploadBtn}>
            {uploading ? "UPLOADING..." : "UPLOAD LOGO"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setLocalError("");
                  setUploading(true);
                  const uploadedUrl = await onUploadFile(file);
                  setUrl(uploadedUrl);
                } catch (err) {
                  setLocalError(err instanceof Error ? err.message : "Upload failed.");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>

        <label style={styles.label}>Preview</label>
        <div style={styles.preview}>
          {url.trim() ? (
            <img src={url.trim()} alt="Logo preview" style={styles.previewImg} />
          ) : (
            <div style={styles.previewEmpty}>No logo selected</div>
          )}
        </div>

        {localError ? <div style={styles.error}>{localError}</div> : null}
        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.footer}>
          <AppButton variant="ghost" style={styles.footerBtn} onClick={onClose}>
            CANCEL
          </AppButton>
          <AppButton
            variant="ghost"
            style={styles.footerBtn}
            onClick={() => onSave(url.trim())}
            disabled={saving || uploading}
          >
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
    color: "var(--tp-text-color)",
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
  label: {
    display: "block",
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 6,
    marginTop: 8,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 8,
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
  input: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 12px",
  },
  uploadRow: {
    marginTop: 10,
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
  preview: {
    height: 110,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--tp-control-bg-soft)",
    overflow: "hidden",
  },
  previewImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  previewEmpty: {
    fontSize: 13,
    opacity: 0.65,
    letterSpacing: 0.5,
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
