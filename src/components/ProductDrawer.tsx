// src/components/ProductDrawer.tsx
"use client";

import * as React from "react";
import type { Product } from "@/types/product";
import type { ProductImage } from "@/lib/products";
import { AppButton, GearIcon, QtyIcon } from "@/components/ui";
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

  const detailRowStyle = styles.detailRowInline;
  const purchaseRowStyle = isMobileViewport
    ? styles.drawerPurchaseRow
    : styles.drawerPurchaseRowDesktop;
  const priceStyle = isMobileViewport ? styles.drawerPrice : styles.drawerPriceDesktop;
  const formatStyle = isMobileViewport ? styles.drawerFormat : styles.drawerFormatDesktop;
  const qtyRowStyle = isMobileViewport ? styles.drawerQtyRow : styles.drawerQtyRowDesktop;
  const qtyBtnStyle = isMobileViewport ? styles.qtyBtn : styles.qtyBtnDesktop;
  const qtyTextStyle = isMobileViewport ? styles.qty : styles.qtyDesktop;
  const productTitle = product?.long_name || product?.name || "Product";
  const activeImageIndex = React.useMemo(() => {
    if (!orderedImages.length) return -1;
    const idx = orderedImages.findIndex((img) => img.url === activeImageUrl);
    return idx >= 0 ? idx : 0;
  }, [orderedImages, activeImageUrl]);
  const hasPrevImage = activeImageIndex > 0;
  const hasNextImage = activeImageIndex >= 0 && activeImageIndex < orderedImages.length - 1;
  const goPrevImage = React.useCallback(() => {
    if (!hasPrevImage) return;
    const prev = orderedImages[activeImageIndex - 1];
    if (prev?.url) setActiveImageUrl(prev.url);
  }, [hasPrevImage, orderedImages, activeImageIndex]);
  const goNextImage = React.useCallback(() => {
    if (!hasNextImage) return;
    const next = orderedImages[activeImageIndex + 1];
    if (next?.url) setActiveImageUrl(next.url);
  }, [hasNextImage, orderedImages, activeImageIndex]);

  if (!isOpen || !product) return null;

  const imageSection = (
    <div
      style={{
        ...styles.drawerImage,
      }}
    >
      <div style={styles.drawerImageInner}>
        <div
          style={styles.mainImageFrame}
          onClick={() => {
            if (hasNextImage) goNextImage();
          }}
        >
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
          {hasPrevImage ? (
            <button
              type="button"
              style={{ ...styles.mainImageNavBtn, ...styles.mainImageNavBtnLeft }}
              onClick={(e) => {
                e.stopPropagation();
                goPrevImage();
              }}
              aria-label="Previous image"
            >
              ‹
            </button>
          ) : null}
          {hasNextImage ? (
            <button
              type="button"
              style={{ ...styles.mainImageNavBtn, ...styles.mainImageNavBtnRight }}
              onClick={(e) => {
                e.stopPropagation();
                goNextImage();
              }}
              aria-label="Next image"
            >
              ›
            </button>
          ) : null}
        </div>

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
  );
  const detailsSection = (
    <>
      {!isMobileViewport ? (
        <div style={styles.drawerName}>{productTitle}</div>
      ) : null}
      <div style={styles.drawerDetailStack}>
        {product.cut ? (
          <div style={detailRowStyle}>
            <div style={styles.detailLabel}>Cut</div>
            <div style={styles.detailValue}>{product.cut}</div>
          </div>
        ) : null}

        {product.country_of_origin ? (
          <div style={detailRowStyle}>
            <div style={styles.detailLabel}>Country of Origin</div>
            <div style={styles.detailValue}>{product.country_of_origin}</div>
          </div>
        ) : null}
      </div>

      {(product.preparation || product.temperature || product.packaging) ? (
        <div style={styles.detailBlock}>
          {product.preparation ? (
            <div style={detailRowStyle}>
              <div style={styles.detailLabel}>Preparation</div>
              <div style={styles.detailValue}>{product.preparation}</div>
            </div>
          ) : null}
          {product.temperature ? (
            <div style={detailRowStyle}>
              <div style={styles.detailLabel}>Temperature</div>
              <div style={styles.detailValue}>{product.temperature}</div>
            </div>
          ) : null}
          {product.packaging ? (
            <div style={detailRowStyle}>
              <div style={styles.detailLabel}>Packaging</div>
              <div style={styles.detailValue}>{product.packaging}</div>
            </div>
          ) : null}
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

      {!isMobileViewport ? (
        <div style={purchaseRowStyle}>
          <div style={styles.drawerPriceGroup}>
            <div style={priceStyle}>₱ {formatMoney(product.selling_price)}</div>
            <div style={styles.drawerPer}>for</div>
            {formatSize(product) ? (
              <div style={formatStyle}>{formatSize(product)}</div>
            ) : null}
          </div>
          <div style={qtyRowStyle}>
            <AppButton
              type="button"
              variant="ghost"
              style={qtyBtnStyle}
              onClick={() => productId && onRemove(productId)}
              disabled={!productId}
            >
              <QtyIcon type="minus" />
            </AppButton>
            <div style={{ ...qtyTextStyle, width: 44 }}>{qty}</div>
            <AppButton
              type="button"
              variant="ghost"
              style={qtyBtnStyle}
              onClick={() => productId && onAdd(productId)}
              disabled={!productId}
            >
              <QtyIcon type="plus" />
            </AppButton>
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <div
        style={{
          ...styles.backdrop,
          ...(backgroundStyle ?? null),
          top: isMobileViewport ? 0 : panelTop,
          height: isMobileViewport ? "100vh" : panelHeight,
          ...(isMobileViewport
            ? {
                zIndex: 1450,
              }
            : null),
        }}
      />

      <aside
        className={isMobileViewport ? "tp-sheet-slide-up" : "tp-drawer-slide-up"}
        style={{
          ...styles.productPanel,
          ...(backgroundStyle ?? null),
          top: isMobileViewport ? 0 : panelTop,
          height: isMobileViewport ? "100vh" : panelHeight,
          ...(isMobileViewport
            ? {
                zIndex: 1500,
                width: "100vw",
                left: 0,
                transform: "none",
              }
            : null),
        }}
        aria-hidden={!isOpen}
      >
        <div style={styles.productPanelInner}>
          <div
            style={{
              ...styles.productTopBand,
              ...(isMobileViewport ? styles.productTopBandMobile : null),
              ...(!isMobileViewport ? styles.productTopBandDesktopOverlay : null),
            }}
          >
            <AppButton type="button" variant="ghost" style={styles.drawerBackBtnTop} onClick={onBack}>
              BACK
            </AppButton>
            {isMobileViewport ? <div style={styles.topTitle}>{productTitle}</div> : null}
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
              ...(isMobileViewport ? styles.contentMobile : null),
            }}
          >
            {isMobileViewport ? (
              <div style={styles.mobileContentStack}>
                <div style={styles.card}>{imageSection}</div>
                <div style={styles.card}>
                  <div
                    style={{
                      ...styles.drawerBody,
                      ...styles.drawerInfoCardMobile,
                      height: "auto",
                      overflowY: "visible",
                    }}
                  >
                    {detailsSection}
                  </div>
                </div>
              </div>
            ) : (
              <div style={styles.drawerGrid}>
                <div style={styles.card}>{imageSection}</div>
                <div style={styles.card}>
                  <div style={styles.drawerBody}>
                    {detailsSection}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {isMobileViewport ? (
          <div style={styles.mobilePurchaseBar}>
            <div style={styles.mobilePurchaseBarInner}>
              <div style={styles.drawerPriceGroup}>
                <div style={priceStyle}>₱ {formatMoney(product.selling_price)}</div>
                <div style={styles.drawerPer}>for</div>
                {formatSize(product) ? (
                  <div style={formatStyle}>{formatSize(product)}</div>
                ) : null}
              </div>
              <div style={qtyRowStyle}>
                <AppButton
                  type="button"
                  variant="ghost"
                  style={styles.qtyBtnDesktop}
                  onClick={() => productId && onRemove(productId)}
                  disabled={!productId}
                >
                  <QtyIcon type="minus" />
                </AppButton>
                <div style={{ ...qtyTextStyle, width: 44 }}>{qty}</div>
                <AppButton
                  type="button"
                  variant="ghost"
                  style={styles.qtyBtnDesktop}
                  onClick={() => productId && onAdd(productId)}
                  disabled={!productId}
                >
                  <QtyIcon type="plus" />
                </AppButton>
              </div>
            </div>
          </div>
        ) : null}
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
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  productTopBand: {
    minHeight: 64,
    display: "flex",
    alignItems: "center",
    gap: 0,
    padding: "18px 0 15px",
  },
  productTopBandMobile: {
    minHeight: 66,
    padding: "13px 15px",
    borderBottom: "1px solid rgba(255,255,255,0.3)",
  },
  productTopBandDesktopOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 0.5,
    color: "var(--tp-text-color)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
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
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 1,
    border: "none",
    background: "transparent",
    justifyContent: "flex-start",
    textAlign: "left",
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    padding: `23px 0 46px ${BACK_BTN_W + TITLE_GAP}px`,
    display: "flex",
  },
  contentMobile: {
    display: "block",
    width: "100%",
    padding: "10px 15px calc(132px + env(safe-area-inset-bottom))",
    overflowY: "auto",
    overflowX: "hidden",
    minHeight: 0,
    WebkitOverflowScrolling: "touch",
  },
  drawerGrid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 32,
    alignItems: "start",
    maxWidth: "min(1120px, 100%)",
    minHeight: 0,
  },
  mobileContentStack: {
    width: "100%",
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 18,
    alignItems: "start",
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
    height: "auto",
    display: "flex",
    flexDirection: "column",
    overflowY: "visible",
  },
  drawerInfoCardMobile: {
    border: "none",
    borderRadius: 14,
    padding: 12,
    background: "transparent",
  },

  drawerImage: {
    border: "none",
    borderRadius: 14,
    background: "transparent",
    minHeight: 0,
    height: "auto",
    overflow: "hidden",
  },
  drawerImageInner: {
    height: "auto",
    display: "grid",
    gridTemplateRows: "minmax(0,1fr) auto",
    alignItems: "stretch",
    justifyItems: "center",
    borderRadius: 14,
    background: "transparent",
  },
  mainImageFrame: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 14,
    background: "transparent",
    overflow: "hidden",
    position: "relative",
    cursor: "pointer",
  },
  mainImageNavBtn: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 65,
    height: 65,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.8)",
    fontSize: 65,
    lineHeight: "65px",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    userSelect: "none",
  },
  mainImageNavBtnLeft: {
    left: 8,
  },
  mainImageNavBtnRight: {
    right: 8,
  },
  drawerImageLogo: {
    opacity: 0.5,
    borderRadius: 0,
  },
  mainImageFallback: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
  },
  mainImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: 0,
  },
  thumbRow: {
    marginTop: 12,
    width: "calc(100% - 24px)",
    display: "flex",
    gap: 10,
    padding: 12,
    justifyContent: "flex-start",
    overflowX: "auto",
  },
  thumb: {
    width: 70,
    height: 70,
    borderRadius: 10,
    border: "none",
    background: "var(--tp-control-bg-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    color: "var(--tp-text-color)",
    cursor: "pointer",
    overflow: "hidden",
    padding: 0,
  },
  thumbActive: {
    border: "1px solid rgba(255,255,255,0.9)",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: 10,
  },

  drawerDetailStack: {
    marginTop: 0,
    display: "grid",
    gap: 8,
  },
  drawerName: {
    fontSize: 24,
    marginBottom: 30,
    color: "var(--tp-text-color)",
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
  detailRowInline: {
    display: "grid",
    gridTemplateColumns: "170px minmax(0,1fr)",
    alignItems: "baseline",
    columnGap: 10,
  },
  detailLabel: {
    fontSize: 16,
    letterSpacing: 0.2,
    textTransform: "none",
    opacity: 0.65,
  },
  detailValue: {
    fontSize: 16,
    color: "var(--tp-text-color)",
  },
  drawerPurchaseRow: {
    marginTop: 24,
    display: "flex",
    alignItems: "center",
    gap: 50,
    flexWrap: "wrap",
  },
  drawerPurchaseRowDesktop: {
    marginTop: 44,
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    gap: 60,
    flexWrap: "wrap",
  },
  drawerPriceGroup: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 12,
  },
  drawerPrice: { fontSize: 18, fontWeight: 800, color: "var(--tp-text-color)" },
  drawerPriceDesktop: { fontSize: 22, fontWeight: 800, color: "var(--tp-text-color)" },
  drawerPer: { fontSize: 14, opacity: 0.7, textTransform: "lowercase" },
  drawerFormat: { fontSize: 15, fontWeight: 700, opacity: 0.9 },
  drawerFormatDesktop: { fontSize: 18, fontWeight: 700, opacity: 0.95 },

  drawerDesc: {
    color: "var(--tp-text-color)",
    opacity: 0.84,
    lineHeight: 1.55,
    fontSize: 16,
    borderTop: "none",
    paddingTop: 0,
  },
  drawerDescMuted: {
    color: "var(--tp-text-color)",
    opacity: 0.58,
    lineHeight: 1.55,
    fontSize: 16,
    borderTop: "none",
    paddingTop: 0,
  },

  drawerQtyRow: {
    display: "grid",
    gridTemplateColumns: "44px 44px 44px",
    alignItems: "center",
    gap: 10,
  },
  drawerQtyRowDesktop: {
    display: "grid",
    gridTemplateColumns: "44px 44px 44px",
    alignItems: "center",
    gap: 10,
  },
  qtyBtn: {
    borderRadius: 12,
    width: 44,
    height: 44,
    padding: 0,
    background: "transparent",
    color: "var(--tp-text-color)",
    border: "1px solid var(--tp-border-color)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    transition: "background 140ms ease, transform 120ms ease",
  },
  qtyBtnDesktop: {
    borderRadius: 12,
    width: 44,
    height: 44,
    padding: 0,
    background: "transparent",
    color: "var(--tp-text-color)",
    border: "1px solid var(--tp-border-color)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    transition: "background 140ms ease, transform 120ms ease",
  },
  qty: {
    width: 44,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    color: "var(--tp-text-color)",
    fontSize: 16,
    fontWeight: 900,
    opacity: 0.9,
  },
  qtyDesktop: {
    width: 44,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    color: "var(--tp-text-color)",
    fontSize: 16,
    fontWeight: 900,
    opacity: 0.9,
    lineHeight: 1,
  },
  mobilePurchaseBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    padding: "13px 15px calc(13px + env(safe-area-inset-bottom, 0px))",
    background: "var(--tp-page-bg)",
    borderTop: "1px solid var(--tp-border-color-soft)",
  },
  mobilePurchaseBarInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "nowrap",
  },
};
