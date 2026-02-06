// src/components/ProductDrawer.tsx
"use client";

import * as React from "react";
import type { Product } from "@/types/product";
import type { ProductImage } from "@/lib/products";
import { AppButton, GearIcon } from "@/components/ui";
import LogoPlaceholder from "@/components/LogoPlaceholder";
const BACK_BTN_W = 68;
const TITLE_GAP = 40;

type Props = {
  isOpen: boolean;
  topOffset: number;
  product: Product | null;
  images: ProductImage[];
  qty: number;
  backgroundStyle?: React.CSSProperties;
  canEdit?: boolean;

  onBack: () => void;
  onEdit?: (id: string) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;

  formatMoney: (n: unknown) => string;
};

function formatSizeG(size_g?: number | null) {
  if (!size_g || size_g <= 0) return "";
  return `${size_g}g`;
}

function formatSize(p: Product) {
  return p.size?.trim() || formatSizeG(p.size_g) || "";
}

export default function ProductDrawer({
  isOpen,
  topOffset,
  product,
  images,
  qty,
  backgroundStyle,
  canEdit = false,
  onBack,
  onEdit,
  onAdd,
  onRemove,
  formatMoney,
}: Props) {
  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const productId = product ? String((product as { id?: string | number }).id ?? "") : "";
  const orderedImages = React.useMemo(
    () => [...images].sort((a, b) => a.sort_order - b.sort_order),
    [images]
  );
  const defaultMainImage = React.useMemo(() => {
    const sortOne = orderedImages.find((img) => img.sort_order === 1);
    return sortOne?.url ?? orderedImages[0]?.url ?? "";
  }, [orderedImages]);
  const [activeImageUrl, setActiveImageUrl] = React.useState<string>("");

  React.useEffect(() => {
    setActiveImageUrl(defaultMainImage);
  }, [defaultMainImage, productId]);

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!isOpen || !product) return null;

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
          ...styles.productPanel,
          ...(backgroundStyle ?? null),
          top: panelTop,
          height: panelHeight,
        }}
        aria-hidden={!isOpen}
      >
        <div style={styles.productPanelInner}>
          <div style={styles.productTopBand}>
            <AppButton type="button" variant="ghost" style={styles.drawerBackBtnTop} onClick={onBack}>
              BACK
            </AppButton>
            <div style={styles.topTitle}>PRODUCT DETAILS</div>
            <div style={styles.topSpacer} />
            {canEdit && onEdit && productId ? (
              <AppButton
                type="button"
                variant="ghost"
                style={styles.editBtn}
                onClick={() => onEdit(productId)}
                aria-label="Edit product"
                title="Edit product"
              >
                <GearIcon size={16} />
              </AppButton>
            ) : null}
          </div>

          <div
            style={{
              ...styles.content,
              ...(isMobileViewport ? { padding: "10px 10px 20px", overflowY: "auto" } : null),
            }}
          >
            <div
              style={{
                ...styles.drawerGrid,
                ...(isMobileViewport
                  ? {
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      alignItems: "stretch",
                    }
                  : null),
              }}
            >
              <div style={styles.card}>
              <div
                style={{
                  ...styles.drawerImage,
                  ...(isMobileViewport ? { height: "clamp(240px, 42vh, 360px)" } : null),
                }}
              >
                <div style={styles.drawerImageInner}>
                  {activeImageUrl ? (
                    <img
                      src={activeImageUrl}
                      alt={product.long_name ?? product.name ?? "Product image"}
                      style={styles.mainImage}
                    />
                  ) : (
                    <div style={styles.mainImageFallback}>
                      <LogoPlaceholder style={styles.drawerImageLogo} />
                    </div>
                  )}

                  {orderedImages.length > 1 && (
                    <div style={styles.thumbRow}>
                      {orderedImages.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          style={{
                            ...styles.thumb,
                            ...(activeImageUrl === img.url
                              ? styles.thumbActive
                              : null),
                          }}
                          onClick={() => setActiveImageUrl(img.url)}
                          aria-label={`View image ${img.sort_order}`}
                        >
                          <img
                            src={img.url}
                            alt=""
                            aria-hidden
                            style={styles.thumbImg}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </div>

              <div style={styles.card}>
                <div
                  style={{
                    ...styles.drawerBody,
                    ...(isMobileViewport ? styles.drawerInfoCardMobile : null),
                    ...(isMobileViewport
                      ? { height: "auto", overflowY: "visible" }
                      : null),
                  }}
                >
                <div style={styles.drawerName}>{product.long_name || product.name}</div>

                <div style={styles.drawerDetailStack}>
                  {product.country_of_origin ? (
                    <div style={styles.detailRow}>
                      <div style={styles.detailLabel}>Country of Origin</div>
                      <div style={styles.detailValue}>{product.country_of_origin}</div>
                    </div>
                  ) : null}

                  {product.cut ? (
                    <div style={styles.detailRow}>
                      <div style={styles.detailLabel}>Cut</div>
                      <div style={styles.detailValue}>{product.cut}</div>
                    </div>
                  ) : null}

                  {product.state ? (
                    <div style={styles.detailRow}>
                      <div style={styles.detailLabel}>State</div>
                      <div style={styles.detailValue}>{product.state}</div>
                    </div>
                  ) : null}
                </div>

                {product.temperature ? (
                  <div style={styles.detailBlock}>
                    <div style={styles.detailLabel}>Temperature</div>
                    <div style={styles.detailValue}>{product.temperature}</div>
                  </div>
                ) : null}

                <div style={styles.detailBlock}>
                  <div style={styles.detailLabel}>Description</div>
                  {product.description ? (
                    <div style={styles.drawerDesc}>{product.description}</div>
                  ) : (
                    <div style={styles.drawerDescMuted}>No description yet.</div>
                  )}
                </div>

                <div style={styles.drawerPriceRow}>
                  <div style={styles.drawerPrice}>₱ {formatMoney(product.selling_price)}</div>
                  {formatSize(product) ? (
                    <div style={styles.drawerFormat}>{formatSize(product)}</div>
                  ) : null}
                </div>

                <div style={styles.drawerQtyRow}>
                  <AppButton
                    type="button"
                    variant="ghost"
                    style={styles.qtyBtn}
                    onClick={() => productId && onRemove(productId)}
                    disabled={!productId}
                  >
                    <span style={styles.qtyGlyph}>−</span>
                  </AppButton>
                  <div style={{ ...styles.qty, width: 40 }}>{qty}</div>
                  <AppButton
                    type="button"
                    variant="ghost"
                    style={styles.qtyBtn}
                    onClick={() => productId && onAdd(productId)}
                    disabled={!productId}
                  >
                    <span style={styles.qtyGlyph}>+</span>
                  </AppButton>
                </div>

                <div style={styles.drawerFooterHint}>
                  Prepared and delivered with care, with direct delivery to your door. You can add a thermal bag during checkout for better temperature preservation.
                </div>
              </div>
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
    zIndex: 850,
  },
  productPanel: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    width: "var(--tp-rail-width)",
    background: "transparent",
    borderRadius: 0,
    zIndex: 900,
    overflow: "hidden",
  },
  productPanelInner: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  productTopBand: {
    minHeight: 64,
    display: "flex",
    alignItems: "center",
    gap: 0,
    padding: "18px 0 12px",
  },
  topTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 2,
    color: "var(--tp-text-color)",
  },
  topSpacer: {
    flex: 1,
  },
  editBtn: {
    height: 40,
    width: 40,
    minWidth: 40,
    padding: 0,
    borderRadius: 12,
    borderColor: "#66c7ff",
    color: "#66c7ff",
    background: "rgba(102,199,255,0.08)",
  },
  drawerBackBtnTop: {
    width: BACK_BTN_W,
    minWidth: BACK_BTN_W,
    height: 36,
    marginRight: TITLE_GAP,
    padding: 0,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    overflow: "hidden",
    padding: `10px 0 26px ${BACK_BTN_W + TITLE_GAP}px`,
    display: "flex",
  },
  drawerGrid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 22,
    alignItems: "stretch",
    maxWidth: "min(1120px, 100%)",
    minHeight: 0,
  },
  card: {
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: 0,
    color: "var(--tp-text-color)",
    minHeight: 0,
  },
  drawerBody: {
    minWidth: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  drawerInfoCardMobile: {
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 14,
    padding: 12,
    background: "var(--tp-control-bg-soft)",
  },

  drawerImage: {
    border: "none",
    borderRadius: 0,
    background: "transparent",
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
  },
  drawerImageInner: {
    height: "100%",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    alignItems: "stretch",
    justifyItems: "center",
    borderRadius: 0,
    background: "transparent",
  },
  drawerImageLogo: {
    opacity: 0.5,
    borderRadius: 0,
  },
  mainImageFallback: {
    width: "100%",
    height: "100%",
    gridRow: "1 / span 3",
  },
  mainImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: 0,
  },
  thumbRow: {
    width: "calc(100% - 24px)",
    display: "flex",
    gap: 10,
    padding: 12,
    justifyContent: "flex-start",
    alignSelf: "end",
    overflowX: "auto",
  },
  thumb: {
    width: 70,
    height: 70,
    borderRadius: 0,
    border: "none",
    background: "var(--tp-control-bg-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    color: "var(--tp-text-color)",
    cursor: "pointer",
    overflow: "hidden",
    padding: 0,
  },
  thumbActive: {},
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  drawerName: { fontSize: 24, marginBottom: 0, color: "var(--tp-text-color)" },
  drawerDetailStack: {
    marginTop: 50,
    display: "grid",
    gap: 8,
  },
  detailBlock: {
    marginTop: 30,
    display: "grid",
    gap: 8,
  },
  detailRow: {
    display: "grid",
    gap: 6,
  },
  detailLabel: {
    fontSize: 13,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 16,
    color: "var(--tp-text-color)",
  },
  drawerPriceRow: {
    marginTop: 24,
    display: "flex",
    alignItems: "baseline",
    gap: 14,
  },
  drawerPrice: { fontSize: 18, color: "var(--tp-text-color)" },
  drawerFormat: { fontSize: 14, opacity: 0.8 },

  drawerDesc: {
    color: "var(--tp-text-color)",
    opacity: 0.84,
    lineHeight: 1.55,
    fontSize: 14,
    borderTop: "none",
    paddingTop: 0,
  },
  drawerDescMuted: {
    color: "var(--tp-text-color)",
    opacity: 0.58,
    lineHeight: 1.55,
    fontSize: 14,
    borderTop: "none",
    paddingTop: 0,
  },

  drawerQtyRow: {
    marginTop: 14,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  qtyBtn: {
    borderRadius: 10,
    width: 36,
    height: 36,
    background: "transparent",
    color: "var(--tp-text-color)",
    border: "1px solid var(--tp-border-color)",
    cursor: "pointer",
    transition: "background 140ms ease, transform 120ms ease",
  },
  qtyGlyph: {
    lineHeight: 1,
    transform: "translateY(-1px)",
  },
  qty: {
    width: 30,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    color: "var(--tp-text-color)",
  },
  drawerFooterHint: {
    marginTop: 18,
    color: "var(--tp-text-color)",
    opacity: 0.58,
    fontSize: 13,
    letterSpacing: 0.5,
  },
};
