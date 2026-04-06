import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type InviteSignupPayload = {
  customerId?: string | null;
  phone?: string | null;
  email?: string | null;
  password?: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function normalizePhone(value: string | null | undefined): string {
  const digits = normalizeText(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("63") && digits.length >= 12) return digits.slice(2);
  if (digits.startsWith("0") && digits.length >= 11) return digits.slice(1);
  return digits;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase server configuration." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as InviteSignupPayload;
    const customerId = normalizeText(body.customerId);
    const email = normalizeText(body.email).toLowerCase();
    const password = String(body.password ?? "");
    const phone = normalizePhone(body.phone);

    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Missing customer id." }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
    }
    if (password.trim().length < 6) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }
    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Phone number confirmation is required." },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: customer, error: customerError } = await adminClient
      .from("customers")
      .select(
        "id,first_name,last_name,full_name,phone,email,address,notes,attention_to,address_line1,address_line2,barangay,city,province,postal_code,country,delivery_note"
      )
      .eq("id", customerId)
      .maybeSingle();

    if (customerError) {
      return NextResponse.json(
        { ok: false, error: customerError.message || "Failed to load customer." },
        { status: 400 }
      );
    }
    if (!customer) {
      return NextResponse.json({ ok: false, error: "Invite is no longer valid." }, { status: 404 });
    }

    const customerPhone = normalizePhone(String(customer.phone ?? ""));
    if (!customerPhone) {
      return NextResponse.json(
        { ok: false, error: "This customer does not have a phone number yet." },
        { status: 400 }
      );
    }
    if (phone !== customerPhone) {
      return NextResponse.json(
        { ok: false, error: "Phone number does not match our records." },
        { status: 400 }
      );
    }

    const created = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: String(customer.full_name ?? "").trim() || undefined,
        phone: String(customer.phone ?? "").trim() || undefined,
      },
      app_metadata: {
        invited_customer_id: customerId,
      },
    });

    if (created.error || !created.data.user?.id) {
      const message = created.error?.message || "Failed to create invited user.";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const userId = String(created.data.user.id);
    const fullName = String(customer.full_name ?? "").trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);

    const { error: profileError } = await adminClient.from("profiles").upsert(
      {
        id: userId,
        customer_id: customerId,
        first_name: String(customer.first_name ?? "").trim() || nameParts[0] || null,
        last_name:
          String(customer.last_name ?? "").trim() ||
          (nameParts.length > 1 ? nameParts.slice(1).join(" ") : null),
        phone: String(customer.phone ?? "").trim() || null,
        attention_to: String(customer.attention_to ?? "").trim() || null,
        address_line1: String(customer.address_line1 ?? "").trim() || null,
        address_line2: String(customer.address_line2 ?? "").trim() || null,
        barangay: String(customer.barangay ?? "").trim() || null,
        city: String(customer.city ?? "").trim() || null,
        province: String(customer.province ?? "").trim() || null,
        postal_code: String(customer.postal_code ?? "").trim() || null,
        country: String(customer.country ?? "").trim() || "Philippines",
        delivery_note: String(customer.delivery_note ?? "").trim() || null,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { ok: false, error: profileError.message || "Failed to create profile." },
        { status: 400 }
      );
    }

    const { error: customerUpdateError } = await adminClient
      .from("customers")
      .update({ email })
      .eq("id", customerId);

    if (customerUpdateError) {
      await adminClient.auth.admin.deleteUser(userId);
      await adminClient.from("profiles").delete().eq("id", userId);
      return NextResponse.json(
        { ok: false, error: customerUpdateError.message || "Failed to update customer email." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, userId });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error." },
      { status: 500 }
    );
  }
}
