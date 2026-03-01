import { supabase } from "@/lib/supabase";

function normalizeOrderStatus(value: unknown): string {
  const raw = String(value ?? "draft").trim().toLowerCase();
  return raw === "pending" ? "submitted" : raw || "draft";
}

export type OrderListItem = {
  id: string;
  order_number?: string | null;
  access_scope?: "public" | "private" | null;
  created_at: string;
  delivery_date?: string | null;
  total_qty: number;
  packed_qty_total: number;
  subtotal: number;
  delivery_fee: number;
  thermal_bag_fee: number;
  total_selling_price: number;
  amount_paid: number | null;
  status: string;
  paid_status: string;
  delivery_status: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  placed_for_someone_else?: boolean | null;
};

export type OrderDetailItem = {
  id: string;
  product_id: string;
  name: string;
  size: string | null;
  temperature: string | null;
  unit_price: number;
  qty: number;
  packed_qty: number | null;
  line_total: number;
  added_by_admin: boolean;
};

export type OrderDetail = {
  id: string;
  created_at: string;
  order_number: string | null;
  access_scope: "public" | "private";
  total_qty: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  placed_for_someone_else: boolean;
  address: string | null;
  postal_code: string | null;
  notes: string | null;
  delivery_date: string | null;
  delivery_slot: string | null;
  express_delivery: boolean;
  add_thermal_bag: boolean;
  subtotal: number;
  delivery_fee: number;
  thermal_bag_fee: number;
  total_selling_price: number;
  amount_paid: number | null;
  payment_proof_path: string | null;
  payment_proof_url: string | null;
  status: string;
  paid_status: string;
  delivery_status: string;
  items: OrderDetailItem[];
};

export type OrderStatusPatch = {
  status?: string;
  paid_status?: string;
  delivery_status?: string;
};

export type OrderAdminPatch = {
  created_at?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  delivery_date?: string | null;
  delivery_slot?: string | null;
  express_delivery?: boolean;
  add_thermal_bag?: boolean;
  delivery_fee?: number;
  total_selling_price?: number;
};

export async function updateOrderAmountPaid(orderId: string, amountPaid: number | null) {
  const value =
    amountPaid === null || Number.isNaN(Number(amountPaid))
      ? null
      : Math.max(0, Number(amountPaid));
  const { data, error } = await supabase
    .from("orders")
    .update({ amount_paid: value })
    .eq("id", orderId)
    .select("id")
    .limit(1);
  if (error) throw new Error(String(error.message ?? error));
  if (!data || data.length === 0) {
    throw new Error("Amount update was blocked (no rows updated). Check RLS/update policy on orders.");
  }
}

export async function updateOrderAdminFields(orderId: string, patch: OrderAdminPatch) {
  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select("id")
    .limit(1);
  if (error) throw new Error(String(error.message ?? error));
  if (!data || data.length === 0) {
    throw new Error("Order update was blocked (no rows updated). Check RLS/update policy on orders.");
  }
}

export async function updateOrderPaymentProof(
  orderId: string,
  file: File | null,
  currentPath: string | null = null
) {
  const tryRemove = async (path: string) => {
    await supabase.storage.from("payment-proofs").remove([path]);
    await supabase.storage.from("payment_proofs").remove([path]);
  };

  if (!file) {
    if (currentPath) {
      await tryRemove(currentPath);
    }
    const { error } = await supabase
      .from("orders")
      .update({ payment_proof_url: null })
      .eq("id", orderId);
    if (error) throw error;
    return;
  }

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase() ?? "jpg"
    : "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `orders/${orderId}/${Date.now()}-${safeName || `proof.${safeExt}`}`;

  const uploadedA = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: false });
  if (uploadedA.error) {
    const uploadedB = await supabase.storage.from("payment_proofs").upload(path, file, { upsert: false });
    if (uploadedB.error) throw uploadedB.error;
  }

  if (currentPath && currentPath !== path) {
    await tryRemove(currentPath);
  }

  const { error } = await supabase
    .from("orders")
    .update({ payment_proof_url: path })
    .eq("id", orderId);
  if (error) throw error;
}

