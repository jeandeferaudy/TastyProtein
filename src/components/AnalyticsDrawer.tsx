"use client";

import * as React from "react";
import { AppButton, TOPBAR_FONT_SIZE, TOPBAR_FONT_SIZE_MOBILE } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  fetchProductSalesSeries,
  type OrderListItem,
  type ProductSalesSeriesItem,
} from "@/lib/ordersApi";

const BACK_BTN_W = 68;
const TITLE_GAP = 40;

type Timeline = "day" | "week" | "month";
type AnalyticsTab = "sales" | "purchases" | "inventory";

type Props = {
  isOpen: boolean;
  topOffset: number;
  onClose: () => void;
  orders: OrderListItem[];
  backgroundStyle?: React.CSSProperties;
};

type Bucket = {
  key: string;
  label: string;
  fullLabel: string;
  value: number;
};

type BucketTemplate = {
  key: string;
  label: string;
  fullLabel: string;
};

type ChartSeries = {
  id: string;
  label: string;
  color: string;
  valueType?: "money" | "count";
  values: number[];
  total: number;
};

type HoveredPoint = {
  x: number;
  y: number;
  bucketLabel: string;
  value: number;
  seriesLabel: string;
  color: string;
  valueType: "money" | "count";
};

type PurchaseMetricRow = {
  purchaseOrderId: string;
  productId: string;
  productName: string;
  date: Date;
  lineTotal: number;
  receivedValue: number;
};

type OrderLineMetricRow = {
  orderId: string;
  productId: string;
  productName: string;
  date: Date;
  lineTotal: number;
  lineProfit: number;
};

type InventoryStockRow = {
  productId: string;
  productName: string;
  qtyOnHand: number;
  productCost: number;
  sellingPrice: number;
};

type ProductSummary = {
  id: string;
  label: string;
  total: number;
};

type SummaryCard = {
  label: string;
  value: string;
  rows?: Array<{ label: string; value: string }>;
};

const PRODUCT_SERIES_COLORS = [
  "#d4b268",
  "#66c7ff",
  "#ff8a5b",
  "#8dd694",
  "#ff6f91",
  "#a78bfa",
  "#f4e285",
  "#5dd39e",
];
const TAB_OPTIONS: Array<{ id: AnalyticsTab; label: string }> = [
  { id: "sales", label: "Sales" },
  { id: "purchases", label: "Purchases" },
  { id: "inventory", label: "Inventory" },
];

function formatChartValue(value: number, type: "money" | "count") {
  return type === "count" ? String(Math.round(value)) : formatMoney(value);
}

