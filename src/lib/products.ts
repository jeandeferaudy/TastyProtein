// src/lib/products.ts
import { supabase } from "@/lib/supabase";

export type DbProduct = {
  id: string;
  name: string | null;
  long_name: string | null;
  description?: string | null;
  type?: string | null;
  cut?: string | null;
  state?: string | null;
  size_g?: number | null;
  size: string | null;
  temperature: string | null;
  country_of_origin: string | null;
  selling_price: number | null; // numeric in Supabase
  thumbnail_url?: string | null;
  keywords: string | null;
  status: string | null; // <-- use status instead of is_active
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
    .select(
      "id,name,long_name,description,type,cut,state,size_g,size,temperature,country_of_origin,selling_price,thumbnail_url,keywords,status,sort"
    )
    .order("sort", { ascending: true, nullsFirst: false });

  if (!includeInactive) {
    query = query.in("status", ["Active", "active"]);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Strongly type the return
  return (data ?? []) as DbProduct[];
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
