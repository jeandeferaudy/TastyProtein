"use client";

import * as React from "react";
import {
  AppButton,
  TOPBAR_FONT_SIZE,
  TOPBAR_FONT_SIZE_MOBILE,
} from "@/components/ui";
import LogoPlaceholder from "@/components/LogoPlaceholder";

export type InventoryLine = {
  product_id: string;
  name: string;
  status?: string;
  format: string;
  preparation: string;
  temperature: string;
  thumbnail_url: string | null;
  unlimited_stock: boolean;
  qty_on_hand: number;
  qty_allocated: number;
  qty_available: number;
};

type Props = {
  isOpen: boolean;
  topOffset: number;
  onClose: () => void;
  rows: InventoryLine[];
  loading?: boolean;
  backgroundStyle?: React.CSSProperties;
  onChangeUnlimited?: (productId: string, next: boolean) => Promise<void> | void;
  onChangeQtyOnHand?: (productId: string, next: number) => Promise<void> | void;
  onBulkChangeUnlimited?: (productIds: string[], next: boolean) => Promise<void> | void;
  onBulkChangeQtyOnHand?: (productIds: string[], next: number) => Promise<void> | void;
};

const BACK_BTN_W = 68;
const TITLE_GAP = 24;

type InventoryTableRowProps = {
  row: InventoryLine;
  isSelected: boolean;
  isUnlimitedSaving: boolean;
  qtyDraft: string;
  onToggleRow: (productId: string, checked: boolean) => void;
  onChangeUnlimited: (productId: string, next: boolean) => void;
  onQtyDraftChange: (productId: string, value: string) => void;
  onQtyFocus: (productId: string) => void;
  onQtyBlur: (productId: string) => void;
  onQtyEnter: (productId: string, inputEl: HTMLInputElement) => void;
};

const InventoryTableRow = React.memo(function InventoryTableRow({
  row,
  isSelected,
  isUnlimitedSaving,
  qtyDraft,
  onToggleRow,
  onChangeUnlimited,
  onQtyDraftChange,
  onQtyFocus,
  onQtyBlur,
  onQtyEnter,
}: InventoryTableRowProps) {
  const isZeroOnHand = Number(row.qty_on_hand) <= 0;
  const safeAllocated = Math.max(0, Number(row.qty_allocated) || 0);
  const safeAvailable = Math.max(0, (Number(row.qty_on_hand) || 0) - safeAllocated);

  return (
    <div style={styles.lineRow}>
      <div style={styles.centerCell}>
        <input
          type="checkbox"
          style={styles.checkbox}
          checked={isSelected}
          onChange={(e) => onToggleRow(row.product_id, e.target.checked)}
          aria-label={`Select ${row.name}`}
        />
      </div>
      <div style={styles.thumbWrap}>
        {row.thumbnail_url ? (
          <img src={row.thumbnail_url} alt="" style={styles.thumbImg} />
        ) : (
          <LogoPlaceholder />
        )}
      </div>
      <div style={styles.nameCell}>{row.name}</div>
      <div style={styles.formatCell}>{row.format || "—"}</div>
      <div style={styles.formatCell}>{row.preparation || "—"}</div>
      <div style={styles.formatCell}>{row.temperature || "—"}</div>
      <div style={styles.centerCell}>
        <select
          value={row.unlimited_stock ? "yes" : "no"}
          disabled={isUnlimitedSaving}
          style={styles.selectCompact}
          onChange={(e) => {
            onChangeUnlimited(row.product_id, e.target.value === "yes");
          }}
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </div>
      <div style={styles.centerCell}>
        <input
          type="text"
          inputMode="numeric"
          value={qtyDraft}
          onChange={(e) => onQtyDraftChange(row.product_id, e.target.value)}
          onFocus={() => onQtyFocus(row.product_id)}
          onBlur={() => onQtyBlur(row.product_id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onQtyEnter(row.product_id, e.currentTarget);
            }
          }}
          style={{
            ...styles.input,
            ...(isZeroOnHand ? styles.zeroStockInput : null),
          }}
        />
      </div>
      <div
        style={{
          ...styles.numberCell,
          ...(isZeroOnHand ? styles.zeroStockNumber : null),
        }}
      >
        {safeAllocated}
      </div>
      <div
        style={{
          ...styles.numberCellStrong,
          ...(isZeroOnHand ? styles.zeroStockNumberStrong : null),
        }}
      >
        {safeAvailable}
      </div>
    </div>
  );
});

