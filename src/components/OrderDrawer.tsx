"use client";

import * as React from "react";
import { AppButton, RemoveIcon, TOPBAR_FONT_SIZE } from "@/components/ui";
import type { OrderAdminPatch, OrderDetail, OrderStatusPatch } from "@/lib/ordersApi";
import type { DbProduct } from "@/lib/products";

type Props = {
  isOpen: boolean;
  topOffset: number;
  onBack: () => void;
  detail: OrderDetail | null;
  products: DbProduct[];
  loading?: boolean;
  canEdit?: boolean;
  noticeText?: string | null;
  backgroundStyle?: React.CSSProperties;
  onChangeStatuses?: (orderId: string, patch: OrderStatusPatch) => Promise<void> | void;
  onChangePackedQty?: (orderLineId: string, packedQty: number | null) => Promise<void> | void;
  onChangeAmountPaid?: (orderId: string, amountPaid: number | null) => Promise<void> | void;
  onChangePaymentProof?: (
    orderId: string,
    file: File | null,
    currentPath: string | null
  ) => Promise<void> | void;
  onChangeAdminFields?: (orderId: string, patch: OrderAdminPatch) => Promise<void> | void;
  onDeleteOrder?: (orderId: string, paymentProofPath: string | null) => Promise<void> | void;
  onAddLines?: (
    orderId: string,
    items: Array<{ productId: string; qty: number }>
  ) => Promise<void> | void;
};

const STATUS_OPTIONS = ["draft", "submitted", "confirmed", "completed"];
const PAYMENT_OPTIONS = ["unpaid", "processed", "paid"];
const DELIVERY_OPTIONS = ["unpacked", "packed", "in progress", "delivered"];
const BACK_BTN_W = 68;
const TITLE_GAP = 40;
const STATUS_CONTROL_W = 148;

function fmtMoney(v: number) {
  return v.toLocaleString("en-PH");
}

