"use client";

import * as React from "react";
import {
  AppButton,
  TOPBAR_FONT_SIZE,
  TOPBAR_FONT_SIZE_MOBILE,
} from "@/components/ui";
import type { OrderListItem } from "@/lib/ordersApi";

export type MyOrderItem = OrderListItem;

type Props = {
  isOpen: boolean;
  topOffset: number;
  onClose: () => void;
  title?: string;
  showSearch?: boolean;
  orders: MyOrderItem[];
  selectedOrderId?: string | null;
  onSelectOrder?: (id: string) => void;
  backgroundStyle?: React.CSSProperties;
};

function fmtDate(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

function fmtMoney(v: number) {
  return v.toLocaleString("en-PH");
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

export default function MyOrdersDrawer({
  isOpen,
  topOffset,
  onClose,
  title = "MY ORDERS",
  showSearch = false,
  orders,
  selectedOrderId = null,
  onSelectOrder,
  backgroundStyle,
}: Props) {
  const [search, setSearch] = React.useState("");
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;
  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const sorted = React.useMemo(
    () => [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders]
  );
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((o) => {
      const orderNo = String(o.order_number ?? orderNumber8(o.id)).toLowerCase();
      const customer = String(o.full_name ?? "").toLowerCase();
      const createdAt = fmtDate(o.created_at).toLowerCase();
      const deliveryAt = o.delivery_date ? fmtDate(o.delivery_date).toLowerCase() : "";
      return (
        orderNo.includes(q) ||
        customer.includes(q) ||
        createdAt.includes(q) ||
        deliveryAt.includes(q)
      );
    });
  }, [search, sorted]);

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
          ...(isMobileViewport
            ? {
                width: "100vw",
                left: 0,
                transform: "none",
              }
            : null),
        }}
      >
        <div style={{ ...styles.topRow, ...(isMobileViewport ? styles.topRowMobile : null) }}>
          <AppButton
            variant="ghost"
            style={{ ...styles.backBtn, ...(isMobileViewport ? styles.backBtnMobile : null) }}
            onClick={onClose}
          >
            BACK
          </AppButton>
          <div style={{ ...styles.title, ...(isMobileViewport ? styles.titleMobile : null) }}>
            {title}
          </div>
        </div>
        <div style={{ ...styles.content, ...(isMobileViewport ? styles.contentMobile : null) }}>
          {showSearch ? (
            <div style={styles.searchWrap}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, customer, or date..."
                style={styles.searchInput}
              />
            </div>
          ) : null}
          {!isMobileViewport ? (
            <div style={styles.listHead}>
              <div>ORDER #</div>
              <div>ORDER DATE</div>
              <div>DELIVERY DATE</div>
              <div>CUSTOMER</div>
              <div>ITEMS</div>
              <div>TOTAL</div>
              <div style={styles.centerCell}>STATUS</div>
              <div style={styles.centerCell}>PAYMENT</div>
              <div style={styles.centerCell}>DELIVERY</div>
            </div>
          ) : null}
          {filtered.length === 0 ? (
            <div style={styles.empty}>No orders yet.</div>
          ) : (
            filtered.map((o) =>
              isMobileViewport ? (
                <button
                  key={o.id}
                  type="button"
                  style={{
                    ...styles.mobileCard,
                    ...(selectedOrderId === o.id ? styles.listRowActive : null),
                  }}
                  onClick={() => onSelectOrder?.(o.id)}
                >
                  <div style={styles.mobileCardTop}>
                    <div style={styles.mobileOrderNo}>#{o.order_number ?? orderNumber8(o.id)}</div>
                    <div style={styles.mobileTotal}>₱ {fmtMoney(o.total_selling_price)}</div>
                  </div>
                  <div style={styles.mobileMetaRow}>
                    <span>Order: {fmtDate(o.created_at)}</span>
                    <span>Delivery: {o.delivery_date ? fmtDate(o.delivery_date) : "—"}</span>
                  </div>
                  <div style={styles.mobileMetaRow}>
                    <span style={styles.customerCell}>{o.full_name || "—"}</span>
                    <span>{o.total_qty} item(s)</span>
                  </div>
                  <div style={styles.mobilePillsRow}>
                    <span style={{ ...styles.rowStatusPill, ...styles.rowStatusPillMobile, ...statusTone(o.status) }}>
                      {o.status}
                    </span>
                    <span style={{ ...styles.rowStatusPill, ...styles.rowStatusPillMobile, ...statusTone(o.paid_status) }}>
                      {o.paid_status}
                    </span>
                    <span style={{ ...styles.rowStatusPill, ...styles.rowStatusPillMobile, ...statusTone(o.delivery_status) }}>
                      {o.delivery_status}
                    </span>
                  </div>
                </button>
              ) : (
                <button
                  key={o.id}
                  type="button"
                  style={{
                    ...styles.listRow,
                    ...(selectedOrderId === o.id ? styles.listRowActive : null),
                  }}
                  onClick={() => onSelectOrder?.(o.id)}
                >
                  <div>{o.order_number ?? orderNumber8(o.id)}</div>
                  <div>{fmtDate(o.created_at)}</div>
                  <div>{o.delivery_date ? fmtDate(o.delivery_date) : "—"}</div>
                  <div style={styles.customerCell}>{o.full_name || "—"}</div>
                  <div>{o.total_qty}</div>
                  <div>₱ {fmtMoney(o.total_selling_price)}</div>
                  <div style={styles.centerCell}><span style={{ ...styles.rowStatusPill, ...statusTone(o.status) }}>{o.status}</span></div>
                  <div style={styles.centerCell}><span style={{ ...styles.rowStatusPill, ...statusTone(o.paid_status) }}>{o.paid_status}</span></div>
                  <div style={styles.centerCell}><span style={{ ...styles.rowStatusPill, ...statusTone(o.delivery_status) }}>{o.delivery_status}</span></div>
                </button>
              )
            )
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
  content: { flex: 1, overflowY: "auto", padding: "6px 24px 48px", color: "var(--tp-text-color)" },
  contentMobile: { padding: "8px 12px 20px" },
  searchWrap: {
    marginBottom: 10,
  },
  searchInput: {
    width: "100%",
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
    gridTemplateColumns: "100px 106px 116px minmax(140px, 1fr) 60px 96px 102px 102px 112px",
    gap: 8,
    fontSize: 15,
    opacity: 0.72,
    padding: "8px 10px",
    borderBottom: "1px solid var(--tp-border-color-soft)",
    letterSpacing: 1,
  },
  listRow: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "100px 106px 116px minmax(140px, 1fr) 60px 96px 102px 102px 112px",
    gap: 8,
    padding: "10px 10px",
    border: "none",
    borderBottom: "1px solid var(--tp-border-color-soft)",
    background: "transparent",
    color: "var(--tp-text-color)",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 15,
    alignItems: "center",
  },
  listRowActive: { background: "rgba(58,170,245,0.1)" },
  empty: { padding: "16px 10px", opacity: 0.75 },
  customerCell: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.92 },
  rowStatusPill: {
    height: 30,
    minWidth: 92,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 10px",
    fontSize: 15,
    textTransform: "uppercase",
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  rowStatusPillMobile: {
    minWidth: 0,
    height: 28,
    fontSize: 12,
    padding: "0 8px",
  },
  centerCell: { textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center" },
  mobileCard: {
    width: "100%",
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 12,
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    textAlign: "left",
    padding: "10px 10px 9px",
    marginBottom: 10,
    display: "grid",
    gap: 6,
  },
  mobileCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  mobileOrderNo: { fontSize: 14, fontWeight: 800, letterSpacing: 0.3 },
  mobileTotal: { fontSize: 15, fontWeight: 900 },
  mobileMetaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 13,
    opacity: 0.88,
  },
  mobilePillsRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 2,
  },
};
