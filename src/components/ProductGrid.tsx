// src/components/ProductGrid.tsx
"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import type { Product } from "@/types/product";
import type { CartState } from "@/lib/cart";
import ProductCard from "@/components/ProductCard";

type Props = {
  products: Product[];
  loading: boolean;
  cart: CartState;
  viewMode: "list" | "4" | "5";
  canEditProducts?: boolean;

  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
  onOpenProduct: (id: string) => void;
  onEditProduct?: (id: string) => void;
  onQuickStatusChange?: (id: string, nextStatus: "Active" | "Disabled" | "Archived") => void;
  contained?: boolean;

  formatMoney: (n: unknown) => string;
};

export default function ProductGrid({
  products,
  loading,
  cart,
  viewMode,
  canEditProducts = false,
  onAdd,
  onRemove,
  onSetQty,
  onOpenProduct,
  onEditProduct,
  onQuickStatusChange,
  contained = false,
  formatMoney,
}: Props) {
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const [sectionWidth, setSectionWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const measure = () => setSectionWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const gap = viewMode === "5" ? 10 : 24;
  const targetColumns = viewMode === "list" ? 1 : viewMode === "4" ? 3 : 5;
  const minTileWidth = viewMode === "5" ? 150 : viewMode === "4" ? 220 : 0;
  const safeWidth = Math.max(sectionWidth, 0);

  let columns = targetColumns;
  if (viewMode !== "list" && safeWidth > 0) {
    const fit = Math.max(1, Math.floor((safeWidth + gap) / (minTileWidth + gap)));
    columns = Math.min(targetColumns, fit);
  }

  const tileWidth =
    viewMode === "list" || columns <= 1
      ? safeWidth
      : Math.floor((safeWidth - gap * (columns - 1)) / columns);

  const productsStyle: CSSProperties =
    viewMode === "list"
      ? {
          ...styles.products,
          gridTemplateColumns: "1fr",
          justifyContent: "stretch",
          gap: 10,
        }
      : {
          ...styles.products,
          gridTemplateColumns: `repeat(${columns}, ${Math.max(tileWidth, minTileWidth)}px)`,
          justifyContent: "center",
          gap,
        };

  return (
    <section
      ref={sectionRef}
      className={contained ? undefined : "tp-content-rail"}
      style={styles.section}
    >
      <div style={productsStyle}>
        {products.map((p) => {
          const id = String(p.id ?? "");
          const qty = cart[id] || 0;

          return (
            <ProductCard
              key={id}
              product={p}
              qty={qty}
              viewMode={viewMode}
              mobileListLayout={viewMode === "list" && safeWidth > 0 && safeWidth < 768}
              canEdit={canEditProducts}
              onOpen={onOpenProduct}
              onAdd={onAdd}
              onRemove={onRemove}
              onSetQty={onSetQty}
              onEdit={onEditProduct}
              onStatusChange={onQuickStatusChange}
              formatMoney={formatMoney}
            />
          );
        })}
      </div>

      {loading && <div style={styles.emptyHint}>Loading products…</div>}

      {!loading && products.length === 0 && (
        <div style={styles.emptyHint}>No results. Try different search or filters.</div>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  section: {
    marginTop: 16,
  },
  products: {
    display: "grid",
    gap: 24,
  },
  emptyHint: {
    marginTop: 24,
    minHeight: "40vh",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 600,
    opacity: 0.95,
  },
};
