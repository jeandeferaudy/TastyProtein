"use client";

import * as React from "react";
import {
  AppButton,
  TOPBAR_FONT_SIZE,
  TOPBAR_FONT_SIZE_MOBILE,
} from "@/components/ui";
import type { CustomerAdminDetail } from "@/lib/customersApi";

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
    return { color: "#67bf8a", borderColor: "rgba(157,228,182,0.75)", background: "rgba(157,228,182,0.26)" };
  }
  if (v === "processed" || v === "packed" || v === "in progress" || v === "submitted") {
    return { color: "#2f99d6", borderColor: "rgba(102,199,255,0.72)", background: "rgba(102,199,255,0.24)" };
  }
  if (v === "unpaid" || v === "undelivered" || v === "draft" || v === "unpacked") {
    return { color: "#c38a28", borderColor: "rgba(255,207,122,0.76)", background: "rgba(255,207,122,0.26)" };
  }
  return { color: "var(--tp-text-color)", borderColor: "rgba(255,255,255,0.24)", background: "var(--tp-control-bg-soft)" };
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
}: Props) {
  const [search, setSearch] = React.useState("");
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const [creditDraft, setCreditDraft] = React.useState("");
  const [creditSaving, setCreditSaving] = React.useState(false);
  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    setCreditDraft("");
    setCreditSaving(false);
  }, [detail?.customer.id]);

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

  if (!isOpen) return null;

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
                  <div style={styles.customerName}>{customerName}</div>
                  <div style={styles.identityMeta}>Email: {detail.customer.email || "—"}</div>
                  <div style={styles.identityMeta}>Created: {fmtDate(detail.customer.created_at)}</div>
                </div>
                <div style={styles.metricCard}>
                  <div style={styles.cardLabel}>Steak Credits</div>
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
            </>
          )}
        </div>
      </aside>
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
    overflow: "hidden",
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
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 16,
    padding: "18px 20px",
    background: "var(--tp-control-bg-soft)",
    display: "grid",
    alignContent: "start",
    gap: 10,
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
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
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
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
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
