"use client";

import * as React from "react";
import { AppButton } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import type { DbProduct, ProductImage } from "@/lib/products";
import LogoPlaceholder from "@/components/LogoPlaceholder";

type Props = {
  isOpen: boolean;
  topOffset: number;
  product: DbProduct | null;
  images: ProductImage[];
  backgroundStyle?: React.CSSProperties;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onDeleted?: () => Promise<void> | void;
};

type Draft = {
  name: string;
  long_name: string;
  description: string;
  type: string;
  size: string;
  size_g: string;
  temperature: string;
  country_of_origin: string;
  selling_price: string;
  thumbnail_url: string;
  keywords: string;
  status: string;
  sort: string;
};

type ImageRow = {
  id: string;
  sort_order: number;
  url: string;
};

const PRODUCT_IMAGE_BUCKET = "product-images";
const STATUS_OPTIONS = ["Active", "Disabled", "Archived"] as const;
type SizeUnit = "g" | "ml";

function buildAutoKeywords(draft: Draft, computedSizeText: string): string {
  const parts = [
    draft.name,
    draft.long_name,
    draft.type,
    draft.temperature,
    draft.country_of_origin,
    computedSizeText || draft.size,
    draft.size_g ? `${draft.size_g}g` : "",
    draft.description,
    draft.status,
    draft.keywords,
  ]
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  const deduped = Array.from(new Set(parts));
  return deduped.join(" ");
}

function toDraft(p: DbProduct): Draft {
  const rawStatus = String(p.status ?? "active").toLowerCase();
  const uiStatus =
    rawStatus === "disabled"
      ? "Disabled"
      : rawStatus === "archived"
        ? "Archived"
        : "Active";
  return {
    name: p.name ?? "",
    long_name: p.long_name ?? "",
    description: p.description ?? "",
    type: p.type ?? "",
    size: p.size ?? "",
    size_g: p.size_g != null ? String(p.size_g) : "",
    temperature: p.temperature ?? "",
    country_of_origin: p.country_of_origin ?? "",
    selling_price: p.selling_price != null ? String(p.selling_price) : "",
    thumbnail_url: p.thumbnail_url ?? "",
    keywords: p.keywords ?? "",
    status: uiStatus,
    sort: p.sort != null ? String(p.sort) : "",
  };
}

function detectSizeUnit(sizeText: string | null | undefined): SizeUnit {
  const s = String(sizeText ?? "").toLowerCase();
  if (s.includes("ml") || /\bl\b/.test(s)) return "ml";
  return "g";
}

function formatAutoSizeText(rawAmount: string, unit: SizeUnit): string {
  const n = Number(rawAmount.trim());
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 1000) {
    const converted = n / 1000;
    const compact = Number.isInteger(converted) ? String(converted) : converted.toFixed(2).replace(/\.?0+$/, "");
    return unit === "g" ? `${compact} kg` : `${compact} L`;
  }
  return unit === "g" ? `${n} g` : `${n} ml`;
}

