import { supabase } from "@/lib/supabase";
import { fetchOrders, type OrderListItem } from "@/lib/ordersApi";

export type CustomerAdminItem = {
  id: string;
  customer_name: string;
  email: string | null;
  has_account: boolean;
  order_count: number;
  total_ordered: number;
  current_credits: number;
};

export type CustomerIdentityInput = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type CustomerRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  address: string;
  notes: string | null;
  created_at?: string | null;
  available_steak_credits: number;
};

export type CustomerAdminDetail = {
  customer: CustomerRecord;
  has_account: boolean;
  order_count: number;
  total_ordered: number;
  orders: OrderListItem[];
};

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: string | null | undefined): string {
  return normalizeText(value).toLowerCase();
}

function normalizePhone(value: string | null | undefined): string {
  return normalizeText(value).replace(/\D/g, "");
}

export function composeCustomerFullName(input: CustomerIdentityInput): string {
  const first = normalizeText(input.firstName);
  const last = normalizeText(input.lastName);
  const full = normalizeText(input.fullName);
  return [first, last].filter(Boolean).join(" ").trim() || full;
}

function mapCustomerRecord(row: Record<string, unknown>): CustomerRecord {
  return {
    id: String(row.id ?? ""),
    first_name: row.first_name == null ? null : String(row.first_name),
    last_name: row.last_name == null ? null : String(row.last_name),
    full_name: String(row.full_name ?? ""),
    phone: String(row.phone ?? ""),
    email: row.email == null ? null : String(row.email),
    address: String(row.address ?? ""),
    notes: row.notes == null ? null : String(row.notes),
    created_at: row.created_at == null ? null : String(row.created_at),
    available_steak_credits: Number(row.available_steak_credits ?? 0),
  };
}

export async function fetchCustomerById(customerId: string): Promise<CustomerRecord | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("id,first_name,last_name,full_name,phone,email,address,notes,created_at,available_steak_credits")
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapCustomerRecord(data as Record<string, unknown>);
}

export async function findExactCustomerMatch(
  input: CustomerIdentityInput
): Promise<CustomerRecord | null> {
  const fullName = composeCustomerFullName(input);
  const phoneKey = normalizePhone(input.phone);
  const emailKey = normalizeKey(input.email);
  if (!fullName || !phoneKey) return null;

  const { data, error } = await supabase
    .from("customers")
    .select("id,first_name,last_name,full_name,phone,email,address,notes,created_at,available_steak_credits")
    .eq("full_name", fullName)
    .limit(20);
  if (error) throw error;

  const matches = (data ?? [])
    .map((row) => mapCustomerRecord(row as Record<string, unknown>))
    .filter((row) => normalizePhone(row.phone) === phoneKey)
    .filter((row) => (emailKey ? normalizeKey(row.email) === emailKey : true));

  return matches.length === 1 ? matches[0] : null;
}

export async function ensureCustomerRecord(input: CustomerIdentityInput): Promise<CustomerRecord> {
  const fullName = composeCustomerFullName(input);
  const phone = normalizeText(input.phone);
  if (!fullName) throw new Error("Customer full name is required.");
  if (!phone) throw new Error("Customer phone is required.");

  const existing = await findExactCustomerMatch(input);
  if (existing) {
    const payload: Record<string, unknown> = {};
    const firstName = normalizeText(input.firstName);
    const lastName = normalizeText(input.lastName);
    const email = normalizeText(input.email) || null;
    const address = normalizeText(input.address);
    const notes = normalizeText(input.notes) || null;

    if (firstName && firstName !== normalizeText(existing.first_name)) payload.first_name = firstName;
    if (lastName && lastName !== normalizeText(existing.last_name)) payload.last_name = lastName;
    if (email && normalizeKey(existing.email) !== normalizeKey(email)) payload.email = email;
    if (address && address !== existing.address) payload.address = address;
    if (notes && normalizeText(existing.notes) !== notes) payload.notes = notes;

    if (Object.keys(payload).length > 0) {
      const { data, error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", existing.id)
        .select("id,first_name,last_name,full_name,phone,email,address,notes,created_at,available_steak_credits")
        .maybeSingle();
      if (error) throw error;
      return mapCustomerRecord((data ?? existing) as Record<string, unknown>);
    }

    return existing;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      first_name: normalizeText(input.firstName) || null,
      last_name: normalizeText(input.lastName) || null,
      full_name: fullName,
      phone,
      email: normalizeText(input.email) || null,
      address: normalizeText(input.address),
      notes: normalizeText(input.notes) || null,
    })
    .select("id,first_name,last_name,full_name,phone,email,address,notes,created_at,available_steak_credits")
    .single();
  if (error) throw error;
  return mapCustomerRecord(data as Record<string, unknown>);
}

