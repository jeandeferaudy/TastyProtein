// src/components/CartDrawer.tsx
"use client";

import type React from "react";
import type { CartItem } from "@/lib/cart";
import { AppButton, QtyIcon } from "@/components/ui";
import LogoPlaceholder from "@/components/LogoPlaceholder";

type Props = {
  isOpen: boolean;
  items: CartItem[];
  subtotal: number;
  backgroundStyle?: React.CSSProperties;

  onClose: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
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
  onOpenProduct,
  onCheckout,
  formatMoney,
}: Props) {
  const qtyCount = items.reduce((sum, i) => sum + Math.max(0, Number(i.qty) || 0), 0);

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
          items.map((i) => (
            <div
              key={String(i.productId)}
              style={styles.line}
              role="button"
              tabIndex={0}
              onClick={() => onOpenProduct(String(i.productId))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenProduct(String(i.productId));
                }
              }}
            >
              <div style={styles.thumbWrap}>
                {i.thumbnailUrl ? (
                  <img src={i.thumbnailUrl} alt="" style={styles.thumbImg} />
                ) : (
                  <LogoPlaceholder />
                )}
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

                <div style={styles.pmRow}>
                  <AppButton
                    variant="ghost"
                    style={{ ...styles.pmBtn, opacity: i.qty > 0 ? 1 : 0.4 }}
                    disabled={i.qty <= 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(String(i.productId));
                    }}
                  >
                    <QtyIcon type="minus" />
                  </AppButton>

                  <div
                    style={{
                      ...styles.qty,
                      color: "var(--tp-text-color)",
                    }}
                  >
                    {i.qty}
                  </div>

                  <AppButton
                    variant="ghost"
                    style={styles.pmBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd(String(i.productId));
                    }}
                  >
                    <QtyIcon type="plus" />
                  </AppButton>
                </div>
              </div>
            </div>
          ))
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

        <AppButton
          style={{
            ...styles.checkoutBtn,
            opacity: items.length ? 1 : 0.5
          }}
          disabled={!items.length}
          onClick={onCheckout}
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
    fontSize: 16,
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
    fontSize: 16,
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
