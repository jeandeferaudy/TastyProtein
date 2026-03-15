"use client";

import * as React from "react";
import { AppButton, TOPBAR_FONT_SIZE } from "@/components/ui";
import type { PurchaseAdminPatch, PurchaseDetail, PurchaseStatusPatch } from "@/lib/purchasesApi";
import type { DbProduct } from "@/lib/products";

type Props = {
  isOpen: boolean;
  topOffset: number;
  onBack: () => void;
  detail: PurchaseDetail | null;
  products: DbProduct[];
  loading?: boolean;
  canEdit?: boolean;
  backgroundStyle?: React.CSSProperties;
  onChangeStatuses?: (purchaseId: string, patch: PurchaseStatusPatch) => Promise<void> | void;
  onChangeReceivedQty?: (purchaseLineId: string, receivedQty: number | null) => Promise<void> | void;
  onChangeUnitPrice?: (purchaseId: string, purchaseLineId: string, unitPrice: number | null) => Promise<void> | void;
  onChangeQty?: (purchaseId: string, purchaseLineId: string, qty: number | null) => Promise<void> | void;
  onDeleteLine?: (purchaseId: string, purchaseLineId: string) => Promise<void> | void;
  onChangeAmountPaid?: (purchaseId: string, amountPaid: number | null) => Promise<void> | void;
  onChangeAdminFields?: (purchaseId: string, patch: PurchaseAdminPatch) => Promise<void> | void;
  onDeletePurchase?: (purchaseId: string) => Promise<void> | void;
  onAddLines?: (purchaseId: string, items: Array<{ productId: string; qty: number }>) => Promise<void> | void;
};

const STATUS_OPTIONS = ["draft", "submitted", "confirmed", "completed"];
const PAYMENT_OPTIONS = ["unpaid", "processed", "paid"];
const DELIVERY_OPTIONS = ["unreceived", "partially received", "received"];

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

function purchaseNumber8(id: string) {
  const digits = id.replace(/\D/g, "");
  return (digits.slice(-8) || "00000000").padStart(8, "0");
}

