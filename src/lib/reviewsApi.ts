import { fetchOrders, type OrderListItem } from "@/lib/ordersApi";
import { supabase } from "@/lib/supabase";

export type ReviewStatus = "pending" | "approved" | "rejected";

export type ProductReview = {
  id: string;
  order_id: string;
  product_id: string;
  customer_id: string | null;
  display_name: string;
  product_name_snapshot: string;
  order_number_snapshot: string | null;
  rating: number;
  tenderness_rating: number;
  taste_rating: number;
  delivery_rating: number;
  review_text: string;
  status: ReviewStatus;
  admin_note: string | null;
  credits_reward: number;
  credits_granted: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductReviewSummary = {
  averageRating: number;
  totalReviews: number;
  countsByRating: Record<number, number>;
};

export type MyReviewQueueItem = {
  queue_key: string;
  review_id: string | null;
  order_id: string;
  order_number: string | null;
  order_created_at: string;
  customer_id: string | null;
  product_id: string;
  product_name: string;
  product_size: string | null;
  product_temperature: string | null;
  product_country: string | null;
  qty: number;
  display_name: string;
  rating: number;
  tenderness_rating: number;
  taste_rating: number;
  delivery_rating: number;
  review_text: string;
  status: ReviewStatus | null;
  admin_note: string | null;
  credits_reward: number;
  credits_granted: boolean;
  review_created_at: string | null;
  review_updated_at: string | null;
};

export type AdminReviewItem = ProductReview;

function clampRating(value: unknown): number {
  return Math.max(1, Math.min(5, Math.round(Number(value) || 0 || 5)));
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

export function maskReviewerName(value: string | null | undefined): string {
  const text = normalizeText(value);
  if (!text) return "Anonymous";
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const part = parts[0];
    if (part.length <= 1) return "*";
    return `${part[0]}${"*".repeat(Math.max(1, part.length - 2))}${part[part.length - 1]}`;
  }

  const first = parts[0];
  const last = parts[parts.length - 1];
  const maskedFirst = first.length <= 1 ? "*" : `${first[0]}${"*".repeat(Math.max(1, first.length - 2))}`;
  const maskedLast = last.length <= 1 ? "*" : `${"*".repeat(Math.max(1, last.length - 1))}${last[last.length - 1]}`;
  return `${maskedFirst} ${maskedLast}`;
}

function mapProductReview(row: Record<string, unknown>): ProductReview {
  return {
    id: String(row.id ?? ""),
    order_id: String(row.order_id ?? ""),
    product_id: String(row.product_id ?? ""),
    customer_id: row.customer_id == null ? null : String(row.customer_id),
    display_name: normalizeText(row.display_name) || "Anonymous",
    product_name_snapshot: normalizeText(row.product_name_snapshot) || "Product",
    order_number_snapshot: row.order_number_snapshot == null ? null : String(row.order_number_snapshot),
    rating: clampRating(row.rating),
    tenderness_rating: clampRating(row.tenderness_rating),
    taste_rating: clampRating(row.taste_rating),
    delivery_rating: clampRating(row.delivery_rating),
    review_text: normalizeText(row.review_text),
    status:
      row.status === "approved" || row.status === "rejected"
        ? row.status
        : "pending",
    admin_note: row.admin_note == null ? null : String(row.admin_note),
    credits_reward: Math.max(0, Number(row.credits_reward ?? 15)),
    credits_granted: Boolean(row.credits_granted),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? row.created_at ?? ""),
  };
}

export function summarizeProductReviews(reviews: ProductReview[]): ProductReviewSummary {
  const countsByRating: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  if (!reviews.length) {
    return {
      averageRating: 0,
      totalReviews: 0,
      countsByRating,
    };
  }

  let total = 0;
  for (const review of reviews) {
    const rating = clampRating(review.rating);
    countsByRating[rating] += 1;
    total += rating;
  }

  return {
    averageRating: Math.round((total / reviews.length) * 10) / 10,
    totalReviews: reviews.length,
    countsByRating,
  };
}

export async function fetchApprovedProductReviews(productId: string): Promise<ProductReview[]> {
  const { data, error } = await supabase.rpc("tp_public_product_reviews", {
    p_product_id: productId,
  });

  if (error) throw error;
  return (data ?? []).map((row: unknown) => mapProductReview(row as Record<string, unknown>));
}