type InventoryMobileCardProps = InventoryTableRowProps;

const InventoryMobileCard = React.memo(function InventoryMobileCard({
  row,
  isSelected,
  isUnlimitedSaving,
  qtyDraft,
  onToggleRow,
  onChangeUnlimited,
  onQtyDraftChange,
  onQtyFocus,
  onQtyBlur,
  onQtyEnter,
}: InventoryMobileCardProps) {
  const isZeroOnHand = Number(row.qty_on_hand) <= 0;
  const safeAllocated = Math.max(0, Number(row.qty_allocated) || 0);
  const safeAvailable = Math.max(0, (Number(row.qty_on_hand) || 0) - safeAllocated);
  const meta = [row.format || "—", row.preparation || "—", row.temperature || "—"].join(" • ");

  return (
    <div style={styles.mobileCard}>
      <div style={styles.mobileCardTop}>
        <input
          type="checkbox"
          style={styles.checkbox}
          checked={isSelected}
          onChange={(e) => onToggleRow(row.product_id, e.target.checked)}
          aria-label={`Select ${row.name}`}
        />
        <div style={styles.thumbWrap}>
          {row.thumbnail_url ? (
            <img src={row.thumbnail_url} alt="" style={styles.thumbImg} />
          ) : (
            <LogoPlaceholder />
          )}
        </div>
        <div style={styles.mobileNameWrap}>
          <div style={styles.mobileName}>{row.name}</div>
          <div style={styles.mobileMeta}>{meta}</div>
        </div>
      </div>

      <div style={styles.mobileControlsRow}>
        <div style={styles.mobileField}>
          <div style={styles.mobileLabel}>Unlimited</div>
          <select
            value={row.unlimited_stock ? "yes" : "no"}
            disabled={isUnlimitedSaving}
            style={styles.selectCompact}
            onChange={(e) => {
              onChangeUnlimited(row.product_id, e.target.value === "yes");
            }}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <div style={styles.mobileField}>
          <div style={styles.mobileLabel}>On hand</div>
          <input
            type="text"
            inputMode="numeric"
            value={qtyDraft}
            onChange={(e) => onQtyDraftChange(row.product_id, e.target.value)}
            onFocus={() => onQtyFocus(row.product_id)}
            onBlur={() => onQtyBlur(row.product_id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onQtyEnter(row.product_id, e.currentTarget);
              }
            }}
            style={{
              ...styles.input,
              ...(isZeroOnHand ? styles.zeroStockInput : null),
            }}
          />
        </div>
      </div>

      <div style={styles.mobileNumbersRow}>
        <div style={styles.mobileNumItem}>
          <div style={styles.mobileLabel}>Allocated</div>
          <div
            style={{
              ...styles.numberCell,
              ...(isZeroOnHand ? styles.zeroStockNumber : null),
            }}
          >
            {safeAllocated}
          </div>
        </div>
        <div style={styles.mobileNumItem}>
          <div style={styles.mobileLabel}>Available</div>
          <div
            style={{
              ...styles.numberCellStrong,
              ...(isZeroOnHand ? styles.zeroStockNumberStrong : null),
            }}
          >
            {safeAvailable}
          </div>
        </div>
      </div>
    </div>
  );
});

