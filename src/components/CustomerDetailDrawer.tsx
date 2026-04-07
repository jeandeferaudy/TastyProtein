"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  AppButton,
  TOPBAR_FONT_SIZE,
  TOPBAR_FONT_SIZE_MOBILE,
} from "@/components/ui";
import type {
  AdminProfileOption,
  CustomerAdminDetail,
  CustomerAdminItem,
} from "@/lib/customersApi";

const BACK_BTN_W = 68;
const TITLE_GAP = 40;

type Props = {
  isOpen: boolean;
  topOffset: number;
  detail: CustomerAdminDetail | null;
  loading?: boolean;
  backgroundStyle?: React.CSSProperties;
  onBack: () => void;
  onOpenOrder: (orderId: string) => void;
  onAdjustCredits: (customerId: string, delta: number) => Promise<void> | void;
  onToggleSteakCreditsEnabled: (customerId: string, enabled: boolean) => Promise<void> | void;
  onSaveCustomerProfile: (
    customerId: string,
    input: {
      firstName: string;
      lastName: string;
      fullName: string;
      phone: string;
      attentionTo: string;
      addressLine1: string;
      addressLine2: string;
      barangay: string;
      city: string;
      province: string;
      postalCode: string;
      country: string;
      deliveryNote: string;
    }
  ) => Promise<void> | void;
  onSaveCustomerEmail: (customerId: string, email: string) => Promise<void> | void;
  profiles: AdminProfileOption[];
  customers: CustomerAdminItem[];
  deleteUserAvailable?: boolean;
  onDeleteCustomer: (customerId: string) => Promise<void> | void;
  onDeleteUser: (profileId: string, customerId: string) => Promise<void> | void;
  onLinkCustomerToProfile: (customerId: string, profileId: string) => Promise<void> | void;
  onCombineCustomer: (customerId: string, otherCustomerId: string) => Promise<void> | void;
  onCopyInviteLink?: (input: { customerId: string; email: string | null }) => Promise<void> | void;
};

