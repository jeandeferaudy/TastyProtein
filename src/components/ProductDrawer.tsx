// src/components/ProductDrawer.tsx
"use client";

import * as React from "react";
import type { Product } from "@/types/product";
import type { ProductImage } from "@/lib/products";
import { getDeliveryPricingMatrixRows } from "@/lib/deliveryPricing";
import { AppButton, GearIcon, QtyIcon, TOPBAR_FONT_SIZE } from "@/components/ui";
import LogoPlaceholder from "@/components/LogoPlaceholder";
import ProductCard from "@/components/ProductCard";
const BACK_BTN_W = 68;
const TITLE_GAP = 40;

type Props = {
  isOpen: boolean;
  topOffset: number;
  product: Product | null;
  images: ProductImage[];
  qty: number;
  cartQtyById?: Record<string, number>;
  relatedProducts?: Product[];
  popularProducts?: Product[];
  backgroundStyle?: React.CSSProperties;
  canEdit?: boolean;

  onBack: () => void;
  onEdit?: (id: string) => void;
  onOpenProduct?: (id: string) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onSetQty?: (id: string, qty: number) => void;

  formatMoney: (n: unknown) => string;
};

function formatSizeG(size_g?: number | null) {
  if (!size_g || size_g <= 0) return "";
  return `${size_g}g`;
}

function formatSize(p: Product) {
  return p.size?.trim() || formatSizeG(p.size_g) || "";
}

function splitLovePoints(value: string | null | undefined) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s\-*•]+/, "").trim())
    .filter(Boolean);
}

function StripChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      style={direction === "left" ? undefined : { transform: "rotate(180deg)" }}
    >
      <path
        d="M12.5 4.5L7 10l5.5 5.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ProductDrawer({
  isOpen,
  topOffset,
  product,
  images,
  qty,
  cartQtyById = {},
  relatedProducts = [],
  popularProducts = [],
  backgroundStyle,
  canEdit = false,
  onBack,
  onEdit,
  onOpenProduct,
  onAdd,
  onRemove,
  onSetQty,
  formatMoney,
}: Props) {
  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const [deliveryPricingOpen, setDeliveryPricingOpen] = React.useState(false);
  const relatedStripRef = React.useRef<HTMLDivElement | null>(null);
  const [canScrollRelatedLeft, setCanScrollRelatedLeft] = React.useState(false);
  const [canScrollRelatedRight, setCanScrollRelatedRight] = React.useState(false);
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
  const deliveryPricingRows = React.useMemo(() => getDeliveryPricingMatrixRows(), []);

  React.useEffect(() => {
    setActiveImageUrl(defaultMainImage);
  }, [defaultMainImage, productId]);

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    if (!deliveryPricingOpen) return;
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setDeliveryPricingOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [deliveryPricingOpen]);

  React.useEffect(() => {
    const el = relatedStripRef.current;
    if (!el) return;
    const getStep = () => {
      const first = el.firstElementChild as HTMLElement | null;
      const firstWidth = first?.getBoundingClientRect().width ?? 220;
      const style = window.getComputedStyle(el);
      const gap = Number.parseFloat(style.columnGap || style.gap || "10") || 10;
      return firstWidth + gap;
    };
    const update = () => {
      const step = getStep();
      const maxIndex = Math.max(0, Math.round((el.scrollWidth - el.clientWidth) / step));
      const currentIndex = Math.round(el.scrollLeft / step);
      setCanScrollRelatedLeft(currentIndex > 0);
      setCanScrollRelatedRight(currentIndex < maxIndex);
    };
    update();
    const t = window.setTimeout(update, 80);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.clearTimeout(t);
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [relatedProducts.length, isMobileViewport]);

  const scrollRelatedBy = React.useCallback((direction: -1 | 1) => {
    const el = relatedStripRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const firstWidth = first?.getBoundingClientRect().width ?? 220;
    const style = window.getComputedStyle(el);
    const gap = Number.parseFloat(style.columnGap || style.gap || "10") || 10;
    const step = firstWidth + gap;
    const maxIndex = Math.max(0, Math.round((el.scrollWidth - el.clientWidth) / step));
    const currentIndex = Math.round(el.scrollLeft / step);
    const nextIndex = Math.max(0, Math.min(maxIndex, currentIndex + direction));
    el.scrollTo({ left: nextIndex * step, behavior: "smooth" });
  }, []);

  const detailRowStyle = styles.detailRowInline;
  const priceStyle = isMobileViewport ? styles.drawerPrice : styles.drawerPriceDesktop;
  const formatStyle = isMobileViewport ? styles.drawerFormat : styles.drawerFormatDesktop;
  const qtyRowStyle = isMobileViewport ? styles.drawerQtyRow : styles.drawerQtyRowDesktop;
  const qtyBtnStyle = isMobileViewport ? styles.qtyBtn : styles.qtyBtnDesktop;
  const qtyTextStyle = isMobileViewport ? styles.qty : styles.qtyDesktop;
  const productTitle = product?.long_name || product?.name || "Product";
  const lovePoints = React.useMemo(() => splitLovePoints(product?.love_points), [product?.love_points]);
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
  const topDetailsSection = (
    <>
      {!isMobileViewport ? (
        <div style={styles.drawerName}>{productTitle}</div>
      ) : null}

      {product.callout_text ? (
        <div style={styles.detailBlockTight}>
          <div style={styles.drawerCallout}>{product.callout_text}</div>
        </div>
      ) : null}

      <div style={styles.drawerDetailStack}>
        {product.cut ? (
          <div style={detailRowStyle}>
            <div style={styles.detailLabel}>Cut</div>
            <div style={styles.detailValue}>{product.cut}</div>
          </div>
        ) : null}

        {product.thickness ? (
          <div style={detailRowStyle}>
            <div style={styles.detailLabel}>Thickness</div>
            <div style={styles.detailValue}>{product.thickness}</div>
          </div>
        ) : null}

        {product.country_of_origin ? (
          <div style={detailRowStyle}>
            <div style={styles.detailLabel}>Country of Origin</div>
            <div style={styles.detailValue}>{product.country_of_origin}</div>
          </div>
        ) : null}
      </div>

      {lovePoints.length > 0 ? (
        <div style={styles.detailBlock}>
          <div
            style={
              isMobileViewport ? styles.loveRowMobile : styles.loveRow
            }
          >
            <div style={styles.detailLabel}>Why People Love It</div>
            <ul style={styles.loveList}>
            {lovePoints.map((point, index) => (
              <li key={`${index}-${point}`} style={styles.loveItem}>
                {point}
              </li>
            ))}
            </ul>
          </div>
        </div>
      ) : null}

      {!isMobileViewport ? (
        <div style={styles.purchaseInfoStack}>
          <div style={detailRowStyle}>
            <div style={styles.detailLabel}>Format</div>
            <div style={styles.detailValue}>{formatSize(product) || "—"}</div>
          </div>
          <div style={{ ...detailRowStyle, ...styles.priceRowSpacing }}>
            <div style={styles.detailLabel}>Price</div>
            <div style={priceStyle}>₱ {formatMoney(product.selling_price)}</div>
          </div>
          <div style={detailRowStyle}>
            <div style={styles.detailLabel}>Add to cart</div>
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
        </div>
      ) : null}
    </>
  );

  const lowerDetailsSection = (
    <>
      <div style={styles.detailBlockWide}>
        <div style={styles.detailLabel}>Description</div>
        {product.description ? (
          <div style={styles.drawerDesc}>{product.description}</div>
        ) : (
          <div style={styles.drawerDescMuted}>No description yet.</div>
        )}
      </div>

      {(product.preparation || product.temperature || product.packaging) ? (
        <div style={styles.detailBlockWide}>
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

      <div style={styles.detailBlockWide}>
        <div
          style={
            isMobileViewport
              ? { ...styles.shopWhyHeaderRow, ...styles.shopWhyHeaderRowMobile }
              : styles.shopWhyHeaderRow
          }
        >
          <div style={styles.shopWhyEyebrow}>Why shop from us</div>
          <div style={styles.shopWhyTitle}>GOOD QUALITY AND FAST DELIVERY AT THE RIGHT PRICE</div>
        </div>
        <div
          style={
            isMobileViewport
              ? { ...styles.shopWhyRow, ...styles.shopWhyRowMobile }
              : styles.shopWhyRow
          }
        >
          <div style={styles.shopWhyCard}>
            <div style={styles.shopWhyBadge}>FREE SHIPPING</div>
            <button
              type="button"
              style={styles.shopWhyLinkBtn}
              onClick={() => setDeliveryPricingOpen(true)}
            >
              See minimum spending per area to unlock FREE delivery every time.
            </button>
          </div>
          <div style={styles.shopWhyCard}>
            <div style={styles.shopWhyBadge}>IN STOCK</div>
            <div style={styles.shopWhyText}>Ready for immediate preparation from our temperature controlled storage.</div>
          </div>
          <div style={styles.shopWhyCard}>
            <div style={styles.shopWhyBadge}>EXPRESS / SAME-DAY DELIVERY</div>
            <div style={styles.shopWhyText}>Order before 9pm to enjoy same day EXPRESS delivery.</div>
          </div>
        </div>
      </div>

      <div style={styles.detailBlockWide}>
        <div style={{ ...styles.stripTitle, marginTop: 20 }}>Products From The Same Category</div>
        <div style={styles.productStripWrap}>
          <button
            type="button"
            aria-label="Previous related products"
            onClick={() => scrollRelatedBy(-1)}
            disabled={!canScrollRelatedLeft}
            style={{
              ...styles.stripArrowBtn,
              ...(canScrollRelatedLeft ? null : styles.stripArrowBtnDisabled),
            }}
          >
            <StripChevronIcon direction="left" />
          </button>
        <div ref={relatedStripRef} style={styles.productStripRow}>
          {relatedProducts.length === 0 ? (
            <div style={styles.drawerDescMuted}>No related products yet.</div>
          ) : (
            relatedProducts.map((item) => {
              const id = String(item.id);
              const itemQty = Math.max(0, Number(cartQtyById[id] ?? 0));
              return (
                <div key={id} style={styles.stripTileWrap}>
                  <ProductCard
                    product={item}
                    qty={itemQty}
                    viewMode="4"
                    onOpen={(nextId) => onOpenProduct?.(nextId)}
                    onAdd={onAdd}
                    onRemove={onRemove}
                    onSetQty={(nextId, nextQty) => onSetQty?.(nextId, nextQty)}
                    formatMoney={formatMoney}
                  />
                </div>
              );
            })
          )}
        </div>
          <button
            type="button"
            aria-label="Next related products"
            onClick={() => scrollRelatedBy(1)}
            disabled={!canScrollRelatedRight}
            style={{
              ...styles.stripArrowBtn,
              ...(canScrollRelatedRight ? null : styles.stripArrowBtnDisabled),
            }}
          >
            <StripChevronIcon direction="right" />
          </button>
        </div>
      </div>

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
          {isMobileViewport ? (
            <>
              <div
                style={{
                  ...styles.productTopBand,
                  ...styles.productTopBandMobile,
                }}
              >
                <AppButton type="button" variant="ghost" style={styles.drawerBackBtnTop} onClick={onBack}>
                  BACK
                </AppButton>
                <div style={styles.topTitle}>{productTitle}</div>
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
                  ...styles.contentMobile,
                }}
              >
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
                      {topDetailsSection}
                      {lowerDetailsSection}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={styles.desktopShell}>
              <div style={styles.desktopBackRail}>
                <AppButton type="button" variant="ghost" style={styles.drawerBackBtnTop} onClick={onBack}>
                  BACK
                </AppButton>
              </div>

              <div style={styles.desktopScrollArea}>
                <div style={styles.desktopContent}>
                  {canEdit && onEdit && productId ? (
                    <div style={styles.desktopHeader}>
                      <div style={styles.topSpacer} />
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
                    </div>
                  ) : null}

                  <div style={styles.drawerGrid}>
                    <div style={{ ...styles.card, ...styles.desktopImageCell }}>{imageSection}</div>
                    <div style={{ ...styles.card, ...styles.desktopInfoCell }}>
                      <div style={styles.drawerBody}>{topDetailsSection}</div>
                    </div>
                    <div style={{ ...styles.card, ...styles.desktopDescriptionCell }}>
                      <div style={styles.drawerBodyWide}>{lowerDetailsSection}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
      {deliveryPricingOpen ? (
        <div
          style={styles.deliveryPricingBackdrop}
          onClick={() => setDeliveryPricingOpen(false)}
          role="presentation"
        >
          <div
            style={styles.deliveryPricingModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Delivery pricing matrix"
          >
            <div style={styles.deliveryPricingHeader}>
              <div style={styles.deliveryPricingTitle}>DELIVERY PRICING MATRIX</div>
              <AppButton
                type="button"
                variant="ghost"
                style={styles.deliveryPricingCloseBtn}
                onClick={() => setDeliveryPricingOpen(false)}
              >
                CLOSE
              </AppButton>
            </div>
            <div style={styles.deliveryPricingSubtitle}>
              Free delivery is automatically unlocked once your subtotal reaches the minimum for your area.
            </div>

            {isMobileViewport ? (
              <div style={styles.deliveryPricingCardList}>
                {deliveryPricingRows.map((row) => (
                  <div key={`${row.postalCodes}-${row.area}`} style={styles.deliveryPricingCard}>
                    <div style={styles.deliveryPricingCardRow}>
                      <span style={styles.deliveryPricingCardLabel}>Area</span>
                      <span style={styles.deliveryPricingCardValue}>{row.area}</span>
                    </div>
                    <div style={styles.deliveryPricingCardRow}>
                      <span style={styles.deliveryPricingCardLabel}>Free from</span>
                      <span style={styles.deliveryPricingCardValue}>₱ {formatMoney(row.freeFromPhp)}</span>
                    </div>
                    <div style={styles.deliveryPricingCardRow}>
                      <span style={styles.deliveryPricingCardLabel}>Fee below min</span>
                      <span style={styles.deliveryPricingCardValue}>₱ {formatMoney(row.feeBelowMinPhp)}</span>
                    </div>
                    <div style={styles.deliveryPricingCardRow}>
                      <span style={styles.deliveryPricingCardLabel}>Postcode(s)</span>
                      <span style={styles.deliveryPricingCardValue}>{row.postalCodes}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.deliveryPricingTableWrap}>
                <div style={styles.deliveryPricingTableHeaderRow}>
                  <div style={styles.deliveryPricingHeaderCell}>AREA</div>
                  <div style={styles.deliveryPricingHeaderCell}>FREE DELIVERY FROM</div>
                  <div style={styles.deliveryPricingHeaderCell}>FEE BELOW MIN</div>
                  <div style={styles.deliveryPricingHeaderCell}>POSTCODE(S)</div>
                </div>
                {deliveryPricingRows.map((row) => (
                  <div key={`${row.postalCodes}-${row.area}`} style={styles.deliveryPricingBodyRow}>
                    <div style={styles.deliveryPricingCell}>{row.area}</div>
                    <div style={styles.deliveryPricingCell}>₱ {formatMoney(row.freeFromPhp)}</div>
                    <div style={styles.deliveryPricingCell}>₱ {formatMoney(row.feeBelowMinPhp)}</div>
                    <div style={styles.deliveryPricingCell}>{row.postalCodes}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
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
  desktopShell: {
    height: "100%",
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: `${BACK_BTN_W}px minmax(0, 1fr)`,
    columnGap: TITLE_GAP,
    padding: "18px 0 0",
  },
  desktopBackRail: {
    minHeight: 0,
    display: "flex",
    alignItems: "flex-start",
  },
  desktopScrollArea: {
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    paddingRight: 4,
  },
  desktopContent: {
    width: "100%",
    maxWidth: "min(1120px, 100%)",
    paddingBottom: 20,
  },
  desktopHeader: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 0,
    marginBottom: 23,
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
  topTitle: {
    fontSize: TOPBAR_FONT_SIZE,
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
    marginRight: 0,
    padding: 0,
    borderRadius: 8,
    fontSize: TOPBAR_FONT_SIZE,
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
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gridTemplateRows: "auto auto",
    gap: 32,
    alignItems: "start",
    width: "100%",
    minHeight: 0,
  },
  desktopImageCell: {
    gridColumn: "1 / 2",
    gridRow: "1 / 2",
  },
  desktopInfoCell: {
    gridColumn: "2 / 3",
    gridRow: "1 / 2",
  },
  desktopDescriptionCell: {
    gridColumn: "1 / 3",
    gridRow: "2 / 3",
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
    border: "1px solid var(--tp-border-color-soft)",
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
    objectFit: "cover",
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
    gap: 9,
  },
  drawerName: {
    fontSize: 24,
    fontWeight: 800,
    marginBottom: 30,
    color: "var(--tp-text-color)",
  },
  detailBlockTight: {
    marginTop: 0,
    display: "grid",
    gap: 0,
  },
  detailBlock: {
    marginTop: 8,
    display: "grid",
    gap: 8,
  },
  detailBlockWide: {
    marginTop: 30,
    display: "grid",
    gap: 8,
    width: "100%",
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
  purchaseInfoStack: {
    marginTop: 44,
    marginBottom: 20,
    display: "grid",
    gap: 9,
  },
  priceRowSpacing: {
    marginBottom: 10,
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
    whiteSpace: "pre-wrap",
  },
  drawerCallout: {
    color: "var(--tp-text-color)",
    fontWeight: 600,
    lineHeight: 1.45,
    fontSize: 15,
    marginBottom: 20,
    opacity: 0.88,
  },
  drawerDescMuted: {
    color: "var(--tp-text-color)",
    opacity: 0.58,
    lineHeight: 1.55,
    fontSize: 16,
    borderTop: "none",
    paddingTop: 0,
  },
  drawerBodyWide: {
    width: "100%",
    color: "var(--tp-text-color)",
    marginTop: 0,
  },
  loveList: {
    margin: 0,
    paddingLeft: 0,
    listStyle: "none",
  },
  loveRow: {
    display: "grid",
    gridTemplateColumns: "170px minmax(0,1fr)",
    alignItems: "start",
    columnGap: 10,
  },
  loveRowMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    rowGap: 6,
  },
  loveItem: {
    display: "block",
    color: "var(--tp-text-color)",
    opacity: 0.9,
    lineHeight: 1.5,
    fontSize: 16,
    marginBottom: 8,
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
  shopWhyEyebrow: {
    fontSize: 16,
    opacity: 0.65,
    letterSpacing: 0.2,
  },
  shopWhyHeaderRow: {
    display: "grid",
    gridTemplateColumns: "170px minmax(0,1fr)",
    alignItems: "baseline",
    columnGap: 10,
    marginBottom: 5,
  },
  shopWhyHeaderRowMobile: {
    gridTemplateColumns: "1fr",
    rowGap: 6,
  },
  shopWhyTitle: {
    fontSize: 22.4,
    fontWeight: 900,
    letterSpacing: 0.6,
  },
  shopWhyRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(220px, 1fr))",
    gap: 10,
    marginLeft: 180,
    width: "calc(100% - 180px)",
  },
  shopWhyRowMobile: {
    gridTemplateColumns: "1fr",
    marginLeft: 0,
    width: "100%",
  },
  shopWhyCard: {
    borderRadius: 12,
    border: "1px solid var(--tp-border-color-soft)",
    background: "transparent",
    padding: 14,
    minHeight: 112,
  },
  shopWhyBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    minHeight: 42,
    padding: "0 12px",
    fontWeight: 900,
    fontSize: 13,
    lineHeight: 1.2,
    textAlign: "center",
    color: "#0c2b58",
    background: "#f4c400",
    marginBottom: 10,
  },
  shopWhyBadgePlain: {
    fontWeight: 900,
    fontSize: 13,
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  shopWhyText: {
    fontSize: 14,
    lineHeight: 1.45,
    opacity: 0.84,
  },
  shopWhyLinkBtn: {
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    textAlign: "left",
    padding: 0,
    margin: 0,
    fontSize: 14,
    lineHeight: 1.45,
    opacity: 0.92,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  },
  deliveryPricingBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 2100,
    background: "rgba(0, 0, 0, 0.66)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  deliveryPricingModal: {
    width: "min(980px, calc(100vw - 32px))",
    maxHeight: "min(82vh, 920px)",
    overflowY: "auto",
    borderRadius: 14,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-page-bg)",
    boxShadow: "0 20px 56px rgba(0,0,0,0.45)",
    padding: 16,
  },
  deliveryPricingHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  deliveryPricingTitle: {
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: 0.6,
  },
  deliveryPricingCloseBtn: {
    height: 34,
    minWidth: 86,
    borderRadius: 10,
    padding: "0 14px",
  },
  deliveryPricingSubtitle: {
    fontSize: 14,
    lineHeight: 1.5,
    opacity: 0.84,
    marginBottom: 14,
  },
  deliveryPricingTableWrap: {
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 12,
    overflow: "hidden",
  },
  deliveryPricingTableHeaderRow: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr",
    background: "var(--tp-control-bg-soft)",
    borderBottom: "1px solid var(--tp-border-color-soft)",
  },
  deliveryPricingHeaderCell: {
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.5,
    opacity: 0.84,
  },
  deliveryPricingBodyRow: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr",
    borderBottom: "1px solid var(--tp-border-color-soft)",
  },
  deliveryPricingCell: {
    padding: "10px 12px",
    fontSize: 14,
    lineHeight: 1.4,
  },
  deliveryPricingCardList: {
    display: "grid",
    gap: 10,
  },
  deliveryPricingCard: {
    borderRadius: 12,
    border: "1px solid var(--tp-border-color-soft)",
    padding: 12,
    background: "var(--tp-control-bg-soft)",
  },
  deliveryPricingCardRow: {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: 8,
    alignItems: "start",
    marginBottom: 6,
  },
  deliveryPricingCardLabel: {
    fontSize: 12,
    letterSpacing: 0.4,
    opacity: 0.74,
    textTransform: "uppercase",
  },
  deliveryPricingCardValue: {
    fontSize: 14,
    lineHeight: 1.4,
  },
  stripTitle: {
    fontSize: 16,
    letterSpacing: 0.2,
    opacity: 0.65,
    marginBottom: 12,
  },
  productStripWrap: {
    display: "grid",
    gridTemplateColumns: "46px minmax(0,1fr) 46px",
    gap: 0,
    alignItems: "stretch",
  },
  productStripRow: {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(220px, 220px)",
    gap: 10,
    overflowX: "hidden",
    paddingBottom: 4,
    scrollSnapType: "x mandatory",
  },
  stripArrowBtn: {
    width: "100%",
    height: "100%",
    minHeight: 100,
    borderRadius: 0,
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    fontSize: 0,
    lineHeight: 0,
    padding: 0,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  stripArrowBtnDisabled: {
    opacity: 0.35,
    cursor: "default",
  },
  stripTileWrap: {
    width: 220,
    minWidth: 220,
    scrollSnapAlign: "start",
  },
};
