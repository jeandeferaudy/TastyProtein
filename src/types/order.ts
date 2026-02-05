// src/types/order.ts

export type CustomerDraft = {
  full_name: string;
  phone: string;
  address: string;
  notes?: string;
};

export type OrderLine = {
  product_id: string;
  name: string;
  size: string | null;
  price: number;
  qty: number;
  line_total: number;
};

export type Order = {
  id: string;
  session_id: string;
  customer: CustomerDraft;
  subtotal: number;
  status: "draft" | "submitted" | "paid" | "cancelled";
  created_at: string;
  lines: OrderLine[];
};