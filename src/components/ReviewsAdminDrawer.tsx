"use client";

import * as React from "react";
import { AppButton, TOPBAR_FONT_SIZE, TOPBAR_FONT_SIZE_MOBILE } from "@/components/ui";
import ReviewStars from "@/components/ReviewStars";
import {
  fetchAdminReviews,
  setAdminReviewStatus,
  type AdminReviewItem,
  type ReviewStatus,
} from "@/lib/reviewsApi";

type Props = {
  isOpen: boolean;
  topOffset: number;
  backgroundStyle?: React.CSSProperties;
  onClose: () => void;
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function statusTone(status: ReviewStatus): React.CSSProperties {
  if (status === "approved") {
    return {
      color: "#67bf8a",
      borderColor: "rgba(157,228,182,0.75)",
      background: "rgba(157,228,182,0.18)",
    };
  }
  if (status === "rejected") {
    return {
      color: "#de6464",
      borderColor: "rgba(222,100,100,0.68)",
      background: "rgba(222,100,100,0.18)",
    };
  }
  return {
    color: "#c38a28",
    borderColor: "rgba(255,207,122,0.7)",
    background: "rgba(255,207,122,0.16)",
  };
}

export default function ReviewsAdminDrawer({
  isOpen,
  topOffset,
  backgroundStyle,
  onClose,
}: Props) {
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const [rows, setRows] = React.useState<AdminReviewItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<"all" | ReviewStatus>("pending");
  const [search, setSearch] = React.useState("");
  const [adminNotes, setAdminNotes] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState("");
  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(var(--tp-app-height, 100vh) - ${panelTop}px)`;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextRows = await fetchAdminReviews();
      setRows(nextRows);
      setAdminNotes(
        Object.fromEntries(
          nextRows.map((row) => [row.id, row.admin_note ?? ""])
        )
      );
    } catch (nextError) {
      console.error("Failed to load reviews", nextError);
      setRows([]);
      setError(nextError instanceof Error ? nextError.message : "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!query) return true;
      return [
        row.product_name_snapshot,
        row.display_name,
        row.order_number_snapshot,
        row.review_text,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [rows, search, statusFilter]);

  const updateStatus = React.useCallback(
    async (row: AdminReviewItem, status: ReviewStatus) => {
      setSavingId(row.id);
      setError("");
      try {
        const saved = await setAdminReviewStatus({
          reviewId: row.id,
          status,
          adminNote: adminNotes[row.id] ?? "",
        });
        setRows((prev) =>
          prev.map((item) => (item.id === row.id ? saved : item))
        );
      } catch (nextError) {
        console.error("Failed to update review status", nextError);
        setError(nextError instanceof Error ? nextError.message : "Failed to update review.");
      } finally {
        setSavingId(null);
      }
    },
    [adminNotes]
  );

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
          ...(isMobileViewport ? styles.panelMobile : null),
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
            REVIEWS
          </div>
          <AppButton variant="ghost" style={styles.refreshBtn} onClick={() => void load()}>
            REFRESH
          </AppButton>
        </div>

        <div style={{ ...styles.content, ...(isMobileViewport ? styles.contentMobile : null) }}>
          <div style={styles.controlsRow}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product, order #, or comment..."
              style={styles.searchInput}
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | ReviewStatus)}
              style={styles.select}
            >
              <option value="pending">Pending</option>
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {error ? <div style={styles.errorBox}>{error}</div> : null}
          {loading ? <div style={styles.empty}>Loading reviews...</div> : null}
          {!loading && filteredRows.length === 0 ? (
            <div style={styles.empty}>No reviews match the current filter.</div>
          ) : null}

          {!loading
            ? filteredRows.map((row) => (
                <section key={row.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div>
                      <div style={styles.productName}>{row.product_name_snapshot}</div>
                      <div style={styles.metaRow}>
                        <span>#{row.order_number_snapshot ?? "—"}</span>
                        <span>{row.display_name}</span>
                        <span>{fmtDate(row.created_at)}</span>
                      </div>
                    </div>
                    <div style={{ ...styles.statusPill, ...statusTone(row.status) }}>
                      {row.status.toUpperCase()}
                    </div>
                  </div>

                  <div
                    style={{
                      ...styles.editorLayout,
                      ...(isMobileViewport ? styles.editorLayoutMobile : null),
                    }}
                  >
                    <div style={styles.ratingBlock}>
                      <div style={styles.ratingGrid}>
                        <div style={styles.ratingCell}>
                          <span>Overall</span>
                          <ReviewStars rating={row.rating} />
                        </div>
                        <div style={styles.ratingCell}>
                          <span>Tenderness</span>
                          <ReviewStars rating={row.tenderness_rating} />
                        </div>
                        <div style={styles.ratingCell}>
                          <span>Taste</span>
                          <ReviewStars rating={row.taste_rating} />
                        </div>
                        <div style={styles.ratingCell}>
                          <span>Delivery</span>
                          <ReviewStars rating={row.delivery_rating} />
                        </div>
                      </div>
                    </div>

                    <div style={styles.adminColumn}>
                      <div style={styles.reviewTextBox}>
                        <div style={styles.reviewText}>{row.review_text || "No comment provided."}</div>
                      </div>

                      <textarea
                        value={adminNotes[row.id] ?? ""}
                        onChange={(event) =>
                          setAdminNotes((prev) => ({ ...prev, [row.id]: event.target.value }))
                        }
                        placeholder="Optional admin note shown back to the customer if rejected."
                        style={styles.noteInput}
                      />
                    </div>
                  </div>

                  <div style={styles.actionsRow}>
                    <div style={styles.creditInfo}>
                      Reward: ₱ {row.credits_reward}
                      {row.credits_granted ? " • Credited" : ""}
                    </div>
                    <div style={styles.actionsRight}>
                      <AppButton
                        variant="ghost"
                        style={styles.rejectBtn}
                        disabled={savingId === row.id}
                        onClick={() => void updateStatus(row, "rejected")}
                      >
                        REJECT
                      </AppButton>
                      <AppButton
                        style={styles.approveBtn}
                        disabled={savingId === row.id}
                        onClick={() => void updateStatus(row, "approved")}
                      >
                        {savingId === row.id ? "SAVING..." : "APPROVE"}
                      </AppButton>
                    </div>
                  </div>
                </section>
              ))
            : null}
        </div>
      </aside>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    insetInline: 0,
    background: "transparent",
    zIndex: 860,
  },
  panel: {
    position: "fixed",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "var(--tp-rail-width)",
    display: "flex",
    flexDirection: "column",
    color: "var(--tp-text-color)",
    zIndex: 910,
    border: "none",
    background: "transparent",
  },
  panelMobile: {
    width: "100vw",
    left: 0,
    transform: "none",
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
    justifyContent: "flex-start",
    border: "none",
    background: "transparent",
    fontSize: TOPBAR_FONT_SIZE,
    fontWeight: 700,
    letterSpacing: 1,
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
  },
  titleMobile: {
    fontSize: TOPBAR_FONT_SIZE_MOBILE,
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  refreshBtn: {
    marginLeft: "auto",
    minHeight: 36,
    padding: "0 12px",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 0 calc(44px + env(safe-area-inset-bottom, 0px)) 108px",
    display: "grid",
    gap: 14,
  },
  contentMobile: {
    padding: "8px 12px calc(20px + env(safe-area-inset-bottom, 0px))",
  },
  controlsRow: {
    maxWidth: "min(1120px, 100%)",
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 160px",
    gap: 12,
  },
  searchInput: {
    width: "100%",
    height: 40,
    borderRadius: 14,
    border: "1px solid var(--tp-border-color-soft)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 15px",
    outline: "none",
    fontSize: 15,
  },
  select: {
    height: 40,
    borderRadius: 14,
    border: "1px solid var(--tp-border-color-soft)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 15px",
    outline: "none",
    fontSize: 15,
  },
  errorBox: {
    maxWidth: "min(1120px, 100%)",
    padding: 14,
    border: "1px solid rgba(222,100,100,0.6)",
    borderRadius: 14,
    background: "rgba(222,100,100,0.12)",
    color: "#ffb5b5",
  },
  empty: {
    maxWidth: "min(1120px, 100%)",
    padding: "6px 0 0",
    border: "none",
    background: "transparent",
    opacity: 0.78,
  },
  card: {
    maxWidth: "min(1120px, 100%)",
    border: "1px solid var(--tp-border-color)",
    borderRadius: 14,
    padding: 16,
    display: "grid",
    gap: 14,
    background: "var(--tp-control-bg-soft)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  productName: {
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1.15,
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
    opacity: 0.72,
    fontSize: 14,
  },
  statusPill: {
    border: "1px solid var(--tp-border-color)",
    borderRadius: 999,
    minHeight: 42,
    padding: "0 14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  editorLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(340px, 420px) minmax(320px, 1fr)",
    gap: 18,
    alignItems: "start",
  },
  editorLayoutMobile: {
    gridTemplateColumns: "1fr",
    gap: 14,
  },
  ratingBlock: {
    display: "grid",
    gap: 12,
  },
  ratingGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  ratingCell: {
    display: "grid",
    gap: 6,
    fontSize: 14,
    opacity: 0.88,
  },
  adminColumn: {
    display: "grid",
    gap: 12,
  },
  reviewTextBox: {
    minHeight: 88,
    padding: 12,
    border: "1px solid var(--tp-border-color)",
    borderRadius: 14,
    background: "rgba(0,0,0,0.2)",
  },
  reviewText: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.55,
  },
  noteInput: {
    minHeight: 88,
    width: "100%",
    padding: 12,
    resize: "vertical",
    border: "1px solid var(--tp-border-color)",
    borderRadius: 14,
    background: "rgba(0,0,0,0.2)",
    color: "var(--tp-text-color)",
    font: "inherit",
    lineHeight: 1.5,
  },
  actionsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  creditInfo: {
    opacity: 0.78,
    fontSize: 14,
    fontWeight: 700,
  },
  actionsRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  rejectBtn: {
    minHeight: 38,
    padding: "0 16px",
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
  },
  approveBtn: {
    minHeight: 36,
    padding: "0 16px",
    borderRadius: 8,
    background: "var(--tp-cta-bg)",
    color: "var(--tp-cta-fg)",
    border: "1px solid var(--tp-cta-border)",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
};