function statusTone(value: string): React.CSSProperties {
  const v = String(value || "").toLowerCase();
  if (v === "completed" || v === "paid" || v === "received" || v === "confirmed") {
    return {
      color: "#67bf8a",
      borderColor: "rgba(157,228,182,0.75)",
      background: "rgba(157,228,182,0.26)",
    };
  }
  if (v === "processed" || v === "partially received" || v === "submitted") {
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

function receivedTone(receivedRaw: string | undefined, orderedQty: number): React.CSSProperties {
  const received = receivedRaw === undefined || receivedRaw === "" ? 0 : Number(receivedRaw);
  if (!Number.isFinite(received)) {
    return { background: "rgba(255,207,122,0.5)" };
  }
  if (received < orderedQty) {
    return { background: "rgba(255,207,122,0.5)" };
  }
  if (received === orderedQty) {
    return { background: "rgba(157,228,182,0.5)" };
  }
  return { background: "rgba(102,199,255,0.5)" };
}

export default function PurchaseDrawer({
  isOpen,
  topOffset,
  onBack,
  detail,
  products,
  loading = false,
  canEdit = false,
  backgroundStyle,
  onChangeStatuses,
  onChangeReceivedQty,
  onChangeUnitPrice,
  onChangeQty,
  onDeleteLine,
  onChangeAmountPaid,
  onChangeAdminFields,
  onDeletePurchase,
  onAddLines,
}: Props) {
  const [statusDraft, setStatusDraft] = React.useState({
    status: "submitted",
    paid_status: "processed",
    delivery_status: "unreceived",
  });
  const [receivedDraftById, setReceivedDraftById] = React.useState<Record<string, string>>({});
  const [amountPaidDraft, setAmountPaidDraft] = React.useState("");
  const [savingStatus, setSavingStatus] = React.useState(false);
  const [savingReceived, setSavingReceived] = React.useState<Record<string, boolean>>({});
  const [savingUnitPrice, setSavingUnitPrice] = React.useState<Record<string, boolean>>({});
  const [savingQty, setSavingQty] = React.useState<Record<string, boolean>>({});
  const [deletingLineById, setDeletingLineById] = React.useState<Record<string, boolean>>({});
  const [savingAmountPaid, setSavingAmountPaid] = React.useState(false);
  const [savingAdminFields, setSavingAdminFields] = React.useState(false);
  const [deletingPurchase, setDeletingPurchase] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [addLinesOpen, setAddLinesOpen] = React.useState(false);
  const [addLineSearch, setAddLineSearch] = React.useState("");
  const [addQtyByProduct, setAddQtyByProduct] = React.useState<Record<string, number>>({});
  const [savingAddLines, setSavingAddLines] = React.useState(false);
  const [savedPulseByKey, setSavedPulseByKey] = React.useState<Record<string, boolean>>({});
  const savedPulseTimersRef = React.useRef<Record<string, number>>({});
  const [adminDraft, setAdminDraft] = React.useState({
    created_at: "",
    seller_name: "",
    seller_email: "",
    seller_phone: "",
    seller_address: "",
    notes: "",
    delivery_date: "",
    delivery_fee: "",
  });
  const [unitPriceDraftById, setUnitPriceDraftById] = React.useState<Record<string, string>>({});
  const [qtyDraftById, setQtyDraftById] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!detail) return;
    setStatusDraft({
      status: String(detail.status || "submitted"),
      paid_status: String(detail.paid_status || "processed"),
      delivery_status: String(detail.delivery_status || "unreceived"),
    });
    const nextReceived: Record<string, string> = {};
    const nextUnitPrice: Record<string, string> = {};
    const nextQty: Record<string, string> = {};
    for (const line of detail.items) {
      nextReceived[line.id] =
        line.received_qty === null || line.received_qty === undefined ? "" : String(line.received_qty);
      nextUnitPrice[line.id] =
        line.unit_price === null || line.unit_price === undefined ? "" : String(line.unit_price);
      nextQty[line.id] = line.qty === null || line.qty === undefined ? "" : String(line.qty);
    }
    setReceivedDraftById(nextReceived);
    setUnitPriceDraftById(nextUnitPrice);
    setQtyDraftById(nextQty);
    setAmountPaidDraft(String(detail.amount_paid ?? 0));
    setAdminDraft({
      created_at: detail.created_at ? String(detail.created_at).slice(0, 10) : "",
      seller_name: detail.seller_name ?? "",
      seller_email: detail.seller_email ?? "",
      seller_phone: detail.seller_phone ?? "",
      seller_address: detail.seller_address ?? "",
      notes: detail.notes ?? "",
      delivery_date: detail.delivery_date ?? "",
      delivery_fee: String(detail.delivery_fee ?? 0),
    });
  }, [detail]);

  const pulseSaved = React.useCallback((key: string) => {
    if (!key) return;
    const existing = savedPulseTimersRef.current[key];
    if (existing) {
      window.clearTimeout(existing);
    }
    setSavedPulseByKey((prev) => ({ ...prev, [key]: true }));
    savedPulseTimersRef.current[key] = window.setTimeout(() => {
      setSavedPulseByKey((prev) => ({ ...prev, [key]: false }));
      delete savedPulseTimersRef.current[key];
    }, 900);
  }, []);

  React.useEffect(
    () => () => {
      for (const id of Object.values(savedPulseTimersRef.current)) {
        window.clearTimeout(id);
      }
      savedPulseTimersRef.current = {};
    },
    []
  );

  const saveStatusPatch = React.useCallback(
    async (patch: PurchaseStatusPatch) => {
      if (!detail || !onChangeStatuses) return;
      setSavingStatus(true);
      try {
        await onChangeStatuses(detail.id, patch);
      } finally {
        setSavingStatus(false);
      }
    },
    [detail, onChangeStatuses]
  );

  const saveReceivedQty = React.useCallback(
    async (lineId: string) => {
      if (!onChangeReceivedQty) return;
      const raw = receivedDraftById[lineId];
      const next = raw === "" ? null : Math.max(0, Math.floor(Number(raw)));
      if (next !== null && Number.isNaN(next)) return;
      setSavingReceived((prev) => ({ ...prev, [lineId]: true }));
      try {
        await onChangeReceivedQty(lineId, next);
        pulseSaved(`received:${lineId}`);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to save received quantity.";
        alert(msg);
      } finally {
        setSavingReceived((prev) => ({ ...prev, [lineId]: false }));
      }
    },
    [onChangeReceivedQty, pulseSaved, receivedDraftById]
  );

  const saveUnitPrice = React.useCallback(
    async (lineId: string) => {
      if (!detail || !onChangeUnitPrice) return;
      const raw = unitPriceDraftById[lineId];
      const next = raw === "" ? null : Number(raw);
      if (next !== null && Number.isNaN(next)) return;
      setSavingUnitPrice((prev) => ({ ...prev, [lineId]: true }));
      try {
        await onChangeUnitPrice(detail.id, lineId, next);
        pulseSaved(`unit_price:${lineId}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to save unit cost.";
        alert(msg);
      } finally {
        setSavingUnitPrice((prev) => ({ ...prev, [lineId]: false }));
      }
    },
    [detail, onChangeUnitPrice, pulseSaved, unitPriceDraftById]
  );

  const saveQty = React.useCallback(
    async (lineId: string) => {
      if (!detail || !onChangeQty) return;
      const raw = qtyDraftById[lineId];
      const next = raw === "" ? null : Math.max(1, Math.floor(Number(raw)));
      if (next !== null && Number.isNaN(next)) return;
      setSavingQty((prev) => ({ ...prev, [lineId]: true }));
      try {
        await onChangeQty(detail.id, lineId, next);
        pulseSaved(`qty:${lineId}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to save quantity.";
        alert(msg);
      } finally {
        setSavingQty((prev) => ({ ...prev, [lineId]: false }));
      }
    },
    [detail, onChangeQty, pulseSaved, qtyDraftById]
  );

  const deleteLine = React.useCallback(
    async (lineId: string) => {
      if (!detail || !onDeleteLine || deletingLineById[lineId]) return;
      setDeletingLineById((prev) => ({ ...prev, [lineId]: true }));
      try {
        await onDeleteLine(detail.id, lineId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to delete line.";
        alert(msg);
      } finally {
        setDeletingLineById((prev) => ({ ...prev, [lineId]: false }));
      }
    },
    [deletingLineById, detail, onDeleteLine]
  );

  const saveAmountPaid = React.useCallback(async () => {
    if (!detail || !onChangeAmountPaid) return;
    const raw = amountPaidDraft.trim();
    const next = raw === "" ? null : Number(raw);
    if (next !== null && Number.isNaN(next)) return;
    setSavingAmountPaid(true);
    try {
      await onChangeAmountPaid(detail.id, next === null ? null : Math.max(0, next));
      pulseSaved("amount_paid");
    } finally {
      setSavingAmountPaid(false);
    }
  }, [amountPaidDraft, detail, onChangeAmountPaid, pulseSaved]);

  const saveAdminFields = React.useCallback(
    async (patch: PurchaseAdminPatch, savedKeys?: string | string[]) => {
      if (!detail || !onChangeAdminFields) return;
      setSavingAdminFields(true);
      try {
        await onChangeAdminFields(detail.id, patch);
        if (savedKeys) {
          for (const key of Array.isArray(savedKeys) ? savedKeys : [savedKeys]) {
            pulseSaved(key);
          }
        }
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to save purchase details.";
        alert(msg);
      } finally {
        setSavingAdminFields(false);
      }
    },
    [detail, onChangeAdminFields, pulseSaved]
  );

  const addCandidates = React.useMemo(() => {
    const q = addLineSearch.trim().toLowerCase();
    const source = products.filter((p) => String(p.status ?? "").toLowerCase() !== "archived");
    if (!q) return source;
    return source.filter((p) =>
      [p.name, p.long_name, p.size, p.temperature, p.country_of_origin, p.keywords]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [addLineSearch, products]);

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

  const totalReceivedUnits = React.useMemo(() => {
    if (!detail) return 0;
    return detail.items.reduce((sum, it) => {
      const raw = receivedDraftById[it.id];
      const n = raw === undefined || raw === "" ? 0 : Number(raw);
      return sum + (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
    }, 0);
  }, [detail, receivedDraftById]);

  const totalAddQty = React.useMemo(
    () => Object.values(addQtyByProduct).reduce((sum, qty) => sum + Math.max(0, Math.floor(Number(qty || 0))), 0),
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
    } finally {
      setSavingAddLines(false);
    }
  }, [addQtyByProduct, detail, onAddLines]);

  const confirmDeletePurchase = React.useCallback(async () => {
    if (!detail || !onDeletePurchase || deletingPurchase) return;
    setDeletingPurchase(true);
    try {
      await onDeletePurchase(detail.id);
      setDeleteConfirmOpen(false);
    } finally {
      setDeletingPurchase(false);
    }
  }, [deletingPurchase, detail, onDeletePurchase]);

  if (!isOpen) return null;

  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;
  const purchaseNo = detail ? detail.purchase_number ?? purchaseNumber8(detail.id) : "—";

  return (
    <>
      <div style={{ ...styles.backdrop, ...(backgroundStyle ?? null), top: panelTop, height: panelHeight }} />
      <aside className="tp-drawer-slide-up" style={{ ...styles.panel, ...(backgroundStyle ?? null), top: panelTop, height: panelHeight }}>
        <div style={styles.topRow}>
          <AppButton variant="ghost" style={styles.backBtn} onClick={onBack}>
            BACK
          </AppButton>
          <div style={styles.title}>PURCHASE #{purchaseNo}</div>
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
                  <div style={{ ...styles.statusChip, ...statusTone(statusDraft.status) }}>{statusDraft.status}</div>
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
                  <div style={{ ...styles.statusChip, ...statusTone(statusDraft.paid_status) }}>{statusDraft.paid_status}</div>
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

        <div style={styles.content}>
          {loading ? <div style={styles.hint}>Loading purchase details...</div> : null}
          {!loading && !detail ? <div style={styles.hint}>Purchase not found.</div> : null}

          {!loading && detail ? (
            <div style={styles.sectionGrid}>
              <section style={styles.leftCol}>
                <div style={styles.sectionTitle}>ITEMS</div>
                <div style={styles.itemListScroll}>
                  <div style={canEdit ? styles.itemHeadRowEditable : styles.itemHeadRow}>
                    <div />
                    <div style={styles.itemHeadCell}>ORDERED</div>
                    <div style={styles.itemHeadCell}>RECEIVED</div>
                    <div style={styles.itemHeadCell}>TOTAL</div>
                    {canEdit ? <div style={styles.itemHeadCell}> </div> : null}
                  </div>
                  {detail.items.map((it) => (
                    <div key={it.id} style={canEdit ? styles.itemRowEditable : styles.itemRow}>
                      <div>
                        <div style={styles.itemName}>{it.name}</div>
                        <div style={styles.itemMeta}>{[it.size, it.temperature].filter(Boolean).join(" • ") || "—"}</div>
                        {canEdit ? (
                          <div style={styles.itemMetaEditRow}>
                            <span style={styles.itemMetaLabel}>Unit cost</span>
                            <div style={styles.itemMetaInputWrap}>
                              <input
                                type="text"
                                inputMode="decimal"
                                disabled={Boolean(savingUnitPrice[it.id])}
                                value={unitPriceDraftById[it.id] ?? ""}
                                onChange={(e) =>
                                  setUnitPriceDraftById((prev) => ({
                                    ...prev,
                                    [it.id]: e.target.value,
                                  }))
                                }
                                onBlur={() => {
                                  void saveUnitPrice(it.id);
                                }}
                                style={{ ...styles.itemUnitPriceInput, ...styles.inputWithCheckPadding }}
                              />
                              {savedPulseByKey[`unit_price:${it.id}`] ? <span style={styles.savedCheck}>✓</span> : null}
                            </div>
                          </div>
                        ) : (
                          <div style={styles.itemMeta}>₱ {fmtMoney(it.unit_price)} / pc</div>
                        )}
                      </div>
                      <div style={styles.itemQty}>
                        {canEdit ? (
                          <div style={styles.itemQtyInputWrap}>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={Boolean(savingQty[it.id])}
                              value={qtyDraftById[it.id] ?? ""}
                              onChange={(e) =>
                                setQtyDraftById((prev) => ({
                                  ...prev,
                                  [it.id]: e.target.value,
                                }))
                              }
                              onBlur={() => {
                                void saveQty(it.id);
                              }}
                              style={{ ...styles.qtyInput, ...styles.inputWithCheckPadding }}
                            />
                            {savedPulseByKey[`qty:${it.id}`] ? <span style={styles.savedCheck}>✓</span> : null}
                          </div>
                        ) : (
                          it.qty
                        )}
                      </div>
                      <div style={styles.itemReceivedCell}>
                        {canEdit ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            value={receivedDraftById[it.id] ?? ""}
                            onChange={(e) =>
                              setReceivedDraftById((prev) => ({
                                ...prev,
                                [it.id]: e.target.value,
                              }))
                            }
                            onBlur={() => {
                              void saveReceivedQty(it.id);
                            }}
                            style={{
                              ...styles.receivedInput,
                              ...receivedTone(receivedDraftById[it.id], Number(it.qty ?? 0)),
                            }}
                          />
                        ) : (
                          <div style={styles.receivedReadOnly}>{receivedDraftById[it.id] === "" ? "—" : receivedDraftById[it.id]}</div>
                        )}
                      </div>
                      <div style={styles.itemTotal}>
                        ₱{" "}
                        {fmtMoney(
                          canEdit
                            ? (() => {
                                const parsed = Number(unitPriceDraftById[it.id]);
                                const effectiveUnit = Number.isFinite(parsed)
                                  ? Math.max(0, parsed)
                                  : Math.max(0, Number(it.unit_price ?? 0));
                                return effectiveUnit * Number(it.qty ?? 0);
                              })()
                            : it.line_total
                        )}
                      </div>
                      {canEdit ? (
                        <div style={styles.itemActionCell}>
                          <button
                            type="button"
                            disabled={Boolean(deletingLineById[it.id])}
                            onClick={() => {
                              void deleteLine(it.id);
                            }}
                            style={styles.deleteLineBtn}
                          >
                            {deletingLineById[it.id] ? "..." : "DELETE"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div style={styles.totalBlock}>
                  <div style={styles.totalGridRow}>
                    <span>Subtotal</span>
                    <strong>{totalUnits}</strong>
                    <strong>{totalReceivedUnits}</strong>
                    <strong style={styles.totalValueCell}>₱ {fmtMoney(detail.subtotal)}</strong>
                  </div>
                  <div style={styles.totalGridRow}>
                    <span>Delivery</span>
                    <strong style={styles.totalValueCell}>
                      {Number(canEdit ? Number(adminDraft.delivery_fee) || 0 : detail.delivery_fee) > 0
                        ? `₱ ${fmtMoney(canEdit ? Number(adminDraft.delivery_fee) || 0 : detail.delivery_fee)}`
                        : "FREE"}
                    </strong>
                  </div>
                  <div style={styles.totalGridRow}>
                    <span>Other fee</span>
                    <strong style={styles.totalValueCell}>
                      {detail.thermal_bag_fee > 0 ? `₱ ${fmtMoney(detail.thermal_bag_fee)}` : "FREE"}
                    </strong>
                  </div>
                  <div style={{ ...styles.totalGridRow, ...styles.totalStrong }}>
                    <span>Total</span>
                    <strong style={styles.totalValueCell}>₱ {fmtMoney(canEdit ? computedDisplayTotal : detail.total_selling_price)}</strong>
                  </div>
                </div>

                {canEdit ? (
                  <div style={styles.addLineRow}>
                    <AppButton type="button" variant="ghost" style={styles.addLineBtn} onClick={() => setAddLinesOpen(true)}>
                      + ADD PRODUCT
                    </AppButton>
                    <AppButton type="button" variant="ghost" style={styles.deletePurchaseBtn} onClick={() => setDeleteConfirmOpen(true)}>
                      DELETE PURCHASE
                    </AppButton>
                  </div>
                ) : null}
              </section>

              <section style={styles.rightCol}>
                <div style={styles.sectionCard}>
                  <div style={styles.sectionTitle}>PURCHASE OVERVIEW</div>
                  <div style={styles.kvRow}>
                    <span>PO #</span>
                    <strong>{purchaseNo}</strong>
                  </div>
                  <div style={styles.kvRow}>
                    <span>Placed on</span>
                    {canEdit ? (
                      <div style={styles.inputWithCheck}>
                        <input
                          type="date"
                          value={adminDraft.created_at}
                          onChange={(e) => setAdminDraft((prev) => ({ ...prev, created_at: e.target.value }))}
                          onClick={(e) => {
                            const input = e.currentTarget as HTMLInputElement & {
                              showPicker?: () => void;
                            };
                            try {
                              input.showPicker?.();
                            } catch {
                              // Ignore browsers that block showPicker outside strict gesture contexts.
                            }
                          }}
                          onBlur={() => {
                            const nextDate = adminDraft.created_at;
                            if (!nextDate) {
                              void saveAdminFields({ created_at: null }, "created_at");
                              return;
                            }
                            const existing = detail.created_at ? new Date(detail.created_at) : null;
                            const timePart =
                              existing && !Number.isNaN(existing.getTime())
                                ? existing.toISOString().slice(11, 24)
                                : "00:00:00.000Z";
                            void saveAdminFields({ created_at: `${nextDate}T${timePart}` }, "created_at");
                          }}
                          style={{ ...styles.kvInput, ...styles.inputWithCheckPadding }}
                        />
                        {savedPulseByKey.created_at ? <span style={styles.savedCheck}>✓</span> : null}
                      </div>
                    ) : (
                      <strong>{fmtDate(detail.created_at)}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Items</span>
                    <strong>{detail.total_qty > 0 ? detail.total_qty : detail.items.reduce((s, it) => s + Number(it.qty ?? 0), 0)}</strong>
                  </div>
                </div>

                <div style={styles.sectionCard}>
                  <div style={styles.sectionTitle}>SELLER</div>
                  <div style={styles.kvRow}>
                    <span>Name</span>
                    {canEdit ? (
                      <div style={styles.inputWithCheck}>
                        <input
                          value={adminDraft.seller_name}
                          onChange={(e) => setAdminDraft((prev) => ({ ...prev, seller_name: e.target.value }))}
                          onBlur={() => void saveAdminFields({ seller_name: adminDraft.seller_name.trim() || null }, "seller_name")}
                          style={{ ...styles.kvInput, ...styles.inputWithCheckPadding }}
                        />
                        {savedPulseByKey.seller_name ? <span style={styles.savedCheck}>✓</span> : null}
                      </div>
                    ) : (
                      <strong>{detail.seller_name || "—"}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Email</span>
                    {canEdit ? (
                      <div style={styles.inputWithCheck}>
                        <input
                          value={adminDraft.seller_email}
                          onChange={(e) => setAdminDraft((prev) => ({ ...prev, seller_email: e.target.value }))}
                          onBlur={() => void saveAdminFields({ seller_email: adminDraft.seller_email.trim() || null }, "seller_email")}
                          style={{ ...styles.kvInput, ...styles.inputWithCheckPadding }}
                        />
                        {savedPulseByKey.seller_email ? <span style={styles.savedCheck}>✓</span> : null}
                      </div>
                    ) : (
                      <strong>{detail.seller_email || "—"}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Mobile</span>
                    {canEdit ? (
                      <div style={styles.inputWithCheck}>
                        <input
                          value={adminDraft.seller_phone}
                          onChange={(e) => setAdminDraft((prev) => ({ ...prev, seller_phone: e.target.value }))}
                          onBlur={() => void saveAdminFields({ seller_phone: adminDraft.seller_phone.trim() || null }, "seller_phone")}
                          style={{ ...styles.kvInput, ...styles.inputWithCheckPadding }}
                        />
                        {savedPulseByKey.seller_phone ? <span style={styles.savedCheck}>✓</span> : null}
                      </div>
                    ) : (
                      <strong>{detail.seller_phone || "—"}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Address</span>
                    {canEdit ? (
                      <div style={styles.inputWithCheck}>
                        <textarea
                          value={adminDraft.seller_address}
                          onChange={(e) => setAdminDraft((prev) => ({ ...prev, seller_address: e.target.value }))}
                          onBlur={() => void saveAdminFields({ seller_address: adminDraft.seller_address.trim() || null }, "seller_address")}
                          style={{ ...styles.kvInput, ...styles.kvTextarea, ...styles.inputWithCheckPadding }}
                        />
                        {savedPulseByKey.seller_address ? <span style={styles.savedCheck}>✓</span> : null}
                      </div>
                    ) : (
                      <strong>{detail.seller_address || "—"}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Notes</span>
                    {canEdit ? (
                      <div style={styles.inputWithCheck}>
                        <textarea
                          value={adminDraft.notes}
                          onChange={(e) => setAdminDraft((prev) => ({ ...prev, notes: e.target.value }))}
                          onBlur={() => void saveAdminFields({ notes: adminDraft.notes.trim() || null }, "notes")}
                          style={{ ...styles.kvInput, ...styles.kvTextarea, ...styles.inputWithCheckPadding }}
                        />
                        {savedPulseByKey.notes ? <span style={styles.savedCheck}>✓</span> : null}
                      </div>
                    ) : (
                      <strong>{detail.notes || "—"}</strong>
                    )}
                  </div>
                </div>

                <div style={styles.sectionCard}>
                  <div style={styles.sectionTitle}>DELIVERY</div>
                  <div style={styles.kvRow}>
                    <span>Date</span>
                    {canEdit ? (
                      <div style={styles.inputWithCheck}>
                        <input
                          type="date"
                          value={adminDraft.delivery_date}
                          onChange={(e) => setAdminDraft((prev) => ({ ...prev, delivery_date: e.target.value }))}
                          onClick={(e) => {
                            const input = e.currentTarget as HTMLInputElement & {
                              showPicker?: () => void;
                            };
                            try {
                              input.showPicker?.();
                            } catch {
                              // Ignore browsers that block showPicker outside strict gesture contexts.
                            }
                          }}
                          onBlur={() => void saveAdminFields({ delivery_date: adminDraft.delivery_date || null }, "delivery_date")}
                          style={{ ...styles.kvInput, ...styles.inputWithCheckPadding }}
                        />
                        {savedPulseByKey.delivery_date ? <span style={styles.savedCheck}>✓</span> : null}
                      </div>
                    ) : (
                      <strong>{detail.delivery_date ? fmtDate(detail.delivery_date) : "—"}</strong>
                    )}
                  </div>
                </div>

                <div style={styles.sectionCard}>
                  <div style={styles.sectionTitle}>PAYMENT</div>
                  <div style={styles.kvRow}>
                    <span>Amount paid</span>
                    {canEdit ? (
                      <div style={styles.inputWithCheck}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={amountPaidDraft}
                          onChange={(e) => setAmountPaidDraft(e.target.value)}
                          onBlur={() => {
                            void saveAmountPaid();
                          }}
                          style={{ ...styles.amountPaidInput, ...styles.shortMoneyInput, ...styles.inputWithCheckPadding }}
                        />
                        {savedPulseByKey.amount_paid ? <span style={styles.savedCheck}>✓</span> : null}
                      </div>
                    ) : (
                      <strong>₱ {fmtMoney(Number(detail.amount_paid ?? 0))}</strong>
                    )}
                  </div>
                  <div style={styles.kvRow}>
                    <span>Delivery fee</span>
                    {canEdit ? (
                      <div style={styles.inputWithCheck}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={adminDraft.delivery_fee}
                          onChange={(e) => setAdminDraft((prev) => ({ ...prev, delivery_fee: e.target.value }))}
                          onBlur={() => {
                            const raw = Number(adminDraft.delivery_fee);
                            const nextFee = Number.isNaN(raw) ? 0 : Math.max(0, raw);
                            void saveAdminFields({
                              delivery_fee: nextFee,
                              total_selling_price: Number(detail.subtotal ?? 0) + nextFee + Number(detail.thermal_bag_fee ?? 0),
                            }, "delivery_fee");
                          }}
                          style={{ ...styles.amountPaidInput, ...styles.shortMoneyInput, ...styles.inputWithCheckPadding }}
                        />
                        {savedPulseByKey.delivery_fee ? <span style={styles.savedCheck}>✓</span> : null}
                      </div>
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

      {addLinesOpen ? (
        <div style={styles.modalBackdrop} onClick={() => setAddLinesOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTop}>
              <div style={styles.modalTitle}>ADD PRODUCTS TO PURCHASE</div>
              <button
                type="button"
                style={styles.modalClose}
                onClick={() => setAddLinesOpen(false)}
              >
                CLOSE
              </button>
            </div>
            <input
              value={addLineSearch}
              onChange={(e) => setAddLineSearch(e.target.value)}
              placeholder="Search product"
              style={styles.modalSearch}
            />
            <div style={styles.modalList}>
              {addCandidates.map((p) => {
                const id = String(p.id);
                const qty = addQtyByProduct[id] ?? 0;
                const detailLine = [p.size, p.temperature, p.country_of_origin].filter(Boolean).join(" • ");
                return (
                  <div key={id} style={styles.modalRow}>
                    <div style={styles.modalInfo}>
                      <div style={styles.modalName}>{p.long_name || p.name || "Item"}</div>
                      {detailLine ? <div style={styles.modalMeta}>{detailLine}</div> : null}
                      {Number.isFinite(Number(p.product_cost ?? p.selling_price))
                        ? <div style={styles.modalMeta}>₱ {fmtMoney(Number(p.product_cost ?? p.selling_price ?? 0))} / pc</div>
                        : null}
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={qty || ""}
                      onChange={(e) => {
                        const next = Math.max(0, Math.floor(Number(e.target.value || 0)));
                        setAddQtyByProduct((prev) => ({ ...prev, [id]: next }));
                      }}
                      style={styles.modalQty}
                    />
                  </div>
                );
              })}
            </div>
            <div style={styles.modalFooter}>
              <div style={styles.modalSummary}>{totalAddQty} unit(s) selected</div>
              <AppButton
                variant="ghost"
                style={styles.modalAddBtn}
                disabled={savingAddLines || totalAddQty <= 0}
                onClick={() => {
                  void confirmAddLines();
                }}
              >
                {savingAddLines ? "ADDING..." : "ADD TO PURCHASE"}
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen && detail ? (
        <div style={styles.modalBackdrop} onClick={() => setDeleteConfirmOpen(false)}>
          <div style={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.confirmTitle}>DELETE PURCHASE #{purchaseNo}?</div>
            <div style={styles.confirmText}>This will permanently delete this purchase and all related lines.</div>
            <div style={styles.confirmActions}>
              <AppButton
                variant="ghost"
                style={styles.confirmCancelBtn}
                onClick={() => (deletingPurchase ? null : setDeleteConfirmOpen(false))}
              >
                CANCEL
              </AppButton>
              <AppButton
                variant="ghost"
                style={styles.confirmDeleteBtn}
                onClick={() => {
                  void confirmDeletePurchase();
                }}
                disabled={deletingPurchase}
              >
                {deletingPurchase ? "DELETING..." : "YES, DELETE"}
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}
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
  },
  topRow: { minHeight: 64, display: "flex", alignItems: "center", gap: 40, padding: "18px 0 15px" },
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
  title: {
    fontSize: TOPBAR_FONT_SIZE,
    fontWeight: 900,
    letterSpacing: 2,
    color: "var(--tp-text-color)",
  },
  statusGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  statusField: { display: "grid", gap: 5 },
  statusLabel: { fontSize: 10, letterSpacing: 0.5, opacity: 0.7, textTransform: "uppercase" },
  statusSelect: {
    minWidth: 148,
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    padding: "0 10px",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
  },
  statusChip: {
    minWidth: 148,
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 10px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 0 24px 108px",
    color: "var(--tp-text-color)",
  },
  hint: { opacity: 0.8, padding: "12px 0" },
  sectionGrid: { display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 14 },
  leftCol: { border: "1px solid var(--tp-border-color-soft)", borderRadius: 10, padding: 12, minHeight: 0 },
  rightCol: { display: "grid", gap: 10, alignContent: "start" },
  sectionTitle: { fontSize: 15, fontWeight: 900, letterSpacing: 0.5, marginBottom: 10 },
  itemListScroll: { maxHeight: "44vh", overflowY: "auto" },
  itemHeadRow: {
    display: "grid",
    gridTemplateColumns: "1fr 84px 90px 108px",
    gap: 8,
    alignItems: "center",
    paddingBottom: 6,
    borderBottom: "1px solid var(--tp-border-color-soft)",
  },
  itemHeadRowEditable: {
    display: "grid",
    gridTemplateColumns: "1fr 84px 90px 108px 84px",
    gap: 8,
    alignItems: "center",
    paddingBottom: 6,
    borderBottom: "1px solid var(--tp-border-color-soft)",
  },
  itemHeadCell: { fontSize: 12, opacity: 0.75, textAlign: "center", fontWeight: 800 },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "1fr 84px 90px 108px",
    gap: 8,
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid var(--tp-border-color-soft)",
  },
  itemRowEditable: {
    display: "grid",
    gridTemplateColumns: "1fr 84px 90px 108px 84px",
    gap: 8,
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid var(--tp-border-color-soft)",
  },
  itemName: { fontSize: 16, fontWeight: 700 },
  itemMeta: { fontSize: 13, opacity: 0.78, marginTop: 2 },
  itemMetaEditRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 },
  itemMetaLabel: { fontSize: 12, opacity: 0.78, minWidth: 56 },
  itemMetaInputWrap: { position: "relative", width: 138, maxWidth: "100%" },
  itemUnitPriceInput: {
    width: "100%",
    height: 30,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    padding: "0 8px",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 13,
    fontWeight: 700,
  },
  itemQty: { textAlign: "center", fontSize: 15, fontWeight: 700 },
  itemQtyInputWrap: { position: "relative", width: 72, justifySelf: "center", maxWidth: "100%" },
  qtyInput: {
    width: "100%",
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    padding: "0 8px",
    textAlign: "center",
    fontSize: 15,
    fontWeight: 700,
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
  },
  itemReceivedCell: { display: "grid", justifyItems: "center", gap: 4 },
  receivedInput: {
    width: 74,
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    padding: "0 8px",
    textAlign: "center",
    fontSize: 15,
    fontWeight: 700,
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
  },
  receivedReadOnly: { fontSize: 15, fontWeight: 700, minHeight: 24, textAlign: "center" },
  itemTotal: { textAlign: "right", fontSize: 15, fontWeight: 700 },
  itemActionCell: { display: "flex", justifyContent: "center" },
  deleteLineBtn: {
    height: 30,
    minWidth: 72,
    borderRadius: 8,
    border: "1px solid rgba(194, 77, 77, 0.44)",
    background: "rgba(194, 77, 77, 0.12)",
    color: "#ff9a9a",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.3,
    cursor: "pointer",
  },
  totalBlock: { marginTop: 12, borderTop: "1px solid var(--tp-border-color-soft)", paddingTop: 12 },
  totalGridRow: {
    display: "grid",
    gridTemplateColumns: "1fr 84px 90px 108px",
    alignItems: "center",
    gap: 8,
    padding: "4px 0",
    fontSize: 15,
  },
  totalStrong: { fontWeight: 900 },
  totalValueCell: { gridColumn: 4, textAlign: "right" },
  addLineRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 12 },
  addLineBtn: {
    height: 34,
    borderRadius: 8,
    padding: "0 12px",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  deletePurchaseBtn: {
    height: 34,
    borderRadius: 8,
    padding: "0 12px",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: 0.3,
    borderColor: "rgba(194, 77, 77, 0.44)",
    color: "#ff9a9a",
  },
  sectionCard: { border: "1px solid var(--tp-border-color-soft)", borderRadius: 10, padding: 12 },
  kvRow: {
    display: "grid",
    gridTemplateColumns: "112px 1fr",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    marginBottom: 8,
  },
  kvInput: {
    width: "100%",
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    padding: "0 10px",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 14,
  },
  kvTextarea: {
    height: 68,
    padding: "8px 10px",
    resize: "vertical",
    fontFamily: "inherit",
  },
  amountPaidInput: {
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    padding: "0 10px",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 14,
    width: "100%",
  },
  shortMoneyInput: {
    width: 220,
    maxWidth: "100%",
  },
  inputWithCheck: { position: "relative", width: "100%" },
  inputWithCheckPadding: { paddingRight: 28 },
  savedCheck: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 13,
    color: "#67bf8a",
    fontWeight: 900,
    pointerEvents: "none",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 2000,
    background: "rgba(0,0,0,0.78)",
    display: "grid",
    placeItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "min(760px, calc(100vw - 40px))",
    maxHeight: "min(76vh, 720px)",
    background: "#06080a",
    border: "1px solid var(--tp-border-color)",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gridTemplateRows: "auto auto 1fr auto",
    gap: 10,
    color: "var(--tp-text-color)",
  },
  modalTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: 900, letterSpacing: 0.5 },
  modalClose: {
    height: 32,
    padding: "0 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    cursor: "pointer",
  },
  modalSearch: {
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    padding: "0 10px",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 14,
  },
  modalList: { overflowY: "auto", border: "1px solid var(--tp-border-color-soft)", borderRadius: 8 },
  modalRow: {
    display: "grid",
    gridTemplateColumns: "1fr 100px",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderBottom: "1px solid var(--tp-border-color-soft)",
  },
  modalInfo: { minWidth: 0 },
  modalName: { fontSize: 14, fontWeight: 700 },
  modalMeta: { fontSize: 12, opacity: 0.8, marginTop: 2 },
  modalQty: {
    height: 32,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    padding: "0 8px",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 14,
  },
  modalFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  modalSummary: { fontSize: 13, opacity: 0.85 },
  modalAddBtn: { height: 34, borderRadius: 8, padding: "0 12px", fontSize: 12, fontWeight: 800 },
  confirmCard: {
    width: "min(460px, calc(100vw - 40px))",
    background: "var(--tp-page-bg)",
    border: "1px solid var(--tp-border-color)",
    borderRadius: 12,
    padding: 14,
    color: "var(--tp-text-color)",
  },
  confirmTitle: { fontSize: 18, fontWeight: 900, marginBottom: 8 },
  confirmText: { fontSize: 14, opacity: 0.86, marginBottom: 12 },
  confirmActions: { display: "flex", justifyContent: "flex-end", gap: 8 },
  confirmCancelBtn: { height: 34, borderRadius: 8, padding: "0 12px", fontSize: 12, fontWeight: 800 },
  confirmDeleteBtn: {
    height: 34,
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 12,
    fontWeight: 800,
    borderColor: "rgba(194, 77, 77, 0.44)",
    color: "#ff9a9a",
  },
};