export default function InventoryDrawer({
  isOpen,
  topOffset,
  onClose,
  rows,
  loading = false,
  backgroundStyle,
  onChangeUnlimited,
  onChangeQtyOnHand,
  onBulkChangeUnlimited,
  onBulkChangeQtyOnHand,
}: Props) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"active" | "all">("active");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkOnHandOpen, setBulkOnHandOpen] = React.useState(false);
  const [bulkOnHandDraft, setBulkOnHandDraft] = React.useState("");
  const [qtyDraftByProduct, setQtyDraftByProduct] = React.useState<Record<string, string>>({});
  const [savingUnlimitedByProduct, setSavingUnlimitedByProduct] = React.useState<Record<string, boolean>>({});
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const skipNextBlurSaveRef = React.useRef<Record<string, boolean>>({});
  const savingByProductRef = React.useRef<Record<string, boolean>>({});
  const activeEditByProductRef = React.useRef<Record<string, boolean>>({});
  const queuedSaveByProductRef = React.useRef<Record<string, boolean>>({});
  const pendingScrollTopRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setQtyDraftByProduct((prev) => {
      const next = { ...prev };
      let changed = false;
      const liveIds = new Set(rows.map((r) => r.product_id));

      for (const row of rows) {
        const id = row.product_id;
        const normalized = String(Math.max(0, Math.floor(Number(row.qty_on_hand) || 0)));
        if (next[id] === undefined) {
          next[id] = normalized;
          changed = true;
          continue;
        }
        if (
          !savingByProductRef.current[id] &&
          !activeEditByProductRef.current[id] &&
          next[id] !== normalized
        ) {
          next[id] = normalized;
          changed = true;
        }
      }

      for (const id of Object.keys(next)) {
        if (!liveIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [rows]);

  React.useEffect(() => {
    const valid = new Set(rows.map((r) => r.product_id));
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)));
  }, [rows]);

  React.useLayoutEffect(() => {
    if (pendingScrollTopRef.current === null) return;
    if (!listRef.current) return;
    listRef.current.scrollTop = pendingScrollTopRef.current;
    requestAnimationFrame(() => {
      if (listRef.current && pendingScrollTopRef.current !== null) {
        listRef.current.scrollTop = pendingScrollTopRef.current;
      }
      pendingScrollTopRef.current = null;
    });
  }, [rows]);

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const saveQty = React.useCallback(
    async (productId: string) => {
      if (!onChangeQtyOnHand) return;
      if (savingByProductRef.current[productId]) {
        queuedSaveByProductRef.current[productId] = true;
        return;
      }
      const raw = qtyDraftByProduct[productId] ?? "";
      const parsed = Math.max(0, Math.floor(Number(raw || 0)));
      if (Number.isNaN(parsed)) return;
      pendingScrollTopRef.current = listRef.current?.scrollTop ?? null;
      savingByProductRef.current = { ...savingByProductRef.current, [productId]: true };
      try {
        await onChangeQtyOnHand(productId, parsed);
      } finally {
        savingByProductRef.current = { ...savingByProductRef.current, [productId]: false };
        if (queuedSaveByProductRef.current[productId]) {
          delete queuedSaveByProductRef.current[productId];
          window.setTimeout(() => {
            void saveQty(productId);
          }, 0);
        }
      }
    },
    [onChangeQtyOnHand, qtyDraftByProduct]
  );

  const saveUnlimited = React.useCallback(
    async (productId: string, next: boolean) => {
      if (!onChangeUnlimited) return;
      setSavingUnlimitedByProduct((prev) => ({ ...prev, [productId]: true }));
      try {
        await onChangeUnlimited(productId, next);
      } finally {
        setSavingUnlimitedByProduct((prev) => ({ ...prev, [productId]: false }));
      }
    },
    [onChangeUnlimited]
  );

  const handleQtyDraftChange = React.useCallback((productId: string, value: string) => {
    activeEditByProductRef.current[productId] = true;
    setQtyDraftByProduct((prev) => ({
      ...prev,
      [productId]: value,
    }));
  }, []);

  const handleQtyFocus = React.useCallback((productId: string) => {
    activeEditByProductRef.current[productId] = true;
  }, []);

  const handleQtyBlur = React.useCallback(
    (productId: string) => {
      delete activeEditByProductRef.current[productId];
      if (skipNextBlurSaveRef.current[productId]) {
        delete skipNextBlurSaveRef.current[productId];
        return;
      }
      void saveQty(productId);
    },
    [saveQty]
  );

  const handleQtyEnter = React.useCallback(
    (productId: string, inputEl: HTMLInputElement) => {
      skipNextBlurSaveRef.current[productId] = true;
      void saveQty(productId);
      inputEl.blur();
    },
    [saveQty]
  );
  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = String(row.status ?? "").trim().toLowerCase();
      if (statusFilter === "active" && status !== "active") return false;
      if (!q) return true;
      return [
        row.name,
        row.format,
        row.preparation,
        row.temperature,
        row.unlimited_stock ? "yes" : "no",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter]);
  const filteredIds = React.useMemo(
    () => filteredRows.map((row) => row.product_id),
    [filteredRows]
  );
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id));

  const toggleRowSelection = React.useCallback((productId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(productId)) return prev;
        return [...prev, productId];
      }
      return prev.filter((id) => id !== productId);
    });
  }, []);

  const toggleSelectAllFiltered = React.useCallback((checked: boolean) => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      if (checked) {
        for (const id of filteredIds) prevSet.add(id);
      } else {
        for (const id of filteredIds) prevSet.delete(id);
      }
      return [...prevSet];
    });
  }, [filteredIds]);

  const runBulkUnlimited = React.useCallback(
    async (next: boolean) => {
      if (selectedIds.length === 0) return;
      setBulkBusy(true);
      try {
        if (onBulkChangeUnlimited) {
          await onBulkChangeUnlimited(selectedIds, next);
          return;
        }
        if (!onChangeUnlimited) return;
        for (const id of selectedIds) {
          await onChangeUnlimited(id, next);
        }
      } finally {
        setBulkBusy(false);
      }
    },
    [onBulkChangeUnlimited, onChangeUnlimited, selectedIds]
  );

  const runBulkOnHand = React.useCallback(
    async (value: number) => {
      if (selectedIds.length === 0) return;
      const safeValue = Math.max(0, Math.floor(Number(value) || 0));
      setBulkBusy(true);
      setQtyDraftByProduct((prev) => {
        const next = { ...prev };
        for (const id of selectedIds) next[id] = String(safeValue);
        return next;
      });
      try {
        if (onBulkChangeQtyOnHand) {
          await onBulkChangeQtyOnHand(selectedIds, safeValue);
          return;
        }
        if (!onChangeQtyOnHand) return;
        for (const id of selectedIds) {
          await onChangeQtyOnHand(id, safeValue);
        }
      } finally {
        setBulkBusy(false);
      }
    },
    [onBulkChangeQtyOnHand, onChangeQtyOnHand, selectedIds]
  );

  const handleBulkAction = React.useCallback(
    async (value: string) => {
      if (!value) return;
      if (value === "unlimited_yes") {
        await runBulkUnlimited(true);
        return;
      }
      if (value === "unlimited_no") {
        await runBulkUnlimited(false);
        return;
      }
      if (value === "on_hand_value") {
        setBulkOnHandDraft("");
        setBulkOnHandOpen(true);
      }
    },
    [runBulkUnlimited]
  );

  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;

  if (!isOpen) return null;

  return (
    <>
      <div style={{ ...styles.backdrop, ...(backgroundStyle ?? null), top: panelTop, height: panelHeight }} />
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
            INVENTORY
          </div>
        </div>
        <div style={{ ...styles.content, ...(isMobileViewport ? styles.contentMobile : null) }}>
          {loading ? <div style={styles.hint}>Loading inventory...</div> : null}
          {!loading && rows.length === 0 ? <div style={styles.hint}>No inventory lines found.</div> : null}
          {!loading && rows.length > 0 ? (
            <>
              {selectedCount > 0 ? (
                <div style={{ ...styles.bulkBar, ...(isMobileViewport ? styles.bulkBarMobile : null) }}>
                  <div style={styles.bulkCount}>{selectedCount} selected</div>
                  <select
                    style={{ ...styles.bulkSelect, ...(isMobileViewport ? styles.bulkSelectMobile : null) }}
                    disabled={bulkBusy}
                    defaultValue=""
                    onChange={(e) => {
                      const value = e.target.value;
                      e.currentTarget.value = "";
                      void handleBulkAction(value);
                    }}
                  >
                    <option value="" disabled>
                      Select action...
                    </option>
                    <option value="unlimited_yes">Change unlimited to yes</option>
                    <option value="unlimited_no">Change unlimited to no</option>
                    <option value="on_hand_value">Change on hand value to...</option>
                  </select>
                  <button
                    type="button"
                    style={{ ...styles.bulkClear, ...(isMobileViewport ? styles.bulkClearMobile : null) }}
                    disabled={bulkBusy}
                    onClick={() => setSelectedIds([])}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div style={{ ...styles.searchWrap, ...(isMobileViewport ? styles.searchWrapMobile : null) }}>
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    style={styles.searchIcon}
                  >
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search product, format, preparation, or temperature..."
                    style={styles.searchInput}
                  />
                  {search.trim().length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      style={styles.searchClear}
                      aria-label="Clear search"
                      title="Clear search"
                    >
                      Clear
                    </button>
                  ) : null}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "active" | "all")}
                    style={styles.statusFilterSelect}
                    aria-label="Filter by product status"
                    title="Filter by status"
                  >
                    <option value="active">Active</option>
                    <option value="all">All</option>
                  </select>
                </div>
              )}
              <div style={{ ...styles.tableWrap, ...(isMobileViewport ? styles.tableWrapMobile : null) }}>
                {isMobileViewport ? (
                  <div style={styles.mobileSelectAllRow}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={allFilteredSelected}
                      onChange={(e) => toggleSelectAllFiltered(e.target.checked)}
                      aria-label="Select all/none"
                    />
                    <span style={styles.mobileSelectAllLabel}>Select all / none</span>
                  </div>
                ) : (
                  <div style={styles.headRow}>
                    <div style={styles.centerHead}>
                      <input
                        type="checkbox"
                        style={styles.checkbox}
                        checked={allFilteredSelected}
                        onChange={(e) => toggleSelectAllFiltered(e.target.checked)}
                        aria-label="Select all/none"
                      />
                    </div>
                    <div>PICTURE</div>
                    <div>NAME</div>
                    <div>FORMAT</div>
                    <div>PREPARATION</div>
                    <div>TEMPERATURE</div>
                    <div>UNLIMITED</div>
                    <div style={styles.centerHead}>ON HAND</div>
                    <div style={styles.centerHead}>ALLOCATED</div>
                    <div style={styles.centerHead}>AVAILABLE</div>
                  </div>
                )}
                <div
                  ref={listRef}
                  style={{ ...styles.list, ...(isMobileViewport ? styles.listMobile : null) }}
                >
                  {filteredRows.length === 0 ? (
                    <div style={styles.hint}>No matching inventory lines.</div>
                  ) : null}
                  {filteredRows.map((row) =>
                    isMobileViewport ? (
                      <InventoryMobileCard
                        key={row.product_id}
                        row={row}
                        isSelected={selectedSet.has(row.product_id)}
                        isUnlimitedSaving={Boolean(savingUnlimitedByProduct[row.product_id])}
                        qtyDraft={qtyDraftByProduct[row.product_id] ?? ""}
                        onToggleRow={toggleRowSelection}
                        onChangeUnlimited={saveUnlimited}
                        onQtyDraftChange={handleQtyDraftChange}
                        onQtyFocus={handleQtyFocus}
                        onQtyBlur={handleQtyBlur}
                        onQtyEnter={handleQtyEnter}
                      />
                    ) : (
                      <InventoryTableRow
                        key={row.product_id}
                        row={row}
                        isSelected={selectedSet.has(row.product_id)}
                        isUnlimitedSaving={Boolean(savingUnlimitedByProduct[row.product_id])}
                        qtyDraft={qtyDraftByProduct[row.product_id] ?? ""}
                        onToggleRow={toggleRowSelection}
                        onChangeUnlimited={saveUnlimited}
                        onQtyDraftChange={handleQtyDraftChange}
                        onQtyFocus={handleQtyFocus}
                        onQtyBlur={handleQtyBlur}
                        onQtyEnter={handleQtyEnter}
                      />
                    )
                  )}
                </div>
              </div>
              {bulkOnHandOpen ? (
                <div style={styles.bulkModalBackdrop} onClick={() => setBulkOnHandOpen(false)}>
                  <div style={styles.bulkModal} onClick={(e) => e.stopPropagation()}>
                    <div style={styles.bulkModalTitle}>Set On Hand Value</div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bulkOnHandDraft}
                      onChange={(e) => setBulkOnHandDraft(e.target.value)}
                      placeholder="Enter new on hand value"
                      style={styles.bulkModalInput}
                    />
                    <div style={styles.bulkModalActions}>
                      <AppButton
                        variant="ghost"
                        style={styles.bulkModalBtn}
                        onClick={() => setBulkOnHandOpen(false)}
                      >
                        Cancel
                      </AppButton>
                      <AppButton
                        style={styles.bulkModalBtn}
                        disabled={bulkBusy}
                        onClick={() => {
                          const value = Math.max(0, Math.floor(Number(bulkOnHandDraft || 0)));
                          if (Number.isNaN(value)) return;
                          void (async () => {
                            await runBulkOnHand(value);
                            setBulkOnHandOpen(false);
                          })();
                        }}
                      >
                        Confirm
                      </AppButton>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
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
  topRowMobile: {
    minHeight: 52,
    gap: 10,
    padding: "8px 10px 8px",
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
  backBtnMobile: {
    fontSize: TOPBAR_FONT_SIZE_MOBILE,
    height: 40,
    padding: "0 15px 0 0",
  },
  title: { fontSize: TOPBAR_FONT_SIZE, fontWeight: 900, letterSpacing: 1.4, color: "var(--tp-text-color)" },
  titleMobile: { fontSize: TOPBAR_FONT_SIZE_MOBILE, fontWeight: 700, letterSpacing: 0.2 },
  content: {
    flex: 1,
    overflow: "hidden",
    padding: `6px 0 48px ${BACK_BTN_W + TITLE_GAP}px`,
    color: "var(--tp-text-color)",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  contentMobile: {
    padding: "8px 12px 20px",
  },
  hint: { marginTop: 12, fontSize: 15, opacity: 0.75 },
  searchWrap: {
    marginBottom: 10,
    width: "100%",
    height: 36,
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "0 8px",
    borderRadius: 8,
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--tp-text-color)",
    position: "relative",
  },
  searchWrapMobile: {
    padding: "0 10px",
  },
  searchInput: {
    width: "100%",
    height: "100%",
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    fontSize: 16,
    lineHeight: "36px",
    padding: 0,
    outline: "none",
  },
  searchIcon: {
    opacity: 0.85,
    flex: "0 0 auto",
  },
  searchClear: {
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    opacity: 0.72,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    flex: "0 0 auto",
  },
  statusFilterSelect: {
    height: 30,
    minWidth: 86,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 14,
    padding: "0 8px",
    outline: "none",
    flex: "0 0 auto",
  },
  bulkBar: {
    marginBottom: 10,
    height: 36,
    display: "grid",
    gridTemplateColumns: "1fr minmax(220px, 340px) 1fr",
    alignItems: "center",
    gap: 10,
  },
  bulkBarMobile: {
    height: "auto",
    gridTemplateColumns: "1fr",
    gap: 8,
  },
  bulkCount: {
    fontSize: 14,
    fontWeight: 700,
    opacity: 0.86,
  },
  bulkSelect: {
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 10px",
    fontSize: 15,
  },
  bulkSelectMobile: {
    width: "100%",
  },
  bulkClear: {
    border: "none",
    background: "transparent",
    color: "var(--tp-accent)",
    opacity: 1,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    padding: 0,
    justifySelf: "end",
    textAlign: "right",
    minWidth: 44,
  },
  bulkClearMobile: {
    justifySelf: "start",
    textAlign: "left",
  },
  tableWrap: {
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 10,
    overflow: "hidden",
    flex: 1,
    minHeight: 0,
    marginBottom: 20,
    display: "flex",
    flexDirection: "column",
    background: "var(--tp-control-bg-soft)",
  },
  tableWrapMobile: {
    border: "none",
    borderRadius: 0,
    marginBottom: 10,
    background: "transparent",
  },
  headRow: {
    display: "grid",
    gridTemplateColumns:
      "34px 62px minmax(180px, 1fr) 120px 120px 120px 82px 100px 100px 100px",
    gap: 10,
    padding: 0,
    height: 40,
    borderBottom: "1px solid var(--tp-border-color-soft)",
    fontSize: 11,
    opacity: 0.68,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: 700,
    alignItems: "center",
    paddingInline: 10,
    flex: "0 0 auto",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    paddingInline: 10,
  },
  listMobile: {
    paddingInline: 0,
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  lineRow: {
    display: "grid",
    gridTemplateColumns:
      "34px 62px minmax(180px, 1fr) 120px 120px 120px 82px 100px 100px 100px",
    gap: 10,
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid var(--tp-border-color-soft)",
    fontSize: 15,
  },
  thumbWrap: {
    width: 50,
    height: 50,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color-soft)",
    overflow: "hidden",
    background: "var(--tp-control-bg-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  nameCell: {
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  formatCell: { opacity: 0.86 },
  select: {
    width: "100%",
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 15,
    padding: "0 8px",
  },
  selectCompact: {
    width: 72,
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 15,
    padding: "0 8px",
    textAlign: "center",
    textAlignLast: "center",
  },
  input: {
    width: 84,
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 15,
    padding: "0 10px",
    textAlign: "center",
  },
  centerHead: {
    textAlign: "center",
  },
  centerCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  numberCell: { textAlign: "center", fontWeight: 700 },
  numberCellStrong: { textAlign: "center", fontWeight: 900 },
  zeroStockInput: {
    background: "rgba(222,100,100,0.2)",
    border: "1px solid rgba(222,100,100,0.9)",
    color: "#ffc2c2",
  },
  zeroStockNumber: {
    background: "rgba(222,100,100,0.26)",
    border: "1px solid rgba(222,100,100,0.75)",
    borderRadius: 8,
    width: 84,
    margin: "0 auto",
    minHeight: 34,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 8px",
    color: "#ffb6b6",
  },
  zeroStockNumberStrong: {
    background: "rgba(222,100,100,0.32)",
    border: "1px solid rgba(222,100,100,0.85)",
    borderRadius: 8,
    width: 84,
    margin: "0 auto",
    minHeight: 34,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 8px",
    color: "#ffd0d0",
  },
  checkbox: {
    opacity: 0.78,
  },
  mobileSelectAllRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 2px 8px",
    borderBottom: "1px solid var(--tp-border-color-soft)",
    marginBottom: 8,
  },
  mobileSelectAllLabel: {
    fontSize: 13,
    opacity: 0.82,
    fontWeight: 700,
  },
  mobileCard: {
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 12,
    padding: "10px 10px 9px",
    background: "var(--tp-control-bg-soft)",
    display: "grid",
    gap: 9,
  },
  mobileCardTop: {
    display: "grid",
    gridTemplateColumns: "18px 50px minmax(0,1fr)",
    alignItems: "center",
    gap: 8,
  },
  mobileNameWrap: {
    minWidth: 0,
  },
  mobileName: {
    fontSize: 15,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  mobileMeta: {
    fontSize: 13,
    opacity: 0.8,
    marginTop: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  mobileControlsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  mobileField: {
    display: "grid",
    gap: 4,
  },
  mobileLabel: {
    fontSize: 12,
    opacity: 0.76,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  mobileNumbersRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  mobileNumItem: {
    display: "grid",
    gap: 4,
  },
  bulkModalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.56)",
    zIndex: 2500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  bulkModal: {
    width: "min(100%, 420px)",
    borderRadius: 12,
    border: "1px solid var(--tp-border-color)",
    background: "#000000",
    padding: 14,
    display: "grid",
    gap: 12,
  },
  bulkModalTitle: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: 0.6,
  },
  bulkModalInput: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 15,
    padding: "0 12px",
    outline: "none",
  },
  bulkModalActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  bulkModalBtn: {
    height: 36,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
  },
};
