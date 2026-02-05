// src/components/ProductCard.tsx
"use client";

import * as React from "react";
import type { DbProduct } from "@/lib/products";
import { AppButton, GearIcon } from "@/components/ui";
import LogoPlaceholder from "@/components/LogoPlaceholder";

type Props = {
  product: DbProduct;
  qty: number;
  viewMode?: "list" | "4" | "6";
  mobileListLayout?: boolean;
  canEdit?: boolean;

  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onOpen: (id: string) => void;
  onEdit?: (id: string) => void;
  onStatusChange?: (id: string, nextStatus: "Active" | "Disabled" | "Archived") => void;

  formatMoney: (n: unknown) => string;
};

function toSmartSizeText(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "N/A";

  const m = s.match(/^(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  if (!m) return s;

  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(value)) return s;

  if (value >= 1000) {
    const converted = value / 1000;
    const compact = Number.isInteger(converted)
      ? String(converted)
      : converted.toFixed(2).replace(/\.?0+$/, "");
    return unit === "g" ? `${compact} kg` : `${compact} L`;
  }

  return unit === "g" ? `${value} g` : `${value} ml`;
}

export default function ProductCard({
  product,
  qty,
  viewMode = "4",
  mobileListLayout = false,
  canEdit = false,
  onAdd,
  onRemove,
  onOpen,
  onEdit,
  onStatusChange,
  formatMoney,
}: Props) {
  const id = String(product.id);
  const openProduct = () => onOpen(id);

  const shortName =
    (product.name && product.name.trim()) ||
    (product.long_name && product.long_name.trim()) ||
    "Unnamed product";
  const longName =
    (product.long_name && product.long_name.trim()) ||
    (product.name && product.name.trim()) ||
    "Unnamed product";

  const price = Number(product.selling_price ?? 0) || 0;

  const country = product.country_of_origin?.trim() || "N/A";
  const temperature = product.temperature?.trim() || "N/A";
  const format = toSmartSizeText(product.size);
  const imageUrl = product.thumbnail_url?.trim() || "";
  const isCompactTile = viewMode === "6";
  const tileTitleStyle: React.CSSProperties =
    isCompactTile ? { ...styles.title, fontSize: 14 } : styles.title;
  const tileMetaStyle: React.CSSProperties = isCompactTile
    ? { ...styles.metaLabel, fontSize: 14 }
    : styles.metaLabel;
  const tilePriceStyle: React.CSSProperties = isCompactTile
    ? { ...styles.price, fontSize: 16 }
    : styles.price;
  const status = (product.status ?? "Active").toLowerCase();
  const normalizedStatus: "Active" | "Disabled" | "Archived" =
    status === "disabled" ? "Disabled" : status === "archived" ? "Archived" : "Active";
  const statusColor =
    normalizedStatus === "Active"
      ? "#57c576"
      : normalizedStatus === "Disabled"
        ? "#de6464"
        : "#0a0a0a";

  if (viewMode === "list") {
    const useMobileList = mobileListLayout && !canEdit;
    return (
      <div style={useMobileList ? styles.listCardMobile : styles.listCard} onClick={openProduct}>
        <button
          type="button"
          style={styles.listImageWrap}
          onClick={(e) => {
            e.stopPropagation();
            openProduct();
          }}
          aria-label={`Open ${longName}`}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={longName} style={styles.listImage} loading="lazy" />
          ) : (
            <div style={styles.listImagePlaceholder} aria-hidden>
              <LogoPlaceholder style={styles.logoPlaceholder} />
            </div>
          )}
        </button>

        <div style={useMobileList ? styles.listInfoMobile : styles.listInfo}>
          <button
            type="button"
            style={styles.listInfoBtn}
            onClick={(e) => {
              e.stopPropagation();
              openProduct();
            }}
          >
            <div style={useMobileList ? styles.listTitleMobile : styles.listTitle}>{longName}</div>
          </button>
          <button
            type="button"
            style={styles.listMetaBtn}
            onClick={(e) => {
              e.stopPropagation();
              openProduct();
            }}
          >
            <div style={useMobileList ? styles.listMetaMobile : styles.listMeta}>
              {[country, temperature, format].join(" • ")}
            </div>
          </button>
          {useMobileList ? (
            <div style={styles.listBottomRowMobile}>
              <div style={styles.listPmRow}>
                <AppButton
                  variant="ghost"
                  disabled={qty <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(id);
                  }}
                  style={{ ...styles.listPmBtn, opacity: qty <= 0 ? 0.45 : 1 }}
                >
                  <span style={styles.pmGlyph}>−</span>
                </AppButton>
                <div
                  style={{
                    ...styles.listQty,
                    opacity: qty <= 0 ? 0.72 : 0.95,
                    fontWeight: qty <= 0 ? 500 : 900,
                  }}
                >
                  {qty}
                </div>
                <AppButton
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd(id);
                  }}
                  style={styles.listPmBtn}
                >
                  <span style={styles.pmGlyph}>+</span>
                </AppButton>
              </div>
              <div style={styles.listPriceMobile}>₱ {formatMoney(price)}</div>
            </div>
          ) : null}
        </div>

        {!useMobileList ? (
          <div style={styles.listRight}>
            <div style={styles.listPrice}>₱ {formatMoney(price)}</div>
            <div style={styles.listPmRow}>
              <AppButton
                variant="ghost"
                disabled={qty <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(id);
                }}
                style={{ ...styles.listPmBtn, opacity: qty <= 0 ? 0.45 : 1 }}
              >
                <span style={styles.pmGlyph}>−</span>
              </AppButton>
              <div
                style={{
                  ...styles.listQty,
                  opacity: qty <= 0 ? 0.72 : 0.95,
                  fontWeight: qty <= 0 ? 500 : 900,
                }}
              >
                {qty}
              </div>
              <AppButton
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(id);
                }}
                style={styles.listPmBtn}
              >
                <span style={styles.pmGlyph}>+</span>
              </AppButton>
            </div>
            {canEdit ? (
              <div style={styles.listAdminRowBelow}>
                <select
                  value={normalizedStatus}
                  onChange={(e) =>
                    onStatusChange?.(
                      id,
                      e.target.value as "Active" | "Disabled" | "Archived"
                    )
                  }
                  style={{
                    ...styles.statusSelect,
                    ...(normalizedStatus === "Active"
                      ? styles.statusActive
                      : normalizedStatus === "Disabled"
                        ? styles.statusDisabled
                        : styles.statusArchived),
                  }}
                  aria-label="Product status"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="Active">ACTIVE</option>
                  <option value="Disabled">DISABLED</option>
                  <option value="Archived">ARCHIVED</option>
                </select>
                {onEdit && (
                  <AppButton
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(id);
                    }}
                    style={styles.listEditBtn}
                    aria-label="Edit product"
                    title="Edit product"
                  >
                    <GearIcon size={16} />
                  </AppButton>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={styles.card} onClick={openProduct}>
      <button
        type="button"
        style={styles.top}
        onClick={(e) => {
          e.stopPropagation();
          openProduct();
        }}
        aria-label={`Open ${longName}`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={longName} style={styles.imgPhoto} loading="lazy" />
        ) : (
          <div style={styles.img} aria-hidden>
            <LogoPlaceholder style={styles.logoPlaceholder} />
          </div>
        )}

        <div style={tileTitleStyle}>{shortName}</div>

        <div style={styles.row}>
          <div style={tileMetaStyle}>{country}</div>
          <div style={tilePriceStyle}>₱ {formatMoney(price)}</div>
        </div>

        <div style={styles.row}>
          <div style={tileMetaStyle}>{temperature}</div>
          <div style={tileMetaStyle}>{format}</div>
        </div>
      </button>

      {canEdit && (
        <div style={isCompactTile ? { ...styles.adminRow, padding: "0 10px 8px", gap: 6 } : styles.adminRow}>
          <select
            value={normalizedStatus}
            onChange={(e) =>
              onStatusChange?.(
                id,
                e.target.value as "Active" | "Disabled" | "Archived"
              )
            }
            style={{
              ...styles.statusSelect,
              ...(isCompactTile ? styles.statusSelectCompact : null),
              borderColor: statusColor,
              ...(normalizedStatus === "Active"
                ? styles.statusActive
                : normalizedStatus === "Disabled"
                  ? styles.statusDisabled
                  : styles.statusArchived),
            }}
            aria-label="Product status"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="Active">ACTIVE</option>
            <option value="Disabled">DISABLED</option>
            <option value="Archived">ARCHIVED</option>
          </select>
          {onEdit && (
            <AppButton
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(id);
              }}
              style={isCompactTile ? styles.adminEditBtnCompact : styles.adminEditBtn}
              aria-label="Edit product"
              title="Edit product"
            >
              <GearIcon size={isCompactTile ? 14 : 16} />
            </AppButton>
          )}
        </div>
      )}

      <div style={styles.pmRow}>
        <AppButton
          variant="ghost"
          disabled={qty <= 0}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          style={{
            opacity: qty <= 0 ? 0.45 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          <span style={styles.pmGlyph}>−</span>
        </AppButton>

        <div
          style={{
            ...styles.qty,
            opacity: qty <= 0 ? 0.72 : styles.qty.opacity,
            fontWeight: qty <= 0 ? 500 : styles.qty.fontWeight,
          }}
        >
          {qty}
        </div>

        <AppButton
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(id);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          <span style={styles.pmGlyph}>+</span>
        </AppButton>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: 18,
    border: "1px solid var(--tp-border-color-soft)",
    background: "var(--tp-surface-bg)",
    boxShadow: "none",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    minHeight: 130,
    cursor: "pointer",
  },
  top: {
    textAlign: "left",
    padding: 14,
    background: "transparent",
    border: "none",
    color: "var(--tp-text-color)",
    cursor: "pointer",
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  img: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 12,
    border: "1px dashed var(--tp-border-color)",
    background: "transparent",
    marginBottom: 12,
  },
  imgPhoto: {
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "cover",
    borderRadius: 12,
    marginBottom: 12,
    border: "1px solid var(--tp-border-color-soft)",
    background: "#0d0d0d",
  },
  title: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    columnGap: 10,
    marginBottom: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: 800,
    opacity: 0.9,
  },
  metaLabel: {
    fontSize: 15,
    opacity: 0.82,
  },
  pmRow: {
    padding: 12,
    paddingTop: 10,
    display: "grid",
    gridTemplateColumns: "44px 1fr 44px",
    gap: 10,
    alignItems: "center",
    borderTop: "1px solid var(--tp-border-color-soft)",
  },
  adminRow: {
    padding: "0 12px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  adminEditBtn: {
    height: 40,
    width: 40,
    minWidth: 40,
    padding: 0,
    borderRadius: 12,
    borderColor: "#66c7ff",
    color: "#66c7ff",
    background: "rgba(102,199,255,0.08)",
  },
  adminEditBtnCompact: {
    height: 34,
    width: 34,
    minWidth: 34,
    padding: 0,
    borderRadius: 10,
    borderColor: "#66c7ff",
    color: "#66c7ff",
    background: "rgba(102,199,255,0.08)",
  },
  qty: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: 900,
    opacity: 0.9,
  },
  pmGlyph: {
    lineHeight: 1,
    transform: "translateY(-1px)",
  },
  listCard: {
    borderRadius: 14,
    border: "1px solid var(--tp-border-color-soft)",
    background: "var(--tp-surface-bg)",
    display: "grid",
    gridTemplateColumns: "75px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 12,
    padding: 10,
    minHeight: 96,
    cursor: "pointer",
  },
  listCardMobile: {
    borderRadius: 14,
    border: "1px solid var(--tp-border-color-soft)",
    background: "var(--tp-surface-bg)",
    display: "grid",
    gridTemplateColumns: "75px minmax(0, 1fr)",
    alignItems: "start",
    gap: 12,
    padding: 10,
    minHeight: 96,
    cursor: "pointer",
  },
  listImageWrap: {
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
  },
  listImage: {
    width: 75,
    height: 75,
    objectFit: "cover",
    borderRadius: 10,
    border: "1px solid var(--tp-border-color-soft)",
  },
  listImagePlaceholder: {
    width: 75,
    height: 75,
    borderRadius: 10,
    border: "1px dashed var(--tp-border-color)",
    background: "transparent",
  },
  logoPlaceholder: {
    opacity: 0.5,
  },
  listInfo: {
    minWidth: 0,
    cursor: "pointer",
  },
  listInfoMobile: {
    minWidth: 0,
    cursor: "pointer",
    display: "grid",
    gap: 6,
  },
  listInfoBtn: {
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    textAlign: "left",
    cursor: "pointer",
    padding: 0,
    width: "100%",
  },
  listMetaBtn: {
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    textAlign: "left",
    cursor: "pointer",
    padding: 0,
    width: "100%",
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1.15,
    marginBottom: 6,
  },
  listTitleMobile: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.2,
    marginBottom: 2,
  },
  listMeta: {
    fontSize: 14,
    opacity: 0.82,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  listMetaMobile: {
    fontSize: 14,
    opacity: 0.82,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  listBottomRowMobile: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 2,
  },
  listPriceMobile: {
    fontSize: 18,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  listRight: {
    display: "grid",
    justifyItems: "end",
    gap: 8,
    minWidth: 170,
  },
  listAdminRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
  },
  listAdminRowBelow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  listPrice: {
    fontSize: 18,
    fontWeight: 800,
  },
  listEditBtn: {
    height: 40,
    width: 40,
    minWidth: 40,
    padding: 0,
    borderRadius: 12,
    borderColor: "#66c7ff",
    color: "#66c7ff",
    background: "rgba(102,199,255,0.08)",
  },
  statusSelect: {
    height: 40,
    minWidth: 108,
    borderRadius: 12,
    border: "1px solid var(--tp-border-color)",
    padding: "0 8px",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.7,
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    cursor: "pointer",
  },
  statusSelectCompact: {
    height: 34,
    minWidth: 92,
    borderRadius: 10,
    fontSize: 12,
    padding: "0 6px",
  },
  statusActive: {
    borderColor: "#57c576",
    color: "#79d590",
  },
  statusDisabled: {
    borderColor: "#de6464",
    color: "#f08888",
  },
  statusArchived: {
    borderColor: "#5b5b5b",
    color: "#9a9a9a",
  },
  listPmRow: {
    display: "grid",
    gridTemplateColumns: "34px 42px 34px",
    gap: 6,
    alignItems: "center",
  },
  listPmBtn: {
    width: 34,
    height: 30,
    borderRadius: 9,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  listQty: {
    textAlign: "center",
    fontSize: 16,
  },
};