export async function fetchMyReviewQueue(params: {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<MyReviewQueueItem[]> {
  const { userId, email, phone } = params;
  const orders = await fetchOrders({
    userId: userId ?? null,
    email: email ?? null,
    phone: phone ?? null,
    all: false,
  });
  const orderIds = orders.map((order) => String(order.id)).filter(Boolean);
  if (!orderIds.length) return [];

  const orderById = new Map<string, OrderListItem>();
  for (const order of orders) {
    orderById.set(String(order.id), order);
  }

  const [linesResult, reviewsResult] = await Promise.all([
    supabase
      .from("order_lines")
      .select(
        "order_id,product_id,qty,name_snapshot,long_name_snapshot,size_snapshot,temperature_snapshot,country_snapshot"
      )
      .in("order_id", orderIds),
    supabase
      .from("product_reviews")
      .select(
        "id,order_id,product_id,customer_id,display_name,product_name_snapshot,order_number_snapshot,rating,tenderness_rating,taste_rating,delivery_rating,review_text,status,admin_note,credits_reward,credits_granted,created_at,updated_at"
      )
      .in("order_id", orderIds),
  ]);

  if (linesResult.error) throw linesResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  const reviewByKey = new Map<string, ProductReview>();
  for (const row of reviewsResult.data ?? []) {
    const review = mapProductReview(row as Record<string, unknown>);
    reviewByKey.set(`${review.order_id}:${review.product_id}`, review);
  }

  const queueByKey = new Map<string, MyReviewQueueItem>();
  for (const row of (linesResult.data ?? []) as Array<Record<string, unknown>>) {
    const orderId = String(row.order_id ?? "");
    const productId = String(row.product_id ?? "");
    if (!orderId || !productId) continue;
    const order = orderById.get(orderId);
    if (!order) continue;
    const key = `${orderId}:${productId}`;
    const existing = queueByKey.get(key);
    const review = reviewByKey.get(key) ?? null;
    const qty = Math.max(0, Number(row.qty ?? 0));
    const productName =
      normalizeText(row.long_name_snapshot) ||
      normalizeText(row.name_snapshot) ||
      review?.product_name_snapshot ||
      "Product";

    if (existing) {
      existing.qty += qty;
      continue;
    }

    queueByKey.set(key, {
      queue_key: key,
      review_id: review?.id ?? null,
      order_id: orderId,
      order_number: order.order_number ?? null,
      order_created_at: order.created_at,
      customer_id: order.customer_id ?? null,
      product_id: productId,
      product_name: productName,
      product_size: row.size_snapshot == null ? null : String(row.size_snapshot),
      product_temperature: row.temperature_snapshot == null ? null : String(row.temperature_snapshot),
      product_country: row.country_snapshot == null ? null : String(row.country_snapshot),
      qty,
      display_name: review?.display_name ?? maskReviewerName(order.full_name),
      rating: review?.rating ?? 5,
      tenderness_rating: review?.tenderness_rating ?? 5,
      taste_rating: review?.taste_rating ?? 5,
      delivery_rating: review?.delivery_rating ?? 5,
      review_text: review?.review_text ?? "",
      status: review?.status ?? null,
      admin_note: review?.admin_note ?? null,
      credits_reward: review?.credits_reward ?? 15,
      credits_granted: review?.credits_granted ?? false,
      review_created_at: review?.created_at ?? null,
      review_updated_at: review?.updated_at ?? null,
    });
  }

  return [...queueByKey.values()].sort((a, b) => {
    const dateDiff = new Date(b.order_created_at).getTime() - new Date(a.order_created_at).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.product_name.localeCompare(b.product_name);
  });
}

export async function saveMyProductReview(input: {
  reviewId?: string | null;
  orderId: string;
  productId: string;
  userId: string;
  customerId?: string | null;
  displayName: string;
  productName: string;
  orderNumber?: string | null;
  rating: number;
  tendernessRating?: number;
  tasteRating?: number;
  deliveryRating?: number;
  reviewText: string;
}): Promise<ProductReview> {
  const payload = {
    order_id: input.orderId,
    product_id: input.productId,
    user_id: input.userId,
    customer_id: input.customerId ?? null,
    display_name: maskReviewerName(input.displayName),
    product_name_snapshot: normalizeText(input.productName) || "Product",
    order_number_snapshot: input.orderNumber ?? null,
    rating: clampRating(input.rating),
    tenderness_rating: clampRating(input.tendernessRating ?? 5),
    taste_rating: clampRating(input.tasteRating ?? 5),
    delivery_rating: clampRating(input.deliveryRating ?? 5),
    review_text: normalizeText(input.reviewText),
    status: "pending",
    admin_note: null,
  };

  const query = input.reviewId
    ? supabase
        .from("product_reviews")
        .update(payload)
        .eq("id", input.reviewId)
        .select(
          "id,order_id,product_id,customer_id,display_name,product_name_snapshot,order_number_snapshot,rating,tenderness_rating,taste_rating,delivery_rating,review_text,status,admin_note,credits_reward,credits_granted,created_at,updated_at"
        )
        .single()
    : supabase
        .from("product_reviews")
        .insert(payload)
        .select(
          "id,order_id,product_id,customer_id,display_name,product_name_snapshot,order_number_snapshot,rating,tenderness_rating,taste_rating,delivery_rating,review_text,status,admin_note,credits_reward,credits_granted,created_at,updated_at"
        )
        .single();

  const { data, error } = await query;
  if (error) throw error;
  return mapProductReview(data as Record<string, unknown>);
}

export async function fetchAdminReviews(): Promise<AdminReviewItem[]> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select(
      "id,order_id,product_id,customer_id,display_name,product_name_snapshot,order_number_snapshot,rating,tenderness_rating,taste_rating,delivery_rating,review_text,status,admin_note,credits_reward,credits_granted,created_at,updated_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapProductReview(row as Record<string, unknown>));
}

export async function setAdminReviewStatus(input: {
  reviewId: string;
  status: ReviewStatus;
  adminNote?: string | null;
}): Promise<ProductReview> {
  const { data, error } = await supabase.rpc("tp_admin_set_product_review_status", {
    p_review_id: input.reviewId,
    p_status: input.status,
    p_admin_note: normalizeText(input.adminNote) || null,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return mapProductReview((row ?? {}) as Record<string, unknown>);
}
