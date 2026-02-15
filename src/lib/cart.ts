// src/lib/cart.ts

export type CartItem = {
  productId: string;
  name: string;
  country?: string | null;
  type?: string | null;
  size: string | null;
  temperature?: string | null;
  thumbnailUrl?: string | null;
  unlimitedStock?: boolean;
  qtyAvailable?: number;
  outOfStock?: boolean;
  price: number;
  qty: number;
  lineTotal: number;
};

export type CartState = Record<string, number>;

export function buildCartItems(rows: any[]): CartItem[] {
  const safeRows = Array.isArray(rows) ? rows : [];

  return safeRows.map((r) => ({
    productId: String(r.product_id ?? r.productId ?? ""),
    name: String(r.name ?? ""),
    country: r.country ?? r.country_of_origin ?? null,
    type: r.type ?? null,
    size: r.size ?? null,
    temperature: r.temperature ?? null,
    thumbnailUrl: r.thumbnail_url ?? r.thumbnailUrl ?? null,
    price: Number(r.price ?? 0),
    qty: Number(r.qty ?? 0),
    lineTotal: Number(r.line_total ?? r.lineTotal ?? 0),
  })).filter(i => i.productId && i.qty > 0);
}

export function cartTotals(items: CartItem[]) {
  return {
    totalUnits: items.reduce((s, i) => s + i.qty, 0),
    subtotal: items.reduce((s, i) => s + i.lineTotal, 0),
  };
}