export default function ProductEditorDrawer({
  isOpen,
  topOffset,
  product,
  images,
  backgroundStyle,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [imageRows, setImageRows] = React.useState<ImageRow[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [dragOverUpload, setDragOverUpload] = React.useState(false);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [sizeUnit, setSizeUnit] = React.useState<SizeUnit>("g");
  const [error, setError] = React.useState("");
  const [savedNoticeAt, setSavedNoticeAt] = React.useState<number>(0);
  const [deleting, setDeleting] = React.useState(false);
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const lastSavedSnapshotRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!product) {
      setDraft(null);
      setImageRows([]);
      return;
    }
    setDraft(toDraft(product));
    setSizeUnit(detectSizeUnit(product.size));
    setImageRows(
      images
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((img) => ({ id: img.id, sort_order: img.sort_order, url: img.url }))
    );
    setError("");
    const initialSnapshot = JSON.stringify({
      draft: toDraft(product),
      sizeUnit: detectSizeUnit(product.size),
      images: images
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((img) => ({ sort_order: img.sort_order, url: img.url.trim() })),
    });
    lastSavedSnapshotRef.current = initialSnapshot;
  }, [product, images]);

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!isOpen || !product || !draft) return null;

  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;
  const autoSizeText = formatAutoSizeText(draft.size_g, sizeUnit);

  const setField = (k: keyof Draft, v: string) => setDraft((prev) => (prev ? { ...prev, [k]: v } : prev));

  const removeImage = (id: string) => {
    setImageRows((prev) => prev.filter((row) => row.id !== id));
    setTimeout(() => {
      void save();
    }, 0);
  };

  const reindexRows = (rows: ImageRow[]) => {
    return rows.map((row, index) => ({ ...row, sort_order: index + 1 }));
  };

  const reorderImage = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setImageRows((prev) => {
      const fromIndex = prev.findIndex((r) => r.id === fromId);
      const toIndex = prev.findIndex((r) => r.id === toId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return reindexRows(next);
    });
    setTimeout(() => {
      void save();
    }, 0);
  };

  const moveImage = (id: string, dir: -1 | 1) => {
    setImageRows((prev) => {
      const index = prev.findIndex((row) => row.id === id);
      if (index < 0) return prev;
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return reindexRows(next);
    });
    setTimeout(() => {
      void save();
    }, 0);
  };

  const setImageOrder = (id: string, nextOrderRaw: string) => {
    const nextOrder = Number(nextOrderRaw);
    if (Number.isNaN(nextOrder)) return;
    setImageRows((prev) => {
      const bounded = Math.max(1, Math.min(prev.length, nextOrder));
      const fromIndex = prev.findIndex((row) => row.id === id);
      if (fromIndex < 0) return prev;
      const toIndex = bounded - 1;
      if (fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return reindexRows(next);
    });
    setTimeout(() => {
      void save();
    }, 0);
  };

  const uploadToStorage = async (
    file: File,
    kind: "thumb" | "gallery"
  ): Promise<string> => {
    const extension = file.name.includes(".")
      ? file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      : "jpg";
    const safeExt = extension.replace(/[^a-z0-9]/g, "") || "jpg";
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 9);
    const pid = String(product.id);
    const path = `${pid}/${kind}-${stamp}-${rand}.${safeExt}`;

    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const handleImageFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setError("");
    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of list) {
        const url = await uploadToStorage(file, "gallery");
        uploadedUrls.push(url);
      }
      setImageRows((prev) => {
        const merged = [...prev];
        for (const url of uploadedUrls) {
          merged.push({
            id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sort_order: merged.length + 1,
            url,
          });
        }
        return reindexRows(merged);
      });
      setTimeout(() => {
        void save();
      }, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleThumbnailFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Thumbnail must be an image file.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const url = await uploadToStorage(file, "thumb");
      setField("thumbnail_url", url);
      setTimeout(() => {
        void save();
      }, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thumbnail upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setError("");
    const nextSnapshot = JSON.stringify({
      draft,
      sizeUnit,
      images: reindexRows(imageRows).map((row) => ({
        sort_order: row.sort_order,
        url: row.url.trim(),
      })),
    });
    if (nextSnapshot === lastSavedSnapshotRef.current) return;
    setSaving(true);
    try {
      const selling = draft.selling_price.trim() ? Number(draft.selling_price) : null;
      const sizeG = draft.size_g.trim() ? Number(draft.size_g) : null;
      const sortValue = draft.sort.trim() ? Number(draft.sort) : null;

      if (selling != null && Number.isNaN(selling)) throw new Error("Selling price must be a number.");
      if (sizeG != null && Number.isNaN(sizeG)) throw new Error("Size (g) must be a number.");
      if (sortValue != null && Number.isNaN(sortValue)) throw new Error("Sort must be a number.");

      const autoKeywords = buildAutoKeywords(draft, autoSizeText);
      const productPayload = {
        name: draft.name || null,
        long_name: draft.long_name || null,
        description: draft.description || null,
        type: draft.type || null,
        size: autoSizeText || null,
        size_g: sizeG,
        temperature: draft.temperature || null,
        country_of_origin: draft.country_of_origin || null,
        selling_price: selling,
        thumbnail_url: draft.thumbnail_url || null,
        keywords: autoKeywords || null,
        status: draft.status || null,
        sort: sortValue,
      };

      const { data: updatedRows, error: updateErr } = await supabase
        .from("products")
        .update(productPayload)
        .eq("id", product.id)
        .select("id");
      if (updateErr) throw updateErr;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          "Product was not updated. Check admin role/RLS permissions."
        );
      }

      const { error: delErr } = await supabase
        .from("product_images")
        .delete()
        .eq("product_id", product.id);
      if (delErr) throw delErr;

      const cleaned = reindexRows(imageRows)
        .map((row) => ({ ...row, url: row.url.trim() }))
        .filter((row) => row.url)
        .sort((a, b) => a.sort_order - b.sort_order);

      if (cleaned.length > 0) {
        const payload = cleaned.map((row) => ({
          product_id: product.id,
          sort_order: row.sort_order,
          url: row.url,
        }));
        const { error: insErr } = await supabase.from("product_images").insert(payload);
        if (insErr) throw insErr;
      }

      await onSaved();
      lastSavedSnapshotRef.current = nextSnapshot;
      setSavedNoticeAt(Date.now());
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message?: unknown }).message ?? "Failed to save.")
            : "Failed to save.";
      const details =
        typeof e === "object" && e !== null && "details" in e
          ? String((e as { details?: unknown }).details ?? "")
          : "";
      const hint =
        typeof e === "object" && e !== null && "hint" in e
          ? String((e as { hint?: unknown }).hint ?? "")
          : "";
      setError([message, details, hint].filter(Boolean).join(" — "));
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSave = () => {
    void save();
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Delete this product? This cannot be undone."
    );
    if (!confirmed) return;

    setError("");
    setDeleting(true);
    try {
      const { error: deleteImagesError } = await supabase
        .from("product_images")
        .delete()
        .eq("product_id", product.id);
      if (deleteImagesError) throw deleteImagesError;

      const { error: deleteProductError } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);
      if (deleteProductError) throw deleteProductError;

      if (onDeleted) {
        await onDeleted();
      } else {
        await onSaved();
        onClose();
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to delete product.";
      setError(message);
    } finally {
      setDeleting(false);
    }
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
          <div style={styles.title}>EDIT PRODUCT</div>
        </div>

        <div
          style={{
            ...styles.content,
            ...(isMobileViewport ? { padding: "8px 10px 20px" } : null),
          }}
        >
          <div style={styles.grid}>
            <div style={styles.card}>
              <div style={styles.section}>IMAGES</div>
              <label style={styles.label}>Thumbnail URL</label>
              <input
                style={styles.input}
                value={draft.thumbnail_url}
                onChange={(e) => setField("thumbnail_url", e.target.value)}
                onBlur={handleAutoSave}
              />
              <div style={styles.inlineTools}>
                <label style={styles.fileUploadLabel}>
                  Upload Thumbnail
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleThumbnailFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <div
                style={{
                  ...styles.dropZone,
                  ...(dragOverUpload ? styles.dropZoneActive : null),
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverUpload(true);
                }}
                onDragLeave={() => setDragOverUpload(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverUpload(false);
                  void handleImageFiles(e.dataTransfer.files);
                }}
              >
                <div>{uploading ? "Uploading..." : "Drag & drop images here"}</div>
                <label style={styles.fileUploadLabel}>
                  + Upload Images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files) void handleImageFiles(e.target.files);
                    }}
                  />
                </label>
              </div>
              {imageRows.map((row) => (
                <div
                  key={row.id}
                  style={styles.imageRow}
                  draggable
                  onDragStart={() => setDraggingId(row.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingId) reorderImage(draggingId, row.id);
                    setDraggingId(null);
                  }}
                >
                  <div style={styles.previewWrap}>
                    {row.url.trim() ? (
                      <img
                        src={row.url}
                        alt={`Image ${row.sort_order}`}
                        style={styles.previewImg}
                      />
                    ) : (
                      <LogoPlaceholder style={styles.previewLogo} />
                    )}
                  </div>
                  <div style={styles.imageFields}>
                    <input
                      style={styles.urlInput}
                      value={row.url}
                      onChange={(e) =>
                        setImageRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, url: e.target.value } : r
                          )
                        )
                      }
                      placeholder="https://..."
                      onBlur={handleAutoSave}
                    />
                    <div style={styles.orderRow}>
                      <span style={styles.orderLabel}>Order</span>
                      <input
                        style={styles.orderInput}
                        value={row.sort_order}
                        onChange={(e) => setImageOrder(row.id, e.target.value)}
                        inputMode="numeric"
                        onBlur={handleAutoSave}
                      />
                    </div>
                  </div>
                  <div style={styles.rowTools}>
                    <button
                      type="button"
                      style={styles.orderBtn}
                      onClick={() => moveImage(row.id, -1)}
                      aria-label="Move image up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      style={styles.orderBtn}
                      onClick={() => moveImage(row.id, 1)}
                      aria-label="Move image down"
                    >
                      ▼
                    </button>
                  </div>
                  <div style={styles.dragHandle}>DRAG</div>
                  <AppButton
                    variant="ghost"
                    style={styles.removeBtn}
                    onClick={() => removeImage(row.id)}
                  >
                    DELETE
                  </AppButton>
                </div>
              ))}
            </div>

            <div style={styles.card}>
              <div style={styles.section}>MAIN FIELDS</div>
              <label style={styles.label}>Short name (tiles)</label>
              <input
                style={styles.input}
                value={draft.name}
                onChange={(e) => setField("name", e.target.value)}
                onBlur={handleAutoSave}
              />
              <label style={styles.label}>Long name (list + drawer)</label>
              <input
                style={styles.input}
                value={draft.long_name}
                onChange={(e) => setField("long_name", e.target.value)}
                onBlur={handleAutoSave}
              />
              <label style={styles.label}>Size</label>
              <div style={styles.sizeRow}>
                <input
                  style={styles.input}
                  value={draft.size_g}
                  onChange={(e) => setField("size_g", e.target.value)}
                  inputMode="decimal"
                  placeholder={sizeUnit === "g" ? "grams" : "milliliters"}
                  onBlur={handleAutoSave}
                />
                <select
                  value={sizeUnit}
                  onChange={(e) => setSizeUnit(e.target.value as SizeUnit)}
                  onBlur={handleAutoSave}
                  style={styles.sizeUnitSelect}
                  aria-label="Size unit"
                >
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                </select>
                <div style={styles.sizeTextReadOnly}>{autoSizeText || "—"}</div>
              </div>
              <label style={styles.label}>Status</label>
              <select
                style={{
                  ...styles.input,
                  ...styles.statusSelect,
                  ...(draft.status === "Active"
                    ? styles.statusActive
                    : draft.status === "Disabled"
                      ? styles.statusDisabled
                      : styles.statusArchived),
                }}
                value={draft.status}
                onChange={(e) => setField("status", e.target.value)}
                onBlur={handleAutoSave}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status} style={styles.statusOption}>
                    {status.toUpperCase()}
                  </option>
                ))}
              </select>
              <label style={styles.label}>Selling price</label>
              <input
                style={styles.input}
                value={draft.selling_price}
                onChange={(e) => setField("selling_price", e.target.value)}
                onBlur={handleAutoSave}
              />
              <label style={styles.label}>Temperature</label>
              <input
                style={styles.input}
                value={draft.temperature}
                onChange={(e) => setField("temperature", e.target.value)}
                onBlur={handleAutoSave}
              />
              <label style={styles.label}>Country</label>
              <input
                style={styles.input}
                value={draft.country_of_origin}
                onChange={(e) => setField("country_of_origin", e.target.value)}
                onBlur={handleAutoSave}
              />
              <label style={styles.label}>Description</label>
              <textarea
                style={styles.textarea}
                value={draft.description}
                onChange={(e) => setField("description", e.target.value)}
                onBlur={handleAutoSave}
              />
            </div>
          </div>

          <div style={styles.extraCard}>
            <div style={styles.section}>EXTRA FIELDS</div>
            <div style={styles.extraGrid}>
              <div>
                <label style={styles.label}>Extra keywords (optional)</label>
                <input
                  style={styles.input}
                  value={draft.keywords}
                  onChange={(e) => setField("keywords", e.target.value)}
                  onBlur={handleAutoSave}
                />
              </div>
              <div>
                <label style={styles.label}>Sort</label>
                <input
                  style={styles.input}
                  value={draft.sort}
                  onChange={(e) => setField("sort", e.target.value)}
                  onBlur={handleAutoSave}
                />
              </div>
            </div>
            <div style={styles.helperText}>
              Keywords are auto-generated and combined with this field.
            </div>
          </div>

          {error ? <div style={styles.error}>{error}</div> : null}
          <div style={styles.saveHintRow}>
            {saving ? <div style={styles.savingHint}>Saving…</div> : null}
            {!saving && savedNoticeAt > 0 ? <div style={styles.savedHint}>Saved</div> : null}
          </div>

          <div style={styles.deleteRow}>
            <AppButton
              variant="ghost"
              onClick={() => void handleDelete()}
              style={styles.deleteBtn}
              disabled={deleting}
            >
              {deleting ? "DELETING…" : "DELETE"}
            </AppButton>
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
    background: "black",
    zIndex: 860,
  },
  panel: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    width: "var(--tp-rail-width)",
    zIndex: 910,
    display: "flex",
    flexDirection: "column",
    background: "black",
  },
  topRow: {
    minHeight: 64,
    display: "flex",
    alignItems: "center",
    gap: 40,
    padding: "18px 0 12px",
  },
  backBtn: {
    width: 68,
    minWidth: 68,
    height: 36,
    padding: 0,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 2,
    color: "#fff",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 0 24px 108px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 22,
    maxWidth: "min(1120px, 100%)",
  },
  card: {
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: 0,
    color: "white",
  },
  section: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 1.5,
    opacity: 0.8,
    marginBottom: 8,
  },
  label: {
    display: "block",
    fontSize: 13,
    opacity: 0.85,
    marginTop: 10,
    marginBottom: 6,
  },
  sizeRow: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 1fr) 90px minmax(140px, 1fr)",
    gap: 8,
    alignItems: "center",
  },
  sizeUnitSelect: {
    height: 40,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    padding: "0 10px",
    fontWeight: 700,
  },
  sizeTextReadOnly: {
    height: 40,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.95)",
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  input: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    padding: "0 12px",
  },
  textarea: {
    width: "100%",
    minHeight: 90,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    padding: "10px 12px",
    resize: "vertical",
  },
  helperText: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.66,
  },
  statusSelect: {
    appearance: "none",
    height: 40,
    borderRadius: 12,
    fontWeight: 900,
    letterSpacing: 0.7,
    color: "#fff",
  },
  statusActive: {
    borderColor: "#57c576",
    background: "rgba(25,85,40,0.42)",
    color: "#d9ffe4",
  },
  statusDisabled: {
    borderColor: "#de6464",
    background: "rgba(120,28,28,0.42)",
    color: "#ffe1e1",
  },
  statusArchived: {
    borderColor: "#5b5b5b",
    background: "rgba(30,30,30,0.62)",
    color: "#ededed",
  },
  statusOption: {
    background: "#101010",
    color: "#fff",
  },
  inlineTools: {
    marginTop: 8,
    marginBottom: 12,
    display: "flex",
    gap: 8,
  },
  fileUploadLabel: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 34,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    padding: "0 10px",
    fontSize: 13,
    letterSpacing: 0.8,
    cursor: "pointer",
  },
  dropZone: {
    border: "1px dashed rgba(255,255,255,0.22)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    opacity: 0.85,
  },
  dropZoneActive: {
    borderColor: "rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.05)",
  },
  imageRow: {
    display: "grid",
    gridTemplateColumns: "70px minmax(0, 1fr) auto 52px auto",
    gap: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  previewWrap: {
    width: 70,
    height: 70,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.14)",
    overflow: "hidden",
    background: "rgba(255,255,255,0.04)",
  },
  previewImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  previewLogo: {
    opacity: 0.5,
    borderRadius: 0,
  },
  imageFields: {
    minWidth: 0,
  },
  dragHandle: {
    height: 70,
    width: 52,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    cursor: "grab",
  },
  urlInput: {
    height: 36,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    padding: "0 10px",
  },
  orderRow: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  orderLabel: {
    fontSize: 13,
    opacity: 0.75,
  },
  orderInput: {
    width: 56,
    height: 28,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    padding: "0 8px",
    fontSize: 13,
  },
  rowTools: {
    display: "grid",
    gap: 4,
  },
  orderBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 13,
    cursor: "pointer",
  },
  removeBtn: {
    height: 70,
    borderRadius: 8,
    padding: "0 10px",
    fontSize: 13,
    letterSpacing: 0.8,
  },
  extraCard: {
    maxWidth: "min(1120px, 100%)",
    marginTop: 16,
  },
  extraGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  error: {
    marginTop: 10,
    color: "#ff9292",
    fontSize: 13,
  },
  saveHintRow: {
    marginTop: 12,
    display: "flex",
    justifyContent: "center",
    maxWidth: "min(1120px, 100%)",
    minHeight: 28,
  },
  savingHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  savedHint: {
    height: 24,
    minWidth: 72,
    borderRadius: 8,
    border: "1px solid rgba(157,228,182,0.45)",
    background: "rgba(157,228,182,0.2)",
    color: "white",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 10px",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  deleteRow: {
    marginTop: 12,
    display: "flex",
    justifyContent: "flex-end",
    maxWidth: "min(1120px, 100%)",
  },
  deleteBtn: {
    height: 40,
    minWidth: 112,
    borderRadius: 10,
    borderColor: "rgba(237,103,103,0.9)",
    color: "#ffd9d9",
    background: "rgba(120,22,22,0.4)",
    fontWeight: 800,
    letterSpacing: 0.8,
  },
};
