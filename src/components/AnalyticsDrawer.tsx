"use client";

import * as React from "react";
import { AppButton, TOPBAR_FONT_SIZE, TOPBAR_FONT_SIZE_MOBILE } from "@/components/ui";
import type { OrderListItem } from "@/lib/ordersApi";

const BACK_BTN_W = 68;
const TITLE_GAP = 40;

type Timeline = "day" | "week" | "month";

type Props = {
  isOpen: boolean;
  topOffset: number;
  onClose: () => void;
  orders: OrderListItem[];
  backgroundStyle?: React.CSSProperties;
};

type Bucket = {
  label: string;
  fullLabel: string;
  value: number;
};

const DAY_TIMELINE_START = new Date("2026-01-01T00:00:00");

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatMoney(v: number) {
  return `₱ ${v.toLocaleString("en-PH")}`;
}

function buildBuckets(
  orders: OrderListItem[],
  timeline: Timeline,
  rangeStart: string,
  rangeEnd: string
): Bucket[] {
  const startBoundary = new Date(`${rangeStart}T00:00:00`);
  const endBoundary = new Date(`${rangeEnd}T23:59:59`);
  if (Number.isNaN(startBoundary.getTime()) || Number.isNaN(endBoundary.getTime()) || startBoundary > endBoundary) {
    return [];
  }
  const salesByKey = new Map<string, number>();

  for (const order of orders) {
    const date = new Date(order.created_at);
    if (Number.isNaN(date.getTime())) continue;
    if (date < startBoundary || date > endBoundary) continue;
    let key = "";
    if (timeline === "day") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;
    } else if (timeline === "week") {
      const weekStart = startOfWeek(date);
      key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(
        weekStart.getDate()
      ).padStart(2, "0")}`;
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }
    salesByKey.set(key, (salesByKey.get(key) ?? 0) + Number(order.total_selling_price ?? 0));
  }

  if (timeline === "day") {
    const buckets: Bucket[] = [];
    const start = new Date(startBoundary);
    start.setHours(0, 0, 0, 0);
    for (let date = new Date(start); date <= endBoundary; date.setDate(date.getDate() + 1)) {
      const next = new Date(date);
      next.setHours(0, 0, 0, 0);
      const key = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
        next.getDate()
      ).padStart(2, "0")}`;
      buckets.push({
        label: next.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
        fullLabel: next.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
        value: salesByKey.get(key) ?? 0,
      });
    }
    return buckets;
  }

  if (timeline === "week") {
    const buckets: Bucket[] = [];
    const start = startOfWeek(startBoundary);
    const currentWeek = startOfWeek(endBoundary);
    for (let date = new Date(start); date <= currentWeek; date.setDate(date.getDate() + 7)) {
      const next = new Date(date);
      const weekEnd = new Date(next);
      weekEnd.setDate(next.getDate() + 6);
      const key = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
        next.getDate()
      ).padStart(2, "0")}`;
      buckets.push({
        label: next.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
        fullLabel: `${next.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`,
        value: salesByKey.get(key) ?? 0,
      });
    }
    return buckets;
  }

  const buckets: Bucket[] = [];
  const start = new Date(startBoundary.getFullYear(), startBoundary.getMonth(), 1);
  const end = new Date(endBoundary.getFullYear(), endBoundary.getMonth(), 1);
  for (let date = new Date(start); date <= end; date.setMonth(date.getMonth() + 1)) {
    const next = new Date(date);
    const key = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      label: next.toLocaleDateString("en-PH", { month: "short", year: "2-digit" }),
      fullLabel: next.toLocaleDateString("en-PH", { year: "numeric", month: "long" }),
      value: salesByKey.get(key) ?? 0,
    });
  }
  return buckets;
}

export default function AnalyticsDrawer({
  isOpen,
  topOffset,
  onClose,
  orders,
  backgroundStyle,
}: Props) {
  const [timeline, setTimeline] = React.useState<Timeline>("day");
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const [chartHostWidth, setChartHostWidth] = React.useState(0);
  const [hoveredPoint, setHoveredPoint] = React.useState<{
    x: number;
    y: number;
    label: string;
    value: number;
  } | null>(null);
  const chartHostRef = React.useRef<HTMLDivElement | null>(null);
  const chartCardRef = React.useRef<HTMLDivElement | null>(null);
  const [rangeStart, setRangeStart] = React.useState("2026-01-01");
  const [rangeEnd, setRangeEnd] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  });

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    const node = chartHostRef.current;
    if (!node) return;
    const update = () => setChartHostWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOpen, timeline]);

  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;

  const buckets = React.useMemo(
    () => buildBuckets(orders, timeline, rangeStart, rangeEnd),
    [orders, rangeEnd, rangeStart, timeline]
  );
  const maxValue = React.useMemo(() => Math.max(...buckets.map((bucket) => bucket.value), 0), [buckets]);
  const chartWidth = React.useMemo(() => Math.max(chartHostWidth, 320), [chartHostWidth]);
  const chartHeight = 280;
  const chartPadding = { top: 20, right: 16, bottom: 42, left: 16 };
  const innerWidth = Math.max(chartWidth - chartPadding.left - chartPadding.right, 1);
  const innerHeight = Math.max(chartHeight - chartPadding.top - chartPadding.bottom, 1);
  const points = React.useMemo(() => {
    if (!buckets.length) return [];
    return buckets.map((bucket, index) => {
      const x =
        chartPadding.left +
        (buckets.length === 1 ? innerWidth / 2 : (index / (buckets.length - 1)) * innerWidth);
      const y =
        chartPadding.top +
        (maxValue <= 0 ? innerHeight : innerHeight - (bucket.value / maxValue) * innerHeight);
      return { ...bucket, x, y };
    });
  }, [buckets, chartPadding.left, chartPadding.top, innerHeight, innerWidth, maxValue]);
  const linePath = React.useMemo(() => {
    if (!points.length) return "";
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
  }, [points]);
  const totalSales = React.useMemo(
    () => buckets.reduce((sum, bucket) => sum + bucket.value, 0),
    [buckets]
  );
  const totalOrders = orders.length;

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
            ANALYTICS
          </div>
        </div>
        <div style={{ ...styles.content, ...(isMobileViewport ? styles.contentMobile : null) }}>
          <div style={styles.summaryRow}>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Sales in view</div>
              <div style={styles.metricValue}>{formatMoney(totalSales)}</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Orders loaded</div>
              <div style={styles.metricValue}>{totalOrders}</div>
            </div>
          </div>
          <div ref={chartCardRef} style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <div style={styles.chartTitle}>Sales per {timeline}</div>
              <div style={styles.chartControls}>
                <div style={styles.rangeGroup}>
                  <input
                    type="date"
                    value={rangeStart}
                    max={rangeEnd}
                    min="2026-01-01"
                    onChange={(e) => setRangeStart(e.target.value)}
                    style={styles.dateInput}
                  />
                  <span style={styles.rangeDash}>to</span>
                  <input
                    type="date"
                    value={rangeEnd}
                    min={rangeStart}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    style={styles.dateInput}
                  />
                </div>
                <select
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value as Timeline)}
                  style={styles.timelineSelect}
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>
            </div>
            {buckets.length === 0 ? (
              <div style={styles.empty}>No sales data yet.</div>
            ) : (
              <div ref={chartHostRef} style={styles.chartScroll}>
                <div style={{ ...styles.chartWrap, width: chartWidth }}>
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    width={chartWidth}
                    height={chartHeight}
                    aria-label={`Sales per ${timeline} line chart`}
                    style={styles.chartSvg}
                  >
                    <line
                      x1={chartPadding.left}
                      y1={chartHeight - chartPadding.bottom}
                      x2={chartWidth - chartPadding.right}
                      y2={chartHeight - chartPadding.bottom}
                      style={styles.axisLine}
                    />
                    <path d={linePath} style={styles.linePath} />
                    {points.map((point, index) => {
                      const showTickLabel =
                        timeline === "day"
                          ? index === 0 || index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 8)) === 0
                          : index === 0 || index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 6)) === 0;
                      return (
                        <g key={`${point.label}-${index}`}>
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={6}
                            style={styles.pointHit}
                            onMouseEnter={(event) => {
                              const cardRect = chartCardRef.current?.getBoundingClientRect();
                              if (!cardRect) return;
                              setHoveredPoint({
                                x: event.clientX - cardRect.left,
                                y: event.clientY - cardRect.top,
                                label: point.fullLabel,
                                value: point.value,
                              });
                            }}
                            onMouseMove={(event) => {
                              const cardRect = chartCardRef.current?.getBoundingClientRect();
                              if (!cardRect) return;
                              setHoveredPoint({
                                x: event.clientX - cardRect.left,
                                y: event.clientY - cardRect.top,
                                label: point.fullLabel,
                                value: point.value,
                              });
                            }}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          <circle cx={point.x} cy={point.y} r={4} style={styles.pointDot} />
                          {point.value > 0 ? (
                            <text x={point.x} y={Math.max(14, point.y - 12)} textAnchor="middle" style={styles.valueText}>
                              {formatMoney(point.value)}
                            </text>
                          ) : null}
                          {showTickLabel ? (
                            <text
                              x={point.x}
                              y={chartHeight - 12}
                              textAnchor="middle"
                              style={styles.tickText}
                            >
                              {point.label}
                            </text>
                          ) : null}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
            {hoveredPoint ? (
              <div
                style={{
                  ...styles.tooltip,
                  left: Math.max(12, hoveredPoint.x - 50),
                  top: Math.max(56, hoveredPoint.y - 52),
                }}
              >
                <div style={styles.tooltipLabel}>{hoveredPoint.label}</div>
                <div style={styles.tooltipValue}>{formatMoney(hoveredPoint.value)}</div>
              </div>
            ) : null}
          </div>
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
    overflowY: "auto",
    padding: `6px 24px 48px ${BACK_BTN_W + TITLE_GAP}px`,
    color: "var(--tp-text-color)",
    display: "grid",
    gap: 18,
    alignContent: "start",
  },
  contentMobile: { padding: "8px 12px 20px" },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 240px))",
    gap: 14,
  },
  metricCard: {
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 12,
    background: "var(--tp-control-bg-soft)",
    padding: "14px 16px",
  },
  metricLabel: { fontSize: 13, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 },
  metricValue: { marginTop: 8, fontSize: 24, fontWeight: 900 },
  chartCard: {
    position: "relative",
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 12,
    background: "var(--tp-control-bg-soft)",
    padding: "16px 18px 18px",
  },
  chartHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  chartTitle: { fontSize: 18, fontWeight: 800, letterSpacing: 0.4 },
  chartControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    flexWrap: "wrap",
  },
  rangeGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  dateInput: {
    height: 36,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 12px",
    fontSize: 14,
  },
  rangeDash: {
    fontSize: 14,
    opacity: 0.72,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  timelineSelect: {
    height: 36,
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 12px",
    fontSize: 15,
    textTransform: "capitalize",
  },
  chartWrap: {
    minHeight: 280,
  },
  chartScroll: {
    width: "100%",
    overflow: "hidden",
    paddingBottom: 6,
  },
  chartSvg: {
    display: "block",
  },
  axisLine: {
    stroke: "rgba(255,255,255,0.24)",
    strokeWidth: 1,
  },
  linePath: {
    fill: "none",
    stroke: "#d4b268",
    strokeWidth: 3,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
  pointDot: {
    fill: "#d4b268",
    stroke: "rgba(0,0,0,0.35)",
    strokeWidth: 1,
  },
  pointHit: {
    fill: "transparent",
    cursor: "pointer",
  },
  valueText: {
    fill: "#d4b268",
    fontSize: 12,
    fontWeight: 700,
  },
  tickText: {
    fill: "rgba(255,255,255,0.82)",
    fontSize: 12,
  },
  tooltip: {
    position: "absolute",
    pointerEvents: "none",
    minWidth: 96,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.88)",
    color: "var(--tp-text-color)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.28)",
  },
  tooltipLabel: {
    fontSize: 12,
    opacity: 0.78,
    marginBottom: 4,
  },
  tooltipValue: {
    fontSize: 13,
    fontWeight: 800,
    color: "#d4b268",
  },
  empty: { padding: "20px 0 8px", opacity: 0.75 },
};
