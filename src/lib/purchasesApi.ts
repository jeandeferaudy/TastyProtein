import { supabase } from "@/lib/supabase";

function normalizePurchaseStatus(value: unknown): string {
  const raw = String(value ?? "draft").trim().toLowerCase();
  return raw === "pending" ? "submitted" : raw || "draft";
}

export type PurchaseListItem = {
  id: string;
  purchase_number?: string | null;
  created_at: string;
  delivery_date?: string | null;
  total_qty: number;
  received_qty_total: number;
  subtotal: number;
  delivery_fee: number;
  thermal_bag_fee: number;
  total_selling_price: number;
  amount_paid: number | null;
  status: string;
  paid_status: string;
  delivery_status: string;
  seller_name?: string | null;
  seller_email?: string | null;
  seller_phone?: string | null;
};

export type PurchaseDetailItem = {
  id: string;
  product_id: string;
  name: string;
  size: string | null;
  temperature: string | null;
  unit_price: number;
  qty: number;
  received_qty: number | null;
  line_total: number;
  added_by_admin: boolean;
};

export type PurchaseDetail = {
  id: string;
  created_at: string;
  purchase_number: string | null;
  total_qty: number;
  seller_name: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  seller_address: string | null;
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
  items: PurchaseDetailItem[];
};

export type PurchaseStatusPatch = {
  status?: string;
  paid_status?: string;
  delivery_status?: string;
};

export type PurchaseAdminPatch = {
  created_at?: string | null;
  seller_name?: string | null;
  seller_email?: string | null;
  seller_phone?: string | null;
  seller_address?: string | null;
  notes?: string | null;
  delivery_date?: string | null;
  delivery_slot?: string | null;
  express_delivery?: boolean;
  add_thermal_bag?: boolean;
  delivery_fee?: number;
  total_selling_price?: number;
};

export async function createPurchaseByAdmin(): Promise<string> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({
      status: "draft",
      paid_status: "unpaid",
      delivery_status: "unreceived",
      total_qty: 0,
      subtotal: 0,
      delivery_fee: 0,
      thermal_bag_fee: 0,
      total_selling_price: 0,
      amount_paid: 0,
    })
    .select("id")
    .limit(1)
    .single();

  if (error) throw new Error(String(error.message ?? error));
  return String(data.id);
}

export async function updatePurchaseAmountPaid(purchaseId: string, amountPaid: number | null) {
  const value =
    amountPaid === null || Number.isNaN(Number(amountPaid))
      ? null
      : Math.max(0, Number(amountPaid));
  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ amount_paid: value })
    .eq("id", purchaseId)
    .select("id")
    .limit(1);
  if (error) throw new Error(String(error.message ?? error));
  if (!data || data.length === 0) {
    throw new Error(
      "Amount update was blocked (no rows updated). Check RLS/update policy on purchase_orders."
    );
  }
}

export async function updatePurchaseAdminFields(purchaseId: string, patch: PurchaseAdminPatch) {
  const { data, error } = await supabase
    .from("purchase_orders")
    .update(patch)
    .eq("id", purchaseId)
    .select("id")
    .limit(1);
  if (error) throw new Error(String(error.message ?? error));
  if (!data || data.length === 0) {
    throw new Error(
      "Purchase update was blocked (no rows updated). Check RLS/update policy on purchase_orders."
    );
  }
}

export async function updatePurchasePaymentProof(
  purchaseId: string,
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
      .from("purchase_orders")
      .update({ payment_proof_url: null })
      .eq("id", purchaseId);
    if (error) throw error;
    return;
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "jpg" : "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `purchase-orders/${purchaseId}/${Date.now()}-${safeName || `proof.${safeExt}`}`;

  const uploadedA = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: false });
  if (uploadedA.error) {
    const uploadedB = await supabase.storage.from("payment_proofs").upload(path, file, { upsert: false });
    if (uploadedB.error) throw uploadedB.error;
  }

  if (currentPath && currentPath !== path) {
    await tryRemove(currentPath);
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({ payment_proof_url: path })
    .eq("id", purchaseId);
  if (error) throw error;
}

