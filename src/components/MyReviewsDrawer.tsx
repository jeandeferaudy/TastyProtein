"use client";

import * as React from "react";
import { AppButton, TOPBAR_FONT_SIZE, TOPBAR_FONT_SIZE_MOBILE } from "@/components/ui";
import ReviewStars from "@/components/ReviewStars";
import { fetchMyReviewQueue, saveMyProductReview, type MyReviewQueueItem } from "@/lib/reviewsApi";

type Props = {
  isOpen: boolean;
  topOffset: number;
  userId: string | null;
  email?: string | null;
  phone?: string | null;
  backgroundStyle?: React.CSSProperties;
  onClose: () => void;
};

type DraftState = Record<
  string,
  {
    rating: number;
    tendernessRating: number;
    tasteRating: number;
    deliveryRating: number;
    reviewText: string;
  }
>;

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

function statusTone(status: string | null): React.CSSProperties {
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
  if (status === "pending") {
    return {
      color: "#c38a28",
      borderColor: "rgba(255,207,122,0.7)",
      background: "rgba(255,207,122,0.16)",
    };
  }
  return {
    color: "var(--tp-text-color)",
    borderColor: "var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
  };
}

function buildDraftState(rows: MyReviewQueueItem[]): DraftState {
  const next: DraftState = {};
  for (const row of rows) {
    next[row.queue_key] = {
      rating: row.rating,
      tendernessRating: row.tenderness_rating,
      tasteRating: row.taste_rating,
      deliveryRating: row.delivery_rating,
      reviewText: row.review_text,
    };
  }
  return next;
}

function RatingPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div style={styles.metricRatingRow}>
      {Array.from({ length: 5 }, (_, index) => {
        const next = index + 1;
        const active = next <= value;
        return (
          <button
            key={next}
            type="button"
            onClick={() => onChange(active ? Math.max(1, next - 1) : next)}
            style={{
              ...styles.ratingStarButton,
              ...(active ? styles.ratingStarButtonActive : null),
            }}
            aria-label={`Set rating to ${next}`}
          >
            <span aria-hidden="true">★</span>
          </button>
        );
      })}
    </div>
  );
}

