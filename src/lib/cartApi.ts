// src/lib/cartApi.ts
import { supabase } from "@/lib/supabase";

export type CartViewRow = {
  session_id: string;
  product_id: string;
  qty: number;
  name: string;
  size: string | null;
  price: number;
  line_total: number;
};

/**
 * Reads the denormalized cart view for a given session.
 * Requires: a view/table named `cart_view` with at least the fields in CartViewRow.
 */
export async function fetchCartView(sessionId: string): Promise<CartViewRow[]> {
  const { data, error } = await supabase
    .from("cart_view")
    .select("session_id,product_id,qty,name,size,price,line_total")
    .eq("session_id", sessionId);

  if (error) throw error;
  return (data ?? []) as CartViewRow[];
}

/**
 * Ensures a cart exists for this session and returns cart.id
 * Requires: `carts` table with columns: id (uuid) and session_id (text/uuid)
 */
async function getOrCreateCartId(sessionId: string): Promise<string> {
  // 1) try find
  const found = await supabase
    .from("carts")
    .select("id")
    .eq("session_id", sessionId)
    .limit(1)
    .maybeSingle();

  if (found.error) throw found.error;
  if (found.data?.id) return String(found.data.id);

  // 2) create
  const created = await supabase
    .from("carts")
    .insert([{ session_id: sessionId }])
    .select("id")
    .single();

  if (created.error) throw created.error;
  return String(created.data.id);
}

/**
 * Sets a cart line quantity (upsert/delete).
 *
 * Requires: `cart_lines` table with columns:
 * - cart_id
 * - product_id
 * - qty
 *
 * And ideally a unique constraint on (cart_id, product_id) so upsert works.
 */
export async function setCartLineQty(
  sessionId: string,
  productId: string,
  qty: number
): Promise<void> {
  const cartId = await getOrCreateCartId(sessionId);

  const nextQty = Math.max(Number(qty) || 0, 0);

  if (nextQty <= 0) {
    const del = await supabase
      .from("cart_lines")
      .delete()
      .eq("cart_id", cartId)
      .eq("product_id", productId);

    if (del.error) throw del.error;
    return;
  }

  const up = await supabase.from("cart_lines").upsert(
    [
      {
        cart_id: cartId,
        product_id: productId,
        qty: nextQty,
      },
    ],
    {
      // needs unique constraint on (cart_id, product_id)
      onConflict: "cart_id,product_id",
    }
  );

  if (up.error) throw up.error;
}