export async function fetchOrders(params: {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  all?: boolean;
}): Promise<OrderListItem[]> {
  const { userId, email, phone, all = false } = params;
  let query = supabase
    .from("orders")
    .select(
      "id,order_number,access_scope,created_at,delivery_date,total_qty,subtotal,delivery_fee,thermal_bag_fee,total_selling_price,amount_paid,status,paid_status,delivery_status,full_name,email,phone,placed_for_someone_else"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (!all) {
    if (!userId && !email && !phone) return [];
    const ors: string[] = [];
    if (userId) ors.push(`user_id.eq.${userId}`);
    if (email) ors.push(`email.eq.${email}`);
    if (phone) ors.push(`phone.eq.${phone}`);
    if (!ors.length) return [];
    query = query.or(ors.join(","));
  }

  const { data, error } = await query;
  if (error) throw error;

  const base = (data ?? []).map((r: any) => ({
    id: String(r.id),
    order_number: r.order_number ?? null,
    access_scope:
      r.access_scope === "public" || r.access_scope === "private" ? r.access_scope : null,
    created_at: String(r.created_at ?? ""),
    delivery_date: r.delivery_date ?? null,
    total_qty: Number(r.total_qty ?? 0),
    packed_qty_total: 0,
    subtotal: Number(r.subtotal ?? 0),
    delivery_fee: Number(r.delivery_fee ?? 0),
    thermal_bag_fee: Number(r.thermal_bag_fee ?? 0),
    total_selling_price: Number(r.total_selling_price ?? 0),
    amount_paid:
      r.amount_paid === null || r.amount_paid === undefined ? null : Number(r.amount_paid),
    status: normalizeOrderStatus(r.status) as OrderListItem["status"],
    paid_status: String(r.paid_status ?? "unpaid") as OrderListItem["paid_status"],
    delivery_status: String(r.delivery_status ?? "undelivered") as OrderListItem["delivery_status"],
    full_name: r.full_name ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    placed_for_someone_else:
      typeof r.placed_for_someone_else === "boolean" ? r.placed_for_someone_else : null,
  }));

  const visibleBase = all
    ? base
    : base.filter((row) => row.placed_for_someone_else !== true);

  const ids = visibleBase.map((r) => r.id).filter(Boolean);
  if (!ids.length) return visibleBase;

  // Fill missing totals from item rows when orders table fields are stale.
  const hydrateFromItems = (
    rows: Array<{ order_id?: string; qty?: number; packed_qty?: number | null; line_total?: number }>,
    target: OrderListItem[]
  ) => {
    const byId = new Map<string, { qty: number; packedQty: number; total: number }>();
    for (const row of rows) {
      const id = String(row.order_id ?? "");
      if (!id) continue;
      const prev = byId.get(id) ?? { qty: 0, packedQty: 0, total: 0 };
      prev.qty += Number(row.qty ?? 0);
      prev.packedQty += Math.max(0, Number(row.packed_qty ?? 0));
      prev.total += Number(row.line_total ?? 0);
      byId.set(id, prev);
    }
    return target.map((o) => {
      const agg = byId.get(o.id);
      if (!agg) return o;
      return {
        ...o,
        total_qty: o.total_qty > 0 ? o.total_qty : agg.qty,
        packed_qty_total: agg.packedQty,
        total_selling_price:
          o.total_selling_price > 0 ? o.total_selling_price : agg.total,
      };
    });
  };

  const itemTry = await supabase
    .from("order_lines")
    .select("order_id,qty,packed_qty,line_total")
    .in("order_id", ids);
  if (!itemTry.error && Array.isArray(itemTry.data)) {
    return hydrateFromItems(itemTry.data as any[], visibleBase);
  }

  return visibleBase;
}

export async function fetchOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return null;

  let resolvedItems: any[] = [];

  const linesByOrderId = await supabase
    .from("order_lines")
    .select("*")
    .eq("order_id", orderId)
    .order("id", { ascending: true });
  if (linesByOrderId.error) {
    console.warn("[ordersApi] failed to load order_lines by order_id:", linesByOrderId.error.message);
  } else if (Array.isArray(linesByOrderId.data)) {
    resolvedItems = linesByOrderId.data as any[];
  }

  const orderNumber = (order as any).order_number ?? null;
  if (!resolvedItems.length && orderNumber) {
    const linesByOrderNumber = await supabase
      .from("order_lines")
      .select("*")
      .eq("order_number", orderNumber)
      .order("id", { ascending: true });
    if (!linesByOrderNumber.error && Array.isArray(linesByOrderNumber.data)) {
      resolvedItems = linesByOrderNumber.data as any[];
    }
  }

  if (!resolvedItems.length) {
    const itemsByOrderId = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("id", { ascending: true });
    if (!itemsByOrderId.error && Array.isArray(itemsByOrderId.data)) {
      resolvedItems = itemsByOrderId.data as any[];
    }
  }

  if (!resolvedItems.length && orderNumber) {
    const itemsByOrderNumber = await supabase
      .from("order_items")
      .select("*")
      .eq("order_number", orderNumber)
      .order("id", { ascending: true });
    if (!itemsByOrderNumber.error && Array.isArray(itemsByOrderNumber.data)) {
      resolvedItems = itemsByOrderNumber.data as any[];
    }
  }

  const rawProofUrl = (order as any).payment_proof_url ?? null;
  const paymentProofPath =
    rawProofUrl && !String(rawProofUrl).startsWith("http") ? String(rawProofUrl) : null;
  let paymentProofUrl: string | null = rawProofUrl;
  if (rawProofUrl && !String(rawProofUrl).startsWith("http")) {
    try {
      const path = String(rawProofUrl);
      const signedA = await supabase.storage.from("payment-proofs").createSignedUrl(path, 3600);
      if (!signedA.error && signedA.data?.signedUrl) {
        paymentProofUrl = signedA.data.signedUrl;
      } else {
        const signedB = await supabase.storage.from("payment_proofs").createSignedUrl(path, 3600);
        if (!signedB.error && signedB.data?.signedUrl) {
          paymentProofUrl = signedB.data.signedUrl;
        } else {
          // Fallback for public bucket configurations.
          paymentProofUrl = supabase.storage.from("payment-proofs").getPublicUrl(path).data
            .publicUrl;
        }
      }
    } catch (e) {
      console.warn("[ordersApi] failed to resolve proof url:", e);
      paymentProofUrl = String(rawProofUrl);
    }
  }

  return {
    id: String(order.id),
    created_at: String(order.created_at ?? ""),
    order_number: (order as any).order_number ?? null,
    access_scope: (order as any).access_scope === "public" ? "public" : "private",
    total_qty: Number((order as any).total_qty ?? 0),
    full_name: (order as any).full_name ?? null,
    email: (order as any).email ?? null,
    phone: (order as any).phone ?? null,
    placed_for_someone_else: Boolean((order as any).placed_for_someone_else),
    address: (order as any).address ?? null,
    postal_code: (order as any).postal_code ?? null,
    notes: (order as any).notes ?? null,
    delivery_date: (order as any).delivery_date ?? null,
    delivery_slot: (order as any).delivery_slot ?? null,
    express_delivery: Boolean((order as any).express_delivery),
    add_thermal_bag: Boolean((order as any).add_thermal_bag),
    subtotal: Number((order as any).subtotal ?? 0),
    delivery_fee: Number((order as any).delivery_fee ?? 0),
    thermal_bag_fee: Number((order as any).thermal_bag_fee ?? 0),
    total_selling_price: Number((order as any).total_selling_price ?? 0),
    amount_paid:
      (order as any).amount_paid === null || (order as any).amount_paid === undefined
        ? null
        : Number((order as any).amount_paid),
    payment_proof_path: paymentProofPath,
    payment_proof_url: paymentProofUrl ?? null,
    status: normalizeOrderStatus((order as any).status),
    paid_status: String((order as any).paid_status ?? "unpaid"),
    delivery_status: String((order as any).delivery_status ?? "undelivered"),
    items: resolvedItems.map((it: any) => ({
      id: String(it.id),
      product_id: String(it.product_id ?? ""),
      name: String(
        it.name ??
          it.name_snapshot ??
          it.long_name_snapshot ??
          it.product_name ??
          "Item"
      ),
      size: it.size ?? it.size_snapshot ?? null,
      temperature: it.temperature ?? it.temperature_snapshot ?? null,
      unit_price: Number(it.unit_price ?? it.price_snapshot ?? it.price ?? 0),
      qty: Number(it.qty ?? 0),
      packed_qty:
        it.packed_qty === null || it.packed_qty === undefined
          ? null
          : Number(it.packed_qty),
      line_total: Number(it.line_total ?? 0),
      added_by_admin: Boolean(it.added_by_admin),
    })),
  };
}