export async function fetchPurchases(): Promise<PurchaseListItem[]> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "id,purchase_number,created_at,delivery_date,total_qty,subtotal,delivery_fee,thermal_bag_fee,total_selling_price,amount_paid,status,paid_status,delivery_status,seller_name,seller_email,seller_phone"
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  const base = (data ?? []).map((r: any) => ({
    id: String(r.id),
    purchase_number: r.purchase_number ?? null,
    created_at: String(r.created_at ?? ""),
    delivery_date: r.delivery_date ?? null,
    total_qty: Number(r.total_qty ?? 0),
    received_qty_total: 0,
    subtotal: Number(r.subtotal ?? 0),
    delivery_fee: Number(r.delivery_fee ?? 0),
    thermal_bag_fee: Number(r.thermal_bag_fee ?? 0),
    total_selling_price: Number(r.total_selling_price ?? 0),
    amount_paid:
      r.amount_paid === null || r.amount_paid === undefined ? null : Number(r.amount_paid),
    status: normalizePurchaseStatus(r.status),
    paid_status: String(r.paid_status ?? "unpaid"),
    delivery_status: String(r.delivery_status ?? "unreceived"),
    seller_name: r.seller_name ?? null,
    seller_email: r.seller_email ?? null,
    seller_phone: r.seller_phone ?? null,
  }));

  const ids = base.map((row) => row.id).filter(Boolean);
  if (!ids.length) return base;

  const lines = await supabase
    .from("purchase_order_lines")
    .select("purchase_order_id,qty,received_qty,line_total")
    .in("purchase_order_id", ids);
  if (lines.error || !Array.isArray(lines.data)) return base;

  const byId = new Map<string, { qty: number; packedQty: number; total: number }>();
  for (const row of lines.data as Array<Record<string, unknown>>) {
    const id = String(row.purchase_order_id ?? "");
    if (!id) continue;
    const prev = byId.get(id) ?? { qty: 0, packedQty: 0, total: 0 };
    prev.qty += Number(row.qty ?? 0);
    prev.packedQty += Math.max(0, Number(row.received_qty ?? 0));
    prev.total += Number(row.line_total ?? 0);
    byId.set(id, prev);
  }

  return base.map((p) => {
    const agg = byId.get(p.id);
    if (!agg) return p;
    return {
      ...p,
      total_qty: p.total_qty > 0 ? p.total_qty : agg.qty,
      received_qty_total: agg.packedQty,
      total_selling_price: p.total_selling_price > 0 ? p.total_selling_price : agg.total,
    };
  });
}

