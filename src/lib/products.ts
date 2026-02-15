// src/lib/products.ts
import { supabase } from "@/lib/supabase";

export type DbProduct = {
  id: string;
  name: string | null;
  long_name: string | null;
  description?: string | null;
  type?: string | null;
  cut?: string | null;
  preparation?: string | null;
  packaging?: string | null;
  size_g?: number | null;
  size: string | null;
  temperature: string | null;
  country_of_origin: string | null;
  selling_price: number | null; // numeric in Supabase
  product_cost?: number | null;
  thumbnail_url?: string | null;
  keywords: string | null;
  status: string | null; // <-- use status instead of is_active
  unlimited_stock?: boolean;
  qty_on_hand?: number;
  qty_allocated?: number;
  qty_available?: number;
  sort: number | null;
};

export type ProductImage = {
  id: string;
  product_id: string;
  sort_order: number;
  url: string;
};

export async function fetchProducts(options?: {
  includeInactive?: boolean;
}): Promise<DbProduct[]> {
  const includeInactive = options?.includeInactive ?? false;
  let query = supabase
    .from("products")
    .select("*")
    .order("sort", { ascending: true, nullsFirst: false });

  if (!includeInactive) {
    query = query.in("status", ["Active", "active"]);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Strongly type the return
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r["id"]),
      name: (r["name"] as string | null) ?? null,
      long_name: (r["long_name"] as string | null) ?? null,
      description: (r["description"] as string | null) ?? null,
      type: (r["type"] as string | null) ?? null,
      cut: (r["cut"] as string | null) ?? null,
      preparation:
        (r["preparation"] as string | null) ??
        (r["preparationa"] as string | null) ??
        null,
      packaging: (r["packaging"] as string | null) ?? null,
      size_g:
        typeof r["size_g"] === "number"
          ? (r["size_g"] as number)
          : r["size_g"] == null
            ? null
            : Number(r["size_g"]),
      size: (r["size"] as string | null) ?? null,
      temperature: (r["temperature"] as string | null) ?? null,
      country_of_origin: (r["country_of_origin"] as string | null) ?? null,
      selling_price:
        typeof r["selling_price"] === "number"
          ? (r["selling_price"] as number)
          : r["selling_price"] == null
            ? null
            : Number(r["selling_price"]),
      product_cost:
        typeof r["product_cost"] === "number"
          ? (r["product_cost"] as number)
          : r["product_cost"] == null
            ? null
            : Number(r["product_cost"]),
      thumbnail_url: (r["thumbnail_url"] as string | null) ?? null,
      keywords: (r["keywords"] as string | null) ?? null,
      status: (r["status"] as string | null) ?? null,
      unlimited_stock: Boolean(r["unlimited_stock"]),
      qty_on_hand:
        typeof r["qty_on_hand"] === "number"
          ? (r["qty_on_hand"] as number)
          : r["qty_on_hand"] == null
            ? 0
            : Number(r["qty_on_hand"]),
      qty_allocated:
        typeof r["qty_allocated"] === "number"
          ? (r["qty_allocated"] as number)
          : r["qty_allocated"] == null
            ? 0
            : Number(r["qty_allocated"]),
      qty_available:
        typeof r["qty_available"] === "number"
          ? (r["qty_available"] as number)
          : r["qty_available"] == null
            ? 0
            : Number(r["qty_available"]),
      sort:
        typeof r["sort"] === "number"
          ? (r["sort"] as number)
          : r["sort"] == null
            ? null
            : Number(r["sort"]),
    } satisfies DbProduct;
  });
}

export async function fetchActiveProducts(): Promise<DbProduct[]> {
  return fetchProducts({ includeInactive: false });
}

export async function fetchProductImages(
  productIds: string[]
): Promise<ProductImage[]> {
  const ids = productIds.filter(Boolean);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("product_images")
    .select("id,product_id,sort_order,url")
    .in("product_id", ids)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProductImage[];
}

export function matchesProductQuery(p: DbProduct, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;

  const hay = [
    p.name,
    p.long_name,
    p.size,
    p.temperature,
    p.country_of_origin,
    p.keywords,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(s);
}
