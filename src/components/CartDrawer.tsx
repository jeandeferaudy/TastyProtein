// src/components/CartDrawer.tsx
"use client";

import * as React from "react";
import type { CartItem } from "@/lib/cart";
import { AppButton, QtyIcon, TOPBAR_FONT_SIZE } from "@/components/ui";
import LogoPlaceholder from "@/components/LogoPlaceholder";

type Props = {
  isOpen: boolean;
  items: CartItem[];
  subtotal: number;
  backgroundStyle?: React.CSSProperties;

  onClose: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
  onOpenProduct: (id: string) => void;
  onCheckout: () => void;

  formatMoney: (n: unknown) => string;
};

export default function CartDrawer({
  isOpen,
  items,
  subtotal,
  backgroundStyle,
  onClose,
  onAdd,
  onRemove,
  onSetQty,
  onOpenProduct,
  onCheckout,
  formatMoney,
}: Props) {
  const suppressRowOpenRef = React.useRef(false);
  const qtyInteractionTimerRef = React.useRef<number | null>(null);
  const markQtyInteraction = React.useCallback(() => {
    if (qtyInteractionTimerRef.current) {
      window.clearTimeout(qtyInteractionTimerRef.current);
      qtyInteractionTimerRef.current = null;
    }
    suppressRowOpenRef.current = true;
    qtyInteractionTimerRef.current = window.setTimeout(() => {
      suppressRowOpenRef.current = false;
      qtyInteractionTimerRef.current = null;
    }, 220);
  }, []);
  React.useEffect(() => {
    return () => {
      if (qtyInteractionTimerRef.current) {
        window.clearTimeout(qtyInteractionTimerRef.current);
        qtyInteractionTimerRef.current = null;
      }
    };
  }, []);

  const qtyCount = items.reduce((sum, i) => sum + Math.max(0, Number(i.qty) || 0), 0);
  const hasOverLimitItems = items.some(
    (i) =>
      !Boolean(i.unlimitedStock) &&
      Math.max(0, Number(i.qty) || 0) > Math.max(0, Number(i.qtyAvailable ?? 0))
  );
  const [editingQtyId, setEditingQtyId] = React.useState<string | null>(null);
  const [editingQtyDraft, setEditingQtyDraft] = React.useState<string>("");
  const commitQty = React.useCallback(
    (productId: string) => {
      const parsed = Math.max(0, Math.floor(Number(editingQtyDraft || 0)));
      onSetQty(productId, parsed);
      setEditingQtyId(null);
    },
    [editingQtyDraft, onSetQty]
  );

  return (
    <aside
      style={{
        ...styles.panel,
        ...(backgroundStyle ?? null),
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        pointerEvents: isOpen ? "auto" : "none",
      }}
      aria-hidden={!isOpen}
    >
      <div style={styles.header}>
        <div style={styles.title}>CART</div>
        <AppButton variant="ghost" style={styles.btn} onClick={onClose} type="button" aria-label="Close">
          CLOSE
        </AppButton>
      </div>

      <div style={styles.body}>
        {items.length === 0 ? (
          <div style={styles.empty}>Your cart is empty.</div>
        ) : (
          items.map((i) => {
            const productId = String(i.productId);
            const qty = Math.max(0, Number(i.qty) || 0);
            const qtyAvailable = Math.max(0, Number(i.qtyAvailable ?? 0));
            const isStockLimited = !Boolean(i.unlimitedStock);
            const isHardOos = isStockLimited && qtyAvailable < 1;
            const isOverLimit = isStockLimited && qty > qtyAvailable;

            return (
            <div
              key={productId}
              style={styles.line}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                if (suppressRowOpenRef.current) return;
                const target = e.target as HTMLElement | null;
                if (target?.closest("[data-qty-control='1']")) return;
                onOpenProduct(productId);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenProduct(productId);
                }
              }}
            >
              <div style={styles.thumbWrap}>
                {i.thumbnailUrl ? (
                  <img src={i.thumbnailUrl} alt="" style={styles.thumbImg} />
                ) : (
                  <LogoPlaceholder />
                )}
                {isHardOos ? <div style={styles.thumbOosOverlay}>OOS</div> : null}
              </div>
              <div style={styles.left}>
                <div style={styles.name}>{i.name ?? "Unnamed product"}</div>
                <div style={styles.meta}>
                  {[i.country, i.temperature].filter(Boolean).join(" • ") || "—"}
                </div>
                <div style={styles.perPiece}>
                  ₱ {formatMoney(i.price)} for {i.size || "pc"}
                </div>
              </div>

              <div style={styles.right}>
                <div style={styles.lineTotal}>₱ {formatMoney(i.lineTotal)}</div>
                {isHardOos ? (
                  <div
                    data-qty-control="1"
                    style={styles.oosGroup}
                    onClick={(e) => {
                      markQtyInteraction();
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      markQtyInteraction();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      markQtyInteraction();
                      e.stopPropagation();
                    }}
                  >
                    <AppButton
                      variant="ghost"
                      style={{ ...styles.pmBtn, ...styles.pmBtnTrash, opacity: qty > 0 ? 1 : 0.45 }}
                      disabled={qty <= 0}
                      onClick={(e) => {
                        markQtyInteraction();
                        e.stopPropagation();
                        onSetQty(productId, 0);
                      }}
                      aria-label="Remove item"
                    >
                      <span style={styles.oosRemoveX} aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="100%" height="100%">
                          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </span>
                    </AppButton>
                    <div style={{ ...styles.qty, ...styles.qtyOos }}>{qty}</div>
                    <AppButton variant="ghost" style={{ ...styles.pmBtn, ...styles.pmBtnMuted }} disabled>
                      <QtyIcon type="plus" />
                    </AppButton>
                  </div>
                ) : (
                  <div
                    data-qty-control="1"
                    style={styles.pmRow}
                    onClick={(e) => {
                      markQtyInteraction();
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      markQtyInteraction();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      markQtyInteraction();
                      e.stopPropagation();
                    }}
                  >
                    <AppButton
                      variant="ghost"
                      style={{ ...styles.pmBtn, opacity: qty > 0 ? 1 : 0.4 }}
                      disabled={qty <= 0}
                      onClick={(e) => {
                        markQtyInteraction();
                        e.stopPropagation();
                        onRemove(productId);
                      }}
                    >
                      <QtyIcon type="minus" />
                    </AppButton>

                    {editingQtyId === productId ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editingQtyDraft}
                        onChange={(e) => setEditingQtyDraft(e.target.value)}
                        onBlur={(e) => {
                          e.stopPropagation();
                          commitQty(productId);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            commitQty(productId);
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
                          markQtyInteraction();
                          e.stopPropagation();
                          setEditingQtyId(productId);
                          setEditingQtyDraft(String(qty));
                        }}
                        style={styles.qtyBtn}
                      >
                        {qty}
                      </button>
                    )}

                    <AppButton
                      variant="ghost"
                      style={styles.pmBtn}
                      onClick={(e) => {
                        markQtyInteraction();
                        e.stopPropagation();
                        onAdd(productId);
                      }}
                    >
                      <QtyIcon type="plus" />
                    </AppButton>
                  </div>
                )}
                {!isHardOos && isOverLimit ? (
                  <div style={styles.stockWarning}>
                    Only {qtyAvailable} left
                  </div>
                ) : null}
                {isHardOos ? <div style={styles.stockWarning}>Sold out</div> : null}
              </div>
            </div>
            );
          })
        )}
      </div>

      <div style={styles.footer}>
        <div style={styles.metaRow}>
          <div style={{ opacity: 0.8 }}>Items</div>
          <div style={styles.metaValue}>{qtyCount}</div>
        </div>
        <div style={styles.totalRow}>
          <div style={{ opacity: 0.8 }}>Subtotal</div>
          <div style={styles.totalValue}>₱ {formatMoney(subtotal)}</div>
        </div>
        {hasOverLimitItems ? (
          <div style={styles.warningBox}>
            You need to reduce some quantites in your cart.
          </div>
        ) : null}
        <AppButton
          style={{
            ...styles.checkoutBtn,
            opacity: items.length && !hasOverLimitItems ? 1 : 0.5
          }}
          disabled={!items.length || hasOverLimitItems}
          onClick={(e) => {
            if (suppressRowOpenRef.current) {
              e.stopPropagation();
              return;
            }
            onCheckout();
          }}
        >
          Checkout
        </AppButton>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: "fixed",
    top: 0,
    right: 0,
    width: 420,
    maxWidth: "92vw",
    height: "100vh",

    // ✅ IMPORTANT: fully opaque panel (removes “faded” look)
    background: "transparent",

    borderLeft: "1px solid rgba(255,255,255,0.3)",
    transition: "transform 220ms ease",
    zIndex: 1700,
    display: "flex",
    flexDirection: "column",
    color: "var(--tp-text-color)",
  },
  header: {
    padding: "16px 16px 15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid var(--tp-border-color-soft)",
  },
  title: {
    fontSize: TOPBAR_FONT_SIZE,
    fontWeight: 900,
    letterSpacing: 2,
    textTransform: "uppercase",
    lineHeight: 1,
  },
  btn: {
    width: 68,
    minWidth: 68,
    height: 36,
    padding: 0,
    borderRadius: 8,
    fontSize: TOPBAR_FONT_SIZE,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    border: "none",
    background: "transparent",
    justifyContent: "flex-end",
    textAlign: "right",
  },
  body: {
    padding: 16,
    overflowY: "auto",
    flex: 1,
  },
  empty: {
    padding: 16,
    opacity: 0.75,
    border: "1px dashed rgba(255,255,255,0.18)",
    borderRadius: 12,
  },
  line: {
    display: "grid",
    gridTemplateColumns: "56px 1fr auto",
    gap: 12,
    padding: "15px 0",
    borderBottom: "1px solid rgba(255,255,255,0.3)",
    cursor: "pointer",
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color-soft)",
    overflow: "hidden",
    background: "var(--tp-control-bg-soft)",
    position: "relative",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  left: {},
  name: { fontSize: 15, fontWeight: 700, marginBottom: 6 },
  meta: { fontSize: 15, opacity: 0.75 },
  right: { textAlign: "right" },
  lineTotal: { fontSize: 15, fontWeight: 700, marginBottom: 8 },
  perPiece: { fontSize: 15, opacity: 0.72, marginBottom: 8 },
  pmRow: {
    display: "grid",
    gridTemplateColumns: "32px 32px 32px",
    gap: 6,
    alignItems: "center",
    justifyContent: "end",
  },
  pmBtn: {
    height: 28,
    width: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  qty: { fontSize: 15, fontWeight: 800, textAlign: "center" },
  qtyBtn: {
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    fontSize: 15,
    fontWeight: 800,
    textAlign: "center",
    cursor: "text",
    padding: 0,
    minWidth: 20,
  },
  qtyInput: {
    width: 34,
    height: 28,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    textAlign: "center",
    fontSize: 14,
    padding: "0 4px",
    outline: "none",
  },
  qtyOos: { color: "#ffb14a" },
  thumbOosOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: 10,
    border: "1px solid rgba(255,177,74,0.9)",
    background: "rgba(0,0,0,0.46)",
    color: "#ffb14a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    pointerEvents: "none",
  },
  oosGroup: {
    display: "grid",
    gridTemplateColumns: "32px 32px 32px",
    gap: 6,
    alignItems: "center",
    justifyContent: "end",
  },
  pmBtnOos: {
    borderColor: "rgba(255,177,74,0.9)",
    color: "#ffb14a",
  },
  pmBtnTrash: {
    borderColor: "rgba(255,177,74,0.9)",
    color: "#ffb14a",
  },
  oosRemoveX: {
    display: "inline-block",
    width: 14,
    height: 14,
    lineHeight: 0,
  },
  pmBtnMuted: {
    borderColor: "rgba(200,200,200,0.45)",
    color: "rgba(200,200,200,0.65)",
  },
  stockWarning: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 700,
    color: "#ffb14a",
    width: 108,
    marginLeft: "auto",
    textAlign: "center",
  },
  footer: {
    padding: "16px 16px 36px",
    borderTop: "1px solid var(--tp-border-color-soft)",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  metaValue: { fontSize: 15, fontWeight: 600 },
  totalValue: { fontSize: 16, fontWeight: 900 },
  warningBox: {
    marginBottom: 10,
    borderRadius: 10,
    border: "1px solid rgba(255,177,74,0.6)",
    background: "rgba(255,177,74,0.16)",
    color: "#ffd79d",
    padding: "8px 10px",
    fontSize: 13,
    lineHeight: 1.3,
  },
  checkoutBtn: {
    width: "100%",
    paddingInline: 12,
    height: 36,
    borderRadius: 8,
    background: "var(--tp-cta-bg)",
    color: "var(--tp-cta-fg)",
    border: "1px solid var(--tp-cta-border)",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
};