export async function updateOrderStatuses(orderId: string, patch: OrderStatusPatch) {
  const payload: Record<string, unknown> = {};
  if (typeof patch.status === "string") payload.status = patch.status;
  if (typeof patch.paid_status === "string") payload.paid_status = patch.paid_status;
  if (typeof patch.delivery_status === "string") payload.delivery_status = patch.delivery_status;
  if (Object.keys(payload).length === 0) return;

  // Keep status progression consistent with delivery updates.
  if (String(payload.delivery_status ?? "").toLowerCase() === "delivered") {
    payload.status = "completed";
  }

  const { data, error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", orderId)
    .select("id")
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Status update was blocked (no rows updated). Check RLS/update policy on orders.");
  }
}

export async function updateOrderLinePackedQty(orderLineId: string, packedQty: number | null) {
  const value =
    packedQty === null || Number.isNaN(Number(packedQty))
      ? null
      : Math.max(0, Math.floor(Number(packedQty)));
  const { data, error } = await supabase
    .from("order_lines")
    .update({ packed_qty: value })
    .eq("id", orderLineId)
    .select("id")
    .limit(1);
  if (error) throw new Error(String(error.message ?? error));
  if (!data || data.length === 0) {
    throw new Error("Packed quantity update was blocked (no rows updated). Check RLS/update policy on order_lines.");
  }
}

