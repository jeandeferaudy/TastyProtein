"use client";

import * as React from "react";
import {
  AppButton,
  TOPBAR_FONT_SIZE,
  TOPBAR_FONT_SIZE_MOBILE,
} from "@/components/ui";
import type { CustomerAdminItem } from "@/lib/customersApi";

type Props = {
  isOpen: boolean;
  topOffset: number;
  onClose: () => void;
  customers: CustomerAdminItem[];
  onOpenCustomer?: (customerId: string) => void;
  backgroundStyle?: React.CSSProperties;
};

function fmtMoney(v: number) {
  return v.toLocaleString("en-PH");
}

export default function CustomersDrawer({
  isOpen,
  topOffset,
  onClose,
  customers,
  onOpenCustomer,
  backgroundStyle,
}: Props) {
  const [search, setSearch] = React.useState("");
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) => {
      return (
        customer.customer_name.toLowerCase().includes(q) ||
        String(customer.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

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
            onClick={onClose}
          >
            BACK
          </AppButton>
          <div style={{ ...styles.title, ...(isMobileViewport ? styles.titleMobile : null) }}>
            CUSTOMERS
          </div>
        </div>

        <div style={{ ...styles.content, ...(isMobileViewport ? styles.contentMobile : null) }}>
          <div style={styles.searchWrap}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer or email..."
              style={styles.searchInput}
            />
          </div>

          {!isMobileViewport ? (
            <div style={styles.listHead}>
              <div>CUSTOMER</div>
              <div>EMAIL</div>
              <div>ACCOUNT</div>
              <div>ORDERS</div>
              <div>TOTAL ORDERED</div>
              <div>CURRENT CREDITS</div>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div style={styles.empty}>No customers found.</div>
          ) : (
            filtered.map((customer) =>
              isMobileViewport ? (
                <button
                  key={customer.id}
                  type="button"
                  style={styles.mobileCard}
                  onClick={() => onOpenCustomer?.(customer.id)}
                >
                  <div style={styles.mobileName}>{customer.customer_name}</div>
                  <div style={styles.mobileEmail}>{customer.email || "—"}</div>
                  <div style={styles.mobileMeta}>
                    Account:{" "}
                    <span
                      style={
                        customer.has_account ? styles.accountYesText : styles.accountNoText
                      }
                    >
                      {customer.has_account ? "Yes" : "No"}
                    </span>
                  </div>
                  <div style={styles.mobileMeta}>Orders: {customer.order_count}</div>
                  <div style={styles.mobileMeta}>Total ordered: ₱ {fmtMoney(customer.total_ordered)}</div>
                  <div style={styles.mobileMeta}>Current credits: ₱ {fmtMoney(customer.current_credits)}</div>
                </button>
              ) : (
                <button
                  key={customer.id}
                  type="button"
                  style={styles.listRow}
                  onClick={() => onOpenCustomer?.(customer.id)}
                >
                  <div style={styles.customerCell}>
                    {customer.customer_name}
                  </div>
                  <div style={styles.emailCell}>{customer.email || "—"}</div>
                  <div>
                    <span
                      style={{
                        ...styles.accountPill,
                        ...(customer.has_account ? styles.accountPillYes : styles.accountPillNo),
                      }}
                    >
                      {customer.has_account ? "Yes" : "No"}
                    </span>
                  </div>
                  <div>{customer.order_count}</div>
                  <div>₱ {fmtMoney(customer.total_ordered)}</div>
                  <div>₱ {fmtMoney(customer.current_credits)}</div>
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
  backdrop: {
    position: "fixed",
    left: 0,
    right: 0,
    background: "transparent",
    zIndex: 860,
  },
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
  topRow: {
    minHeight: 64,
    display: "flex",
    alignItems: "center",
    gap: 40,
    padding: "18px 0 15px",
  },
  topRowMobile: {
    minHeight: 52,
    gap: 10,
    padding: "8px 10px 8px",
  },
  backBtn: {
    width: 68,
    minWidth: 68,
    height: 36,
    padding: 0,
    borderRadius: 8,
    fontSize: TOPBAR_FONT_SIZE,
    fontWeight: 700,
    letterSpacing: 1,
    border: "none",
    background: "transparent",
    justifyContent: "flex-start",
    textAlign: "left",
  },
  backBtnMobile: {
    fontSize: TOPBAR_FONT_SIZE_MOBILE,
    height: 40,
    padding: "0 15px 0 0",
  },
  title: {
    fontSize: TOPBAR_FONT_SIZE,
    fontWeight: 900,
    letterSpacing: 2,
    color: "var(--tp-text-color)",
  },
  titleMobile: {
    fontSize: TOPBAR_FONT_SIZE_MOBILE,
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 0 44px 108px",
    color: "var(--tp-text-color)",
  },
  contentMobile: {
    padding: "8px 12px 20px",
  },
  searchWrap: {
    marginBottom: 12,
  },
  searchInput: {
    width: "100%",
    maxWidth: 420,
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 15px",
  },
  listHead: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1.4fr 0.7fr 0.5fr 0.9fr 0.9fr",
    gap: 12,
    padding: "0 10px 10px",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    opacity: 0.7,
  },
  listRow: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1.4fr 0.7fr 0.5fr 0.9fr 0.9fr",
    gap: 12,
    alignItems: "center",
    width: "100%",
    padding: "12px 10px",
    borderTop: "1px solid var(--tp-border-color-soft)",
    fontSize: 15,
    background: "transparent",
    color: "var(--tp-text-color)",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: "none",
    textAlign: "left",
    cursor: "pointer",
  },
  customerCell: {
    fontWeight: 700,
    minWidth: 0,
  },
  emailCell: {
    minWidth: 0,
    opacity: 0.82,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  accountPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 56,
    height: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid var(--tp-border-color)",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.3,
  },
  accountPillYes: {
    color: "#67bf8a",
    borderColor: "rgba(157,228,182,0.75)",
    background: "rgba(157,228,182,0.18)",
  },
  accountPillNo: {
    color: "#d98b2b",
    borderColor: "rgba(255,196,122,0.72)",
    background: "rgba(255,196,122,0.16)",
  },
  empty: {
    opacity: 0.7,
    padding: "18px 0",
  },
  mobileCard: {
    width: "100%",
    borderTop: "1px solid var(--tp-border-color-soft)",
    padding: "14px 0",
    background: "transparent",
    color: "var(--tp-text-color)",
    textAlign: "left",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: "none",
  },
  mobileName: {
    fontSize: 16,
    fontWeight: 800,
  },
  mobileEmail: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.8,
  },
  mobileMeta: {
    marginTop: 6,
    fontSize: 14,
  },
  accountYesText: {
    color: "#67bf8a",
    fontWeight: 800,
  },
  accountNoText: {
    color: "#d98b2b",
    fontWeight: 800,
  },
};