export async function fetchPurchaseDetail(purchaseId: string): Promise<PurchaseDetail | null> {
  const { data: purchaseOrder, error: purchaseError } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", purchaseId)
    .maybeSingle();
  if (purchaseError) throw purchaseError;
  if (!purchaseOrder) return null;

  const linesById = await supabase
    .from("purchase_order_lines")
    .select("*")
    .eq("purchase_order_id", purchaseId)
    .order("id", { ascending: true });
  if (linesById.error) throw linesById.error;

  const rawProofUrl = (purchaseOrder as any).payment_proof_url ?? null;
  const paymentProofPath =
    rawProofUrl && !String(rawProofUrl).startsWith("http") ? String(rawProofUrl) : null;
  let paymentProofUrl: string | null = rawProofUrl;
  if (rawProofUrl && !String(rawProofUrl).startsWith("http")) {
    const path = String(rawProofUrl);
    const signedA = await supabase.storage.from("payment-proofs").createSignedUrl(path, 3600);
    if (!signedA.error && signedA.data?.signedUrl) {
      paymentProofUrl = signedA.data.signedUrl;
    } else {
      const signedB = await supabase.storage.from("payment_proofs").createSignedUrl(path, 3600);
      if (!signedB.error && signedB.data?.signedUrl) {
        paymentProofUrl = signedB.data.signedUrl;
      } else {
        paymentProofUrl = supabase.storage.from("payment-proofs").getPublicUrl(path).data.publicUrl;
      }
    }
  }

  return {
    id: String(purchaseOrder.id),
    created_at: String((purchaseOrder as any).created_at ?? ""),
    purchase_number: (purchaseOrder as any).purchase_number ?? null,
    total_qty: Number((purchaseOrder as any).total_qty ?? 0),
    seller_name: (purchaseOrder as any).seller_name ?? null,
    seller_email: (purchaseOrder as any).seller_email ?? null,
    seller_phone: (purchaseOrder as any).seller_phone ?? null,
    seller_address: (purchaseOrder as any).seller_address ?? null,
    notes: (purchaseOrder as any).notes ?? null,
    delivery_date: (purchaseOrder as any).delivery_date ?? null,
    delivery_slot: (purchaseOrder as any).delivery_slot ?? null,
    express_delivery: Boolean((purchaseOrder as any).express_delivery),
    add_thermal_bag: Boolean((purchaseOrder as any).add_thermal_bag),
    subtotal: Number((purchaseOrder as any).subtotal ?? 0),
    delivery_fee: Number((purchaseOrder as any).delivery_fee ?? 0),
    thermal_bag_fee: Number((purchaseOrder as any).thermal_bag_fee ?? 0),
    total_selling_price: Number((purchaseOrder as any).total_selling_price ?? 0),
    amount_paid:
      (purchaseOrder as any).amount_paid === null || (purchaseOrder as any).amount_paid === undefined
        ? null
        : Number((purchaseOrder as any).amount_paid),
    payment_proof_path: paymentProofPath,
    payment_proof_url: paymentProofUrl,
    status: normalizePurchaseStatus((purchaseOrder as any).status),
    paid_status: String((purchaseOrder as any).paid_status ?? "unpaid"),
    delivery_status: String((purchaseOrder as any).delivery_status ?? "unreceived"),
    items: ((linesById.data ?? []) as any[]).map((it) => ({
      id: String(it.id),
      product_id: String(it.product_id ?? ""),
      name: String(it.name_snapshot ?? it.long_name_snapshot ?? it.product_name ?? "Item"),
      size: it.size_snapshot ?? null,
      temperature: it.temperature_snapshot ?? null,
      unit_price: Number(it.unit_price ?? it.price_snapshot ?? 0),
      qty: Number(it.qty ?? 0),
      received_qty: it.received_qty === null || it.received_qty === undefined ? null : Number(it.received_qty),
      line_total: Number(it.line_total ?? 0),
      added_by_admin: Boolean(it.added_by_admin),
    })),
  };
}

export async function updatePurchaseStatuses(purchaseId: string, patch: PurchaseStatusPatch) {
  const payload: Record<string, unknown> = {};
  if (typeof patch.status === "string") payload.status = patch.status;
  if (typeof patch.paid_status === "string") payload.paid_status = patch.paid_status;
  if (typeof patch.delivery_status === "string") payload.delivery_status = patch.delivery_status;
  if (Object.keys(payload).length === 0) return;

  if (String(payload.delivery_status ?? "").toLowerCase() === "received") {
    payload.status = "completed";
  }

  const { data, error } = await supabase
    .from("purchase_orders")
    .update(payload)
    .eq("id", purchaseId)
    .select("id")
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "Status update was blocked (no rows updated). Check RLS/update policy on purchase_orders."
    );
  }
}

export async function updatePurchaseLineReceivedQty(purchaseOrderLineId: string, receivedQty: number | null) {
  const value =
    receivedQty === null || Number.isNaN(Number(receivedQty))
      ? null
      : Math.max(0, Math.floor(Number(receivedQty)));
  const { data, error } = await supabase
    .from("purchase_order_lines")
    .update({ received_qty: value })
    .eq("id", purchaseOrderLineId)
    .select("id")
    .limit(1);
  if (error) throw new Error(String(error.message ?? error));
  if (!data || data.length === 0) {
    throw new Error(
      "Received quantity update was blocked (no rows updated). Check RLS/update policy on purchase_order_lines."
    );
  }
}

