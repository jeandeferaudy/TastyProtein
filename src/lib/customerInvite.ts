export type CustomerInvite = {
  customerId: string;
  email: string | null;
};

const INVITE_CUSTOMER_KEY = "invite_customer";
const INVITE_EMAIL_KEY = "invite_email";

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function buildCustomerInvitePath(input: {
  customerId: string;
  email?: string | null;
}): string {
  const customerId = normalizeText(input.customerId);
  if (!customerId) return "/";

  const params = new URLSearchParams();
  params.set(INVITE_CUSTOMER_KEY, customerId);
  const email = normalizeText(input.email).toLowerCase();
  if (email) params.set(INVITE_EMAIL_KEY, email);
  return `/?${params.toString()}`;
}

export function parseCustomerInvite(search: string): CustomerInvite | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const customerId = normalizeText(params.get(INVITE_CUSTOMER_KEY));
  if (!customerId) return null;

  const email = normalizeText(params.get(INVITE_EMAIL_KEY)).toLowerCase();
  return {
    customerId,
    email: email || null,
  };
}