function fmtMoney(v: number) {
  return v.toLocaleString("en-PH");
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

function orderNumber8(id: string) {
  const digits = id.replace(/\D/g, "");
  return (digits.slice(-8) || "00000000").padStart(8, "0");
}

function statusTone(value: string): React.CSSProperties {
  const v = String(value || "").toLowerCase();
  if (v === "completed" || v === "paid" || v === "delivered" || v === "confirmed") {
    return { color: "#67bf8a", borderColor: "rgba(157,228,182,0.75)", background: "transparent" };
  }
  if (v === "processed" || v === "packed" || v === "in progress" || v === "submitted") {
    return { color: "#2f99d6", borderColor: "rgba(102,199,255,0.72)", background: "transparent" };
  }
  if (v === "unpaid" || v === "undelivered" || v === "draft" || v === "unpacked") {
    return { color: "#c38a28", borderColor: "rgba(255,207,122,0.76)", background: "transparent" };
  }
  return { color: "var(--tp-text-color)", borderColor: "rgba(255,255,255,0.24)", background: "transparent" };
}

export default function CustomerDetailDrawer({
  isOpen,
  topOffset,
  detail,
  loading = false,
  backgroundStyle,
  onBack,
  onOpenOrder,
  onAdjustCredits,
  onToggleSteakCreditsEnabled,
  onSaveCustomerProfile,
  onSaveCustomerEmail,
  profiles,
  customers,
  deleteUserAvailable = false,
  onDeleteCustomer,
  onDeleteUser,
  onLinkCustomerToProfile,
  onCombineCustomer,
  onCopyInviteLink,
}: Props) {
  const [search, setSearch] = React.useState("");
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const [creditDraft, setCreditDraft] = React.useState("");
  const [emailDraft, setEmailDraft] = React.useState("");
  const [profileEditorOpen, setProfileEditorOpen] = React.useState(false);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [profileDraft, setProfileDraft] = React.useState({
    firstName: "",
    lastName: "",
    fullName: "",
    phone: "",
    attentionTo: "",
    addressLine1: "",
    addressLine2: "",
    barangay: "",
    city: "",
    province: "",
    postalCode: "",
    country: "Philippines",
    deliveryNote: "",
  });
  const [linkQuery, setLinkQuery] = React.useState("");
  const [combineQuery, setCombineQuery] = React.useState("");
  const [creditSaving, setCreditSaving] = React.useState(false);
  const [emailSaving, setEmailSaving] = React.useState(false);
  const [creditsEnabledSaving, setCreditsEnabledSaving] = React.useState(false);
  const [deleteSaving, setDeleteSaving] = React.useState(false);
  const [deleteUserSaving, setDeleteUserSaving] = React.useState(false);
  const [linkSaving, setLinkSaving] = React.useState(false);
  const [combineSaving, setCombineSaving] = React.useState(false);
  const [inviteCopied, setInviteCopied] = React.useState(false);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [portalReady, setPortalReady] = React.useState(false);
  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;

  React.useEffect(() => {
    setPortalReady(true);
    return () => setPortalReady(false);
  }, []);

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    setCreditDraft("");
    setEmailDraft(detail?.customer.email ?? "");
    setProfileEditorOpen(false);
    setProfileSaving(false);
    setProfileDraft({
      firstName: detail?.customer.first_name ?? "",
      lastName: detail?.customer.last_name ?? "",
      fullName: detail?.customer.full_name ?? "",
      phone: detail?.customer.phone ?? "",
      attentionTo: detail?.customer.attention_to ?? "",
      addressLine1: detail?.customer.address_line1 ?? "",
      addressLine2: detail?.customer.address_line2 ?? "",
      barangay: detail?.customer.barangay ?? "",
      city: detail?.customer.city ?? "",
      province: detail?.customer.province ?? "",
      postalCode: detail?.customer.postal_code ?? "",
      country: detail?.customer.country || "Philippines",
      deliveryNote: detail?.customer.delivery_note ?? "",
    });
    setLinkQuery("");
    setCombineQuery("");
    setCreditSaving(false);
    setEmailSaving(false);
    setCreditsEnabledSaving(false);
    setDeleteSaving(false);
    setDeleteUserSaving(false);
    setLinkSaving(false);
    setCombineSaving(false);
    setInviteCopied(false);
    setAdminOpen(false);
  }, [
    detail?.customer.address,
    detail?.customer.email,
    detail?.customer.first_name,
    detail?.customer.full_name,
    detail?.customer.id,
    detail?.customer.last_name,
    detail?.customer.phone,
    detail?.customer.attention_to,
    detail?.customer.address_line1,
    detail?.customer.address_line2,
    detail?.customer.barangay,
    detail?.customer.city,
    detail?.customer.province,
    detail?.customer.postal_code,
    detail?.customer.country,
    detail?.customer.delivery_note,
  ]);

  const filteredOrders = React.useMemo(() => {
    const rows = detail?.orders ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((order) => {
      const orderNo = String(order.order_number ?? orderNumber8(order.id)).toLowerCase();
      const createdAt = fmtDate(order.created_at).toLowerCase();
      const deliveryAt = fmtDate(order.delivery_date).toLowerCase();
      return orderNo.includes(q) || createdAt.includes(q) || deliveryAt.includes(q);
    });
  }, [detail?.orders, search]);

  const customerName =
    detail?.customer.full_name?.trim() ||
    [detail?.customer.first_name, detail?.customer.last_name].filter(Boolean).join(" ").trim() ||
    "Customer";
  const parsedCreditDelta = Number(creditDraft);
  const canAdjustCredits =
    !!detail &&
    creditDraft.trim().length > 0 &&
    Number.isFinite(parsedCreditDelta) &&
    parsedCreditDelta !== 0 &&
    !creditSaving;
  const normalizedEmailDraft = emailDraft.trim();
  const canSaveEmail =
    !!detail &&
    !emailSaving &&
    normalizedEmailDraft !== String(detail.customer.email ?? "").trim();
  const canSaveProfile =
    !!detail &&
    !profileSaving &&
    (
      profileDraft.firstName.trim() !== String(detail.customer.first_name ?? "").trim() ||
      profileDraft.lastName.trim() !== String(detail.customer.last_name ?? "").trim() ||
      profileDraft.fullName.trim() !== String(detail.customer.full_name ?? "").trim() ||
      profileDraft.phone.trim() !== String(detail.customer.phone ?? "").trim() ||
      profileDraft.attentionTo.trim() !== String(detail.customer.attention_to ?? "").trim() ||
      profileDraft.addressLine1.trim() !== String(detail.customer.address_line1 ?? "").trim() ||
      profileDraft.addressLine2.trim() !== String(detail.customer.address_line2 ?? "").trim() ||
      profileDraft.barangay.trim() !== String(detail.customer.barangay ?? "").trim() ||
      profileDraft.city.trim() !== String(detail.customer.city ?? "").trim() ||
      profileDraft.province.trim() !== String(detail.customer.province ?? "").trim() ||
      profileDraft.postalCode.trim() !== String(detail.customer.postal_code ?? "").trim() ||
      profileDraft.country.trim() !== String(detail.customer.country ?? "Philippines").trim() ||
      profileDraft.deliveryNote.trim() !== String(detail.customer.delivery_note ?? "").trim()
    );
  const linkedCustomerLabels = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const customer of customers) {
      map.set(customer.id, customer.customer_name);
    }
    return map;
  }, [customers]);
  const filteredProfiles = React.useMemo(() => {
    if (!detail || detail.has_account) return [];
    const q = linkQuery.trim().toLowerCase();
    return profiles
      .filter((profile) => profile.id !== "")
      .filter((profile) => profile.customer_id !== detail.customer.id)
      .filter((profile) => {
        const displayName =
          [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
          `User ${profile.id.slice(0, 8)}`;
        const linkedCustomerLabel = profile.customer_id
          ? linkedCustomerLabels.get(profile.customer_id) ?? "Linked customer"
          : "No customer";
        const haystack = `${displayName} ${linkedCustomerLabel}`.toLowerCase();
        return !q || haystack.includes(q);
      })
      .slice(0, 8);
  }, [detail, linkQuery, linkedCustomerLabels, profiles]);
  const filteredCombineCustomers = React.useMemo(() => {
    if (!detail) return [];
    const q = combineQuery.trim().toLowerCase();
    return customers
      .filter((customer) => customer.id !== detail.customer.id)
      .filter((customer) => {
        const haystack = `${customer.customer_name} ${customer.email ?? ""}`.toLowerCase();
        return !q || haystack.includes(q);
      })
      .slice(0, 8);
  }, [combineQuery, customers, detail]);
  const linkedProfiles = React.useMemo(() => {
    if (!detail) return [];
    return profiles.filter((profile) => profile.customer_id === detail.customer.id);
  }, [detail, profiles]);

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          ...styles.backdrop,
          ...(backgroundStyle ?? null),
          top: panelTop,
          height: panelHeight,
        }}
      />
      <aside
        className={isMobileViewport ? "tp-sheet-slide-up" : "tp-drawer-slide-up"}
        style={{
          ...styles.panel,
          ...(backgroundStyle ?? null),
          top: panelTop,
          height: panelHeight,
          ...(isMobileViewport ? { width: "100vw", left: 0, transform: "none" } : null),
        }}
      >
        <div style={{ ...styles.topRow, ...(isMobileViewport ? styles.topRowMobile : null) }}>
          <AppButton
            variant="ghost"
            style={{ ...styles.backBtn, ...(isMobileViewport ? styles.backBtnMobile : null) }}
            onClick={onBack}
          >
            BACK
          </AppButton>
          <div style={{ ...styles.title, ...(isMobileViewport ? styles.titleMobile : null) }}>
            CUSTOMER
          </div>
        </div>

        <div style={{ ...styles.content, ...(isMobileViewport ? styles.contentMobile : null) }}>
          {loading || !detail ? (
            <div style={styles.empty}>Loading customer...</div>
          ) : (
            <>
              <div style={{ ...styles.summaryGrid, ...(isMobileViewport ? styles.summaryGridMobile : null) }}>
                <div style={styles.identityCard}>
                  <div style={styles.cardLabel}>Customer</div>
                  <div style={styles.customerNameRow}>
                    <div style={styles.customerName}>{customerName}</div>
                    <div style={styles.customerActions}>
                      <button
                        type="button"
                        style={{
                          ...styles.inviteButton,
                          ...(!detail.customer.phone ? styles.inviteButtonDisabled : null),
                        }}
                        disabled={!detail.customer.phone}
                        onClick={async () => {
                          if (!detail || !detail.customer.phone || !onCopyInviteLink) return;
                          try {
                            await onCopyInviteLink({
                              customerId: detail.customer.id,
                              email: detail.customer.email,
                            });
                            setInviteCopied(true);
                            window.setTimeout(() => setInviteCopied(false), 1800);
                          } catch (error) {
                            console.error("Failed to copy invite link", error);
                            alert("Failed to copy invite link.");
                          }
                        }}
                        aria-label="Copy invite link"
                        title={
                          detail.customer.phone
                            ? "Copy invite link"
                            : "Add a customer phone number before sending an invite"
                        }
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                          <path
                            d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25ZM5.4 6.5l6.1 5.07a.8.8 0 0 0 1 0l6.1-5.07H5.4Zm13.1 1.04-5.48 4.55a2.4 2.4 0 0 1-3.04 0L4.5 7.54v9.71c0 .69.56 1.25 1.25 1.25h12.5c.69 0 1.25-.56 1.25-1.25Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        style={styles.editProfileButton}
                        onClick={() => setProfileEditorOpen(true)}
                        aria-label="Edit customer profile"
                      >
                        EDIT
                      </button>
                    </div>
                  </div>
                  {inviteCopied ? <div style={styles.inviteCopied}>Link copied</div> : null}
                  <div style={styles.identityFieldRow}>
                    <label style={styles.identityFieldLabel}>Email</label>
                    <div style={styles.identityEmailRow}>
                      <input
                        value={emailDraft}
                        onChange={(event) => setEmailDraft(event.target.value)}
                        placeholder="customer@email.com"
                        style={styles.identityEmailInput}
                      />
                      <AppButton
                        type="button"
                        variant="ghost"
                        style={styles.identityEmailButton}
                        disabled={!canSaveEmail}
                        onClick={async () => {
                          if (!detail || !canSaveEmail) return;
                          setEmailSaving(true);
                          try {
                            await onSaveCustomerEmail(detail.customer.id, normalizedEmailDraft);
                          } catch (error) {
                            console.error("Failed to update customer email", error);
                            alert("Failed to update customer email.");
                          } finally {
                            setEmailSaving(false);
                          }
                        }}
                      >
                        {emailSaving ? "SAVING..." : "SAVE"}
                      </AppButton>
                    </div>
                  </div>
                  <div style={styles.identityMeta}>Created: {fmtDate(detail.customer.created_at)}</div>
                </div>
                <div
                  style={{
                    ...styles.metricCard,
                    ...(detail.customer.steak_credits_enabled ? styles.metricCardEnabled : null),
                  }}
                >
                  <div style={styles.cardLabel}>Steak Credits</div>
                  <label
                    style={{
                      ...styles.toggleCorner,
                      ...(detail.customer.steak_credits_enabled ? styles.toggleCornerEnabled : null),
                      ...(creditsEnabledSaving ? styles.toggleCornerDisabled : null),
                    }}
                  >
                    <span style={styles.toggleCornerLabel}>
                      {detail.customer.steak_credits_enabled ? "ON" : "OFF"}
                    </span>
                    <input
                      type="checkbox"
                      checked={detail.customer.steak_credits_enabled}
                      disabled={creditsEnabledSaving}
                      onChange={async (event) => {
                        if (!detail) return;
                        setCreditsEnabledSaving(true);
                        try {
                          await onToggleSteakCreditsEnabled(
                            detail.customer.id,
                            event.target.checked
                          );
                        } catch (error) {
                          console.error("Failed to update Steak Credits activation", error);
                          alert("Failed to update Steak Credits activation.");
                        } finally {
                          setCreditsEnabledSaving(false);
                        }
                      }}
                      style={styles.toggleInput}
                      aria-label="Toggle steak credits"
                    />
                    <span
                      aria-hidden
                      style={{
                        ...styles.toggleTrack,
                        ...(detail.customer.steak_credits_enabled ? styles.toggleTrackEnabled : null),
                      }}
                    >
                      <span
                        style={{
                          ...styles.toggleThumb,
                          ...(detail.customer.steak_credits_enabled ? styles.toggleThumbEnabled : null),
                        }}
                      />
                    </span>
                  </label>
                  <div style={styles.metricValue}>₱ {fmtMoney(detail.customer.available_steak_credits)}</div>
                  <div style={styles.creditAdjustRow}>
                    <input
                      value={creditDraft}
                      onChange={(event) => setCreditDraft(event.target.value)}
                      placeholder="+100 or -50"
                      style={styles.creditInput}
                    />
                    <AppButton
                      type="button"
                      variant="ghost"
                      style={styles.creditButton}
                      disabled={!canAdjustCredits}
                      onClick={async () => {
                        if (!detail || !canAdjustCredits) return;
                        setCreditSaving(true);
                        try {
                          await onAdjustCredits(detail.customer.id, parsedCreditDelta);
                          setCreditDraft("");
                        } catch (error) {
                          console.error("Failed to adjust Steak Credits", error);
                          alert("Failed to update Steak Credits.");
                        } finally {
                          setCreditSaving(false);
                        }
                      }}
                    >
                      {creditSaving ? "SAVING..." : "UPDATE"}
                    </AppButton>
                  </div>
                </div>
                <div style={styles.metricCard}>
                  <div style={styles.cardLabel}>Total Ordered</div>
                  <div style={styles.metricValue}>₱ {fmtMoney(detail.total_ordered)}</div>
                </div>
                <div style={styles.metricCard}>
                  <div style={styles.cardLabel}>Orders To Date</div>
                  <div style={styles.metricValue}>{detail.order_count}</div>
                </div>
              </div>

              <div style={styles.ordersBlock}>
                <div style={styles.sectionHead}>
                  <div style={styles.sectionTitle}>PAST ORDERS</div>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search order # or date..."
                    style={styles.searchInput}
                  />
                </div>

                {!isMobileViewport ? (
                  <div style={styles.listHead}>
                    <div>ORDER #</div>
                    <div>ORDER DATE</div>
                    <div>DELIVERY DATE</div>
                    <div>ITEMS</div>
                    <div>TOTAL</div>
                    <div style={styles.centerCell}>STATUS</div>
                    <div style={styles.centerCell}>PAYMENT</div>
                    <div style={styles.centerCell}>DELIVERY</div>
                  </div>
                ) : null}

                <div style={styles.listBody}>
                  {filteredOrders.length === 0 ? (
                    <div style={styles.empty}>No orders for this customer yet.</div>
                  ) : (
                    filteredOrders.map((order) =>
                      isMobileViewport ? (
                        <button
                          key={order.id}
                          type="button"
                          style={styles.mobileCard}
                          onClick={() => onOpenOrder(order.id)}
                        >
                          <div style={styles.mobileCardTop}>
                            <div style={styles.mobileOrderNo}>#{order.order_number ?? orderNumber8(order.id)}</div>
                            <div style={styles.mobileTotal}>₱ {fmtMoney(order.total_selling_price)}</div>
                          </div>
                          <div style={styles.mobileMetaRow}>
                            <span>Order: {fmtDate(order.created_at)}</span>
                            <span>Delivery: {fmtDate(order.delivery_date)}</span>
                          </div>
                          <div style={styles.mobileMetaRow}>
                            <span>Items: {Math.max(0, Number(order.total_qty ?? 0))}</span>
                          </div>
                          <div style={styles.mobilePillsRow}>
                            <span style={{ ...styles.rowStatusPill, ...styles.rowStatusPillMobile, ...statusTone(order.status) }}>
                              {order.status}
                            </span>
                            <span style={{ ...styles.rowStatusPill, ...styles.rowStatusPillMobile, ...statusTone(order.paid_status) }}>
                              {order.paid_status}
                            </span>
                            <span style={{ ...styles.rowStatusPill, ...styles.rowStatusPillMobile, ...statusTone(order.delivery_status) }}>
                              {order.delivery_status}
                            </span>
                          </div>
                        </button>
                      ) : (
                        <button
                          key={order.id}
                          type="button"
                          style={styles.listRow}
                          onClick={() => onOpenOrder(order.id)}
                        >
                          <div>{order.order_number ?? orderNumber8(order.id)}</div>
                          <div>{fmtDate(order.created_at)}</div>
                          <div>{fmtDate(order.delivery_date)}</div>
                          <div>{Math.max(0, Number(order.total_qty ?? 0))}</div>
                          <div>₱ {fmtMoney(order.total_selling_price)}</div>
                          <div style={styles.centerCell}>
                            <span style={{ ...styles.rowStatusPill, ...statusTone(order.status) }}>{order.status}</span>
                          </div>
                          <div style={styles.centerCell}>
                            <span style={{ ...styles.rowStatusPill, ...statusTone(order.paid_status) }}>{order.paid_status}</span>
                          </div>
                          <div style={styles.centerCell}>
                            <span style={{ ...styles.rowStatusPill, ...statusTone(order.delivery_status) }}>{order.delivery_status}</span>
                          </div>
                        </button>
                      )
                    )
                  )}
                </div>
              </div>

              <div style={styles.actionsPanel}>
                <button
                  type="button"
                  style={styles.adminToggle}
                  onClick={() => setAdminOpen((prev) => !prev)}
                >
                  <span style={styles.sectionTitle}>ADMIN ONLY</span>
                  <span style={styles.adminToggleIcon}>{adminOpen ? "−" : "+"}</span>
                </button>
                {adminOpen ? (
                  <div style={{ ...styles.actionsGrid, ...(isMobileViewport ? styles.actionsGridMobile : null) }}>
                    <div style={styles.actionsCard}>
                      <div style={styles.cleanupTitle}>Cleanup</div>
                      {!detail.has_account ? (
                        <AppButton
                          type="button"
                          variant="ghost"
                          style={styles.cleanupDangerButton}
                          disabled={deleteSaving}
                          onClick={async () => {
                            if (!detail) return;
                            if (!window.confirm("Delete this customer?")) return;
                            setDeleteSaving(true);
                            try {
                              await onDeleteCustomer(detail.customer.id);
                            } catch (error) {
                              console.error("Failed to delete customer", error);
                              alert("Failed to delete customer.");
                            } finally {
                              setDeleteSaving(false);
                            }
                          }}
                        >
                          {deleteSaving ? "DELETING..." : "DELETE CUSTOMER"}
                        </AppButton>
                      ) : (
                        <div style={styles.cleanupPlaceholder}>Customer is already linked to a user.</div>
                      )}

                      {linkedProfiles.length > 0 && deleteUserAvailable ? (
                        <AppButton
                          type="button"
                          variant="ghost"
                          style={styles.cleanupDangerButton}
                          disabled={deleteUserSaving}
                          onClick={async () => {
                            if (!detail || linkedProfiles.length === 0) return;
                            if (!window.confirm("Delete the linked user account?")) return;
                            setDeleteUserSaving(true);
                            try {
                              await onDeleteUser(linkedProfiles[0].id, detail.customer.id);
                            } catch (error) {
                              console.error("Failed to delete user", error);
                              alert("Failed to delete user.");
                            } finally {
                              setDeleteUserSaving(false);
                            }
                          }}
                        >
                          {deleteUserSaving ? "DELETING..." : "DELETE USER"}
                        </AppButton>
                      ) : null}
                    </div>

                    <div style={styles.actionsCard}>
                      <div style={styles.cleanupTitle}>Link to user</div>
                      {!detail.has_account ? (
                        <div style={styles.cleanupBlock}>
                          <div style={styles.cleanupLabel}>Select user</div>
                          <input
                            value={linkQuery}
                            onChange={(event) => setLinkQuery(event.target.value)}
                            placeholder="Search user profile..."
                            style={styles.cleanupInput}
                          />
                          {filteredProfiles.length > 0 ? (
                            <div style={styles.cleanupList}>
                              {filteredProfiles.map((profile) => {
                                const displayName =
                                  [profile.first_name, profile.last_name]
                                    .filter(Boolean)
                                    .join(" ")
                                    .trim() || `User ${profile.id.slice(0, 8)}`;
                                const linkedCustomerLabel = profile.customer_id
                                  ? linkedCustomerLabels.get(profile.customer_id) ?? "Linked customer"
                                  : "No customer yet";
                                return (
                                  <button
                                    key={profile.id}
                                    type="button"
                                    style={styles.cleanupOption}
                                    disabled={linkSaving}
                                    onClick={async () => {
                                      if (!detail) return;
                                      const actionText = profile.customer_id
                                        ? "This user already has a customer. Transfer this customer's orders to that customer?"
                                        : "Link this customer to the selected user?";
                                      if (!window.confirm(actionText)) return;
                                      setLinkSaving(true);
                                      try {
                                        await onLinkCustomerToProfile(detail.customer.id, profile.id);
                                      } catch (error) {
                                        console.error("Failed to link customer", error);
                                        alert("Failed to link customer.");
                                      } finally {
                                        setLinkSaving(false);
                                      }
                                    }}
                                  >
                                    <span>{displayName}</span>
                                    <span style={styles.cleanupOptionMeta}>{linkedCustomerLabel}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div style={styles.cleanupPlaceholder}>This customer already has a linked user.</div>
                      )}
                    </div>

                    <div style={styles.actionsCard}>
                      <div style={styles.cleanupTitle}>Combine</div>
                      <div style={styles.cleanupBlock}>
                        <div style={styles.cleanupLabel}>Combine with customer</div>
                        <input
                          value={combineQuery}
                          onChange={(event) => setCombineQuery(event.target.value)}
                          placeholder="Search customer..."
                          style={styles.cleanupInput}
                        />
                        {filteredCombineCustomers.length > 0 ? (
                          <div style={styles.cleanupList}>
                            {filteredCombineCustomers.map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                style={styles.cleanupOption}
                                disabled={combineSaving}
                                onClick={async () => {
                                  if (!detail) return;
                                  if (
                                    !window.confirm(
                                      "Combine these customers? Orders will be transferred and one customer will be removed."
                                    )
                                  ) {
                                    return;
                                  }
                                  setCombineSaving(true);
                                  try {
                                    await onCombineCustomer(detail.customer.id, customer.id);
                                  } catch (error) {
                                    console.error("Failed to combine customers", error);
                                    alert("Failed to combine customers.");
                                  } finally {
                                    setCombineSaving(false);
                                  }
                                }}
                              >
                                <span>{customer.customer_name}</span>
                                <span style={styles.cleanupOptionMeta}>
                                  {customer.has_account ? "Has user" : "No user"}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </aside>
      {portalReady && profileEditorOpen && detail
        ? createPortal(
            <div style={styles.profileModalBackdrop}>
              <div style={styles.profileModal}>
                <div style={styles.profileModalHeader}>
                  <div style={styles.profileModalTitle}>EDIT CUSTOMER</div>
                  <button
                    type="button"
                    style={styles.profileModalClose}
                    onClick={() => setProfileEditorOpen(false)}
                  >
                    CLOSE
                  </button>
                </div>
                <div style={styles.profileFormGrid}>
                  <label style={styles.profileField}>
                    <span style={styles.profileFieldLabel}>First name</span>
                    <input
                      value={profileDraft.firstName}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, firstName: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={styles.profileField}>
                    <span style={styles.profileFieldLabel}>Last name</span>
                    <input
                      value={profileDraft.lastName}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, lastName: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={{ ...styles.profileField, ...styles.profileFieldFull }}>
                    <span style={styles.profileFieldLabel}>Display name</span>
                    <input
                      value={profileDraft.fullName}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, fullName: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={styles.profileField}>
                    <span style={styles.profileFieldLabel}>Phone</span>
                    <input
                      value={profileDraft.phone}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, phone: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={{ ...styles.profileField, ...styles.profileFieldFull }}>
                    <span style={styles.profileFieldLabel}>Attention to</span>
                    <input
                      value={profileDraft.attentionTo}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, attentionTo: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={{ ...styles.profileField, ...styles.profileFieldFull }}>
                    <span style={styles.profileFieldLabel}>Address line 1</span>
                    <input
                      value={profileDraft.addressLine1}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, addressLine1: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={{ ...styles.profileField, ...styles.profileFieldFull }}>
                    <span style={styles.profileFieldLabel}>Address line 2</span>
                    <input
                      value={profileDraft.addressLine2}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, addressLine2: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={styles.profileField}>
                    <span style={styles.profileFieldLabel}>Barangay</span>
                    <input
                      value={profileDraft.barangay}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, barangay: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={styles.profileField}>
                    <span style={styles.profileFieldLabel}>City</span>
                    <input
                      value={profileDraft.city}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, city: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={styles.profileField}>
                    <span style={styles.profileFieldLabel}>Province</span>
                    <input
                      value={profileDraft.province}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, province: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={styles.profileField}>
                    <span style={styles.profileFieldLabel}>Postal code</span>
                    <input
                      value={profileDraft.postalCode}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, postalCode: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={{ ...styles.profileField, ...styles.profileFieldFull }}>
                    <span style={styles.profileFieldLabel}>Country</span>
                    <input
                      value={profileDraft.country}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, country: event.target.value }))
                      }
                      style={styles.cleanupInput}
                    />
                  </label>
                  <label style={{ ...styles.profileField, ...styles.profileFieldFull }}>
                    <span style={styles.profileFieldLabel}>Delivery note</span>
                    <textarea
                      value={profileDraft.deliveryNote}
                      onChange={(event) =>
                        setProfileDraft((prev) => ({ ...prev, deliveryNote: event.target.value }))
                      }
                      style={styles.profileTextarea}
                    />
                  </label>
                </div>
                <div style={styles.profileModalActions}>
                  <AppButton
                    type="button"
                    variant="ghost"
                    style={styles.profileModalButton}
                    onClick={() => setProfileEditorOpen(false)}
                  >
                    CANCEL
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="ghost"
                    style={styles.profileModalButton}
                    disabled={!canSaveProfile}
                    onClick={async () => {
                      if (!detail || !canSaveProfile) return;
                      setProfileSaving(true);
                      try {
                        await onSaveCustomerProfile(detail.customer.id, profileDraft);
                        setProfileEditorOpen(false);
                      } catch (error) {
                        console.error("Failed to update customer profile", error);
                        alert("Failed to update customer profile.");
                      } finally {
                        setProfileSaving(false);
                      }
                    }}
                  >
                    {profileSaving ? "SAVING..." : "SAVE"}
                  </AppButton>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: { position: "fixed", left: 0, right: 0, background: "transparent", zIndex: 860 },
  panel: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    width: "var(--tp-rail-width)",
    background: "transparent",
    zIndex: 910,
    display: "flex",
    flexDirection: "column",
    boxShadow: "none",
    border: "none",
  },
  topRow: { minHeight: 64, display: "flex", alignItems: "center", gap: 40, padding: "18px 0 15px" },
  topRowMobile: { minHeight: 52, gap: 10, padding: "8px 10px 8px" },
  backBtn: { width: 68, minWidth: 68, height: 36, padding: 0, borderRadius: 8, fontSize: TOPBAR_FONT_SIZE, fontWeight: 700, letterSpacing: 1, border: "none", background: "transparent", justifyContent: "flex-start", textAlign: "left" },
  backBtnMobile: { fontSize: TOPBAR_FONT_SIZE_MOBILE, height: 40, padding: "0 15px 0 0" },
  title: { fontSize: TOPBAR_FONT_SIZE, fontWeight: 900, letterSpacing: 2, color: "var(--tp-text-color)" },
  titleMobile: { fontSize: TOPBAR_FONT_SIZE_MOBILE, fontWeight: 700, letterSpacing: 0.2 },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: `6px 0 48px ${BACK_BTN_W + TITLE_GAP}px`,
    color: "var(--tp-text-color)",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  contentMobile: { padding: "8px 12px 20px", gap: 14 },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.4fr) repeat(3, minmax(0, 0.8fr))",
    gap: 16,
    paddingRight: 12,
  },
  summaryGridMobile: {
    gridTemplateColumns: "1fr",
    paddingRight: 0,
  },
  identityCard: {
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 16,
    padding: "18px 20px",
    background: "var(--tp-control-bg-soft)",
  },
  metricCard: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--tp-border-color-soft)",
    borderRadius: 16,
    padding: "18px 20px",
    background: "var(--tp-control-bg-soft)",
    display: "grid",
    alignContent: "start",
    gap: 10,
    position: "relative",
  },
  metricCardEnabled: {
    borderColor: "rgba(195,138,40,0.72)",
    boxShadow: "inset 0 0 0 1px rgba(195,138,40,0.18)",
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase",
    opacity: 0.7,
  },
  customerName: {
    fontSize: 28,
    fontWeight: 900,
    lineHeight: 1.1,
  },
  customerNameRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  customerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  editProfileButton: {
    height: 32,
    minWidth: 56,
    borderRadius: 999,
    border: "1px solid var(--tp-border-color-soft)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--tp-text-color)",
    padding: "0 12px",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.8,
    cursor: "pointer",
  },
  inviteButton: {
    width: 32,
    minWidth: 32,
    height: 32,
    borderRadius: 999,
    border: "1px solid var(--tp-border-color-soft)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--tp-text-color)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  },
  inviteButtonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  inviteCopied: {
    marginTop: 8,
    color: "#67bf8a",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  identityFieldRow: {
    display: "grid",
    gap: 6,
    marginTop: 10,
  },
  identityFieldLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    opacity: 0.72,
  },
  identityEmailRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
  },
  identityEmailInput: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color-soft)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--tp-text-color)",
    padding: "0 14px",
    minWidth: 0,
  },
  identityEmailButton: {
    minWidth: 92,
    height: 40,
    borderRadius: 10,
    padding: "0 16px",
    fontWeight: 800,
    letterSpacing: 0.8,
  },
  cleanupSection: {
    display: "grid",
    gap: 10,
    marginTop: 18,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  actionsPanel: {
    display: "grid",
    gap: 14,
    paddingRight: 12,
  },
  adminToggle: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "0 0 2px",
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    cursor: "pointer",
    textAlign: "left",
  },
  adminToggleIcon: {
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 300,
    opacity: 0.78,
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
    alignItems: "start",
  },
  actionsGridMobile: {
    gridTemplateColumns: "1fr",
  },
  actionsCard: {
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 16,
    padding: "18px 20px",
    background: "var(--tp-control-bg-soft)",
    display: "grid",
    gap: 12,
    alignContent: "start",
  },
  profileModalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.66)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "20px 20px 28px",
    zIndex: 5000,
    overflowY: "auto",
  },
  profileModal: {
    width: "min(640px, 100%)",
    maxHeight: "calc(100vh - 40px)",
    borderRadius: 18,
    border: "1px solid var(--tp-border-color-soft)",
    background: "rgba(17,17,17,0.96)",
    padding: "18px 20px",
    display: "grid",
    gap: 16,
    overflowY: "auto",
  },
  profileModalTitle: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: "var(--tp-text-color)",
    opacity: 0.96,
  },
  profileModalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  profileModalClose: {
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    cursor: "pointer",
  },
  profileFormGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  profileField: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  profileFieldLabel: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    opacity: 0.92,
    color: "var(--tp-text-color)",
  },
  profileFieldFull: {
    gridColumn: "1 / -1",
  },
  profileTextarea: {
    width: "100%",
    minHeight: 96,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color-soft)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--tp-text-color)",
    padding: "10px 14px",
    resize: "vertical",
    font: "inherit",
  },
  profileModalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  profileModalButton: {
    minWidth: 96,
    height: 40,
  },
  cleanupTitle: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase",
    opacity: 0.72,
  },
  cleanupBlock: {
    display: "grid",
    gap: 8,
  },
  cleanupPlaceholder: {
    fontSize: 13,
    lineHeight: 1.5,
    opacity: 0.68,
    minHeight: 40,
    display: "flex",
    alignItems: "center",
  },
  cleanupLabel: {
    fontSize: 13,
    fontWeight: 700,
    opacity: 0.88,
  },
  cleanupInput: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color-soft)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--tp-text-color)",
    padding: "0 14px",
    minWidth: 0,
  },
  cleanupList: {
    display: "grid",
    gap: 8,
    maxHeight: 220,
    overflowY: "auto",
  },
  cleanupOption: {
    width: "100%",
    display: "grid",
    gap: 2,
    textAlign: "left",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "var(--tp-text-color)",
    padding: "10px 12px",
    cursor: "pointer",
  },
  cleanupOptionMeta: {
    fontSize: 12,
    opacity: 0.68,
  },
  cleanupDangerButton: {
    minWidth: 160,
    height: 40,
    borderRadius: 10,
    padding: "0 16px",
    fontWeight: 800,
    letterSpacing: 0.8,
    color: "#ff9f9f",
    borderColor: "rgba(255,159,159,0.42)",
  },
  identityMeta: {
    fontSize: 14,
    opacity: 0.88,
    marginTop: 6,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 900,
    lineHeight: 1.1,
  },
  toggleCorner: {
    position: "absolute",
    top: 16,
    right: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "rgba(255,255,255,0.55)",
    cursor: "pointer",
    userSelect: "none",
  },
  toggleCornerEnabled: {
    color: "var(--tp-accent)",
  },
  toggleCornerDisabled: {
    opacity: 0.6,
    cursor: "default",
  },
  toggleCornerLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.8,
  },
  toggleInput: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
    width: 1,
    height: 1,
  },
  toggleTrack: {
    width: 34,
    height: 20,
    borderRadius: 999,
    background: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.22)",
    position: "relative",
    transition: "background 140ms ease, border-color 140ms ease",
  },
  toggleTrackEnabled: {
    background: "rgba(195,138,40,0.24)",
    borderColor: "rgba(195,138,40,0.72)",
  },
  toggleThumb: {
    position: "absolute",
    top: 2,
    left: 2,
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.8)",
    transition: "transform 140ms ease, background 140ms ease",
  },
  toggleThumbEnabled: {
    transform: "translateX(14px)",
    background: "var(--tp-accent)",
  },
  creditAdjustRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
    alignItems: "center",
  },
  creditInput: {
    width: "100%",
    minWidth: 0,
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color-soft)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 12px",
    outline: "none",
    fontSize: 14,
  },
  creditButton: {
    minWidth: 96,
    height: 40,
  },
  ordersBlock: {
    display: "grid",
    gap: 0,
  },
  sectionHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
    paddingRight: 12,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.2,
    opacity: 0.7,
  },
  searchInput: {
    width: "100%",
    maxWidth: 300,
    height: 40,
    borderRadius: 12,
    border: "1px solid var(--tp-border-color-soft)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 15px",
    outline: "none",
    fontSize: 15,
  },
  listHead: {
    display: "grid",
    gridTemplateColumns: "0.85fr 0.9fr 0.9fr 0.55fr 0.8fr 0.7fr 0.8fr 0.9fr",
    gap: 12,
    alignItems: "center",
    fontSize: 12,
    letterSpacing: 1,
    opacity: 0.78,
    padding: "0 12px 10px 0",
  },
  listBody: {
    paddingRight: 12,
  },
  listRow: {
    display: "grid",
    gridTemplateColumns: "0.85fr 0.9fr 0.9fr 0.55fr 0.8fr 0.7fr 0.8fr 0.9fr",
    gap: 12,
    alignItems: "center",
    width: "100%",
    padding: "12px 0",
    borderTop: "1px solid var(--tp-border-color-soft)",
    background: "transparent",
    color: "var(--tp-text-color)",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: "none",
    textAlign: "left",
    cursor: "pointer",
  },
  centerCell: {
    display: "flex",
    justifyContent: "center",
  },
  rowStatusPill: {
    minWidth: 108,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid transparent",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  rowStatusPillMobile: {
    minWidth: 0,
    fontSize: 11,
    padding: "4px 8px",
  },
  mobileCard: {
    width: "100%",
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 14,
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: 14,
    textAlign: "left",
    display: "grid",
    gap: 10,
  },
  mobileCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  mobileOrderNo: {
    fontSize: 15,
    fontWeight: 800,
  },
  mobileTotal: {
    fontSize: 16,
    fontWeight: 800,
  },
  mobileMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 13,
    opacity: 0.84,
  },
  mobilePillsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  empty: {
    padding: "18px 0",
    opacity: 0.75,
  },
};