export async function updatePurchaseLineUnitPrice(purchaseOrderLineId: string, unitPrice: number | null) {
  const asError = (e: unknown) =>
    e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));

  const normalizedUnitPrice =
    unitPrice === null || Number.isNaN(Number(unitPrice)) ? 0 : Math.max(0, Number(unitPrice));

  const { data: lineRow, error: lineFetchError } = await supabase
    .from("purchase_order_lines")
    .select("id,purchase_order_id,qty")
    .eq("id", purchaseOrderLineId)
    .maybeSingle();
  if (lineFetchError) throw asError(lineFetchError.message ?? lineFetchError);
  if (!lineRow) throw new Error("Purchase line not found.");

  const qty = Math.max(0, Math.floor(Number((lineRow as any).qty ?? 0)));
  const purchaseId = String((lineRow as any).purchase_order_id ?? "");
  if (!purchaseId) throw new Error("Purchase line is missing purchase_order_id.");

  const lineTotal = normalizedUnitPrice * qty;

  const { data: lineUpdateRows, error: lineUpdateError } = await supabase
    .from("purchase_order_lines")
    .update({
      unit_price: normalizedUnitPrice,
      line_total: lineTotal,
    })
    .eq("id", purchaseOrderLineId)
    .select("id")
    .limit(1);
  if (lineUpdateError) throw asError(lineUpdateError.message ?? lineUpdateError);
  if (!lineUpdateRows || lineUpdateRows.length === 0) {
    throw new Error(
      "Unit cost update was blocked (no rows updated). Check RLS/update policy on purchase_order_lines."
    );
  }

  const { data: purchaseOrder, error: purchaseError } = await supabase
    .from("purchase_orders")
    .select("delivery_fee,thermal_bag_fee")
    .eq("id", purchaseId)
    .maybeSingle();
  if (purchaseError) throw asError(purchaseError.message ?? purchaseError);

  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select("qty,line_total")
    .eq("purchase_order_id", purchaseId);
  if (linesError) throw asError(linesError.message ?? linesError);

  const totalQty = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.qty ?? 0), 0);
  const subtotal = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.line_total ?? 0), 0);
  const deliveryFee = Number((purchaseOrder as any)?.delivery_fee ?? 0);
  const thermalBagFee = Number((purchaseOrder as any)?.thermal_bag_fee ?? 0);
  const total = subtotal + deliveryFee + thermalBagFee;

  const { error: purchaseUpdateError } = await supabase
    .from("purchase_orders")
    .update({
      total_qty: totalQty,
      subtotal,
      total_selling_price: total,
    })
    .eq("id", purchaseId);
  if (purchaseUpdateError) throw asError(purchaseUpdateError.message ?? purchaseUpdateError);

  return {
    purchaseId,
    purchaseOrderLineId,
    unitPrice: normalizedUnitPrice,
    lineTotal,
    totalQty,
    subtotal,
    total,
  };
}

