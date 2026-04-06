import { supabase } from "@/lib/supabase";

function normalizeOrderStatus(value: unknown): string {
  const raw = String(value ?? "draft").trim().toLowerCase();
  return raw === "pending" ? "submitted" : raw || "draft";
}

export type OrderListItem = {
  id: string;
  customer_id?: string | null;
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
  total_cost?: number;
  total_profit?: number;
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
  cost_snapshot: number | null;
  qty: number;
  packed_qty: number | null;
  line_total: number;
  line_profit: number | null;
  added_by_admin: boolean;
};

export type ProductSalesSeriesItem = {
  bucket_key: string;
  bucket_start: string;
  product_id: string;
  product_name: string;
  sales_total: number;
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
  total_cost?: number;
  total_profit?: number;
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

type OrderTotals = {
  totalQty: number;
  subtotal: number;
  total: number;
  totalCost: number;
  totalProfit: number;
};

async function rebuildOrderTotals(orderId: string): Promise<OrderTotals> {
  const asError = (e: unknown) =>
    e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("delivery_fee,thermal_bag_fee")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw asError(orderError.message ?? orderError);

  const { data: lines, error: linesError } = await supabase
    .from("order_lines")
    .select("qty,line_total,cost_snapshot,line_profit")
    .eq("order_id", orderId);
  if (linesError) throw asError(linesError.message ?? linesError);

  const totalQty = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.qty ?? 0), 0);
  const subtotal = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.line_total ?? 0), 0);
  const deliveryFee = Number((order as any)?.delivery_fee ?? 0);
  const thermalBagFee = Number((order as any)?.thermal_bag_fee ?? 0);
  const total = subtotal + deliveryFee + thermalBagFee;
  const totalCost = (lines ?? []).reduce((sum: number, l: any) => {
    const qty = Math.max(0, Number(l.qty ?? 0));
    const unitCost = Math.max(0, Number(l.cost_snapshot ?? 0));
    return sum + unitCost * qty;
  }, 0);
  const totalProfit = (lines ?? []).reduce((sum: number, l: any) => {
    const qty = Math.max(0, Number(l.qty ?? 0));
    const lineTotal = Math.max(0, Number(l.line_total ?? 0));
    const unitCost = Math.max(0, Number(l.cost_snapshot ?? 0));
    const fallbackProfit = Math.max(0, lineTotal - unitCost * qty);
    return sum + Math.max(0, Number(l.line_profit ?? fallbackProfit));
  }, 0);
  let { error: updateError } = await supabase
    .from("orders")
    .update({
      total_qty: totalQty,
      subtotal,
      total_selling_price: total,
      total_cost: totalCost,
      total_profit: totalProfit,
    })
    .eq("id", orderId);
  if (updateError) {
    const fallback = await supabase
      .from("orders")
      .update({
        total_qty: totalQty,
        subtotal,
        total_selling_price: total,
      })
      .eq("id", orderId);
    updateError = fallback.error;
  }
  if (updateError) throw asError(updateError.message ?? updateError);

  return { totalQty, subtotal, total, totalCost, totalProfit };
}