export default function MyReviewsDrawer({
  isOpen,
  topOffset,
  userId,
  email = null,
  phone = null,
  backgroundStyle,
  onClose,
}: Props) {
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const [rows, setRows] = React.useState<MyReviewQueueItem[]>([]);
  const [drafts, setDrafts] = React.useState<DraftState>({});
  const [loading, setLoading] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(var(--tp-app-height, 100vh) - ${panelTop}px)`;
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    if (!isOpen || !userId) return;
    setLoading(true);
    setError("");
    fetchMyReviewQueue({
      userId,
      email,
      phone,
    })
      .then((nextRows) => {
        setRows(nextRows);
        setDrafts(buildDraftState(nextRows));
      })
      .catch((nextError) => {
        console.error("Failed to load review queue", nextError);
        setRows([]);
        setDrafts({});
        setError(nextError instanceof Error ? nextError.message : "Failed to load reviews.");
      })
      .finally(() => setLoading(false));
  }, [email, isOpen, phone, userId]);

  const setDraftField = React.useCallback(
    (queueKey: string, patch: Partial<DraftState[string]>) => {
      setDrafts((prev) => ({
        ...prev,
        [queueKey]: {
          rating: prev[queueKey]?.rating ?? 5,
          tendernessRating: prev[queueKey]?.tendernessRating ?? 5,
          tasteRating: prev[queueKey]?.tasteRating ?? 5,
          deliveryRating: prev[queueKey]?.deliveryRating ?? 5,
          reviewText: prev[queueKey]?.reviewText ?? "",
          ...patch,
        },
      }));
    },
    []
  );

  const submitReview = React.useCallback(
    async (row: MyReviewQueueItem) => {
      const draft = drafts[row.queue_key];
      if (!draft) return;
      setSavingKey(row.queue_key);
      setError("");
      try {
        const saved = await saveMyProductReview({
          reviewId: row.review_id,
          orderId: row.order_id,
          productId: row.product_id,
          userId,
          customerId: row.customer_id,
          displayName: row.display_name,
          productName: row.product_name,
          orderNumber: row.order_number,
          rating: draft.rating,
          tendernessRating: draft.tendernessRating,
          tasteRating: draft.tasteRating,
          deliveryRating: draft.deliveryRating,
          reviewText: draft.reviewText,
        });
        setRows((prev) =>
          prev.map((item) =>
            item.queue_key === row.queue_key
              ? {
                  ...item,
                  review_id: saved.id,
                  display_name: saved.display_name,
                  rating: saved.rating,
                  tenderness_rating: saved.tenderness_rating,
                  taste_rating: saved.taste_rating,
                  delivery_rating: saved.delivery_rating,
                  review_text: saved.review_text,
                  status: saved.status,
                  admin_note: saved.admin_note,
                  credits_reward: saved.credits_reward,
                  credits_granted: saved.credits_granted,
                  review_created_at: saved.created_at,
                  review_updated_at: saved.updated_at,
                }
              : item
          )
        );
      } catch (nextError) {
        console.error("Failed to save review", nextError);
        setError(nextError instanceof Error ? nextError.message : "Failed to save review.");
      } finally {
        setSavingKey(null);
      }
    },
    [drafts, userId]
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
            MY REVIEWS
          </div>
        </div>

        <div
          ref={contentRef}
          style={{ ...styles.content, ...(isMobileViewport ? styles.contentMobile : null) }}
        >
          <div style={styles.introCard}>
            <div style={styles.introRow}>
              <div>
                <div style={styles.introTitle}>Earn ₱ 15 per approved review.</div>
                <div style={styles.introText}>
                  Review products and earn steack credits once they are published.
                </div>
              </div>
            </div>
          </div>

          {error ? <div style={styles.errorBox}>{error}</div> : null}
          {loading ? <div style={styles.empty}>Loading reviews...</div> : null}
          {!loading && rows.length === 0 ? (
            <div style={styles.empty}>No purchased products available for review yet.</div>
          ) : null}

          {!loading
            ? rows.map((row) => {
                const draft = drafts[row.queue_key] ?? {
                  rating: 5,
                  tendernessRating: 5,
                  tasteRating: 5,
                  deliveryRating: 5,
                  reviewText: "",
                };
                const isApproved = row.status === "approved";
                return (
                  <section key={row.queue_key} data-review-key={row.queue_key} style={styles.card}>
                    <div style={styles.cardTop}>
                      <div>
                        <div style={styles.productName}>{row.product_name}</div>
                        <div style={styles.metaRow}>
                          <span>Order #{row.order_number ?? "—"}</span>
                          <span>{fmtDate(row.order_created_at)}</span>
                          <span>Qty {row.qty}</span>
                        </div>
                        {(row.product_country || row.product_size || row.product_temperature) ? (
                          <div style={styles.metaRow}>
                            {[row.product_country, row.product_size, row.product_temperature]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        ) : null}
                      </div>
                      <div style={styles.statusWrap}>
                        {row.status === "pending" ? (
                          <div style={styles.pendingInlineNote}>
                            Pending admin approval. Credit is granted only after approval.
                          </div>
                        ) : null}
                        <div style={{ ...styles.statusPill, ...statusTone(row.status) }}>
                          {row.status ? row.status.toUpperCase() : "NOT REVIEWED"}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        ...styles.editorLayout,
                        ...(isMobileViewport ? styles.editorLayoutMobile : null),
                      }}
                    >
                      <div style={styles.metricBlock}>
                        <div style={styles.metricRow}>
                          <span style={styles.metricLabel}>Overall</span>
                          <RatingPicker
                            value={draft.rating}
                            onChange={(next) => setDraftField(row.queue_key, { rating: next })}
                          />
                        </div>
                        <div style={styles.metricRow}>
                          <span style={styles.metricLabel}>Tenderness</span>
                          <RatingPicker
                            value={draft.tendernessRating}
                            onChange={(next) =>
                              setDraftField(row.queue_key, { tendernessRating: next })
                            }
                          />
                        </div>
                        <div style={styles.metricRow}>
                          <span style={styles.metricLabel}>Taste</span>
                          <RatingPicker
                            value={draft.tasteRating}
                            onChange={(next) => setDraftField(row.queue_key, { tasteRating: next })}
                          />
                        </div>
                        <div style={styles.metricRow}>
                          <span style={styles.metricLabel}>Delivery</span>
                          <RatingPicker
                            value={draft.deliveryRating}
                            onChange={(next) =>
                              setDraftField(row.queue_key, { deliveryRating: next })
                            }
                          />
                        </div>
                      </div>

                      <textarea
                        value={draft.reviewText}
                        onChange={(event) =>
                          setDraftField(row.queue_key, { reviewText: event.target.value })
                        }
                        placeholder="Share what you liked, how it cooked, and whether you would order it again."
                        style={{
                          ...styles.textarea,
                          ...(isApproved ? styles.readonlyField : null),
                        }}
                        disabled={isApproved}
                      />
                    </div>

                    <div style={styles.actionsRow}>
                      <div style={styles.reviewPreview}>
                        <ReviewStars rating={draft.rating} size={14} />
                        <span>{draft.rating}/5</span>
                      </div>
                      <div style={styles.actionsRight}>
                        {!isApproved ? (
                          <AppButton
                            style={styles.submitBtn}
                            disabled={savingKey === row.queue_key}
                            onClick={() => void submitReview(row)}
                          >
                            {savingKey === row.queue_key
                              ? "SAVING..."
                              : row.status === "rejected"
                                ? "RESUBMIT"
                                : row.status === "pending"
                                  ? "UPDATE"
                                  : "CREATE"}
                          </AppButton>
                        ) : null}
                      </div>
                    </div>

                    {row.status === "approved" ? (
                      <div style={styles.approvalNote}>
                        Published. {row.credits_granted ? `₱ ${row.credits_reward} credited.` : "Credit pending sync."}
                      </div>
                    ) : null}
                    {row.status === "rejected" && row.admin_note ? (
                      <div style={styles.rejectedNote}>Admin note: {row.admin_note}</div>
                    ) : null}
                  </section>
                );
              })
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
  introCard: {
    maxWidth: "min(1120px, 100%)",
    marginBottom: 8,
    padding: "16px 18px",
    alignSelf: "start",
    borderRadius: 14,
    border: "1px solid var(--tp-accent)",
    background: "rgba(184, 153, 88, 0.08)",
    color: "var(--tp-accent)",
    display: "block",
  },
  introRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  introTitle: {
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.35,
  },
  introText: {
    fontSize: 14,
    opacity: 0.92,
    lineHeight: 1.4,
    maxWidth: 620,
  },
  createBtn: {
    minHeight: 40,
    padding: "0 16px",
    whiteSpace: "nowrap",
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
  statusWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "flex-end",
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
  pendingInlineNote: {
    fontSize: 14,
    fontWeight: 400,
    color: "#f4cd73",
    opacity: 0.92,
    textAlign: "right",
  },
  editorLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(420px, 520px) minmax(320px, 1fr)",
    gap: 18,
    alignItems: "start",
  },
  editorLayoutMobile: {
    gridTemplateColumns: "1fr",
    gap: 14,
  },
  metricBlock: {
    display: "grid",
    gap: 10,
  },
  metricRow: {
    display: "grid",
    gridTemplateColumns: "120px minmax(0,1fr)",
    alignItems: "center",
    gap: 12,
  },
  metricLabel: {
    fontSize: 15,
    opacity: 0.85,
  },
  metricRatingRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  ratingStarButton: {
    width: 38,
    height: 38,
    borderWidth: 0,
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: 0,
    background: "transparent",
    color: "var(--tp-text-color)",
    opacity: 0.7,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    lineHeight: 1,
  },
  ratingStarButtonActive: {
    borderWidth: 0,
    borderStyle: "solid",
    borderColor: "transparent",
    background: "transparent",
    color: "#f4cd73",
    opacity: 1,
  },
  textarea: {
    minHeight: 112,
    width: "100%",
    height: "100%",
    padding: 12,
    resize: "vertical",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--tp-border-color)",
    borderRadius: 14,
    background: "rgba(0,0,0,0.2)",
    color: "var(--tp-text-color)",
    font: "inherit",
    lineHeight: 1.5,
  },
  readonlyField: {
    opacity: 0.8,
  },
  actionsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  reviewPreview: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    opacity: 0.88,
    fontWeight: 700,
  },
  actionsRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  submitBtn: {
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
  approvalNote: {
    color: "#8be0a7",
    fontSize: 14,
    fontWeight: 700,
  },
  rejectedNote: {
    color: "#ffb5b5",
    fontSize: 14,
    fontWeight: 700,
  },
};