export async function updatePurchaseLineQty(purchaseOrderLineId: string, qty: number | null) {
  const asError = (e: unknown) =>
    e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));

  const normalizedQty = Math.max(1, Math.floor(Number(qty ?? 1)));

  const { data: lineRow, error: lineFetchError } = await supabase
    .from("purchase_order_lines")
    .select("id,purchase_order_id,unit_price,received_qty")
    .eq("id", purchaseOrderLineId)
    .maybeSingle();
  if (lineFetchError) throw asError(lineFetchError.message ?? lineFetchError);
  if (!lineRow) throw new Error("Purchase line not found.");

  const purchaseId = String((lineRow as any).purchase_order_id ?? "");
  if (!purchaseId) throw new Error("Purchase line is missing purchase_order_id.");

  const unitPrice = Math.max(0, Number((lineRow as any).unit_price ?? 0));
  const receivedQty = Math.max(0, Math.floor(Number((lineRow as any).received_qty ?? 0)));
  const nextReceivedQty = Math.min(receivedQty, normalizedQty);
  const lineTotal = unitPrice * normalizedQty;

  const { data: lineUpdateRows, error: lineUpdateError } = await supabase
    .from("purchase_order_lines")
    .update({
      qty: normalizedQty,
      received_qty: nextReceivedQty,
      line_total: lineTotal,
    })
    .eq("id", purchaseOrderLineId)
    .select("id")
    .limit(1);
  if (lineUpdateError) throw asError(lineUpdateError.message ?? lineUpdateError);
  if (!lineUpdateRows || lineUpdateRows.length === 0) {
    throw new Error(
      "Quantity update was blocked (no rows updated). Check RLS/update policy on purchase_order_lines."
    );
  }

  const { data: purchaseOrder, error: purchaseError } = await supabase
    .from("purchase_orders")
    .select("delivery_fee,thermal_bag_fee")
    .eq("id", purchaseId)
    .maybeSingle();
  if (purchaseError) throw asError(purchaseError.message ?? purchaseError);

  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select("qty,line_total")
    .eq("purchase_order_id", purchaseId);
  if (linesError) throw asError(linesError.message ?? linesError);

  const totalQty = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.qty ?? 0), 0);
  const subtotal = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.line_total ?? 0), 0);
  const deliveryFee = Number((purchaseOrder as any)?.delivery_fee ?? 0);
  const thermalBagFee = Number((purchaseOrder as any)?.thermal_bag_fee ?? 0);
  const total = subtotal + deliveryFee + thermalBagFee;

  const { error: purchaseUpdateError } = await supabase
    .from("purchase_orders")
    .update({
      total_qty: totalQty,
      subtotal,
      total_selling_price: total,
    })
    .eq("id", purchaseId);
  if (purchaseUpdateError) throw asError(purchaseUpdateError.message ?? purchaseUpdateError);

  return {
    purchaseId,
    purchaseOrderLineId,
    qty: normalizedQty,
    receivedQty: nextReceivedQty,
    lineTotal,
    totalQty,
    subtotal,
    total,
  };
}

export async function deletePurchaseLineByAdmin(purchaseOrderLineId: string) {
  const asError = (e: unknown) =>
    e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));

  const { data: lineRow, error: lineFetchError } = await supabase
    .from("purchase_order_lines")
    .select("id,purchase_order_id")
    .eq("id", purchaseOrderLineId)
    .maybeSingle();
  if (lineFetchError) throw asError(lineFetchError.message ?? lineFetchError);
  if (!lineRow) throw new Error("Purchase line not found.");

  const purchaseId = String((lineRow as any).purchase_order_id ?? "");
  if (!purchaseId) throw new Error("Purchase line is missing purchase_order_id.");

  const { data: deletedRows, error: deleteError } = await supabase
    .from("purchase_order_lines")
    .delete()
    .eq("id", purchaseOrderLineId)
    .select("id")
    .limit(1);
  if (deleteError) throw asError(deleteError.message ?? deleteError);
  if (!deletedRows || deletedRows.length === 0) {
    throw new Error(
      "Line delete was blocked (no rows deleted). Check RLS/delete policy on purchase_order_lines."
    );
  }

  const { data: purchaseOrder, error: purchaseError } = await supabase
    .from("purchase_orders")
    .select("delivery_fee,thermal_bag_fee")
    .eq("id", purchaseId)
    .maybeSingle();
  if (purchaseError) throw asError(purchaseError.message ?? purchaseError);

  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select("qty,line_total")
    .eq("purchase_order_id", purchaseId);
  if (linesError) throw asError(linesError.message ?? linesError);

  const totalQty = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.qty ?? 0), 0);
  const subtotal = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.line_total ?? 0), 0);
  const deliveryFee = Number((purchaseOrder as any)?.delivery_fee ?? 0);
  const thermalBagFee = Number((purchaseOrder as any)?.thermal_bag_fee ?? 0);
  const total = subtotal + deliveryFee + thermalBagFee;

  const { error: purchaseUpdateError } = await supabase
    .from("purchase_orders")
    .update({
      total_qty: totalQty,
      subtotal,
      total_selling_price: total,
    })
    .eq("id", purchaseId);
  if (purchaseUpdateError) throw asError(purchaseUpdateError.message ?? purchaseUpdateError);

  return {
    purchaseId,
    purchaseOrderLineId,
    totalQty,
    subtotal,
    total,
  };
}