type SalesProductMetricMode = "sales" | "orders" | "profit" | "all";
type SalesOverviewLineMode = "sales" | "orders" | "profit";
type InventoryValueMode = "cost" | "sales";

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getSalesMetricColor(productId: string, metricMode: SalesProductMetricMode) {
  const hue = hashString(productId || "product") % 360;
  const saturation = 76;
  let lightness = 66;
  if (metricMode === "orders") lightness = 58;
  if (metricMode === "profit") lightness = 72;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

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

function formatBucketKey(date: Date, timeline: Timeline) {
  if (timeline === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function buildBucketTemplates(
  timeline: Timeline,
  rangeStart: string,
  rangeEnd: string
): BucketTemplate[] {
  const startBoundary = new Date(`${rangeStart}T00:00:00`);
  const endBoundary = new Date(`${rangeEnd}T23:59:59`);
  if (Number.isNaN(startBoundary.getTime()) || Number.isNaN(endBoundary.getTime()) || startBoundary > endBoundary) {
    return [];
  }

  if (timeline === "day") {
    const buckets: BucketTemplate[] = [];
    const start = new Date(startBoundary);
    start.setHours(0, 0, 0, 0);
    for (let date = new Date(start); date <= endBoundary; date.setDate(date.getDate() + 1)) {
      const next = new Date(date);
      next.setHours(0, 0, 0, 0);
      buckets.push({
        key: formatBucketKey(next, "day"),
        label: next.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
        fullLabel: next.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
      });
    }
    return buckets;
  }

  if (timeline === "week") {
    const buckets: BucketTemplate[] = [];
    const start = startOfWeek(startBoundary);
    const currentWeek = startOfWeek(endBoundary);
    for (let date = new Date(start); date <= currentWeek; date.setDate(date.getDate() + 7)) {
      const next = new Date(date);
      const weekEnd = new Date(next);
      weekEnd.setDate(next.getDate() + 6);
      buckets.push({
        key: formatBucketKey(next, "week"),
        label: next.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
        fullLabel: `${next.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`,
      });
    }
    return buckets;
  }

  const buckets: BucketTemplate[] = [];
  const start = new Date(startBoundary.getFullYear(), startBoundary.getMonth(), 1);
  const end = new Date(endBoundary.getFullYear(), endBoundary.getMonth(), 1);
  for (let date = new Date(start); date <= end; date.setMonth(date.getMonth() + 1)) {
    const next = new Date(date);
    buckets.push({
      key: formatBucketKey(next, "month"),
      label: next.toLocaleDateString("en-PH", { month: "short", year: "2-digit" }),
      fullLabel: next.toLocaleDateString("en-PH", { year: "numeric", month: "long" }),
    });
  }
  return buckets;
}

function buildBuckets(
  orders: OrderListItem[],
  timeline: Timeline,
  rangeStart: string,
  rangeEnd: string
): Bucket[] {
  const templates = buildBucketTemplates(timeline, rangeStart, rangeEnd);
  if (!templates.length) return [];
  const salesByKey = new Map<string, number>();
  const startBoundary = new Date(`${rangeStart}T00:00:00`);
  const endBoundary = new Date(`${rangeEnd}T23:59:59`);

  for (const order of orders) {
    const date = new Date(order.created_at);
    if (Number.isNaN(date.getTime())) continue;
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    if (date < startBoundary || date > endBoundary) continue;
    const key =
      timeline === "week"
        ? formatBucketKey(startOfWeek(date), "week")
        : formatBucketKey(timeline === "month" ? new Date(date.getFullYear(), date.getMonth(), 1) : dateOnly, timeline);
    salesByKey.set(key, (salesByKey.get(key) ?? 0) + Number(order.total_selling_price ?? 0));
  }

  return templates.map((bucket) => ({
    ...bucket,
    value: salesByKey.get(bucket.key) ?? 0,
  }));
}

function isDateInRange(date: Date, rangeStart: string, rangeEnd: string) {
  const startBoundary = new Date(`${rangeStart}T00:00:00`);
  const endBoundary = new Date(`${rangeEnd}T23:59:59`);
  return !Number.isNaN(date.getTime()) && date >= startBoundary && date <= endBoundary;
}

function bucketKeyForDate(date: Date, timeline: Timeline) {
  if (timeline === "week") return formatBucketKey(startOfWeek(date), "week");
  if (timeline === "month") return formatBucketKey(new Date(date.getFullYear(), date.getMonth(), 1), "month");
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  return formatBucketKey(dateOnly, "day");
}

function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function LineChartCard({
  title,
  buckets,
  series,
  emptyMessage,
  showValueLabels = false,
  normalizeEachSeries = false,
  children,
}: {
  title: string;
  buckets: BucketTemplate[];
  series: ChartSeries[];
  emptyMessage: string;
  showValueLabels?: boolean;
  normalizeEachSeries?: boolean;
  children?: React.ReactNode;
}) {
  const [chartHostRef, chartHostWidth] = useElementWidth<HTMLDivElement>();
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = React.useState<HoveredPoint | null>(null);

  const chartWidth = React.useMemo(() => Math.max(chartHostWidth, 320), [chartHostWidth]);
  const chartHeight = 280;
  const chartPadding = { top: 20, right: 16, bottom: 42, left: 16 };
  const innerWidth = Math.max(chartWidth - chartPadding.left - chartPadding.right, 1);
  const innerHeight = Math.max(chartHeight - chartPadding.top - chartPadding.bottom, 1);
  const maxValue = React.useMemo(
    () => Math.max(0, ...series.flatMap((item) => item.values)),
    [series]
  );
  const seriesMaxById = React.useMemo(
    () => new Map(series.map((item) => [item.id, Math.max(0, ...item.values)])),
    [series]
  );

  const renderedSeries = React.useMemo(
    () =>
      series.map((item, seriesIndex) => {
        const points = buckets.map((bucket, index) => {
          const value = item.values[index] ?? 0;
          const x =
            chartPadding.left +
            (buckets.length === 1 ? innerWidth / 2 : (index / Math.max(buckets.length - 1, 1)) * innerWidth);
          const seriesMax = normalizeEachSeries ? seriesMaxById.get(item.id) ?? 0 : maxValue;
          const baseY =
            chartPadding.top +
            (seriesMax <= 0 ? innerHeight : innerHeight - (value / seriesMax) * innerHeight);
          const laneOffset =
            normalizeEachSeries && series.length > 1
              ? (seriesIndex - (series.length - 1) / 2) * 10
              : 0;
          const y = Math.min(
            chartPadding.top + innerHeight - 6,
            Math.max(chartPadding.top + 6, baseY + laneOffset)
          );
          return { ...bucket, value, x, y, seriesIndex };
        });
        const path = points
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
          .join(" ");
        return { ...item, points, path };
      }),
    [buckets, chartPadding.left, chartPadding.top, innerHeight, innerWidth, maxValue, normalizeEachSeries, series, seriesMaxById]
  );

  const hasData = series.length > 0 && series.some((item) => item.total > 0);

  return (
    <div ref={cardRef} style={styles.chartCard}>
      <div style={styles.chartHeader}>
        <div style={styles.chartTitle}>{title}</div>
      </div>
      {children}
      {!hasData || buckets.length === 0 ? (
        <div style={styles.empty}>{emptyMessage}</div>
      ) : (
        <div ref={chartHostRef} style={styles.chartScroll}>
          <div style={{ ...styles.chartWrap, width: chartWidth }}>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              width={chartWidth}
              height={chartHeight}
              aria-label={`${title} line chart`}
              style={styles.chartSvg}
            >
              <line
                x1={chartPadding.left}
                y1={chartHeight - chartPadding.bottom}
                x2={chartWidth - chartPadding.right}
                y2={chartHeight - chartPadding.bottom}
                style={styles.axisLine}
              />
              {renderedSeries.map((item) => (
                <path key={item.id} d={item.path} style={{ ...styles.linePath, stroke: item.color }} />
              ))}
              {renderedSeries.flatMap((item) =>
                item.points.map((point, index) => {
                  const showTickLabel =
                    index === 0 ||
                    index === item.points.length - 1 ||
                    index % Math.max(1, Math.ceil(item.points.length / (buckets.length > 16 ? 8 : 6))) === 0;
                  const labelOffset =
                    normalizeEachSeries && series.length > 1
                      ? (point.seriesIndex - (series.length - 1) / 2) * 11
                      : 0;
                  return (
                    <g key={`${item.id}-${point.key}`}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={6}
                        style={styles.pointHit}
                        onMouseEnter={(event) => {
                          const cardRect = cardRef.current?.getBoundingClientRect();
                          if (!cardRect) return;
                          setHoveredPoint({
                            x: event.clientX - cardRect.left,
                            y: event.clientY - cardRect.top,
                            bucketLabel: point.fullLabel,
                            value: point.value,
                            seriesLabel: item.label,
                            color: item.color,
                            valueType: item.valueType ?? "money",
                          });
                        }}
                        onMouseMove={(event) => {
                          const cardRect = cardRef.current?.getBoundingClientRect();
                          if (!cardRect) return;
                          setHoveredPoint({
                            x: event.clientX - cardRect.left,
                            y: event.clientY - cardRect.top,
                            bucketLabel: point.fullLabel,
                            value: point.value,
                            seriesLabel: item.label,
                            color: item.color,
                            valueType: item.valueType ?? "money",
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                      <circle cx={point.x} cy={point.y} r={4} style={{ ...styles.pointDot, fill: item.color }} />
                      {showValueLabels && point.value > 0 ? (
                        <text
                          x={point.x}
                          y={Math.max(14, point.y - 12 + labelOffset)}
                          textAnchor="middle"
                          style={{ ...styles.valueText, fill: item.color }}
                        >
                          {formatChartValue(point.value, item.valueType ?? "money")}
                        </text>
                      ) : null}
                      {showTickLabel && item.id === renderedSeries[0]?.id ? (
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
                })
              )}
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
          <div style={{ ...styles.tooltipValue, color: hoveredPoint.color }}>{hoveredPoint.seriesLabel}</div>
          <div style={styles.tooltipLabel}>{hoveredPoint.bucketLabel}</div>
          <div style={{ ...styles.tooltipValue, color: hoveredPoint.color }}>
            {formatChartValue(hoveredPoint.value, hoveredPoint.valueType)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProductComparisonChartCard({
  title,
  buckets,
  series,
  emptyMessage,
  children,
  isMobileViewport,
}: {
  title: string;
  buckets: BucketTemplate[];
  series: ChartSeries[];
  emptyMessage: string;
  children?: React.ReactNode;
  isMobileViewport: boolean;
}) {
  const [barHostRef, barHostWidth] = useElementWidth<HTMLDivElement>();
  const [linePaneRef, linePaneWidth] = useElementWidth<HTMLDivElement>();
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = React.useState<HoveredPoint | null>(null);
  const [hoveredBar, setHoveredBar] = React.useState<HoveredPoint | null>(null);
  const activeHover = hoveredBar ?? hoveredPoint;

  const hasData = series.length > 0 && series.some((item) => item.total > 0);

  const lineChartWidth = React.useMemo(
    () => Math.max(linePaneWidth, isMobileViewport ? 320 : 420),
    [isMobileViewport, linePaneWidth]
  );
  const chartHeight = 280;
  const chartPadding = { top: 20, right: 16, bottom: 42, left: 16 };
  const innerWidth = Math.max(lineChartWidth - chartPadding.left - chartPadding.right, 1);
  const innerHeight = Math.max(chartHeight - chartPadding.top - chartPadding.bottom, 1);
  const maxValue = React.useMemo(
    () => Math.max(0, ...series.flatMap((item) => item.values)),
    [series]
  );
  const renderedSeries = React.useMemo(
    () =>
      series.map((item) => {
        const points = buckets.map((bucket, index) => {
          const value = item.values[index] ?? 0;
          const x =
            chartPadding.left +
            (buckets.length === 1 ? innerWidth / 2 : (index / Math.max(buckets.length - 1, 1)) * innerWidth);
          const y =
            chartPadding.top +
            (maxValue <= 0 ? innerHeight : innerHeight - (value / maxValue) * innerHeight);
          return { ...bucket, value, x, y };
        });
        const path = points
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
          .join(" ");
        return { ...item, points, path };
      }),
    [buckets, chartPadding.left, chartPadding.top, innerHeight, innerWidth, maxValue, series]
  );

  const barChartWidth = React.useMemo(
    () => Math.max(barHostWidth, isMobileViewport ? 320 : 260),
    [barHostWidth, isMobileViewport]
  );
  const barChartHeight = 280;
  const barPadding = { top: 22, right: 14, bottom: 42, left: 14 };
  const barInnerWidth = Math.max(barChartWidth - barPadding.left - barPadding.right, 1);
  const barInnerHeight = Math.max(barChartHeight - barPadding.top - barPadding.bottom, 1);
  const maxBarValue = React.useMemo(() => Math.max(0, ...series.map((item) => item.total)), [series]);
  const barSlotWidth = series.length ? barInnerWidth / series.length : barInnerWidth;
  const barWidth = Math.max(18, Math.min(40, barSlotWidth * 0.58));

  return (
    <div ref={cardRef} style={styles.chartCard}>
      <div style={styles.chartHeader}>
        <div style={styles.chartTitle}>{title}</div>
      </div>
      {children}
      {!hasData || buckets.length === 0 ? (
        <div style={styles.empty}>{emptyMessage}</div>
      ) : (
        <div
          style={{
            ...styles.productChartGrid,
            ...(isMobileViewport ? styles.productChartGridMobile : null),
          }}
        >
          <div style={styles.productChartPane}>
            <div style={styles.subchartTitle}>Totals by product</div>
            <div ref={barHostRef} style={styles.productChartScroll}>
              <div style={{ ...styles.chartWrap, width: barChartWidth }}>
                <svg
                  viewBox={`0 0 ${barChartWidth} ${barChartHeight}`}
                  width={barChartWidth}
                  height={barChartHeight}
                  aria-label={`${title} totals chart`}
                  style={styles.chartSvg}
                >
                  <line
                    x1={barPadding.left}
                    y1={barChartHeight - barPadding.bottom}
                    x2={barChartWidth - barPadding.right}
                    y2={barChartHeight - barPadding.bottom}
                    style={styles.axisLine}
                  />
                  {series.map((item, index) => {
                    const barHeight =
                      maxBarValue <= 0 ? 0 : Math.max(2, (item.total / maxBarValue) * barInnerHeight);
                    const x = barPadding.left + index * barSlotWidth + (barSlotWidth - barWidth) / 2;
                    const y = barChartHeight - barPadding.bottom - barHeight;
                    return (
                      <g key={item.id}>
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          rx={8}
                          ry={8}
                          style={{ fill: item.color, cursor: "pointer" }}
                          onMouseEnter={(event) => {
                            const cardRect = cardRef.current?.getBoundingClientRect();
                            if (!cardRect) return;
                            setHoveredBar({
                              x: event.clientX - cardRect.left,
                              y: event.clientY - cardRect.top,
                              bucketLabel: "Entire range",
                              value: item.total,
                              seriesLabel: item.label,
                              color: item.color,
                              valueType: item.valueType ?? "money",
                            });
                          }}
                          onMouseMove={(event) => {
                            const cardRect = cardRef.current?.getBoundingClientRect();
                            if (!cardRect) return;
                            setHoveredBar({
                              x: event.clientX - cardRect.left,
                              y: event.clientY - cardRect.top,
                              bucketLabel: "Entire range",
                              value: item.total,
                              seriesLabel: item.label,
                              color: item.color,
                              valueType: item.valueType ?? "money",
                            });
                          }}
                          onMouseLeave={() => setHoveredBar(null)}
                        />
                        <text
                          x={x + barWidth / 2}
                          y={Math.max(14, y - 10)}
                          textAnchor="middle"
                          style={{ ...styles.valueText, fill: item.color }}
                        >
                          {formatChartValue(item.total, item.valueType ?? "money")}
                        </text>
                        <text
                          x={x + barWidth / 2}
                          y={barChartHeight - 12}
                          textAnchor="middle"
                          style={styles.tickText}
                        >
                          {String(index + 1)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
          <div ref={linePaneRef} style={styles.productChartPane}>
            <div style={styles.subchartTitle}>Sales trend</div>
            <div style={styles.productChartScroll}>
              <div style={{ ...styles.chartWrap, width: lineChartWidth }}>
                <svg
                  viewBox={`0 0 ${lineChartWidth} ${chartHeight}`}
                  width={lineChartWidth}
                  height={chartHeight}
                  aria-label={`${title} trend chart`}
                  style={styles.chartSvg}
                >
                  <line
                    x1={chartPadding.left}
                    y1={chartHeight - chartPadding.bottom}
                    x2={lineChartWidth - chartPadding.right}
                    y2={chartHeight - chartPadding.bottom}
                    style={styles.axisLine}
                  />
                  {renderedSeries.map((item) => (
                    <path key={item.id} d={item.path} style={{ ...styles.linePath, stroke: item.color }} />
                  ))}
                  {renderedSeries.flatMap((item) =>
                    item.points.map((point, index) => {
                      const showTickLabel =
                        index === 0 ||
                        index === item.points.length - 1 ||
                        index % Math.max(1, Math.ceil(item.points.length / (buckets.length > 16 ? 8 : 6))) === 0;
                      return (
                        <g key={`${item.id}-${point.key}`}>
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={6}
                            style={styles.pointHit}
                            onMouseEnter={(event) => {
                              const cardRect = cardRef.current?.getBoundingClientRect();
                              if (!cardRect) return;
                              setHoveredPoint({
                                x: event.clientX - cardRect.left,
                                y: event.clientY - cardRect.top,
                                bucketLabel: point.fullLabel,
                                value: point.value,
                                seriesLabel: item.label,
                                color: item.color,
                                valueType: item.valueType ?? "money",
                              });
                            }}
                            onMouseMove={(event) => {
                              const cardRect = cardRef.current?.getBoundingClientRect();
                              if (!cardRect) return;
                              setHoveredPoint({
                                x: event.clientX - cardRect.left,
                                y: event.clientY - cardRect.top,
                                bucketLabel: point.fullLabel,
                                value: point.value,
                                seriesLabel: item.label,
                                color: item.color,
                                valueType: item.valueType ?? "money",
                              });
                            }}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          <circle cx={point.x} cy={point.y} r={4} style={{ ...styles.pointDot, fill: item.color }} />
                          {showTickLabel && item.id === renderedSeries[0]?.id ? (
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
                    })
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeHover ? (
        <div
          style={{
            ...styles.tooltip,
            left: Math.max(12, activeHover.x - 50),
            top: Math.max(56, activeHover.y - 52),
          }}
        >
          <div style={{ ...styles.tooltipValue, color: activeHover.color }}>{activeHover.seriesLabel}</div>
          <div style={styles.tooltipLabel}>{activeHover.bucketLabel}</div>
          <div style={{ ...styles.tooltipValue, color: activeHover.color }}>
            {formatChartValue(activeHover.value, activeHover.valueType)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InventorySnapshotChartCard({
  title,
  rows,
  valueMode,
  onChangeValueMode,
}: {
  title: string;
  rows: Array<{ id: string; label: string; value: number; color: string }>;
  valueMode: InventoryValueMode;
  onChangeValueMode: (mode: InventoryValueMode) => void;
}) {
  const [hostRef, hostWidth] = useElementWidth<HTMLDivElement>();
  const chartHeight = 330;
  const padding = { top: 22, right: 18, bottom: 86, left: 18 };
  const widthFromBars = rows.length * 132;
  const chartWidth = Math.max(hostWidth, Math.max(520, widthFromBars));
  const innerWidth = Math.max(chartWidth - padding.left - padding.right, 1);
  const innerHeight = Math.max(chartHeight - padding.top - padding.bottom, 1);
  const maxValue = Math.max(0, ...rows.map((row) => row.value));
  const slotWidth = rows.length ? innerWidth / rows.length : innerWidth;
  const barWidth = Math.max(26, Math.min(62, slotWidth * 0.55));

  return (
    <div style={styles.chartCard}>
      <div style={styles.chartHeader}>
        <div style={styles.chartTitle}>{title}</div>
        <select
          value={valueMode}
          onChange={(e) => onChangeValueMode(e.target.value as InventoryValueMode)}
          style={styles.timelineSelect}
        >
          <option value="cost">Cost</option>
          <option value="sales">Sales</option>
        </select>
      </div>
      {rows.length === 0 ? (
        <div style={styles.empty}>No inventory rows yet.</div>
      ) : (
        <div ref={hostRef} style={styles.chartScroll}>
          <div style={{ ...styles.chartWrap, width: chartWidth }}>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              width={chartWidth}
              height={chartHeight}
              aria-label={`${title} bar chart`}
              style={styles.chartSvg}
            >
              <line
                x1={padding.left}
                y1={chartHeight - padding.bottom}
                x2={chartWidth - padding.right}
                y2={chartHeight - padding.bottom}
                style={styles.axisLine}
              />
              {rows.map((row, index) => {
                const barHeight = maxValue <= 0 ? 0 : Math.max(2, (row.value / maxValue) * innerHeight);
                const x = padding.left + index * slotWidth + (slotWidth - barWidth) / 2;
                const y = chartHeight - padding.bottom - barHeight;
                const labelX = x + barWidth / 2;
                const labelY = chartHeight - padding.bottom + 14;
                return (
                  <g key={row.id}>
                    <rect x={x} y={y} width={barWidth} height={barHeight} rx={8} ry={8} style={{ fill: row.color }} />
                    <text
                      x={labelX}
                      y={Math.max(14, y - 10)}
                      textAnchor="middle"
                      style={{ ...styles.valueText, fill: row.color }}
                    >
                      {formatMoney(row.value)}
                    </text>
                    <text
                      x={labelX}
                      y={labelY}
                      transform={`rotate(45 ${labelX} ${labelY})`}
                      textAnchor="start"
                      style={styles.tickText}
                    >
                      {row.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsDrawer({
  isOpen,
  topOffset,
  onClose,
  orders,
  backgroundStyle,
}: Props) {
  const [activeTab, setActiveTab] = React.useState<AnalyticsTab>("sales");
  const [timeline, setTimeline] = React.useState<Timeline>("week");
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const [rangeStart, setRangeStart] = React.useState("2026-01-01");
  const [rangeEnd, setRangeEnd] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  });
  const [productSeriesRows, setProductSeriesRows] = React.useState<ProductSalesSeriesItem[]>([]);
  const [productSeriesLoading, setProductSeriesLoading] = React.useState(false);
  const [productSeriesError, setProductSeriesError] = React.useState<string | null>(null);
  const [purchaseMetricRows, setPurchaseMetricRows] = React.useState<PurchaseMetricRow[]>([]);
  const [purchaseMetricsLoading, setPurchaseMetricsLoading] = React.useState(false);
  const [purchaseMetricsError, setPurchaseMetricsError] = React.useState<string | null>(null);
  const [inventoryStockRows, setInventoryStockRows] = React.useState<InventoryStockRow[]>([]);
  const [orderLineMetricRows, setOrderLineMetricRows] = React.useState<OrderLineMetricRow[]>([]);
  const [productQuery, setProductQuery] = React.useState("");
  const [salesProductMetricMode, setSalesProductMetricMode] = React.useState<SalesProductMetricMode>("sales");
  const [salesOverviewLineMode, setSalesOverviewLineMode] = React.useState<SalesOverviewLineMode>("sales");
  const [inventoryValueMode, setInventoryValueMode] = React.useState<InventoryValueMode>("cost");
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [hasCustomizedProductSelection, setHasCustomizedProductSelection] = React.useState(false);

  React.useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = async () => {
      setProductSeriesLoading(true);
      setProductSeriesError(null);
      try {
        const rows = await fetchProductSalesSeries({ rangeStart, rangeEnd, timeline });
        if (cancelled) return;
        setProductSeriesRows(rows);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load product sales series", error);
        setProductSeriesRows([]);
        setProductSeriesError("Product sales data could not be loaded.");
      } finally {
        if (!cancelled) setProductSeriesLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, rangeEnd, rangeStart, timeline]);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadPurchases = async () => {
      setPurchaseMetricsLoading(true);
      setPurchaseMetricsError(null);
      try {
        const { data, error } = await supabase
          .from("purchase_order_lines")
          .select(
            "purchase_order_id,product_id,name_snapshot,long_name_snapshot,unit_price,qty,received_qty,line_total,created_at,purchase_orders(created_at,delivery_date)"
          )
          .order("created_at", { ascending: false })
          .limit(5000);
        if (error) throw error;
        if (cancelled) return;

        const rows: PurchaseMetricRow[] = (data ?? []).map((row: any) => {
          const parent = Array.isArray(row.purchase_orders)
            ? row.purchase_orders[0] ?? {}
            : row.purchase_orders ?? {};
          const rawDate = parent.delivery_date ?? parent.created_at ?? row.created_at ?? null;
          const date = rawDate ? new Date(String(rawDate)) : new Date(NaN);
          const unitPrice = Number(row.unit_price ?? 0);
          const receivedQty = Math.max(0, Number(row.received_qty ?? 0));
          return {
            purchaseOrderId: String(row.purchase_order_id ?? ""),
            productId: String(row.product_id ?? ""),
            productName: String(row.long_name_snapshot ?? row.name_snapshot ?? "Item"),
            date,
            lineTotal: Number(row.line_total ?? 0),
            receivedValue: unitPrice * receivedQty,
          };
        });
        setPurchaseMetricRows(rows);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load purchase metrics", error);
        setPurchaseMetricRows([]);
        setPurchaseMetricsError("Purchase data could not be loaded.");
      } finally {
        if (!cancelled) setPurchaseMetricsLoading(false);
      }
    };

    void loadPurchases();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadOrderLines = async () => {
      try {
        const selectAttempts = [
          "order_id,product_id,name_snapshot,long_name_snapshot,qty,line_total,line_profit,cost_snapshot,created_at",
          "order_id,product_id,name_snapshot,long_name_snapshot,qty,line_total,created_at",
          "order_id,product_id,name_snapshot,long_name_snapshot,qty,line_total,line_profit,cost_snapshot",
          "order_id,product_id,name_snapshot,long_name_snapshot,qty,line_total",
        ];

        let data: any[] | null = null;
        let error: any = null;
        for (const selectExpr of selectAttempts) {
          const attempt = await supabase.from("order_lines").select(selectExpr).limit(10000);
          if (!attempt.error) {
            data = (attempt.data as any[]) ?? [];
            error = null;
            break;
          }
          error = attempt.error;
        }

        if (error) throw error;
        if (cancelled) return;

        const orderIds = [...new Set((data ?? []).map((row: any) => String(row.order_id ?? "")).filter(Boolean))];
        const orderDateById = new Map<string, string>();
        if (orderIds.length > 0) {
          const { data: orderRows } = await supabase
            .from("orders")
            .select("id,created_at")
            .in("id", orderIds);
          for (const orderRow of orderRows ?? []) {
            const id = String((orderRow as any).id ?? "");
            const createdAt = String((orderRow as any).created_at ?? "");
            if (id && createdAt) orderDateById.set(id, createdAt);
          }
        }

        const rows: OrderLineMetricRow[] = (data ?? []).map((row: any) => {
          const rawDate = row.created_at ?? orderDateById.get(String(row.order_id ?? "")) ?? null;
          const date = rawDate ? new Date(String(rawDate)) : new Date(NaN);
          const qty = Math.max(0, Number(row.qty ?? 0));
          const lineTotal = Number(row.line_total ?? 0);
          const lineProfitRaw =
            row.line_profit === null || row.line_profit === undefined
              ? Math.max(0, lineTotal - Math.max(0, Number(row.cost_snapshot ?? 0)) * qty)
              : Math.max(0, Number(row.line_profit));
          return {
            orderId: String(row.order_id ?? ""),
            productId: String(row.product_id ?? ""),
            productName: String(row.long_name_snapshot ?? row.name_snapshot ?? "Item"),
            date,
            lineTotal,
            lineProfit: lineProfitRaw,
          };
        });
        setOrderLineMetricRows(rows);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load order line metrics", error);
        setOrderLineMetricRows([]);
      }
    };

    void loadOrderLines();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadInventoryStock = async () => {
      try {
        const { data, error } = await supabase
          .from("inventory")
          .select("product_id,qty_on_hand,products(id,name,long_name,product_cost,selling_price)")
          .limit(5000);
        if (error) throw error;
        if (cancelled) return;
        const rows: InventoryStockRow[] = (data ?? []).map((row: any) => {
          const product = Array.isArray(row.products) ? row.products[0] ?? {} : row.products ?? {};
          return {
            productId: String(row.product_id ?? product.id ?? ""),
            productName: String(product.long_name ?? product.name ?? "Item"),
            qtyOnHand: Math.max(0, Number(row.qty_on_hand ?? 0)),
            productCost: Math.max(0, Number(product.product_cost ?? 0)),
            sellingPrice: Math.max(0, Number(product.selling_price ?? 0)),
          };
        });
        setInventoryStockRows(rows);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load inventory stock valuation", error);
        setInventoryStockRows([]);
      }
    };

    void loadInventoryStock();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const panelTop = Math.max(topOffset, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;
  const bucketTemplates = React.useMemo(
    () => buildBucketTemplates(timeline, rangeStart, rangeEnd),
    [rangeEnd, rangeStart, timeline]
  );

  const buckets = React.useMemo(
    () => buildBuckets(orders, timeline, rangeStart, rangeEnd),
    [orders, rangeEnd, rangeStart, timeline]
  );
  const bucketIndexByKey = React.useMemo(
    () => new Map(bucketTemplates.map((bucket, index) => [bucket.key, index])),
    [bucketTemplates]
  );

  const salesSummaryValue = React.useMemo(() => buckets.reduce((sum, bucket) => sum + bucket.value, 0), [buckets]);
  const salesOrdersCount = React.useMemo(() => {
    return orders.filter((order) => isDateInRange(new Date(order.created_at), rangeStart, rangeEnd)).length;
  }, [orders, rangeEnd, rangeStart]);
  const salesLast30 = React.useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    let sales = 0;
    let count = 0;
    for (const order of orders) {
      const d = new Date(order.created_at);
      if (Number.isNaN(d.getTime())) continue;
      if (d < start || d > end) continue;
      sales += Number(order.total_selling_price ?? 0);
      count += 1;
    }
    return { sales, count };
  }, [orders]);
  const salesLast7 = React.useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    let sales = 0;
    let count = 0;
    for (const order of orders) {
      const d = new Date(order.created_at);
      if (Number.isNaN(d.getTime())) continue;
      if (d < start || d > end) continue;
      sales += Number(order.total_selling_price ?? 0);
      count += 1;
    }
    return { sales, count };
  }, [orders]);
  const salesLineValues = React.useMemo(() => buckets.map((bucket) => bucket.value), [buckets]);
  const salesOrderCountValues = React.useMemo(() => {
    const values = bucketTemplates.map(() => 0);
    for (const order of orders) {
      const d = new Date(order.created_at);
      if (!isDateInRange(d, rangeStart, rangeEnd)) continue;
      const idx = bucketIndexByKey.get(bucketKeyForDate(d, timeline));
      if (idx === undefined) continue;
      values[idx] += 1;
    }
    return values;
  }, [bucketIndexByKey, bucketTemplates, orders, rangeEnd, rangeStart, timeline]);

  const salesProductBucketsById = React.useMemo(() => {
    const byProduct = new Map<string, number[]>();
    const labelsByProduct = new Map<string, string>();
    for (const row of productSeriesRows) {
      const id = String(row.product_id ?? "");
      if (!id) continue;
      const index = bucketIndexByKey.get(String(row.bucket_key ?? ""));
      if (index === undefined) continue;
      const values = byProduct.get(id) ?? bucketTemplates.map(() => 0);
      values[index] += Number(row.sales_total ?? 0);
      byProduct.set(id, values);
      labelsByProduct.set(id, String(row.product_name ?? labelsByProduct.get(id) ?? "Item"));
    }
    return { byProduct, labelsByProduct };
  }, [bucketIndexByKey, bucketTemplates, productSeriesRows]);

  const purchasesInRange = React.useMemo(
    () => purchaseMetricRows.filter((row) => isDateInRange(row.date, rangeStart, rangeEnd)),
    [purchaseMetricRows, rangeEnd, rangeStart]
  );

  const purchaseLineValues = React.useMemo(() => {
    const values = bucketTemplates.map(() => 0);
    for (const row of purchasesInRange) {
      const idx = bucketIndexByKey.get(bucketKeyForDate(row.date, timeline));
      if (idx === undefined) continue;
      values[idx] += row.lineTotal;
    }
    return values;
  }, [bucketIndexByKey, bucketTemplates, purchasesInRange, timeline]);

  const inventoryInboundValues = React.useMemo(() => {
    const values = bucketTemplates.map(() => 0);
    for (const row of purchasesInRange) {
      const idx = bucketIndexByKey.get(bucketKeyForDate(row.date, timeline));
      if (idx === undefined) continue;
      values[idx] += row.receivedValue;
    }
    return values;
  }, [bucketIndexByKey, bucketTemplates, purchasesInRange, timeline]);

  const profitValues = React.useMemo(() => {
    const values = bucketTemplates.map(() => 0);
    for (const row of orderLineMetricRows) {
      if (!isDateInRange(row.date, rangeStart, rangeEnd)) continue;
      const idx = bucketIndexByKey.get(bucketKeyForDate(row.date, timeline));
      if (idx === undefined) continue;
      values[idx] += Math.max(0, Number(row.lineProfit ?? 0));
    }
    return values;
  }, [bucketIndexByKey, bucketTemplates, orderLineMetricRows, rangeEnd, rangeStart, timeline]);
  const salesProfitInView = React.useMemo(
    () => profitValues.reduce((sum, value) => sum + value, 0),
    [profitValues]
  );
  const salesProfitLast30 = React.useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return orderLineMetricRows.reduce((sum, row) => {
      if (Number.isNaN(row.date.getTime()) || row.date < start || row.date > end) return sum;
      return sum + Math.max(0, Number(row.lineProfit ?? 0));
    }, 0);
  }, [orderLineMetricRows]);
  const salesProfitLast7 = React.useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return orderLineMetricRows.reduce((sum, row) => {
      if (Number.isNaN(row.date.getTime()) || row.date < start || row.date > end) return sum;
      return sum + Math.max(0, Number(row.lineProfit ?? 0));
    }, 0);
  }, [orderLineMetricRows]);

  const latestInboundValue = React.useMemo(() => {
    const byPurchaseId = new Map<string, { date: Date; total: number }>();
    for (const row of purchaseMetricRows) {
      if (row.receivedValue <= 0 || Number.isNaN(row.date.getTime())) continue;
      const prev = byPurchaseId.get(row.purchaseOrderId) ?? { date: row.date, total: 0 };
      if (row.date > prev.date) prev.date = row.date;
      prev.total += row.receivedValue;
      byPurchaseId.set(row.purchaseOrderId, prev);
    }
    let latest: { date: Date; total: number } | null = null;
    for (const entry of byPurchaseId.values()) {
      if (!latest || entry.date > latest.date) latest = entry;
    }
    return latest?.total ?? 0;
  }, [purchaseMetricRows]);

  const stockCostValue = React.useMemo(
    () =>
      inventoryStockRows.reduce(
        (sum, row) => sum + Math.max(0, Number(row.qtyOnHand ?? 0)) * Math.max(0, Number(row.productCost ?? 0)),
        0
      ),
    [inventoryStockRows]
  );

  const stockSalesValue = React.useMemo(
    () =>
      inventoryStockRows.reduce(
        (sum, row) => sum + Math.max(0, Number(row.qtyOnHand ?? 0)) * Math.max(0, Number(row.sellingPrice ?? 0)),
        0
      ),
    [inventoryStockRows]
  );

  const stockSittingProfit = React.useMemo(
    () => stockSalesValue - stockCostValue,
    [stockCostValue, stockSalesValue]
  );
  const inventorySnapshotRows = React.useMemo(() => {
    const mode: InventoryValueMode = inventoryValueMode;
    const rows = inventoryStockRows
      .map((row, index) => {
        const valuePerUnit = mode === "sales" ? row.sellingPrice : row.productCost;
        const value = Math.max(0, Number(row.qtyOnHand ?? 0)) * Math.max(0, Number(valuePerUnit ?? 0));
        return {
          id: row.productId || `${row.productName}-${index}`,
          label: row.productName || "Item",
          value,
        };
      })
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    return rows.map((row) => ({
      ...row,
      color: getSalesMetricColor(row.id, "sales"),
    }));
  }, [inventoryStockRows, inventoryValueMode]);

  const purchaseOrdersCount = React.useMemo(
    () => new Set(purchasesInRange.map((row) => row.purchaseOrderId)).size,
    [purchasesInRange]
  );

  const purchasesByProduct = React.useMemo(() => {
    const byProduct = new Map<string, number[]>();
    const labelsByProduct = new Map<string, string>();
    for (const row of purchasesInRange) {
      if (!row.productId) continue;
      const idx = bucketIndexByKey.get(bucketKeyForDate(row.date, timeline));
      if (idx === undefined) continue;
      const values = byProduct.get(row.productId) ?? bucketTemplates.map(() => 0);
      values[idx] += row.lineTotal;
      byProduct.set(row.productId, values);
      labelsByProduct.set(row.productId, row.productName || labelsByProduct.get(row.productId) || "Item");
    }
    return { byProduct, labelsByProduct };
  }, [bucketIndexByKey, bucketTemplates, purchasesInRange, timeline]);

  const inventoryByProduct = React.useMemo(() => {
    const byProduct = new Map<string, number[]>();
    const labelsByProduct = new Map<string, string>();
    for (const row of purchasesInRange) {
      if (!row.productId) continue;
      const idx = bucketIndexByKey.get(bucketKeyForDate(row.date, timeline));
      if (idx === undefined) continue;
      const values = byProduct.get(row.productId) ?? bucketTemplates.map(() => 0);
      values[idx] += row.receivedValue;
      byProduct.set(row.productId, values);
      labelsByProduct.set(row.productId, row.productName || labelsByProduct.get(row.productId) || "Item");
    }
    return { byProduct, labelsByProduct };
  }, [bucketIndexByKey, bucketTemplates, purchasesInRange, timeline]);

  const salesProductOrdersById = React.useMemo(() => {
    const byProduct = new Map<string, number[]>();
    const labelsByProduct = new Map<string, string>();
    const orderSeenByProductBucket = new Map<string, Set<string>>();

    for (const row of orderLineMetricRows) {
      if (!row.productId) continue;
      if (!isDateInRange(row.date, rangeStart, rangeEnd)) continue;
      const idx = bucketIndexByKey.get(bucketKeyForDate(row.date, timeline));
      if (idx === undefined) continue;
      const key = `${row.productId}:${idx}`;
      const seen = orderSeenByProductBucket.get(key) ?? new Set<string>();
      if (!row.orderId || seen.has(row.orderId)) {
        labelsByProduct.set(row.productId, row.productName || labelsByProduct.get(row.productId) || "Item");
        continue;
      }
      seen.add(row.orderId);
      orderSeenByProductBucket.set(key, seen);
      const values = byProduct.get(row.productId) ?? bucketTemplates.map(() => 0);
      values[idx] += 1;
      byProduct.set(row.productId, values);
      labelsByProduct.set(row.productId, row.productName || labelsByProduct.get(row.productId) || "Item");
    }
    return { byProduct, labelsByProduct };
  }, [bucketIndexByKey, bucketTemplates, orderLineMetricRows, rangeEnd, rangeStart, timeline]);

  const salesProductProfitById = React.useMemo(() => {
    const byProduct = new Map<string, number[]>();
    const labelsByProduct = new Map<string, string>();

    for (const row of orderLineMetricRows) {
      if (!row.productId) continue;
      if (!isDateInRange(row.date, rangeStart, rangeEnd)) continue;
      const idx = bucketIndexByKey.get(bucketKeyForDate(row.date, timeline));
      if (idx === undefined) continue;
      const values = byProduct.get(row.productId) ?? bucketTemplates.map(() => 0);
      values[idx] += Number(row.lineProfit ?? 0);
      byProduct.set(row.productId, values);
      labelsByProduct.set(row.productId, row.productName || labelsByProduct.get(row.productId) || "Item");
    }
    return { byProduct, labelsByProduct };
  }, [bucketIndexByKey, bucketTemplates, orderLineMetricRows, rangeEnd, rangeStart, timeline]);

  const activeTotalValues = React.useMemo(() => {
    if (activeTab === "sales") return salesLineValues;
    if (activeTab === "purchases") return purchaseLineValues;
    return inventoryInboundValues;
  }, [activeTab, inventoryInboundValues, purchaseLineValues, salesLineValues]);

  const totalSeriesLabel = activeTab === "sales"
    ? "Total sales"
    : activeTab === "purchases"
      ? "Total purchases"
      : "Inbound inventory value";

  const totalSeriesColor = PRODUCT_SERIES_COLORS[0];
  const totalSeriesSum = React.useMemo(
    () => activeTotalValues.reduce((sum, value) => sum + value, 0),
    [activeTotalValues]
  );
  const totalSeries = React.useMemo<ChartSeries[]>(() => {
    if (activeTab === "sales") {
      const allSeries: ChartSeries[] = [
        {
          id: "sales-total",
          label: "Sales",
          color: PRODUCT_SERIES_COLORS[0],
          valueType: "money",
          values: salesLineValues,
          total: salesSummaryValue,
        },
        {
          id: "sales-orders",
          label: "Orders",
          color: "#66c7ff",
          valueType: "count",
          values: salesOrderCountValues,
          total: salesOrdersCount,
        },
        {
          id: "sales-profit",
          label: "Profit",
          color: "#8dd694",
          valueType: "money",
          values: profitValues,
          total: salesProfitInView,
        },
      ];
      return allSeries.filter((item) =>
        salesOverviewLineMode === "sales"
          ? item.id === "sales-total"
          : salesOverviewLineMode === "orders"
            ? item.id === "sales-orders"
            : item.id === "sales-profit"
      );
    }
    return [
      {
        id: `total-${activeTab}`,
        label: totalSeriesLabel,
        color: totalSeriesColor,
        valueType: "money",
        values: activeTotalValues,
        total: totalSeriesSum,
      },
    ];
  }, [
    activeTab,
    activeTotalValues,
    profitValues,
    salesLineValues,
    salesOrderCountValues,
    salesOrdersCount,
    salesProfitInView,
    salesSummaryValue,
    salesOverviewLineMode,
    totalSeriesColor,
    totalSeriesLabel,
    totalSeriesSum,
  ]);

  const activeProductSource = React.useMemo(() => {
    if (activeTab === "sales") return salesProductBucketsById;
    if (activeTab === "purchases") return purchasesByProduct;
    return inventoryByProduct;
  }, [activeTab, inventoryByProduct, purchasesByProduct, salesProductBucketsById]);

  const productSummaries = React.useMemo<ProductSummary[]>(() => {
    const items: ProductSummary[] = [];
    for (const [id, values] of activeProductSource.byProduct.entries()) {
      const total = values.reduce((sum, value) => sum + value, 0);
      items.push({
        id,
        label: activeProductSource.labelsByProduct.get(id) ?? "Item",
        total,
      });
    }
    return items.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }, [activeProductSource.byProduct, activeProductSource.labelsByProduct]);

  React.useEffect(() => {
    const validIds = new Set(productSummaries.map((item) => item.id));
    const defaultIds = productSummaries.slice(0, Math.min(5, productSummaries.length)).map((item) => item.id);
    setSelectedProductIds((prev) => {
      const validPrev = prev.filter((id) => validIds.has(id));
      if (hasCustomizedProductSelection && validPrev.length > 0) return validPrev;
      return defaultIds;
    });
  }, [hasCustomizedProductSelection, productSummaries]);

  const visibleProductSummaries = React.useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return productSummaries;
    return productSummaries.filter((item) => item.label.toLowerCase().includes(query));
  }, [productQuery, productSummaries]);

  const productSeries = React.useMemo<ChartSeries[]>(() => {
    if (activeTab === "sales") {
      const findLabel = (productId: string) =>
        productSummaries.find((item) => item.id === productId)?.label ??
        salesProductBucketsById.labelsByProduct.get(productId) ??
        salesProductOrdersById.labelsByProduct.get(productId) ??
        salesProductProfitById.labelsByProduct.get(productId) ??
        "Item";

      const rows: ChartSeries[] = [];
      selectedProductIds.forEach((productId) => {
        const label = findLabel(productId);
        const salesValues = salesProductBucketsById.byProduct.get(productId) ?? bucketTemplates.map(() => 0);
        const orderValues = salesProductOrdersById.byProduct.get(productId) ?? bucketTemplates.map(() => 0);
        const profitMetricValues = salesProductProfitById.byProduct.get(productId) ?? bucketTemplates.map(() => 0);
        const salesColor = getSalesMetricColor(productId, "sales");
        const ordersColor = getSalesMetricColor(productId, "orders");
        const profitColor = getSalesMetricColor(productId, "profit");

        if (salesProductMetricMode === "sales" || salesProductMetricMode === "all") {
          rows.push({
            id: salesProductMetricMode === "all" ? `${productId}:sales` : productId,
            label: salesProductMetricMode === "all" ? `${label} · Sales` : label,
            color: salesColor,
            valueType: "money",
            values: salesValues,
            total: salesValues.reduce((sum, value) => sum + value, 0),
          });
        }
        if (salesProductMetricMode === "orders" || salesProductMetricMode === "all") {
          rows.push({
            id: `${productId}:orders`,
            label: salesProductMetricMode === "all" ? `${label} · Orders` : label,
            color: ordersColor,
            valueType: "count",
            values: orderValues,
            total: orderValues.reduce((sum, value) => sum + value, 0),
          });
        }
        if (salesProductMetricMode === "profit" || salesProductMetricMode === "all") {
          rows.push({
            id: `${productId}:profit`,
            label: salesProductMetricMode === "all" ? `${label} · Profit` : label,
            color: profitColor,
            valueType: "money",
            values: profitMetricValues,
            total: profitMetricValues.reduce((sum, value) => sum + value, 0),
          });
        }
      });
      return rows;
    }

    const byProduct = new Map<string, ChartSeries>();
    selectedProductIds.forEach((productId) => {
      const summary = productSummaries.find((item) => item.id === productId);
      byProduct.set(productId, {
        id: productId,
        label: summary?.label ?? "Item",
        color: getSalesMetricColor(productId, "sales"),
        valueType: "money",
        values: bucketTemplates.map(() => 0),
        total: 0,
      });
    });
    for (const [productId, values] of activeProductSource.byProduct.entries()) {
      const series = byProduct.get(productId);
      if (!series) continue;
      values.forEach((value, idx) => {
        series.values[idx] = value;
      });
      series.total = values.reduce((sum, value) => sum + value, 0);
    }
    return selectedProductIds
      .map((id) => byProduct.get(id))
      .filter((item): item is ChartSeries => Boolean(item));
  }, [
    activeProductSource.byProduct,
    activeTab,
    bucketTemplates,
    productSummaries,
    salesProductBucketsById.byProduct,
    salesProductBucketsById.labelsByProduct,
    salesProductMetricMode,
    salesProductOrdersById.byProduct,
    salesProductOrdersById.labelsByProduct,
    salesProductProfitById.byProduct,
    salesProductProfitById.labelsByProduct,
    selectedProductIds,
  ]);

  const summaryCards = React.useMemo<SummaryCard[]>(() => {
    if (activeTab === "sales") {
      return [
        {
          label: "Total sales",
          value: "",
          rows: [
            { label: "Sales", value: formatMoney(salesSummaryValue) },
            { label: "Orders", value: String(salesOrdersCount) },
            { label: "Profit", value: formatMoney(salesProfitInView) },
          ],
        },
        {
          label: "Last 30 days",
          value: "",
          rows: [
            { label: "Sales", value: formatMoney(salesLast30.sales) },
            { label: "Orders", value: String(salesLast30.count) },
            { label: "Profit", value: formatMoney(salesProfitLast30) },
          ],
        },
        {
          label: "Last 7 days",
          value: "",
          rows: [
            { label: "Sales", value: formatMoney(salesLast7.sales) },
            { label: "Orders", value: String(salesLast7.count) },
            { label: "Profit", value: formatMoney(salesProfitLast7) },
          ],
        },
      ];
    }
    if (activeTab === "purchases") {
      return [
        { label: "Purchases in view", value: formatMoney(totalSeriesSum) },
        { label: "Purchase orders", value: String(purchaseOrdersCount) },
      ];
    }
    if (activeTab === "inventory") {
      return [
        { label: "Stock value (cost)", value: formatMoney(stockCostValue) },
        { label: "Stock value (sales)", value: formatMoney(stockSalesValue) },
        { label: "Sitting profit", value: formatMoney(stockSittingProfit) },
        { label: "Inbound value in view", value: formatMoney(totalSeriesSum) },
        { label: "Latest inbound value", value: formatMoney(latestInboundValue) },
      ];
    }
    return [];
  }, [
    activeTab,
    latestInboundValue,
    purchaseOrdersCount,
    salesLast30.count,
    salesLast30.sales,
    salesLast7.count,
    salesLast7.sales,
    salesProfitLast30,
    salesProfitLast7,
    salesOrdersCount,
    salesProfitInView,
    salesSummaryValue,
    inventoryValueMode,
    stockCostValue,
    stockSalesValue,
    stockSittingProfit,
    totalSeriesSum,
  ]);

  const lineChartTitle = activeTab === "sales" ? `Sales overview per ${timeline}` : `${totalSeriesLabel} per ${timeline}`;
  const productChartTitle =
    activeTab === "sales"
      ? `Product sales per ${timeline}`
      : activeTab === "purchases"
        ? `Product purchases per ${timeline}`
        : `Product inventory value per ${timeline}`;

  const productChartEmptyMessage =
    selectedProductIds.length === 0 && !productSeriesLoading && !purchaseMetricsLoading
      ? "Select at least one product to compare trends."
      : productSeriesLoading || purchaseMetricsLoading
        ? "Loading data..."
        : activeTab === "sales"
          ? productSeriesError ?? "No product sales data for this view."
          : purchaseMetricsError ?? "No product data for this view.";

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
          <div style={styles.tabRow}>
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === tab.id ? styles.tabBtnActive : null),
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div
            style={{
              ...styles.summaryRow,
              ...((activeTab === "inventory" || activeTab === "sales") && !isMobileViewport
                ? { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }
                : null),
            }}
          >
            {summaryCards.map((card) => (
              <div key={card.label} style={styles.metricCard}>
                <div style={styles.metricLabel}>{card.label}</div>
                {card.rows && card.rows.length > 0 ? (
                  <div style={styles.metricRowsWrap}>
                    {card.rows.map((row) => (
                      <div key={`${card.label}-${row.label}`} style={styles.metricSubRow}>
                        <span style={styles.metricSubLabel}>{row.label}</span>
                        <strong style={styles.metricSubValue}>{row.value}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.metricValue}>{card.value}</div>
                )}
              </div>
            ))}
          </div>
          {activeTab !== "inventory" ? (
            <>
              <div style={styles.timelineControlsCard}>
                <div style={styles.timelineControlsHeader}>
                  <div style={styles.chartControls}>
                    {activeTab === "sales" ? (
                      <select
                        value={salesOverviewLineMode}
                        onChange={(e) => setSalesOverviewLineMode(e.target.value as SalesOverviewLineMode)}
                        style={styles.timelineSelect}
                      >
                        <option value="sales">Sales</option>
                        <option value="orders">Orders</option>
                        <option value="profit">Profit</option>
                      </select>
                    ) : null}
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
              </div>
              <LineChartCard
                title={lineChartTitle}
                buckets={bucketTemplates}
                series={totalSeries}
                emptyMessage="No data yet for this tab."
                showValueLabels
                normalizeEachSeries={activeTab === "sales" && totalSeries.length > 1}
              >
                {totalSeries.length > 0 ? (
                  <div style={{ ...styles.legendWrap, marginBottom: 8 }}>
                    {totalSeries.map((item) => (
                      <div key={item.id} style={styles.legendItem}>
                        <span style={{ ...styles.legendSwatch, background: item.color }} />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </LineChartCard>
              <ProductComparisonChartCard
                title={productChartTitle}
                buckets={bucketTemplates}
                series={productSeries}
                isMobileViewport={isMobileViewport}
                emptyMessage={productChartEmptyMessage}
              >
                <div style={styles.filterPanel}>
                  <div style={styles.filterRow}>
                    {activeTab === "sales" ? (
                      <select
                        value={salesProductMetricMode}
                        onChange={(event) =>
                          setSalesProductMetricMode(event.target.value as SalesProductMetricMode)
                        }
                        style={{ ...styles.timelineSelect, minWidth: 126 }}
                      >
                        <option value="sales">Sales</option>
                        <option value="orders">Orders</option>
                        <option value="profit">Profit</option>
                        <option value="all">All</option>
                      </select>
                    ) : null}
                    <input
                      type="search"
                      value={productQuery}
                      onChange={(event) => setProductQuery(event.target.value)}
                      placeholder="Filter products"
                      style={{ ...styles.dateInput, minWidth: 220 }}
                    />
                    <AppButton
                      variant="ghost"
                      style={styles.filterBtn}
                      onClick={() => {
                        setHasCustomizedProductSelection(true);
                        setSelectedProductIds(visibleProductSummaries.map((item) => item.id));
                      }}
                    >
                      ALL
                    </AppButton>
                    <AppButton
                      variant="ghost"
                      style={styles.filterBtn}
                      onClick={() => {
                        setHasCustomizedProductSelection(true);
                        setSelectedProductIds([]);
                      }}
                    >
                      CLEAR
                    </AppButton>
                  </div>
                  <div style={styles.filterHelp}>
                    Select one or more products to compare trends in the same time range.
                  </div>
                  <div style={styles.productChipWrap}>
                    {visibleProductSummaries.length === 0 ? (
                      <div style={styles.emptyInline}>No matching products.</div>
                    ) : (
                      visibleProductSummaries.map((item) => {
                        const isSelected = selectedProductIds.includes(item.id);
                        const chipColor =
                          isSelected
                            ? activeTab === "sales"
                              ? getSalesMetricColor(
                                  item.id,
                                  salesProductMetricMode === "all" ? "sales" : salesProductMetricMode
                                )
                              : getSalesMetricColor(item.id, "sales")
                            : "var(--tp-border-color)";
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setHasCustomizedProductSelection(true);
                              setSelectedProductIds((prev) =>
                                prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                              );
                            }}
                            style={{
                              ...styles.productChip,
                              ...(isSelected
                                ? {
                                    borderColor: chipColor,
                                    boxShadow: `inset 0 0 0 1px ${chipColor}`,
                                    color: chipColor,
                                  }
                                : null),
                            }}
                          >
                            <span>{item.label}</span>
                            <span style={styles.productChipValue}>{formatMoney(item.total)}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </ProductComparisonChartCard>
            </>
          ) : (
            <InventorySnapshotChartCard
              title={`Current inventory value by product (${inventoryValueMode})`}
              rows={inventorySnapshotRows}
              valueMode={inventoryValueMode}
              onChangeValueMode={setInventoryValueMode}
            />
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
    overflowY: "auto",
    padding: `6px 24px 48px ${BACK_BTN_W + TITLE_GAP}px`,
    color: "var(--tp-text-color)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 18,
    alignContent: "start",
  },
  contentMobile: { padding: "8px 12px 20px", gridTemplateColumns: "minmax(0, 1fr)" },
  tabRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  tabBtn: {
    height: 34,
    minWidth: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--tp-border-color-soft)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.4,
    padding: "0 14px",
    cursor: "pointer",
  },
  tabBtnActive: {
    borderColor: "var(--tp-accent)",
    boxShadow: "inset 0 0 0 1px var(--tp-accent)",
    color: "var(--tp-accent)",
  },
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
  metricRowsWrap: { marginTop: 4 },
  metricSubRow: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTop: "1px solid var(--tp-border-color-soft)",
    paddingTop: 8,
  },
  metricSubLabel: { fontSize: 12, opacity: 0.72, textTransform: "uppercase", letterSpacing: 0.8 },
  metricSubValue: { fontSize: 20, fontWeight: 800 },
  chartCard: {
    position: "relative",
    justifySelf: "stretch",
    width: "100%",
    minWidth: 0,
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
  timelineControlsCard: {
    position: "relative",
    border: "none",
    borderRadius: 0,
    background: "transparent",
    padding: 0,
  },
  timelineControlsHeader: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: 0,
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
  filterPanel: {
    display: "grid",
    gap: 12,
    marginBottom: 14,
  },
  filterRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  filterBtn: {
    height: 36,
    minWidth: 72,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid var(--tp-border-color)",
    background: "transparent",
  },
  filterHelp: {
    fontSize: 13,
    opacity: 0.72,
  },
  productChipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  productChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--tp-border-color-soft)",
    background: "rgba(255,255,255,0.03)",
    color: "var(--tp-text-color)",
    padding: "8px 12px",
    fontSize: 13,
    cursor: "pointer",
  },
  productChipValue: {
    opacity: 0.72,
    fontWeight: 700,
  },
  legendWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    opacity: 0.9,
  },
  productChartGrid: {
    display: "grid",
    gridTemplateColumns: "280px minmax(0, 1fr)",
    gap: 18,
    alignItems: "stretch",
  },
  productChartGridMobile: {
    gridTemplateColumns: "1fr",
  },
  productChartPane: {
    minWidth: 0,
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  subchartTitle: {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    opacity: 0.76,
  },
  productChartScroll: {
    width: "100%",
    overflow: "hidden",
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
    display: "inline-block",
  },
  emptyInline: {
    fontSize: 13,
    opacity: 0.72,
  },
  chartWrap: {
    minHeight: 280,
  },
  chartScroll: {
    width: "100%",
    minWidth: 0,
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