export async function linkProfileToCustomer(profileId: string, customerId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ customer_id: customerId })
    .eq("id", profileId);
  if (error) throw error;
}

export async function updateCustomerRecord(
  customerId: string,
  input: CustomerIdentityInput
): Promise<CustomerRecord> {
  const { data, error } = await supabase
    .from("customers")
    .update({
      first_name: normalizeText(input.firstName) || null,
      last_name: normalizeText(input.lastName) || null,
      full_name: composeCustomerFullName(input),
      phone: normalizeText(input.phone),
      email: normalizeText(input.email) || null,
      address: normalizeText(input.address),
      notes: normalizeText(input.notes) || null,
    })
    .eq("id", customerId)
    .select("id,first_name,last_name,full_name,phone,email,address,notes,created_at,available_steak_credits")
    .single();
  if (error) throw error;
  return mapCustomerRecord(data as Record<string, unknown>);
}

export async function fetchAdminCustomers(): Promise<CustomerAdminItem[]> {
  const { data, error } = await supabase.rpc("tp_admin_customer_overview");
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ""),
    customer_name: String(row.customer_name ?? "Unnamed customer"),
    email: row.email == null ? null : String(row.email),
    has_account: Boolean(row.has_account),
    order_count: Number(row.order_count ?? 0),
    total_ordered: Number(row.total_ordered ?? 0),
    current_credits: Number(row.current_credits ?? 0),
  }));
}

export async function fetchAdminCustomerDetail(customerId: string): Promise<CustomerAdminDetail | null> {
  let customer = await fetchCustomerById(customerId).catch(() => null);
  const overviewRows = customer ? null : await fetchAdminCustomers().catch(() => []);
  const overview = overviewRows?.find((row) => row.id === customerId) ?? null;

  if (!customer && overview) {
    customer = {
      id: overview.id,
      first_name: null,
      last_name: null,
      full_name: overview.customer_name,
      phone: "",
      email: overview.email,
      address: "",
      notes: null,
      created_at: null,
      available_steak_credits: overview.current_credits,
    };
  }

  if (!customer) return null;

  const [profileResult, orders] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId),
    fetchOrders({ all: true, customerId }),
  ]);

  const hasAccount =
    profileResult.error == null
      ? Number(profileResult.count ?? 0) > 0
      : Boolean(overview?.has_account);
  const firstOrderCreatedAt =
    orders.length > 0
      ? orders
          .map((row) => String(row.created_at ?? "").trim())
          .filter(Boolean)
          .slice()
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null
      : null;

  return {
    customer: {
      ...customer,
      created_at: firstOrderCreatedAt ?? customer.created_at ?? null,
    },
    has_account: hasAccount,
    order_count: overview ? overview.order_count : orders.length,
    total_ordered: overview
      ? overview.total_ordered
      : orders.reduce((sum, row) => sum + Math.max(0, Number(row.total_selling_price ?? 0)), 0),
    orders,
  };
}

export async function adjustCustomerSteakCredits(
  customerId: string,
  delta: number
): Promise<number> {
  const { data, error } = await supabase.rpc("tp_admin_adjust_steak_credits", {
    p_customer_id: customerId,
    p_delta: delta,
  });
  if (error) throw error;
  return Number(data ?? 0);
}
