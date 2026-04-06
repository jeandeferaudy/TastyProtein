import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getBearerToken(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function normalizePath(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || text.startsWith("http")) return null;
  return text;
}

type StorageAdminClient = {
  storage: {
    from: (bucket: string) => {
      remove: (paths: string[]) => Promise<unknown>;
    };
  };
};

async function removeProofObject(adminClient: StorageAdminClient, path: string): Promise<void> {
  await adminClient.storage.from("payment-proofs").remove([path]);
  await adminClient.storage.from("payment_proofs").remove([path]);
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase server configuration." },
        { status: 500 }
      );
    }

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing auth token." }, { status: 401 });
    }

    const formData = await req.formData();
    const orderId = String(formData.get("orderId") ?? "").trim();
    const currentPath = normalizePath(formData.get("currentPath"));
    const fileValue = formData.get("file");
    const file = fileValue instanceof File ? fileValue : null;

    if (!orderId) {
      return NextResponse.json({ ok: false, error: "Missing order id." }, { status: 400 });
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const {
      data: { user: actingUser },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !actingUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id,user_id,customer_id,payment_proof_url")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) {
      return NextResponse.json(
        { ok: false, error: orderError.message || "Failed to load order." },
        { status: 400 }
      );
    }
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
    }

    const byId = await adminClient
      .from("profiles")
      .select("role,customer_id")
      .eq("id", actingUser.id)
      .maybeSingle();
    const profile = byId.data ?? null;
    const role = String(profile?.role ?? "").trim().toLowerCase();
    const actingCustomerId = profile?.customer_id ? String(profile.customer_id) : null;

    const canManage =
      role === "admin" ||
      String(order.user_id ?? "") === actingUser.id ||
      (actingCustomerId && String(order.customer_id ?? "") === actingCustomerId);

    if (!canManage) {
      return NextResponse.json(
        { ok: false, error: "You are not allowed to update this payment proof." },
        { status: 403 }
      );
    }

    const existingPath = normalizePath(order.payment_proof_url) ?? currentPath;

    if (!file) {
      if (existingPath) {
        await removeProofObject(adminClient, existingPath);
      }
      const { error: clearError } = await adminClient
        .from("orders")
        .update({ payment_proof_url: null })
        .eq("id", orderId);
      if (clearError) {
        return NextResponse.json(
          { ok: false, error: clearError.message || "Failed to clear payment proof." },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true, paymentProofPath: null });
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "jpg" : "jpg";
    const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `orders/${orderId}/${Date.now()}-${safeName || `proof.${safeExt}`}`;

    const uploadedA = await adminClient.storage.from("payment-proofs").upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (uploadedA.error) {
      const uploadedB = await adminClient.storage.from("payment_proofs").upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (uploadedB.error) {
        return NextResponse.json(
          { ok: false, error: uploadedB.error.message || "Failed to upload payment proof." },
          { status: 400 }
        );
      }
    }

    if (existingPath && existingPath !== path) {
      await removeProofObject(adminClient, existingPath);
    }

    const { error: saveError } = await adminClient
      .from("orders")
      .update({ payment_proof_url: path })
      .eq("id", orderId);
    if (saveError) {
      await removeProofObject(adminClient, path);
      return NextResponse.json(
        { ok: false, error: saveError.message || "Failed to save payment proof." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, paymentProofPath: path });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase server configuration." },
        { status: 500 }
      );
    }

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing auth token." }, { status: 401 });
    }

    const url = new URL(req.url);
    const orderId = String(url.searchParams.get("orderId") ?? "").trim();
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "Missing order id." }, { status: 400 });
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const {
      data: { user: actingUser },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !actingUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id,user_id,customer_id,payment_proof_url")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) {
      return NextResponse.json(
        { ok: false, error: orderError.message || "Failed to load order." },
        { status: 400 }
      );
    }
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
    }

    const byId = await adminClient
      .from("profiles")
      .select("role,customer_id")
      .eq("id", actingUser.id)
      .maybeSingle();
    const profile = byId.data ?? null;
    const role = String(profile?.role ?? "").trim().toLowerCase();
    const actingCustomerId = profile?.customer_id ? String(profile.customer_id) : null;

    const canView =
      role === "admin" ||
      String(order.user_id ?? "") === actingUser.id ||
      (actingCustomerId && String(order.customer_id ?? "") === actingCustomerId);

    if (!canView) {
      return NextResponse.json(
        { ok: false, error: "You are not allowed to view this payment proof." },
        { status: 403 }
      );
    }

    const path = normalizePath(order.payment_proof_url);
    if (!path) {
      return NextResponse.json({ ok: true, signedUrl: null });
    }

    const signedA = await adminClient.storage.from("payment-proofs").createSignedUrl(path, 3600);
    if (!signedA.error && signedA.data?.signedUrl) {
      return NextResponse.json({ ok: true, signedUrl: signedA.data.signedUrl });
    }

    const signedB = await adminClient.storage.from("payment_proofs").createSignedUrl(path, 3600);
    if (!signedB.error && signedB.data?.signedUrl) {
      return NextResponse.json({ ok: true, signedUrl: signedB.data.signedUrl });
    }

    return NextResponse.json(
      { ok: false, error: signedB.error?.message || signedA.error?.message || "Failed to sign URL." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error." },
      { status: 500 }
    );
  }
}