function fmtDate(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fmtDateTime(date: string | null, slot: string | null) {
  if (!date) return "—";
  const d = new Date(`${date}T00:00:00`);
  const day = Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-PH", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
  return slot ? `${day} at ${slot}` : day;
}

function orderNumber8(id: string) {
  const digits = id.replace(/\D/g, "");
  return (digits.slice(-8) || "00000000").padStart(8, "0");
}

function looksLikeImage(url: string | null) {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

function statusTone(value: string): React.CSSProperties {
  const v = String(value || "").toLowerCase();
  if (v === "completed" || v === "paid" || v === "delivered" || v === "confirmed") {
    return {
      color: "#67bf8a",
      borderColor: "rgba(157,228,182,0.75)",
      background: "rgba(157,228,182,0.26)",
    };
  }
  if (v === "processed" || v === "packed" || v === "in progress" || v === "submitted") {
    return {
      color: "#2f99d6",
      borderColor: "rgba(102,199,255,0.72)",
      background: "rgba(102,199,255,0.24)",
    };
  }
  return {
    color: "#c38a28",
    borderColor: "rgba(255,207,122,0.76)",
    background: "rgba(255,207,122,0.26)",
  };
}

function packedTone(packedRaw: string | undefined, orderedQty: number): React.CSSProperties {
  const packed = packedRaw === undefined || packedRaw === "" ? 0 : Number(packedRaw);
  if (!Number.isFinite(packed)) {
    return { background: "rgba(255,207,122,0.5)" };
  }
  if (packed < orderedQty) {
    return { background: "rgba(255,207,122,0.5)" };
  }
  if (packed === orderedQty) {
    return { background: "rgba(157,228,182,0.5)" };
  }
  return { background: "rgba(102,199,255,0.5)" };
}

export default function OrderDrawer({
  isOpen,
  topOffset,
  onBack,
  detail,
  products,
  loading = false,
  canEdit = false,
  noticeText = null,
  backgroundStyle,
  onChangeStatuses,
  onChangePackedQty,
  onChangeAmountPaid,
  onChangePaymentProof,
  onChangeAdminFields,
  onDeleteOrder,
  onAddLines,
}: Props) {
  const [statusDraft, setStatusDraft] = React.useState({
    status: "submitted",
    paid_status: "processed",
    delivery_status: "unpacked",
  });
  const [packedDraftById, setPackedDraftById] = React.useState<Record<string, string>>({});
  const [amountPaidDraft, setAmountPaidDraft] = React.useState("");
  const [savingStatus, setSavingStatus] = React.useState(false);
  const [savingPacked, setSavingPacked] = React.useState<Record<string, boolean>>({});
  const [savingAmountPaid, setSavingAmountPaid] = React.useState(false);
  const [savingAdminFields, setSavingAdminFields] = React.useState(false);
  const [proofOpen, setProofOpen] = React.useState(false);
  const [savingProof, setSavingProof] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deletingOrder, setDeletingOrder] = React.useState(false);
  const [addLinesOpen, setAddLinesOpen] = React.useState(false);
  const [addLineSearch, setAddLineSearch] = React.useState("");
  const [addQtyByProduct, setAddQtyByProduct] = React.useState<Record<string, number>>({});
  const [savingAddLines, setSavingAddLines] = React.useState(false);
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const [adminDraft, setAdminDraft] = React.useState({
    created_at: "",
    full_name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    delivery_date: "",
    delivery_slot: "",
    express_delivery: false,
    add_thermal_bag: false,
    delivery_fee: "",
  });

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    if (!detail) return;
    const initialPaidStatus =
      detail.payment_proof_url && String(detail.paid_status || "unpaid").toLowerCase() === "unpaid"
        ? "processed"
        : String(detail.paid_status || "processed");
    setStatusDraft({
      status: String(detail.status || "submitted"),
      paid_status: initialPaidStatus,
      delivery_status: String(detail.delivery_status || "unpacked"),
    });
    const nextPacked: Record<string, string> = {};
    for (const line of detail.items) {
      nextPacked[line.id] =
        line.packed_qty === null || line.packed_qty === undefined ? "" : String(line.packed_qty);
    }
    setPackedDraftById(nextPacked);
    setAmountPaidDraft(String(detail.amount_paid ?? 0));
    setAdminDraft({
      created_at: detail.created_at ? String(detail.created_at).slice(0, 10) : "",
      full_name: detail.full_name ?? "",
      email: detail.email ?? "",
      phone: detail.phone ?? "",
      address: detail.address ?? "",
      notes: detail.notes ?? "",
      delivery_date: detail.delivery_date ?? "",
      delivery_slot: detail.delivery_slot ?? "",
      express_delivery: detail.express_delivery,
      add_thermal_bag: detail.add_thermal_bag,
      delivery_fee: String(detail.delivery_fee ?? 0),
    });
  }, [detail]);

  const saveStatusPatch = React.useCallback(
    async (patch: OrderStatusPatch) => {
      if (!detail || !onChangeStatuses) return;
      setSavingStatus(true);
      try {
        await onChangeStatuses(detail.id, patch);
      } catch (e) {
        console.error("Failed to update order status", e);
        alert("Failed to update status. Please try again.");
      } finally {
        setSavingStatus(false);
      }
    },
    [detail, onChangeStatuses]
  );

  const savePackedQty = React.useCallback(
    async (lineId: string) => {
      if (!onChangePackedQty) return;
      const raw = packedDraftById[lineId];
      const next = raw === "" ? null : Math.max(0, Math.floor(Number(raw)));
      if (next !== null && Number.isNaN(next)) return;
      setSavingPacked((prev) => ({ ...prev, [lineId]: true }));
      try {
        await onChangePackedQty(lineId, next);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to save packed quantity.";
        alert(msg);
        console.error("Failed to save packed quantity", e);
      } finally {
        setSavingPacked((prev) => ({ ...prev, [lineId]: false }));
      }
    },
    [onChangePackedQty, packedDraftById]
  );

  const saveAmountPaid = React.useCallback(async () => {
    if (!detail || !onChangeAmountPaid) return;
    const raw = amountPaidDraft.trim();
    const next = raw === "" ? null : Number(raw);
    if (next !== null && Number.isNaN(next)) return;
    setSavingAmountPaid(true);
    try {
      await onChangeAmountPaid(detail.id, next === null ? null : Math.max(0, next));
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to save amount paid.";
      alert(msg);
      console.error("Failed to save amount paid", e);
    } finally {
      setSavingAmountPaid(false);
    }
  }, [amountPaidDraft, detail, onChangeAmountPaid]);

  const savePaymentProof = React.useCallback(
    async (file: File | null) => {
      if (!detail || !onChangePaymentProof) return;
      setSavingProof(true);
      try {
        await onChangePaymentProof(detail.id, file, detail.payment_proof_path ?? null);
      } finally {
        setSavingProof(false);
      }
    },
    [detail, onChangePaymentProof]
  );

  const saveAdminFields = React.useCallback(
    async (patch: OrderAdminPatch) => {
      if (!detail || !onChangeAdminFields) return;
      setSavingAdminFields(true);
      try {
        await onChangeAdminFields(detail.id, patch);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to save order details.";
        alert(msg);
        console.error("Failed to save admin order fields", e);
      } finally {
        setSavingAdminFields(false);
      }
    },
    [detail, onChangeAdminFields]
  );

  const proofFileName = React.useMemo(() => {
    if (!detail?.payment_proof_url) return "";
    const src = detail.payment_proof_path || detail.payment_proof_url;
    const clean = src.split("?")[0];
    const last = clean.split("/").pop() || "";
    return decodeURIComponent(last) || "attachment";
  }, [detail?.payment_proof_path, detail?.payment_proof_url]);

  const addCandidates = React.useMemo(() => {
    const q = addLineSearch.trim().toLowerCase();
    const source = products.filter((p) => String(p.status ?? "").toLowerCase() !== "archived");
    if (!q) return source;
    return source.filter((p) =>
      [
        p.name,
        p.long_name,
        p.size,
        p.temperature,
        p.country_of_origin,
        p.keywords,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [addLineSearch, products]);

  const amountPaid = React.useMemo(() => {
    const v = Number(amountPaidDraft);
    return Number.isNaN(v) ? 0 : v;
  }, [amountPaidDraft]);

  const paymentDelta = React.useMemo(() => {
    if (!detail) return 0;
    return amountPaid - detail.total_selling_price;
  }, [amountPaid, detail]);

  const paymentDeltaMessage = React.useMemo(() => {
    if (paymentDelta === 0) {
      return {
        label: "Amount paid is correct",
        tone: styles.paymentDeltaRowOk,
      };
    }
    if (paymentDelta < 0) {
      return {
        label: `Amount due: ₱ ${fmtMoney(Math.abs(paymentDelta))}`,
        tone: styles.paymentDeltaRowWarn,
      };
    }
    return {
      label: `Refund due: ₱ ${fmtMoney(paymentDelta)}`,
      tone: styles.paymentDeltaRow,
    };
  }, [paymentDelta]);

  const computedDisplayTotal = React.useMemo(() => {
    if (!detail) return 0;
    const rawFee = Number(adminDraft.delivery_fee);
    const deliveryFee = Number.isNaN(rawFee) ? Number(detail.delivery_fee ?? 0) : Math.max(0, rawFee);
    return Number(detail.subtotal ?? 0) + deliveryFee + Number(detail.thermal_bag_fee ?? 0);
  }, [adminDraft.delivery_fee, detail]);

  const totalUnits = React.useMemo(
    () => (detail ? detail.items.reduce((sum, it) => sum + Number(it.qty ?? 0), 0) : 0),
    [detail]
  );

  const totalPickedUnits = React.useMemo(() => {
    if (!detail) return 0;
    return detail.items.reduce((sum, it) => {
      const raw = packedDraftById[it.id];
      const n = raw === undefined || raw === "" ? 0 : Number(raw);
      return sum + (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
    }, 0);
  }, [detail, packedDraftById]);

  const sortedItems = React.useMemo(() => {
    if (!detail) return [];
    return [...detail.items].sort((a, b) => {
      const aAdmin = a.added_by_admin ? 1 : 0;
      const bAdmin = b.added_by_admin ? 1 : 0;
      if (aAdmin !== bAdmin) return aAdmin - bAdmin; // customer-added first
      const aName = String(a.name ?? "").toLowerCase();
      const bName = String(b.name ?? "").toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [detail]);

  const totalAddQty = React.useMemo(
    () =>
      Object.values(addQtyByProduct).reduce(
        (sum, qty) => sum + Math.max(0, Math.floor(Number(qty || 0))),
        0
      ),
    [addQtyByProduct]
  );

  const confirmAddLines = React.useCallback(async () => {
    if (!detail || !onAddLines) return;
    const payload = Object.entries(addQtyByProduct)
      .map(([productId, qty]) => ({
        productId,
        qty: Math.max(0, Math.floor(Number(qty || 0))),
      }))
      .filter((it) => it.qty > 0);
    if (!payload.length) return;
    setSavingAddLines(true);
    try {
      await onAddLines(detail.id, payload);
      setAddLinesOpen(false);
      setAddLineSearch("");
      setAddQtyByProduct({});
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to add items.";
      alert(msg);
      console.error("Failed to add order lines", e);
    } finally {
      setSavingAddLines(false);
    }
  }, [addQtyByProduct, detail, onAddLines]);

  const confirmDeleteOrder = React.useCallback(async () => {
    if (!detail || !onDeleteOrder || deletingOrder) return;
    setDeletingOrder(true);
    try {
      await onDeleteOrder(detail.id, detail.payment_proof_path ?? null);
      setDeleteConfirmOpen(false);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to delete order.";
      alert(msg);
      console.error("Failed to delete order", e);
    } finally {
      setDeletingOrder(false);
    }
  }, [deletingOrder, detail, onDeleteOrder]);

  if (!isOpen) return null;

  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;
  const orderNo = detail ? detail.order_number ?? orderNumber8(detail.id) : "—";
  const statusKey = String(statusDraft.status || "").toLowerCase();
  const headerSuffix =
    statusKey === "submitted" || statusKey === "draft" ? " WAITING TO BE PACKED" : "";
  const showPackedColumn = true;
  const itemGridTemplate = "1fr 84px 90px 108px";

  return (
    <>
      <div style={{ ...styles.backdrop, ...(backgroundStyle ?? null), top: panelTop, height: panelHeight }} />
      <aside className="tp-drawer-slide-up" style={{ ...styles.panel, ...(backgroundStyle ?? null), top: panelTop, height: panelHeight }}>
        <div style={styles.topRow}>
          <AppButton variant="ghost" style={styles.backBtn} onClick={onBack}>
            BACK
          </AppButton>
          <div style={styles.title}>
            ORDER #{orderNo}
            {headerSuffix ? <span style={styles.titleStatusSuffix}>{headerSuffix}</span> : null}
          </div>
          {!loading && detail ? (
            <div style={styles.statusGroup}>
              <div style={styles.statusField}>
                <div style={styles.statusLabel}>STATUS</div>
                {canEdit ? (
                  <select
                    value={statusDraft.status}
                    disabled={savingStatus}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStatusDraft((prev) => ({ ...prev, status: value }));
                      void saveStatusPatch({ status: value });
                    }}
                    style={{ ...styles.statusSelect, ...statusTone(statusDraft.status) }}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ ...styles.statusChip, ...statusTone(statusDraft.status) }}>
                    {statusDraft.status}
                  </div>
                )}
              </div>
              <div style={styles.statusField}>
                <div style={styles.statusLabel}>PAYMENT</div>
                {canEdit ? (
                  <select
                    value={statusDraft.paid_status}
                    disabled={savingStatus}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStatusDraft((prev) => ({ ...prev, paid_status: value }));
                      void saveStatusPatch({ paid_status: value });
                    }}
                    style={{ ...styles.statusSelect, ...statusTone(statusDraft.paid_status) }}
                  >
                    {PAYMENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ ...styles.statusChip, ...statusTone(statusDraft.paid_status) }}>
                    {statusDraft.paid_status}
                  </div>
                )}
              </div>
              <div style={styles.statusField}>
                <div style={styles.statusLabel}>DELIVERY</div>
                {canEdit ? (
                  <select
                    value={statusDraft.delivery_status}
                    disabled={savingStatus}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStatusDraft((prev) => ({ ...prev, delivery_status: value }));
                      void saveStatusPatch({ delivery_status: value });
                    }}
                    style={{ ...styles.statusSelect, ...statusTone(statusDraft.delivery_status) }}
                  >
                    {DELIVERY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ ...styles.statusChip, ...statusTone(statusDraft.delivery_status) }}>
                    {statusDraft.delivery_status}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            ...styles.content,
            ...(isMobileViewport ? { padding: "8px 10px 20px" } : null),
          }}
        >
          {loading ? <div style={styles.hint}>Loading order details...</div> : null}
          {!loading && !detail ? <div style={styles.hint}>Order not found.</div> : null}

          {!loading && detail ? (
            <div style={styles.sectionGrid}>
              {noticeText ? <div style={styles.publicNotice}>{noticeText}</div> : null}
              <section style={styles.leftCol}>
                <div style={styles.sectionTitle}>CART</div>
                <div style={styles.itemListScroll}>
                  <div style={{ ...styles.itemHeadRow, gridTemplateColumns: itemGridTemplate }}>
                    <div />
                    <div style={styles.itemHeadCell}>ORDERED</div>
                    <div style={styles.itemHeadCell}>PACKED</div>
                    <div style={styles.itemHeadCell}>TOTAL</div>
                  </div>
                  {sortedItems.map((it) => (
                    <div key={it.id} style={{ ...styles.itemRow, gridTemplateColumns: itemGridTemplate }}>
                      <div>
                        <div style={styles.itemName}>{it.name}</div>
                        <div style={styles.itemMeta}>
                          {[it.size, it.temperature].filter(Boolean).join(" • ") || "—"}
                        </div>
                        {it.added_by_admin ? (
                          <div style={styles.adminAddedText}>added by admin</div>
                        ) : null}
                        <div style={styles.itemMeta}>₱ {fmtMoney(it.unit_price)} / pc</div>
                      </div>
                      <div style={styles.itemQty}>{it.qty}</div>
                      <div style={styles.itemPackedCell}>
                        {canEdit ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            value={packedDraftById[it.id] ?? ""}
                            onChange={(e) =>
                              setPackedDraftById((prev) => ({
                                ...prev,
                                [it.id]: e.target.value,
                              }))
                            }
                            onBlur={() => {
                              void savePackedQty(it.id);
                            }}
                            style={{
                              ...styles.packedInput,
                              ...packedTone(packedDraftById[it.id], Number(it.qty ?? 0)),
                            }}
                          />
                        ) : (
                          <div style={styles.packedReadOnly}>
                            {packedDraftById[it.id] === "" ? "—" : packedDraftById[it.id]}
                          </div>
                        )}
                        {canEdit && savingPacked[it.id] ? <div style={styles.savingTiny}>saving...</div> : null}
                      </div>
                      <div style={styles.itemTotal}>₱ {fmtMoney(it.line_total)}</div>
                    </div>
                  ))}
                </div>

                <div style={styles.totalBlock}>
                  <div style={{ ...styles.totalGridRow, gridTemplateColumns: itemGridTemplate }}>
                    <span>Subtotal</span>
                    <strong style={styles.totalQtyCell}>{totalUnits}</strong>
                    <strong style={styles.totalPickedCell}>{totalPickedUnits}</strong>
                    <strong
                      style={{
                        ...styles.totalValueCell,
                        gridColumn: 4,
                      }}
                    >
                      ₱ {fmtMoney(detail.subtotal)}
                    </strong>
                  </div>
                  <div style={{ ...styles.totalGridRow, gridTemplateColumns: itemGridTemplate }}>
                    <span>Delivery</span>
                    <strong
                      style={{
                        ...styles.totalValueCell,
                        gridColumn: 4,
                      }}
                    >
                      {Number(canEdit ? Number(adminDraft.delivery_fee) || 0 : detail.delivery_fee) > 0
                        ? `₱ ${fmtMoney(canEdit ? Number(adminDraft.delivery_fee) || 0 : detail.delivery_fee)}`
                        : "FREE"}
                    </strong>
                  </div>
                  <div style={{ ...styles.totalGridRow, gridTemplateColumns: itemGridTemplate }}>
                    <span>{detail.thermal_bag_fee > 0 ? "Thermal bag" : "Standard bag"}</span>
                    <strong
                      style={{
                        ...styles.totalValueCell,
                        gridColumn: 4,
                        ...(detail.thermal_bag_fee > 0 ? styles.adminHighlight : null),
                      }}
                    >
                      {detail.thermal_bag_fee > 0 ? `₱ ${fmtMoney(detail.thermal_bag_fee)}` : "FREE"}
                    </strong>
                  </div>
                  <div style={{ ...styles.totalGridRow, ...styles.totalStrong, gridTemplateColumns: itemGridTemplate }}>
                    <span>Total</span>
                    <strong
                      style={{
                        ...styles.totalValueCell,
                        gridColumn: 4,
                      }}
                    >
                      ₱ {fmtMoney(canEdit ? computedDisplayTotal : detail.total_selling_price)}
                    </strong>
                  </div>
                </div>

                {canEdit ? (
                  <div style={styles.addLineRow}>
                    <AppButton
                      type="button"
                      variant="ghost"
                      style={styles.addLineBtn}
                      onClick={() => setAddLinesOpen(true)}
                    >
                      + ADD PRODUCT
                    </AppButton>
                    <AppButton
                      type="button"
                      variant="ghost"
                      style={styles.deleteOrderBtn}
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      DELETE ORDER
                    </AppButton>
                  </div>
                ) : null}
              </section>

              <section style={styles.rightCol}>
                <div style={styles.sectionCard}>
                  <div style={styles.sectionTitle}>ORDER OVERVIEW</div>
                  <div style={styles.kvRow}>
                    <span>Order #</span>
                    <strong>{orderNo}</strong>
                  </div>
                  <div style={styles.kvRow}>
                    <span>Placed on</span>
                    {canEdit ? (
                      <input
                        type="date"
                        value={adminDraft.created_at}
                        onChange={(e) =>
                          setAdminDraft((prev) => ({ ...prev, created_at: e.target.value }))
                        }
                        onBlur={() => {
                          const nextDate = adminDraft.created_at;
                          if (!nextDate) {
                            void saveAdminFields({ created_at: null });
                            return;
                          }
                          const existing = detail.created_at ? new Date(detail.created_at) : null;
                          const timePart =
                            existing && !Number.isNaN(existing.getTime())
                              ? existing.toISOString().slice(11, 24)
                              : "00:00:00.000Z";
                          void saveAdminFields({ created_at: `${nextDate}T${timePart}` });
                        }}
                        style={styles.kvInput}
                      />
                    ) : (
                      <strong>{fmtDate(detail.created_at)}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Items</span>
                    <strong>
                      {detail.total_qty > 0
                        ? detail.total_qty
                        : detail.items.reduce((s, it) => s + Number(it.qty ?? 0), 0)}
                    </strong>
                  </div>
                </div>

                <div style={styles.sectionCard}>
                  <div style={styles.sectionTitle}>CUSTOMER</div>
                  <div style={styles.kvRow}>
                    <span>Name</span>
                    {canEdit ? (
                      <input
                        value={adminDraft.full_name}
                        onChange={(e) => setAdminDraft((prev) => ({ ...prev, full_name: e.target.value }))}
                        onBlur={() => void saveAdminFields({ full_name: adminDraft.full_name.trim() || null })}
                        style={styles.kvInput}
                      />
                    ) : (
                      <strong>{detail.full_name || "—"}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Email</span>
                    {canEdit ? (
                      <input
                        value={adminDraft.email}
                        onChange={(e) => setAdminDraft((prev) => ({ ...prev, email: e.target.value }))}
                        onBlur={() => void saveAdminFields({ email: adminDraft.email.trim() || null })}
                        style={styles.kvInput}
                      />
                    ) : (
                      <strong>{detail.email || "—"}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Mobile</span>
                    {canEdit ? (
                      <input
                        value={adminDraft.phone}
                        onChange={(e) => setAdminDraft((prev) => ({ ...prev, phone: e.target.value }))}
                        onBlur={() => void saveAdminFields({ phone: adminDraft.phone.trim() || null })}
                        style={styles.kvInput}
                      />
                    ) : (
                      <strong>{detail.phone || "—"}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Address</span>
                    {canEdit ? (
                      <textarea
                        value={adminDraft.address}
                        onChange={(e) => setAdminDraft((prev) => ({ ...prev, address: e.target.value }))}
                        onBlur={() => void saveAdminFields({ address: adminDraft.address.trim() || null })}
                        style={{ ...styles.kvInput, ...styles.kvTextarea }}
                      />
                    ) : (
                      <strong>{detail.address || "—"}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Notes</span>
                    {canEdit ? (
                      <textarea
                        value={adminDraft.notes}
                        onChange={(e) => setAdminDraft((prev) => ({ ...prev, notes: e.target.value }))}
                        onBlur={() => void saveAdminFields({ notes: adminDraft.notes.trim() || null })}
                        style={{ ...styles.kvInput, ...styles.kvTextarea }}
                      />
                    ) : (
                      <strong style={detail.notes ? styles.adminHighlight : undefined}>
                        {detail.notes || "—"}
                      </strong>
                    )}
                  </div>
                </div>

                <div style={styles.sectionCard}>
                  <div style={styles.sectionTitle}>DELIVERY</div>
                  <div style={styles.kvRow}>
                    <span>Schedule</span>
                    {canEdit ? (
                      <div style={styles.kvFieldStack}>
                        <input
                          type="date"
                          value={adminDraft.delivery_date}
                          onChange={(e) =>
                            setAdminDraft((prev) => ({ ...prev, delivery_date: e.target.value }))
                          }
                          onBlur={() =>
                            void saveAdminFields({ delivery_date: adminDraft.delivery_date || null })
                          }
                          style={styles.kvInput}
                        />
                        <input
                          value={adminDraft.delivery_slot}
                          onChange={(e) =>
                            setAdminDraft((prev) => ({ ...prev, delivery_slot: e.target.value }))
                          }
                          onBlur={() =>
                            void saveAdminFields({ delivery_slot: adminDraft.delivery_slot.trim() || null })
                          }
                          placeholder="HH:MM"
                          style={styles.kvInput}
                        />
                      </div>
                    ) : (
                      <strong>{fmtDateTime(detail.delivery_date, detail.delivery_slot)}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Express</span>
                    {canEdit ? (
                      <label style={styles.kvCheckRow}>
                        <input
                          type="checkbox"
                          checked={adminDraft.express_delivery}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setAdminDraft((prev) => ({ ...prev, express_delivery: next }));
                            void saveAdminFields({ express_delivery: next });
                          }}
                        />
                        <span>{adminDraft.express_delivery ? "YES" : "No"}</span>
                      </label>
                    ) : (
                      <strong style={detail.express_delivery ? styles.adminHighlight : undefined}>
                        {detail.express_delivery ? "YES" : "No"}
                      </strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Packaging</span>
                    {canEdit ? (
                      <select
                        value={adminDraft.add_thermal_bag ? "thermal" : "standard"}
                        onChange={(e) => {
                          const next = e.target.value === "thermal";
                          setAdminDraft((prev) => ({ ...prev, add_thermal_bag: next }));
                          void saveAdminFields({ add_thermal_bag: next });
                        }}
                        style={styles.kvInput}
                      >
                        <option value="standard">Standard bag</option>
                        <option value="thermal">Thermal bag</option>
                      </select>
                    ) : (
                      <strong style={detail.add_thermal_bag ? styles.adminHighlight : undefined}>
                        {detail.add_thermal_bag ? "Thermal bag" : "Standard bag"}
                      </strong>
                    )}
                  </div>
                </div>

                <div style={styles.sectionCard}>
                  <div style={styles.sectionTitle}>PAYMENT</div>
                  <div style={styles.kvRow}>
                    <span>Proof</span>
                    <div style={styles.proofCell}>
                      <label style={{ ...styles.uploadBtn }}>
                        Upload
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (!f) return;
                            void savePaymentProof(f);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {detail.payment_proof_url ? (
                        <button type="button" style={styles.fileNameBtn} onClick={() => setProofOpen(true)}>
                          {proofFileName}
                        </button>
                      ) : (
                        <span style={styles.noFile}>No attachment</span>
                      )}
                      {detail.payment_proof_url ? (
                        <button
                          type="button"
                          style={styles.removeFileBtn}
                          onClick={() => {
                            void savePaymentProof(null);
                          }}
                          aria-label="Remove uploaded proof"
                          title="Remove file"
                        >
                          <RemoveIcon size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {savingProof || savingAdminFields ? <div style={styles.savingTiny}>saving...</div> : null}
                  <div style={styles.kvRow}>
                    <span>Amount paid</span>
                    <div style={styles.amountPaidInline}>
                      {canEdit ? (
                        <>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={amountPaidDraft}
                            onChange={(e) => setAmountPaidDraft(e.target.value)}
                            onBlur={() => {
                              void saveAmountPaid();
                            }}
                            style={{ ...styles.amountPaidInput, ...paymentDeltaMessage.tone }}
                          />
                          <div style={{ ...paymentDeltaMessage.tone, ...styles.paymentDeltaInline }}>
                            {paymentDeltaMessage.label}
                          </div>
                        </>
                      ) : (
                        <strong style={styles.amountPaidValue}>
                          ₱ {fmtMoney(amountPaid)}
                        </strong>
                      )}
                    </div>
                  </div>
                  {savingAmountPaid ? <div style={styles.savingTiny}>saving...</div> : null}
                  <div style={styles.kvRow}>
                    <span>Delivery fee</span>
                    {canEdit ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={adminDraft.delivery_fee}
                        onChange={(e) =>
                          setAdminDraft((prev) => ({ ...prev, delivery_fee: e.target.value }))
                        }
                        onBlur={() => {
                          const raw = Number(adminDraft.delivery_fee);
                          const nextFee = Number.isNaN(raw) ? 0 : Math.max(0, raw);
                          void saveAdminFields({
                            delivery_fee: nextFee,
                            total_selling_price:
                              Number(detail.subtotal ?? 0) +
                              nextFee +
                              Number(detail.thermal_bag_fee ?? 0),
                          });
                        }}
                        style={styles.amountPaidInput}
                      />
                    ) : (
                      <strong>{detail.delivery_fee > 0 ? `₱ ${fmtMoney(detail.delivery_fee)}` : "FREE"}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Total</span>
                    <strong>₱ {fmtMoney(canEdit ? computedDisplayTotal : detail.total_selling_price)}</strong>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </aside>

      {proofOpen && detail?.payment_proof_url ? (
        <div style={styles.previewBackdrop} onClick={() => setProofOpen(false)}>
          <div style={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.previewTop}>
              <div style={styles.previewTitle}>PAYMENT PROOF</div>
              <AppButton variant="ghost" style={styles.previewClose} onClick={() => setProofOpen(false)}>
                CLOSE
              </AppButton>
            </div>
            {looksLikeImage(detail.payment_proof_url) ? (
              <img src={detail.payment_proof_url} alt="Payment proof" style={styles.previewImg} />
            ) : (
              <iframe src={detail.payment_proof_url} title="Payment proof" style={styles.previewFrame} />
            )}
          </div>
        </div>
      ) : null}

      {addLinesOpen ? (
        <div style={styles.previewBackdrop} onClick={() => setAddLinesOpen(false)}>
          <div style={styles.addLinesModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.previewTop}>
              <div style={styles.previewTitle}>ADD PRODUCTS TO ORDER</div>
              <AppButton variant="ghost" style={styles.previewClose} onClick={() => setAddLinesOpen(false)}>
                CLOSE
              </AppButton>
            </div>

            <input
              value={addLineSearch}
              onChange={(e) => setAddLineSearch(e.target.value)}
              placeholder="Search products..."
              style={styles.addLinesSearch}
            />

            <div style={styles.addLinesList}>
              {addCandidates.map((p) => {
                const id = String(p.id);
                const qty = addQtyByProduct[id] ?? 0;
                return (
                  <div key={id} style={styles.addLineItem}>
                    <div style={styles.addLineInfo}>
                      <div style={styles.addLineName}>{p.long_name || p.name || "Unnamed item"}</div>
                      <div style={styles.addLineMeta}>
                        {[p.size, p.temperature, p.country_of_origin].filter(Boolean).join(" • ") || "—"}
                      </div>
                    </div>
                    <div style={styles.addLinePrice}>₱ {fmtMoney(Number(p.selling_price ?? 0))}</div>
                    <div style={styles.addLineQty}>
                      <button
                        type="button"
                        style={styles.addQtyBtn}
                        onClick={() =>
                          setAddQtyByProduct((prev) => ({
                            ...prev,
                            [id]: Math.max(0, (prev[id] ?? 0) - 1),
                          }))
                        }
                      >
                        −
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={qty ? String(qty) : ""}
                        onChange={(e) => {
                          const n = Number(e.target.value || 0);
                          setAddQtyByProduct((prev) => ({
                            ...prev,
                            [id]: Number.isNaN(n) ? 0 : Math.max(0, Math.floor(n)),
                          }));
                        }}
                        style={styles.addQtyInput}
                      />
                      <button
                        type="button"
                        style={styles.addQtyBtn}
                        onClick={() =>
                          setAddQtyByProduct((prev) => ({
                            ...prev,
                            [id]: Math.max(0, (prev[id] ?? 0) + 1),
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.addLinesFooter}>
              <div style={styles.addLinesHint}>
                {totalAddQty > 0 ? `${totalAddQty} unit(s) selected` : "Select quantities to add"}
              </div>
              <AppButton
                type="button"
                style={styles.addConfirmBtn}
                onClick={() => void confirmAddLines()}
                disabled={savingAddLines || totalAddQty <= 0}
              >
                {savingAddLines ? "ADDING..." : "CONFIRM"}
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen && detail ? (
        <div
          style={styles.previewBackdrop}
          onClick={() => (deletingOrder ? null : setDeleteConfirmOpen(false))}
        >
          <div style={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.confirmTitle}>DELETE ORDER #{orderNo}?</div>
            <div style={styles.confirmText}>
              This will permanently delete the order and all related order details. This action cannot be undone.
            </div>
            <div style={styles.confirmActions}>
              <AppButton
                type="button"
                variant="ghost"
                style={styles.confirmCancelBtn}
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deletingOrder}
              >
                CANCEL
              </AppButton>
              <AppButton
                type="button"
                style={styles.confirmDeleteBtn}
                onClick={() => {
                  void confirmDeleteOrder();
                }}
                disabled={deletingOrder}
              >
                {deletingOrder ? "DELETING..." : "YES, DELETE"}
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: { position: "fixed", left: 0, right: 0, background: "transparent", zIndex: 920 },
  panel: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    width: "var(--tp-rail-width)",
    background: "transparent",
    zIndex: 930,
    display: "flex",
    flexDirection: "column",
    boxShadow: "none",
    border: "none",
  },
  topRow: {
    minHeight: 64,
    display: "flex",
    alignItems: "center",
    gap: TITLE_GAP,
    padding: "18px 0 15px",
  },
  backBtn: {
    width: BACK_BTN_W,
    minWidth: BACK_BTN_W,
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
  title: { fontSize: TOPBAR_FONT_SIZE, fontWeight: 900, letterSpacing: 1.4, color: "var(--tp-text-color)" },
  titleStatusSuffix: {
    marginLeft: 12,
    fontSize: TOPBAR_FONT_SIZE,
    fontWeight: 700,
    letterSpacing: 1,
    color: "#c38a28",
  },
  content: {
    flex: 1,
    overflow: "hidden",
    padding: `6px 0 48px ${BACK_BTN_W + TITLE_GAP}px`,
    color: "var(--tp-text-color)",
  },
  hint: { marginTop: 12, fontSize: 15, opacity: 0.75 },
  statusGroup: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 24 },
  statusField: { display: "flex", flexDirection: "row", gap: 10, alignItems: "center" },
  statusLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: 800,
    color: "var(--tp-text-color)",
    opacity: 0.72,
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  statusSelect: {
    height: 34,
    width: STATUS_CONTROL_W,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 10px",
    fontSize: 15,
    textTransform: "uppercase",
  },
  statusChip: {
    width: STATUS_CONTROL_W,
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    textTransform: "uppercase",
    paddingInline: 10,
  },
  sectionGrid: {
    height: "100%",
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "1.05fr 1fr",
    gap: 20,
    paddingRight: 0,
  },
  publicNotice: {
    gridColumn: "1 / -1",
    border: "1px solid rgba(102,199,255,0.42)",
    background: "rgba(102,199,255,0.12)",
    color: "var(--tp-text-color)",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 15,
    lineHeight: 1.45,
  },
  leftCol: {
    order: 2,
    minHeight: 0,
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 10,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    background: "var(--tp-control-bg-soft)",
  },
  itemListScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingRight: 4,
  },
  rightCol: {
    order: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "grid",
    gap: 12,
    alignContent: "start",
  },
  sectionCard: {
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 10,
    padding: 12,
    background: "var(--tp-control-bg-soft)",
  },
  sectionTitle: { fontSize: 15, letterSpacing: 1.2, fontWeight: 900, marginBottom: 10 },
  itemHeadRow: {
    display: "grid",
    gridTemplateColumns: "1fr 84px 108px 90px",
    gap: 12,
    padding: "0 0 6px",
    borderBottom: "1px solid var(--tp-border-color-soft)",
    marginBottom: 2,
  },
  itemHeadCell: {
    fontSize: 11,
    opacity: 0.65,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
    fontWeight: 700,
  },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "1fr 84px 108px 90px",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--tp-border-color-soft)",
  },
  itemName: { fontSize: 15, fontWeight: 700, marginBottom: 4 },
  itemMeta: { marginTop: 0, fontSize: 15, opacity: 0.78 },
  adminAddedText: { marginTop: 2, fontSize: 15, color: "#66c7ff", fontWeight: 700 },
  itemQty: { fontSize: 15, fontWeight: 800, minWidth: 32, textAlign: "center" },
  itemTotal: { fontSize: 15, fontWeight: 700, minWidth: 108, textAlign: "right" },
  itemPackedCell: { minWidth: 90, textAlign: "center" },
  itemPackedLabel: {
    fontSize: 11,
    opacity: 0.65,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  packedInput: {
    width: 70,
    height: 32,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 15,
    textAlign: "center",
  },
  packedReadOnly: { fontSize: 15, fontWeight: 700, minHeight: 24, textAlign: "center" },
  savingTiny: { fontSize: 11, opacity: 0.65, marginTop: 2 },
  totalBlock: { marginTop: 12, borderTop: "1px solid var(--tp-border-color-soft)", paddingTop: 12 },
  totalGridRow: {
    display: "grid",
    gridTemplateColumns: "1fr 84px 108px 90px",
    gap: 12,
    fontSize: 15,
    marginBottom: 8,
    alignItems: "center",
  },
  totalQtyCell: { textAlign: "center" },
  totalValueCell: { gridColumn: 3, textAlign: "right" },
  totalPickedCell: { textAlign: "center" },
  totalStrong: {
    fontSize: 20,
    marginTop: 6,
    paddingTop: 8,
    borderTop: "1px solid var(--tp-border-color-soft)",
    marginBottom: 0,
  },
  kvRow: {
    display: "grid",
    gridTemplateColumns: "130px 1fr",
    gap: 10,
    alignItems: "center",
    marginBottom: 8,
    fontSize: 15,
  },
  kvInput: {
    width: "100%",
    minWidth: 0,
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 15,
    padding: "0 10px",
  },
  kvTextarea: {
    minHeight: 72,
    height: "auto",
    padding: "8px 10px",
    resize: "vertical",
    lineHeight: 1.4,
    fontFamily: "inherit",
  },
  kvFieldStack: {
    display: "grid",
    gap: 8,
  },
  kvCheckRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 15,
    fontWeight: 700,
  },
  proofCell: { display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" },
  uploadBtn: {
    height: 30,
    minWidth: 72,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.4,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 15px",
  },
  fileNameBtn: {
    height: 30,
    maxWidth: 260,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "transparent",
    color: "var(--tp-text-color)",
    fontSize: 15,
    cursor: "pointer",
    padding: "0 10px",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
    textAlign: "left",
  },
  noFile: { fontSize: 15, color: "var(--tp-text-color)", opacity: 0.72 },
  removeFileBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid rgba(214,74,74,0.46)",
    background: "rgba(214,74,74,0.14)",
    color: "#ff6b6b",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  },
  amountPaidInput: {
    width: 180,
    height: 32,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 15,
    padding: "0 10px",
  },
  amountPaidInline: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    minWidth: 0,
    flexWrap: "wrap",
  },
  amountPaidValue: {
    fontSize: 15,
    fontWeight: 800,
  },
  paymentDeltaInline: {
    marginTop: 0,
    whiteSpace: "nowrap",
  },
  paymentDeltaRow: { marginTop: 4, fontSize: 15, color: "#66c7ff" },
  paymentDeltaRowWarn: { marginTop: 4, fontSize: 15, color: "#de6464" },
  paymentDeltaRowOk: { marginTop: 4, fontSize: 15, color: "#67bf8a" },
  adminHighlight: { color: "#66c7ff", fontWeight: 900 },
  addLineRow: { marginTop: 14, display: "flex", justifyContent: "space-between", gap: 12 },
  addLineBtn: {
    height: 34,
    paddingInline: 14,
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.8,
  },
  deleteOrderBtn: {
    height: 34,
    paddingInline: 14,
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.8,
    borderColor: "rgba(194, 77, 77, 0.44)",
    color: "#8d1f1f",
    background: "rgba(194, 77, 77, 0.12)",
  },
  previewBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    zIndex: 3000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  previewModal: {
    width: "min(100%, 1000px)",
    maxHeight: "calc(100vh - 40px)",
    border: "1px solid var(--tp-border-color)",
    borderRadius: 12,
    background: "var(--tp-control-bg-soft)",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  previewTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  previewTitle: { fontSize: 15, fontWeight: 800, letterSpacing: 1, color: "var(--tp-text-color)" },
  previewClose: {
    width: 72,
    minWidth: 72,
    height: 34,
    padding: 0,
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.8,
  },
  previewImg: {
    width: "100%",
    maxHeight: "calc(100vh - 120px)",
    objectFit: "contain",
    borderRadius: 8,
    background: "var(--tp-control-bg-soft)",
  },
  previewFrame: {
    width: "100%",
    height: "calc(100vh - 140px)",
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 8,
    background: "var(--tp-control-bg-soft)",
  },
  confirmModal: {
    width: "min(460px, calc(100vw - 32px))",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 12,
    background: "#000",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 1,
    color: "#fff",
  },
  confirmText: {
    fontSize: 15,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.84)",
  },
  confirmActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  confirmCancelBtn: {
    minWidth: 110,
  },
  confirmDeleteBtn: {
    minWidth: 140,
    background: "#8d1f1f",
    color: "#fff",
    borderColor: "#8d1f1f",
  },
  addLinesModal: {
    width: "min(100%, 980px)",
    maxHeight: "calc(100vh - 40px)",
    border: "1px solid var(--tp-border-color)",
    borderRadius: 12,
    background: "var(--tp-control-bg-soft)",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  addLinesSearch: {
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 15px",
    fontSize: 15,
  },
  addLinesList: {
    flex: 1,
    minHeight: 220,
    overflowY: "auto",
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 10,
    padding: "4px 10px",
  },
  addLineItem: {
    display: "grid",
    gridTemplateColumns: "1fr 110px 128px",
    alignItems: "center",
    gap: 12,
    padding: "10px 4px",
    borderBottom: "1px solid var(--tp-border-color-soft)",
  },
  addLineInfo: { minWidth: 0 },
  addLineName: {
    fontSize: 15,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  addLineMeta: { fontSize: 15, opacity: 0.72, marginTop: 2 },
  addLinePrice: { textAlign: "right", fontSize: 15, fontWeight: 700 },
  addLineQty: { display: "grid", gridTemplateColumns: "30px 56px 30px", gap: 6, alignItems: "center" },
  addQtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1,
    cursor: "pointer",
  },
  addQtyInput: {
    height: 30,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    textAlign: "center",
    fontSize: 15,
  },
  addLinesFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  addLinesHint: { fontSize: 15, opacity: 0.78 },
  addConfirmBtn: {
    minWidth: 120,
    height: 36,
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.8,
  },
};
