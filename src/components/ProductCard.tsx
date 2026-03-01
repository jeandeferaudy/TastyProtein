// src/components/ProductCard.tsx
"use client";

import * as React from "react";
import type { DbProduct } from "@/lib/products";
import { AppButton, GearIcon, QtyIcon } from "@/components/ui";
import LogoPlaceholder from "@/components/LogoPlaceholder";

type Props = {
  product: DbProduct;
  qty: number;
  viewMode?: "list" | "4" | "5";
  mobileListLayout?: boolean;
  canEdit?: boolean;

  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
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
  onSetQty,
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
  const priceSuffix = format && format !== "N/A" ? ` for ${format}` : "";
  const imageUrl = product.thumbnail_url?.trim() || "";
  const isCompactTile = viewMode === "5";
  const tileTitleStyle: React.CSSProperties = isCompactTile
    ? { ...styles.title, ...styles.titleCompact }
    : styles.title;
  const tileMetaStyle: React.CSSProperties = isCompactTile
    ? { ...styles.metaLabel, fontSize: 15 }
    : styles.metaLabel;
  const tilePriceStyle: React.CSSProperties = isCompactTile
    ? { ...styles.price, fontSize: 16 }
    : styles.price;
  const tileRowStyle: React.CSSProperties = isCompactTile
    ? { ...styles.row, ...styles.rowCompact }
    : styles.row;
  const tileRightValueStyle: React.CSSProperties = isCompactTile
    ? styles.metaRightCompact
    : styles.metaRight;
  const tilePmRowStyle: React.CSSProperties = isCompactTile
    ? { ...styles.pmRow, ...styles.pmRowCompact }
    : styles.pmRow;
  const tilePmBtnStyle: React.CSSProperties = isCompactTile
    ? styles.pmBtnCompact
    : styles.pmBtn;
  const tileTopStyle: React.CSSProperties = isCompactTile
    ? { ...styles.top, ...styles.topCompact }
    : styles.top;
  const status = (product.status ?? "Active").toLowerCase();
  const qtyAvailable = Math.max(0, Number(product.qty_available ?? 0));
  const isStockLimited = !Boolean(product.unlimited_stock);
  const isHardOos = isStockLimited && qtyAvailable < 1;
  const showStockWarning = isStockLimited && !isHardOos && qty > qtyAvailable;
  const [qtyEditing, setQtyEditing] = React.useState(false);
  const [qtyDraft, setQtyDraft] = React.useState(String(Math.max(0, Number(qty) || 0)));
  React.useEffect(() => {
    if (qtyEditing) return;
    setQtyDraft(String(Math.max(0, Number(qty) || 0)));
  }, [qty, qtyEditing]);
  const commitQty = React.useCallback(() => {
    const parsed = Math.max(0, Math.floor(Number(qtyDraft || 0)));
    onSetQty(id, parsed);
    setQtyEditing(false);
  }, [id, onSetQty, qtyDraft]);
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
    const showDesktopListAdmin = canEdit && !useMobileList;
    return (
      <div
        style={
          useMobileList
            ? styles.listCardMobile
            : {
                ...styles.listCard,
                gridTemplateColumns: showDesktopListAdmin
                  ? "75px minmax(0,1fr) auto auto"
                  : "75px minmax(0,1fr) auto",
              }
        }
        onClick={openProduct}
      >
        <button
          type="button"
          style={styles.listImageWrap}
          onClick={(e) => {
            e.stopPropagation();
            openProduct();
          }}
          aria-label={`Open ${longName}`}
        >
          <div style={styles.listImageShell}>
            {imageUrl ? (
              <img src={imageUrl} alt={longName} style={styles.listImage} loading="lazy" />
            ) : (
              <div style={styles.listImagePlaceholder} aria-hidden>
                <LogoPlaceholder style={styles.logoPlaceholder} />
              </div>
            )}
          </div>
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
              {[country, temperature].join(" • ")}
            </div>
          </button>
          {useMobileList ? (
            <>
              <div style={styles.listBottomRowMobile}>
                <div style={styles.listPriceMobile}>
                  ₱ {formatMoney(price)}
                  <span style={styles.listPerInline}>{priceSuffix}</span>
                </div>
                {isHardOos ? (
                  <div style={styles.listOosZone}>Sold out</div>
                ) : (
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
                      <QtyIcon type="minus" />
                    </AppButton>
                    {qtyEditing ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={qtyDraft}
                        onChange={(e) => setQtyDraft(e.target.value)}
                        onBlur={(e) => {
                          e.stopPropagation();
                          commitQty();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            commitQty();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={styles.qtyInput}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQtyDraft(String(Math.max(0, Number(qty) || 0)));
                          setQtyEditing(true);
                        }}
                        style={{
                          ...styles.qtyBtn,
                          opacity: qty <= 0 ? 0.72 : 0.95,
                          fontWeight: qty <= 0 ? 500 : 900,
                        }}
                      >
                        {qty}
                      </button>
                    )}
                  <AppButton
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdd(id);
                      }}
                      style={styles.listPmBtn}
                    >
                      <QtyIcon type="plus" />
                    </AppButton>
                  </div>
                )}
                {showStockWarning ? (
                  <div style={styles.listStockWarning}>Only {qtyAvailable} left</div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {showDesktopListAdmin ? (
          <div style={styles.listAdminCol} onClick={(e) => e.stopPropagation()}>
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

        {!useMobileList ? (
          <div style={styles.listRight}>
            <div style={styles.listPrice}>
              ₱ {formatMoney(price)}
              <span style={styles.listPerInline}>{priceSuffix}</span>
            </div>
            {isHardOos ? (
              <div style={styles.listOosZone}>Sold out</div>
            ) : (
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
                  <QtyIcon type="minus" />
                </AppButton>
                {qtyEditing ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={qtyDraft}
                    onChange={(e) => setQtyDraft(e.target.value)}
                    onBlur={(e) => {
                      e.stopPropagation();
                      commitQty();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        commitQty();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={styles.qtyInput}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQtyDraft(String(Math.max(0, Number(qty) || 0)));
                      setQtyEditing(true);
                    }}
                    style={{
                      ...styles.qtyBtn,
                      opacity: qty <= 0 ? 0.72 : 0.95,
                      fontWeight: qty <= 0 ? 500 : 900,
                    }}
                  >
                    {qty}
                  </button>
                )}
                <AppButton
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd(id);
                  }}
                  style={styles.listPmBtn}
                >
                  <QtyIcon type="plus" />
                </AppButton>
              </div>
            )}
            {showStockWarning ? (
              <div style={styles.listStockWarning}>Only {qtyAvailable} left</div>
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
        style={tileTopStyle}
        onClick={(e) => {
          e.stopPropagation();
          openProduct();
        }}
        aria-label={`Open ${longName}`}
      >
        {imageUrl ? (
          <div style={styles.imgFrame}>
            <img src={imageUrl} alt={longName} style={styles.imgPhoto} loading="lazy" />
          </div>
        ) : (
          <div style={styles.imgFrame} aria-hidden>
            <div style={styles.img}>
              <LogoPlaceholder style={styles.logoPlaceholder} />
            </div>
          </div>
        )}

        <div style={tileTitleStyle}>{shortName}</div>

        <div style={tileRowStyle}>
          <div style={tileMetaStyle}>{country}</div>
          <div style={{ ...tilePriceStyle, textAlign: "right" }}>₱ {formatMoney(price)}</div>
        </div>

        <div style={tileRowStyle}>
          <div style={isCompactTile ? { ...tileMetaStyle, ...styles.metaOneLine } : tileMetaStyle}>
            {temperature}
          </div>
          <div style={{ ...tileMetaStyle, ...tileRightValueStyle }}>{format}</div>
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

      {isHardOos ? (
        <div style={styles.oosZone}>Sold out</div>
      ) : (
        <div style={tilePmRowStyle}>
          <AppButton
            variant="ghost"
            disabled={qty <= 0}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(id);
            }}
            style={{
              ...tilePmBtnStyle,
              opacity: qty <= 0 ? 0.45 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            <QtyIcon type="minus" />
          </AppButton>

          <div style={styles.qtyCellWrap}>
            {showStockWarning ? (
              <div style={styles.qtyInlineWarning}>Only {qtyAvailable} left</div>
            ) : null}
            {qtyEditing ? (
              <input
                type="text"
                inputMode="numeric"
                value={qtyDraft}
                onChange={(e) => setQtyDraft(e.target.value)}
                onBlur={(e) => {
                  e.stopPropagation();
                  commitQty();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    commitQty();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                style={styles.qtyInput}
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQtyDraft(String(Math.max(0, Number(qty) || 0)));
                  setQtyEditing(true);
                }}
                style={{
                  ...styles.qtyBtn,
                  opacity: qty <= 0 ? 0.72 : styles.qty.opacity,
                  fontWeight: qty <= 0 ? 500 : styles.qty.fontWeight,
                }}
              >
                {qty}
              </button>
            )}
          </div>

          <AppButton
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(id);
            }}
            style={{
              ...tilePmBtnStyle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            <QtyIcon type="plus" />
          </AppButton>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.4)",
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
  topCompact: {
    flex: "0 0 auto",
    padding: 9,
  },
  img: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: "12px 12px 0 0",
    border: "none",
    background: "transparent",
    marginBottom: 0,
    position: "relative",
    overflow: "hidden",
  },
  imgFrame: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: "12px 12px 0 0",
    overflow: "hidden",
    position: "relative",
    marginBottom: 12,
  },
  imgPhoto: {
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "cover",
    borderRadius: "12px 12px 0 0",
    marginBottom: 0,
    border: "1px solid transparent",
    background: "#0d0d0d",
    display: "block",
  },
  title: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  titleCompact: {
    fontSize: 15,
    lineHeight: 1.2,
    minHeight: "2.4em",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
    marginBottom: 8,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    columnGap: 10,
    marginBottom: 6,
  },
  rowCompact: {
    gridTemplateColumns: "minmax(0,1fr) 68px",
    columnGap: 8,
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
  metaRight: {
    textAlign: "right",
  },
  metaRightCompact: {
    textAlign: "right",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  metaOneLine: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  pmRow: {
    padding: 12,
    paddingTop: 10,
    display: "grid",
    gridTemplateColumns: "44px 1fr 44px",
    gap: 10,
    alignItems: "center",
    borderTop: "none",
  },
  pmRowCompact: {
    gridTemplateColumns: "40px 1fr 40px",
    gap: 8,
    marginTop: 0,
    padding: 7,
    paddingTop: 5,
  },
  pmBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    padding: 0,
  },
  pmBtnCompact: {
    width: 40,
    height: 40,
    borderRadius: 11,
    padding: 0,
  },
  adminRow: {
    padding: "0 15px 10px",
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
  qtyBtn: {
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    textAlign: "center",
    fontSize: 16,
    cursor: "text",
    padding: 0,
    minWidth: 24,
  },
  qtyInput: {
    width: 40,
    height: 30,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    textAlign: "center",
    fontSize: 15,
    padding: "0 6px",
    outline: "none",
    boxSizing: "border-box",
  },
  qtyCellWrap: {
    position: "relative",
    width: "100%",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyInlineWarning: {
    position: "absolute",
    top: -24,
    left: "50%",
    transform: "translateX(-50%)",
    width: 120,
    textAlign: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#ffb14a",
    lineHeight: 1,
    pointerEvents: "none",
  },
  oosZone: {
    margin: 10,
    marginTop: 8,
    height: 44,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(160,160,160,0.25)",
    color: "rgba(255,255,255,0.82)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  listCard: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.4)",
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
    border: "1px solid rgba(255,255,255,0.4)",
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
  listImageShell: {
    width: 75,
    height: 75,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  listImage: {
    width: 75,
    height: 75,
    objectFit: "cover",
    borderRadius: 10,
    border: "1px solid transparent",
  },
  listImagePlaceholder: {
    width: 75,
    height: 75,
    borderRadius: 10,
    border: "none",
    background: "transparent",
  },
  logoPlaceholder: {
    opacity: 0.7,
  },
  imgOosShade: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    pointerEvents: "none",
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
    fontSize: 15,
    opacity: 0.82,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  listMetaMobile: {
    fontSize: 15,
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
    minWidth: 140,
  },
  listAdminCol: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 162,
    alignSelf: "center",
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
    whiteSpace: "nowrap",
  },
  listPerInline: {
    fontSize: 14,
    fontWeight: 500,
    opacity: 0.82,
    marginLeft: 8,
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
    fontSize: 15,
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
    fontSize: 15,
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
  listStockWarning: {
    marginTop: 4,
    width: 114,
    textAlign: "center",
    justifySelf: "end",
    fontSize: 12,
    fontWeight: 700,
    color: "#ffb14a",
    lineHeight: 1.1,
  },
  listOosZone: {
    minWidth: 112,
    height: 30,
    borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(160,160,160,0.25)",
    color: "rgba(255,255,255,0.82)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    padding: "0 10px",
  },
};