export async function createOrderByAdmin(): Promise<string> {
  const { data, error } = await supabase
    .from("orders")
    .insert({
      access_scope: "private",
      total_qty: 0,
      subtotal: 0,
      delivery_fee: 0,
      thermal_bag_fee: 0,
      total_selling_price: 0,
      amount_paid: 0,
      status: "draft",
      paid_status: "unpaid",
      delivery_status: "unpacked",
      placed_for_someone_else: false,
    })
    .select("id")
    .limit(1)
    .single();

  if (error) throw new Error(String(error.message ?? error));
  return String(data.id);
}

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
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    const formData = new FormData();
    formData.append("orderId", orderId);
    if (currentPath) {
      formData.append("currentPath", currentPath);
    }
    if (file) {
      formData.append("file", file);
    }

    const response = await fetch("/api/orders/payment-proof", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Failed to update payment proof.");
    }
    return;
  }

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
  customerId?: string | null;
  all?: boolean;
}): Promise<OrderListItem[]> {
  const { userId, email, phone, customerId, all = false } = params;
  let query = supabase
    .from("orders")
    .select(
      "id,customer_id,order_number,access_scope,created_at,delivery_date,total_qty,subtotal,delivery_fee,thermal_bag_fee,total_selling_price,amount_paid,status,paid_status,delivery_status,full_name,email,phone,placed_for_someone_else"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (customerId) {
    query = query.eq("customer_id", customerId);
  } else if (!all) {
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
    customer_id: r.customer_id ? String(r.customer_id) : null,
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
      total_cost:
        r.total_cost === null || r.total_cost === undefined ? undefined : Number(r.total_cost),
      total_profit:
        r.total_profit === null || r.total_profit === undefined ? undefined : Number(r.total_profit),
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

  const visibleBase = base;

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
  if (orderNumber) {
    const linesByOrderNumber = await supabase
      .from("order_lines")
      .select("*")
      .eq("order_number", orderNumber)
      .order("id", { ascending: true });
    if (!linesByOrderNumber.error && Array.isArray(linesByOrderNumber.data)) {
      const merged = new Map<string, any>();
      for (const row of resolvedItems) merged.set(String((row as any).id), row);
      for (const row of linesByOrderNumber.data as any[]) merged.set(String((row as any).id), row);
      resolvedItems = Array.from(merged.values()).sort((a, b) =>
        String((a as any).id ?? "").localeCompare(String((b as any).id ?? ""))
      );
    }
  }

  const rawProofUrl = (order as any).payment_proof_url ?? null;
  const paymentProofPath =
    rawProofUrl && !String(rawProofUrl).startsWith("http") ? String(rawProofUrl) : null;
  let paymentProofUrl: string | null = rawProofUrl;
  if (rawProofUrl && !String(rawProofUrl).startsWith("http")) {
    try {
      const path = String(rawProofUrl);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        const response = await fetch(
          `/api/orders/payment-proof?orderId=${encodeURIComponent(orderId)}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; signedUrl?: string | null }
          | null;
        if (response.ok && payload?.ok && payload.signedUrl) {
          paymentProofUrl = payload.signedUrl;
        } else {
          const signedA = await supabase.storage.from("payment-proofs").createSignedUrl(path, 3600);
          if (!signedA.error && signedA.data?.signedUrl) {
            paymentProofUrl = signedA.data.signedUrl;
          } else {
            const signedB = await supabase.storage.from("payment_proofs").createSignedUrl(path, 3600);
            if (!signedB.error && signedB.data?.signedUrl) {
              paymentProofUrl = signedB.data.signedUrl;
            } else {
              paymentProofUrl = supabase.storage.from("payment-proofs").getPublicUrl(path).data
                .publicUrl;
            }
          }
        }
      } else {
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
      }
    } catch (e) {
      console.warn("[ordersApi] failed to resolve proof url:", e);
      paymentProofUrl = String(rawProofUrl);
    }
  }

  if (resolvedItems.length > 0) {
    const linesQty = resolvedItems.reduce((sum, row) => sum + Number((row as any)?.qty ?? 0), 0);
    const linesSubtotal = resolvedItems.reduce((sum, row) => sum + Number((row as any)?.line_total ?? 0), 0);
    const orderQty = Number((order as any).total_qty ?? 0);
    const orderSubtotal = Number((order as any).subtotal ?? 0);
    if (
      (orderQty > 0 && linesQty !== orderQty) ||
      (orderSubtotal > 0 && Math.abs(linesSubtotal - orderSubtotal) > 0.01)
    ) {
      console.warn("[ordersApi] order_lines mismatch for order", {
        orderId,
        orderNumber,
        linesCount: resolvedItems.length,
        linesQty,
        orderQty,
        linesSubtotal,
        orderSubtotal,
      });
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
    total_cost:
      (order as any).total_cost === null || (order as any).total_cost === undefined
        ? undefined
        : Number((order as any).total_cost),
    total_profit:
      (order as any).total_profit === null || (order as any).total_profit === undefined
        ? undefined
        : Number((order as any).total_profit),
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
      cost_snapshot:
        it.cost_snapshot === null || it.cost_snapshot === undefined
          ? null
          : Number(it.cost_snapshot),
      qty: Number(it.qty ?? 0),
      packed_qty:
        it.packed_qty === null || it.packed_qty === undefined
          ? null
          : Number(it.packed_qty),
      line_total: Number(it.line_total ?? 0),
      line_profit:
        it.line_profit === null || it.line_profit === undefined
          ? null
          : Math.max(0, Number(it.line_profit)),
      added_by_admin: Boolean(it.added_by_admin),
    })),
  };
}

export async function fetchProductSalesSeries(params: {
  rangeStart: string;
  rangeEnd: string;
  timeline: "day" | "week" | "month";
}): Promise<ProductSalesSeriesItem[]> {
  const { rangeStart, rangeEnd, timeline } = params;
  const { data, error } = await supabase.rpc("tp_order_line_sales_by_bucket", {
    p_start_date: rangeStart,
    p_end_date: rangeEnd,
    p_timeline: timeline,
  });

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const record = row as Record<string, unknown>;
    return {
      bucket_key: String(record.bucket_key ?? ""),
      bucket_start: String(record.bucket_start ?? ""),
      product_id: String(record.product_id ?? ""),
      product_name: String(record.product_name ?? "Item"),
      sales_total: Number(record.sales_total ?? 0),
    };
  });
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
    .select("id,name,long_name,size,temperature,country_of_origin,selling_price,product_cost")
    .in("id", productIds);
  if (productsError) throw asError(productsError.message ?? productsError);
  const byId = new Map<string, any>();
  for (const p of products ?? []) byId.set(String((p as any).id), p);

  const rows = clean.map((it) => {
    const p = byId.get(it.productId);
    const unitPrice = Number((p as any)?.selling_price ?? 0);
    const costSnapshot = Math.max(0, Number((p as any)?.product_cost ?? 0));
    const lineTotal = unitPrice * it.qty;
    return {
      order_id: orderId,
      product_id: it.productId,
      name_snapshot: String((p as any)?.name ?? "Item"),
      long_name_snapshot: String((p as any)?.long_name ?? (p as any)?.name ?? "Item"),
      size_snapshot: (p as any)?.size ?? null,
      temperature_snapshot: (p as any)?.temperature ?? null,
      country_snapshot: (p as any)?.country_of_origin ?? null,
      price_snapshot: unitPrice,
      cost_snapshot: costSnapshot,
      qty: it.qty,
      packed_qty: 0,
      line_total: lineTotal,
      line_profit: Math.max(0, lineTotal - costSnapshot * it.qty),
      added_by_admin: true,
    };
  });

  const dropColumn = (source: any[], column: string) => source.map(({ [column]: _, ...rest }) => rest);
  const attempts: any[][] = [];
  attempts.push(rows as any[]);
  attempts.push(dropColumn(attempts[attempts.length - 1], "line_profit"));
  attempts.push(dropColumn(attempts[attempts.length - 1], "cost_snapshot"));
  attempts.push(dropColumn(attempts[attempts.length - 1], "added_by_admin"));
  attempts.push(dropColumn(attempts[attempts.length - 1], "packed_qty"));

  let insertError: any = null;
  for (const payload of attempts) {
    const attempt = await supabase.from("order_lines").insert(payload);
    if (!attempt.error) {
      insertError = null;
      break;
    }
    insertError = attempt.error;
  }
  if (insertError) throw asError(insertError.message ?? insertError);

  await rebuildOrderTotals(orderId);
}

export async function hydrateOrderLineFinancialSnapshots(orderId: string) {
  const asError = (e: unknown) =>
    e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));

  const lineRows = await supabase
    .from("order_lines")
    .select("id,order_id,product_id,qty,line_total,price_snapshot,cost_snapshot,line_profit")
    .eq("order_id", orderId);

  const lineErrorText = String(lineRows.error?.message ?? "").toLowerCase();
  if (lineRows.error && (lineErrorText.includes("cost_snapshot") || lineErrorText.includes("line_profit"))) {
    return;
  }
  if (lineRows.error) throw asError(lineRows.error.message ?? lineRows.error);

  const lines = (lineRows.data ?? []) as any[];
  if (!lines.length) return;

  const productIds = [...new Set(lines.map((line) => String(line.product_id ?? "")).filter(Boolean))];
  let productCostById = new Map<string, number>();
  if (productIds.length > 0) {
    const productRows = await supabase
      .from("products")
      .select("id,product_cost")
      .in("id", productIds);
    if (!productRows.error) {
      productCostById = new Map<string, number>(
        (productRows.data ?? []).map((p: any) => [String(p.id), Math.max(0, Number(p.product_cost ?? 0))])
      );
    }
  }

  for (const line of lines) {
    const qty = Math.max(0, Number(line.qty ?? 0));
    const lineTotal = Math.max(0, Number(line.line_total ?? 0));
    const unitPrice =
      line.price_snapshot === null || line.price_snapshot === undefined
        ? qty > 0
          ? lineTotal / qty
          : 0
        : Number(line.price_snapshot);
    const existingCost =
      line.cost_snapshot === null || line.cost_snapshot === undefined
        ? null
        : Math.max(0, Number(line.cost_snapshot));
    const costSnapshot =
      existingCost === null
        ? Math.max(0, Number(productCostById.get(String(line.product_id ?? "")) ?? 0))
        : existingCost;
    const lineProfit = Math.max(0, lineTotal - costSnapshot * qty);

    const payload: Record<string, unknown> = {};
    if (line.price_snapshot === null || line.price_snapshot === undefined) payload.price_snapshot = unitPrice;
    if (line.cost_snapshot === null || line.cost_snapshot === undefined) payload.cost_snapshot = costSnapshot;
    if (line.line_profit === null || line.line_profit === undefined) payload.line_profit = lineProfit;

    if (Object.keys(payload).length === 0) continue;
    const updateRes = await supabase.from("order_lines").update(payload).eq("id", String(line.id));
    if (updateRes.error) {
      const msg = String(updateRes.error.message ?? "").toLowerCase();
      if (msg.includes("cost_snapshot") || msg.includes("line_profit")) {
        // Older schema path: skip silently.
        continue;
      }
      throw asError(updateRes.error.message ?? updateRes.error);
    }
  }
}

export async function updateOrderLineUnitPrice(orderLineId: string, unitPrice: number | null) {
  const asError = (e: unknown) =>
    e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));

  const normalizedUnitPrice = Math.max(0, Number(unitPrice ?? 0));

  const { data: lineRow, error: lineFetchError } = await supabase
    .from("order_lines")
    .select("id,order_id,product_id,qty,cost_snapshot")
    .eq("id", orderLineId)
    .maybeSingle();
  if (lineFetchError) throw asError(lineFetchError.message ?? lineFetchError);
  if (!lineRow) throw new Error("Order line not found.");

  const orderId = String((lineRow as any).order_id ?? "");
  if (!orderId) throw new Error("Order line is missing order_id.");

  const qty = Math.max(0, Number((lineRow as any).qty ?? 0));
  let costSnapshot =
    (lineRow as any).cost_snapshot === null || (lineRow as any).cost_snapshot === undefined
      ? null
      : Math.max(0, Number((lineRow as any).cost_snapshot));
  if (costSnapshot === null) {
    const { data: productRow } = await supabase
      .from("products")
      .select("product_cost")
      .eq("id", String((lineRow as any).product_id ?? ""))
      .maybeSingle();
    costSnapshot = Math.max(0, Number((productRow as any)?.product_cost ?? 0));
  }

  const lineTotal = normalizedUnitPrice * qty;
  const lineProfit = Math.max(0, lineTotal - Number(costSnapshot ?? 0) * qty);

  const payload: Record<string, unknown> = {
    price_snapshot: normalizedUnitPrice,
    line_total: lineTotal,
    cost_snapshot: costSnapshot,
    line_profit: lineProfit,
  };
  let updateResult = await supabase
    .from("order_lines")
    .update(payload)
    .eq("id", orderLineId)
    .select("id")
    .limit(1);
  if (updateResult.error) {
    const strippedPayload = {
      price_snapshot: normalizedUnitPrice,
      line_total: lineTotal,
    };
    updateResult = await supabase
      .from("order_lines")
      .update(strippedPayload)
      .eq("id", orderLineId)
      .select("id")
      .limit(1);
  }
  if (updateResult.error) throw asError(updateResult.error.message ?? updateResult.error);
  if (!updateResult.data || updateResult.data.length === 0) {
    throw new Error(
      "Unit price update was blocked (no rows updated). Check RLS/update policy on order_lines."
    );
  }

  const totals = await rebuildOrderTotals(orderId);

  return {
    orderId,
    orderLineId,
    unitPrice: normalizedUnitPrice,
    lineTotal,
    costSnapshot,
    lineProfit,
    totalQty: totals.totalQty,
    subtotal: totals.subtotal,
    total: totals.total,
  };
}

export async function deleteOrderByAdmin(
  orderId: string,
  opts?: { paymentProofPath?: string | null }
) {
  const asError = (e: unknown) =>
    e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));

  const { data: packedLines, error: packedLinesError } = await supabase
    .from("order_lines")
    .select("product_id,packed_qty")
    .eq("order_id", orderId);
  if (packedLinesError) throw asError(packedLinesError.message ?? packedLinesError);

  const packedByProduct = new Map<string, number>();
  for (const row of (packedLines ?? []) as Array<Record<string, unknown>>) {
    const productId = String(row.product_id ?? "");
    const packedQty = Math.max(0, Math.floor(Number(row.packed_qty ?? 0)));
    if (!productId || packedQty <= 0) continue;
    packedByProduct.set(productId, (packedByProduct.get(productId) ?? 0) + packedQty);
  }

  if (packedByProduct.size > 0) {
    const productIds = [...packedByProduct.keys()];
    const { data: inventoryRows, error: inventoryError } = await supabase
      .from("inventory")
      .select("product_id,qty_on_hand")
      .in("product_id", productIds);
    if (inventoryError) throw asError(inventoryError.message ?? inventoryError);

    const qtyOnHandByProduct = new Map<string, number>();
    for (const row of (inventoryRows ?? []) as Array<Record<string, unknown>>) {
      const productId = String(row.product_id ?? "");
      if (!productId) continue;
      qtyOnHandByProduct.set(productId, Math.max(0, Number(row.qty_on_hand ?? 0)));
    }

    const inventoryPayload = productIds.map((productId) => ({
      product_id: productId,
      qty_on_hand:
        Math.max(0, qtyOnHandByProduct.get(productId) ?? 0) +
        Math.max(0, packedByProduct.get(productId) ?? 0),
    }));

    const { error: restockError } = await supabase
      .from("inventory")
      .upsert(inventoryPayload, { onConflict: "product_id" });
    if (restockError) throw asError(restockError.message ?? restockError);
  }

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