export async function addPurchaseLinesByAdmin(
  purchaseId: string,
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
    .select("id,name,long_name,size,temperature,country_of_origin,product_cost,selling_price")
    .in("id", productIds);
  if (productsError) throw asError(productsError.message ?? productsError);

  const byId = new Map<string, any>();
  for (const p of products ?? []) byId.set(String((p as any).id), p);

  const rows = clean.map((it) => {
    const p = byId.get(it.productId);
    const unitPrice = Number((p as any)?.product_cost ?? (p as any)?.selling_price ?? 0);
    return {
      purchase_order_id: purchaseId,
      product_id: it.productId,
      name_snapshot: String((p as any)?.name ?? "Item"),
      long_name_snapshot: String((p as any)?.long_name ?? (p as any)?.name ?? "Item"),
      size_snapshot: (p as any)?.size ?? null,
      temperature_snapshot: (p as any)?.temperature ?? null,
      country_snapshot: (p as any)?.country_of_origin ?? null,
      unit_price: unitPrice,
      qty: it.qty,
      received_qty: 0,
      line_total: unitPrice * it.qty,
      added_by_admin: true,
    };
  });

  const { error: insertError } = await supabase.from("purchase_order_lines").insert(rows);
  if (insertError) throw asError(insertError.message ?? insertError);

  const { data: purchaseOrder, error: purchaseError } = await supabase
    .from("purchase_orders")
    .select("delivery_fee,thermal_bag_fee")
    .eq("id", purchaseId)
    .maybeSingle();
  if (purchaseError) throw asError(purchaseError.message ?? purchaseError);

  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select("qty,line_total")
    .eq("purchase_order_id", purchaseId);
  if (linesError) throw asError(linesError.message ?? linesError);

  const totalQty = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.qty ?? 0), 0);
  const subtotal = (lines ?? []).reduce((sum: number, l: any) => sum + Number(l.line_total ?? 0), 0);
  const deliveryFee = Number((purchaseOrder as any)?.delivery_fee ?? 0);
  const thermalBagFee = Number((purchaseOrder as any)?.thermal_bag_fee ?? 0);
  const total = subtotal + deliveryFee + thermalBagFee;

  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({
      total_qty: totalQty,
      subtotal,
      total_selling_price: total,
    })
    .eq("id", purchaseId);
  if (updateError) throw asError(updateError.message ?? updateError);
}

export async function deletePurchaseByAdmin(purchaseId: string, opts?: { paymentProofPath?: string | null }) {
  const asError = (e: unknown) =>
    e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));

  const { error: deleteLinesError } = await supabase
    .from("purchase_order_lines")
    .delete()
    .eq("purchase_order_id", purchaseId);
  if (deleteLinesError) throw asError(deleteLinesError.message ?? deleteLinesError);

  const paymentProofPath = String(opts?.paymentProofPath ?? "").trim();
  if (paymentProofPath) {
    await supabase.storage.from("payment-proofs").remove([paymentProofPath]);
    await supabase.storage.from("payment_proofs").remove([paymentProofPath]);
  }

  const { data, error } = await supabase
    .from("purchase_orders")
    .delete()
    .eq("id", purchaseId)
    .select("id")
    .limit(1);
  if (error) throw asError(error.message ?? error);
  if (!data || data.length === 0) {
    throw new Error(
      "Purchase delete was blocked (no rows deleted). Check RLS/delete policy on purchase_orders."
    );
  }
}