export async function addOrderLinesByAdmin(
  orderId: string,
  items: Array<{ productId: string; qty: number }>
) {
  const asError = (e: unknown) =>
    e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));
  const clean = items
    .map((it) => ({ productId: String(it.productId), qty: Math.max(0, Math.floor(Number(it.qty))) }))
    .filter((it) => it.productId && it.qty > 0);
  if (!clean.length) return;

  const productIds = [...new Set(clean.map((it) => it.productId))];
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id,name,long_name,size,temperature,country_of_origin,selling_price")
    .in("id", productIds);
  if (productsError) throw asError(productsError.message ?? productsError);
  const byId = new Map<string, any>();
  for (const p of products ?? []) byId.set(String((p as any).id), p);

  const rows = clean.map((it) => {
    const p = byId.get(it.productId);
    const unitPrice = Number((p as any)?.selling_price ?? 0);
    return {
      order_id: orderId,
      product_id: it.productId,
      name_snapshot: String((p as any)?.name ?? "Item"),
      long_name_snapshot: String((p as any)?.long_name ?? (p as any)?.name ?? "Item"),
      size_snapshot: (p as any)?.size ?? null,
      temperature_snapshot: (p as any)?.temperature ?? null,
      country_snapshot: (p as any)?.country_of_origin ?? null,
      price_snapshot: unitPrice,
      qty: it.qty,
      packed_qty: 0,
      line_total: unitPrice * it.qty,
      added_by_admin: true,
    };
  });

  let insertError: any = null;
  const firstTry = await supabase.from("order_lines").insert(rows);
  insertError = firstTry.error;
  if (insertError) {
    const message = String(insertError.message ?? "");
    if (message.includes("added_by_admin")) {
      const fallbackRows = rows.map(({ added_by_admin, ...rest }) => rest);
      const secondTry = await supabase.from("order_lines").insert(fallbackRows as any[]);
      insertError = secondTry.error;
    }
    if (insertError && String(insertError.message ?? "").includes("packed_qty")) {
      const fallbackRows = rows.map(({ added_by_admin, packed_qty, ...rest }) => rest);
      const thirdTry = await supabase.from("order_lines").insert(fallbackRows as any[]);
      insertError = thirdTry.error;
    }
  }
  if (insertError) throw asError(insertError.message ?? insertError);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("delivery_fee,thermal_bag_fee")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw asError(orderError.message ?? orderError);

  const { data: lines, error: linesError } = await supabase
    .from("order_lines")
    .select("qty,line_total")
    .eq("order_id", orderId);
  if (linesError) throw asError(linesError.message ?? linesError);

  const totalQty = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.qty ?? 0), 0);
  const subtotal = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.line_total ?? 0), 0);
  const deliveryFee = Number((order as any)?.delivery_fee ?? 0);
  const thermalBagFee = Number((order as any)?.thermal_bag_fee ?? 0);
  const total = subtotal + deliveryFee + thermalBagFee;

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      total_qty: totalQty,
      subtotal,
      total_selling_price: total,
    })
    .eq("id", orderId);
  if (updateError) throw asError(updateError.message ?? updateError);
}

export async function deleteOrderByAdmin(
  orderId: string,
  opts?: { paymentProofPath?: string | null }
) {
  const asError = (e: unknown) =>
    e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));

  const { error: deleteOrderLinesError } = await supabase
    .from("order_lines")
    .delete()
    .eq("order_id", orderId);
  if (deleteOrderLinesError) throw asError(deleteOrderLinesError.message ?? deleteOrderLinesError);

  const { error: deleteOrderItemsError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", orderId);
  const deleteOrderItemsMessage = String(deleteOrderItemsError?.message ?? "").toLowerCase();
  const orderItemsMissing =
    !!deleteOrderItemsError &&
    deleteOrderItemsMessage.includes("relation") &&
    deleteOrderItemsMessage.includes("order_items");
  if (deleteOrderItemsError && !orderItemsMissing) {
    throw asError(deleteOrderItemsError.message ?? deleteOrderItemsError);
  }

  const paymentProofPath = String(opts?.paymentProofPath ?? "").trim();
  if (paymentProofPath) {
    await supabase.storage.from("payment-proofs").remove([paymentProofPath]);
    await supabase.storage.from("payment_proofs").remove([paymentProofPath]);
  }

  const { data, error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .select("id")
    .limit(1);
  if (error) throw asError(error.message ?? error);
  if (!data || data.length === 0) {
    throw new Error("Order delete was blocked (no rows deleted). Check RLS/delete policy on orders.");
  }
}
