import { NextResponse } from "next/server";

type SendOrderEmailPayload = {
  email: string;
  name?: string | null;
  orderId: string;
  orderNumber?: string | null;
  origin?: string | null;
};

const DEFAULT_ADMIN_CC = ["uzziel.sanjuan@gmail.com", "adriel.sanjuan@gmail.com"];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SendOrderEmailPayload;
    const email = String(body.email ?? "").trim();
    if (!email) {
      return NextResponse.json({ ok: false, error: "Missing email." }, { status: 400 });
    }

    const orderId = String(body.orderId ?? "").trim();
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "Missing order id." }, { status: 400 });
    }

    const from = process.env.RESEND_FROM || "onboarding@resend.dev";
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY." }, { status: 500 });
    }

    const origin = String(body.origin ?? "").trim() || "https://tastyprotein.vercel.app";
    const orderNumber = String(body.orderNumber ?? "").trim();
    const orderLabel = orderNumber ? `Order ${orderNumber}` : "Your order";
    const orderUrl = `${origin.replace(/\/$/, "")}/order?id=${encodeURIComponent(orderId)}`;
    const displayName = String(body.name ?? "").trim() || "there";
    const adminCcEnv = String(process.env.ADMIN_CC_EMAILS ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const adminCc = adminCcEnv.length ? adminCcEnv : DEFAULT_ADMIN_CC;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111;">
        <p>Hi ${displayName},</p>
        <p>Your order has been placed successfully.</p>
        <p><strong>${orderLabel}</strong></p>
        <p>You can view your order summary anytime using this link:</p>
        <p><a href="${orderUrl}">${orderUrl}</a></p>
        <p>If you have any questions, reply to this email and our team will help you.</p>
        <p>— Tasty Protein</p>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        cc: adminCc,
        subject: `${orderLabel} has been placed`,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      return NextResponse.json(
        { ok: false, error: "Resend request failed.", details: errText },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error." },
      { status: 500 }
    );
  }
}
