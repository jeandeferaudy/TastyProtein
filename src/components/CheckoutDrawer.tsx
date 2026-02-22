// src/components/CheckoutDrawer.tsx
"use client";

import React, { useMemo } from "react";
import type { Order } from "@/types/order";
import type { CheckoutSubmitPayload, CustomerDraft } from "@/types/checkout";
import { AppButton, TOPBAR_FONT_SIZE, UI } from "@/components/ui";
import LogoPlaceholder from "@/components/LogoPlaceholder";
import { supabase } from "@/lib/supabase";

const TOPBAR_H = 88; // <-- adjust to match your white bar height (try 80-96)
const BACK_BTN_W = 68;
const TITLE_GAP = 40;
const CONTENT_RIGHT_PAD = 24;
const CHECKOUT_GRID_GAP = 26;
const CHECKOUT_LEFT_COL_RATIO = 0.275; // 0.55 / (0.55 + 1.45)
const PROGRESS_RIGHT_TRIM = 12;

type DeliveryRule = {
  postal_code: string;
  area_name: string;
  min_order_free_delivery_php: number;
  delivery_fee_below_min_php: number;
};

function fallbackDeliveryRule(postal: string, area: string): DeliveryRule | null {
  const p = postal.replace(/\D/g, "");
  const a = area.toLowerCase();
  if (!p) return null;

  // Near zones
  if (p === "1709") {
    return {
      postal_code: p,
      area_name: "Merville/Moonwalk",
      min_order_free_delivery_php: 2000,
      delivery_fee_below_min_php: 100,
    };
  }
  if (p === "1700") {
    const near1700 = ["san dionisio", "tambo", "baclaran"];
    const isNear = near1700.some((k) => a.includes(k));
    return {
      postal_code: p,
      area_name: isNear ? "San Dionisio/Tambo/Baclaran" : "Sucat/Marcelo Green",
      min_order_free_delivery_php: isNear ? 2000 : 3000,
      delivery_fee_below_min_php: isNear ? 100 : 150,
    };
  }
  if (p === "1701" || p === "1702") {
    return {
      postal_code: p,
      area_name: "Paranaque near",
      min_order_free_delivery_php: 2000,
      delivery_fee_below_min_php: 100,
    };
  }

  // Medium zones
  if (["1711", "1715", "1720"].includes(p) || /^130\d$/.test(p)) {
    return {
      postal_code: p,
      area_name: "Medium zone",
      min_order_free_delivery_php: 3000,
      delivery_fee_below_min_php: 150,
    };
  }

  // Far zones (default from your pricing model)
  return {
    postal_code: p,
    area_name: "Far zone",
    min_order_free_delivery_php: 4000,
    delivery_fee_below_min_php: 200,
  };
}

function ordinalDay(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const r = n % 10;
  if (r === 1) return `${n}st`;
  if (r === 2) return `${n}nd`;
  if (r === 3) return `${n}rd`;
  return `${n}th`;
}

type Props = {
  isOpen: boolean;
  topOffset?: number;
  backgroundStyle?: React.CSSProperties;

  // draft order (can be null before you create it)
  draft?: Order | null;
  items?: Array<{
    productId: string;
    name: string;
    size: string | null;
    temperature?: string | null;
    thumbnailUrl?: string | null;
    unlimitedStock?: boolean;
    qtyAvailable?: number;
    outOfStock?: boolean;
    price?: number;
    qty: number;
    lineTotal: number;
  }>;
  total?: number;

  // "form" | "success" like in your page.tsx
  checkoutState?: "form" | "success";

  // controlled form state
  customer: CustomerDraft;
  setCustomer: (next: CustomerDraft) => void;
  isLoggedIn?: boolean;
  createAccountFromDetails?: boolean;
  setCreateAccountFromDetails?: (next: boolean) => void;
  suggestSaveAddressToProfile?: boolean;
  saveAddressToProfile?: boolean;
  setSaveAddressToProfile?: (next: boolean) => void;
  profileAddress?: Pick<
    CustomerDraft,
    "attention_to" | "line1" | "line2" | "barangay" | "city" | "province" | "postal_code" | "country"
  > | null;

  // payment proof upload (optional)
  paymentFile?: File | null;
  setPaymentFile?: (f: File | null) => void;
  gcashQrUrl?: string;
  gcashPhone?: string;

  // actions
  onBack: () => void;
  onSubmit: (payload: CheckoutSubmitPayload) => void;
  onOpenProfile?: () => void;
  onAddItem?: (id: string) => void;
  onRemoveItem?: (id: string) => void;

  formatMoney: (n: unknown) => string;
};

export default function CheckoutDrawer({
  isOpen,
  topOffset,
  backgroundStyle,
  draft,
  items,
  total,
  checkoutState,
  customer,
  setCustomer,
  isLoggedIn = false,
  createAccountFromDetails = false,
  setCreateAccountFromDetails,
  suggestSaveAddressToProfile = false,
  saveAddressToProfile = false,
  setSaveAddressToProfile,
  profileAddress = null,
  paymentFile,
  setPaymentFile,
  gcashQrUrl = "",
  gcashPhone = "",
  onBack,
  onSubmit,
  onOpenProfile,
  onAddItem,
  onRemoveItem,
  formatMoney,
}: Props) {
  const [checkoutStep, setCheckoutStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [stepAttempted, setStepAttempted] = React.useState<Record<1 | 2 | 3 | 4, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
  });
  const [isNarrow, setIsNarrow] = React.useState(false);
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const [useProfileAddress, setUseProfileAddress] = React.useState(false);
  const [deliveryRules, setDeliveryRules] = React.useState<DeliveryRule[]>([]);
  const [proofPreviewOpen, setProofPreviewOpen] = React.useState(false);
  const [proofPreviewUrl, setProofPreviewUrl] = React.useState<string | null>(null);
  const [copyNoticeVisible, setCopyNoticeVisible] = React.useState(false);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  const [timePickerOpen, setTimePickerOpen] = React.useState(false);
  const datePickerWrapRef = React.useRef<HTMLDivElement | null>(null);
  const datePickerListRef = React.useRef<HTMLDivElement | null>(null);
  const timePickerWrapRef = React.useRef<HTMLDivElement | null>(null);
  const timePickerListRef = React.useRef<HTMLDivElement | null>(null);
  const notesTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const rightStepScrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setIsNarrow(w < 980);
      setIsMobileViewport(w < 768);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const loadDeliveryRules = async () => {
      const { data, error } = await supabase
        .from("delivery_pricing")
        .select(
          "postal_code,area_name,min_order_free_delivery_php,delivery_fee_below_min_php"
        );
      if (error) {
        console.error("[CheckoutDrawer] delivery_pricing load failed:", error.message);
      }
      const rows = ((data ?? []) as DeliveryRule[]).map((r) => ({
        ...r,
        postal_code: String(r.postal_code ?? "").trim(),
        area_name: String(r.area_name ?? "").trim(),
        min_order_free_delivery_php: Number(r.min_order_free_delivery_php ?? 0),
        delivery_fee_below_min_php: Number(r.delivery_fee_below_min_php ?? 0),
      }));
      setDeliveryRules(rows);
    };
    void loadDeliveryRules();
  }, [isOpen]);

  React.useEffect(() => {
    return () => {
      if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    };
  }, [proofPreviewUrl]);

  React.useEffect(() => {
    if (!copyNoticeVisible) return;
    const timer = window.setTimeout(() => setCopyNoticeVisible(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copyNoticeVisible]);

  const panelTop = Math.max(topOffset ?? TOPBAR_H, 0);
  const panelHeight = `calc(100vh - ${panelTop}px)`;

  const summaryLines = useMemo(() => {
    if (Array.isArray(items)) return items;
    const draftItems = (draft as any)?.items ?? [];
    // Expecting items like: [{ productId, name, qty, size, lineTotal }]
    return Array.isArray(draftItems) ? draftItems : [];
  }, [draft, items]);

  const computedTotal = useMemo(() => {
    if (typeof total === "number") return total;
    const t = (draft as any)?.total;
    if (typeof t === "number") return t;
    // fallback: sum line totals
    let sum = 0;
    for (const li of summaryLines) sum += Number(li?.lineTotal ?? 0);
    return sum;
  }, [draft, summaryLines, total]);

  const requiresProof = typeof setPaymentFile === "function";
  const hasProfileAddress = useMemo(() => {
    if (!profileAddress) return false;
    return (
      profileAddress.line1.trim().length > 0 &&
      profileAddress.barangay.trim().length > 0 &&
      profileAddress.city.trim().length > 0 &&
      profileAddress.province.trim().length > 0 &&
      profileAddress.postal_code.trim().length > 0
    );
  }, [profileAddress]);
  const minDeliveryMs = Date.now() + 2 * 60 * 60 * 1000;

  const slotOptions = useMemo(() => {
    const slots: string[] = [];
    for (let h = 0; h < 24; h += 1) {
      for (let m = 0; m < 60; m += 30) {
        slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return slots;
  }, []);

  const daytimeSlots = useMemo(
    () =>
      slotOptions.filter((slot) => {
        const [h, m] = slot.split(":").map(Number);
        const afterStart = h > 10 || (h === 10 && m >= 0);
        const beforeEnd = h < 21 || (h === 21 && m === 0);
        return afterStart && beforeEnd;
      }),
    [slotOptions]
  );

  const minDeliveryDate = useMemo(() => {
    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    const minDate = new Date(minDeliveryMs);
    const minHH = minDate.getHours();
    const minMM = minDate.getMinutes();
    const hasSameDaySlots = daytimeSlots.some((slot) => {
      const [h, m] = slot.split(":").map(Number);
      return h > minHH || (h === minHH && m >= minMM);
    });
    if (hasSameDaySlots) return fmtDate(minDate);
    const nextDay = new Date(minDate);
    nextDay.setDate(nextDay.getDate() + 1);
    return fmtDate(nextDay);
  }, [daytimeSlots, minDeliveryMs]);

  const validSlots = useMemo(() => {
    if (!customer.delivery_date) return daytimeSlots;
    const selectedDate = new Date(`${customer.delivery_date}T00:00:00`);
    const minDate = new Date(minDeliveryMs);
    const sameDay =
      selectedDate.getFullYear() === minDate.getFullYear() &&
      selectedDate.getMonth() === minDate.getMonth() &&
      selectedDate.getDate() === minDate.getDate();
    if (!sameDay) return daytimeSlots;
    const minHH = minDate.getHours();
    const minMM = minDate.getMinutes();
    return daytimeSlots.filter((slot) => {
      const [h, m] = slot.split(":").map(Number);
      return h > minHH || (h === minHH && m >= minMM);
    });
  }, [customer.delivery_date, daytimeSlots, minDeliveryMs]);

  React.useEffect(() => {
    if (!isOpen) return;
    const next = isLoggedIn && hasProfileAddress;
    setUseProfileAddress(next);
    if (next && profileAddress) {
      setCustomer({
        ...customer,
        attention_to: profileAddress.attention_to,
        line1: profileAddress.line1,
        line2: profileAddress.line2,
        barangay: profileAddress.barangay,
        city: profileAddress.city,
        province: profileAddress.province,
        postal_code: profileAddress.postal_code,
        country: profileAddress.country || "Philippines",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isLoggedIn, hasProfileAddress, profileAddress]);

  React.useEffect(() => {
    if (!isOpen) return;
    // Never prefill delivery date/time slot.
    if (!customer.delivery_date) {
      if (customer.delivery_slot) {
        setCustomer({
          ...customer,
          delivery_slot: "",
        });
      }
      return;
    }
    if (customer.delivery_slot && !validSlots.includes(customer.delivery_slot)) {
      setCustomer({
        ...customer,
        delivery_slot: "",
      });
    }
  }, [customer, isOpen, setCustomer, validSlots]);

  const selectedDeliveryMs = useMemo(() => {
    if (!customer.delivery_date || !customer.delivery_slot) return 0;
    return new Date(`${customer.delivery_date}T${customer.delivery_slot}:00`).getTime();
  }, [customer.delivery_date, customer.delivery_slot]);
  const isWithin2h = selectedDeliveryMs > 0 && selectedDeliveryMs < minDeliveryMs;
  const fieldRowStyle = isNarrow ? styles.fieldRowMobile : styles.fieldRowDesktop;
  const fieldLabelStyle = isNarrow ? styles.label : styles.labelDesktop;
  const normalizedPostal = customer.postal_code.replace(/\D/g, "");
  const normalizedArea = `${customer.barangay} ${customer.city}`.trim().toLowerCase();
  const hasDeliveryRules = deliveryRules.length > 0;

  const selectedDeliveryRule = useMemo(() => {
    if (!hasDeliveryRules) {
      return fallbackDeliveryRule(normalizedPostal, normalizedArea);
    }
    if (!normalizedPostal) return null;
    const matchesPostal = deliveryRules.filter((r) => {
      const rulePostal = String(r.postal_code ?? "").replace(/\D/g, "");
      return rulePostal === normalizedPostal;
    });
    if (!matchesPostal.length) return null;
    if (matchesPostal.length === 1) return matchesPostal[0];

    const exactAreaMatch = matchesPostal.find((r) =>
      normalizedArea.includes(r.area_name.toLowerCase())
    );
    if (exactAreaMatch) return exactAreaMatch;

    const partialAreaMatch = matchesPostal.find((r) =>
      r.area_name
        .toLowerCase()
        .split(/[,\s/]+/)
        .filter((p) => p.length > 3)
        .some((p) => normalizedArea.includes(p))
    );
    if (partialAreaMatch) return partialAreaMatch;

    return matchesPostal.sort(
      (a, b) => a.min_order_free_delivery_php - b.min_order_free_delivery_php
    )[0];
  }, [deliveryRules, hasDeliveryRules, normalizedArea, normalizedPostal]);

  const postalSupported = !normalizedPostal ? false : !!selectedDeliveryRule;
  const freeDeliveryTarget = selectedDeliveryRule?.min_order_free_delivery_php ?? 0;
  const deliveryFee =
    !selectedDeliveryRule || computedTotal >= 4000 || computedTotal >= freeDeliveryTarget
      ? 0
      : selectedDeliveryRule.delivery_fee_below_min_php;
  const referBagFee = customer.add_refer_bag ? 200 : 0;
  const grandTotal = computedTotal + deliveryFee + referBagFee;
  const displayedTotal = checkoutStep === 1 ? computedTotal : grandTotal;
  const hasOutOfStockItems = summaryLines.some((li: any) => Boolean(li?.outOfStock));

  const isCheckoutValid =
    customer.full_name.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) &&
    customer.phone.trim().length >= 7 &&
    customer.line1.trim().length > 3 &&
    customer.barangay.trim().length > 1 &&
    customer.city.trim().length > 1 &&
    customer.province.trim().length > 1 &&
    customer.postal_code.trim().length > 2 &&
    postalSupported &&
    customer.delivery_date.trim().length > 0 &&
    customer.delivery_slot.trim().length > 0 &&
    (!isWithin2h || customer.express_delivery) &&
    (!requiresProof || !!paymentFile) &&
    !summaryLines.some((li: any) => Boolean(li?.outOfStock));
  React.useEffect(() => {
    if (!isOpen) {
      setCheckoutStep(1);
      setStepAttempted({ 1: false, 2: false, 3: false, 4: false });
    }
  }, [isOpen]);

  const missingCustomer: string[] = [];
  if (customer.full_name.trim().length <= 1) missingCustomer.push("full name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
    missingCustomer.push("valid email");
  }
  if (customer.phone.trim().length < 7) missingCustomer.push("phone");
  if (customer.line1.trim().length <= 3) missingCustomer.push("line 1");
  if (customer.barangay.trim().length <= 1) missingCustomer.push("barangay");
  if (customer.city.trim().length <= 1) missingCustomer.push("city");
  if (customer.province.trim().length <= 1) missingCustomer.push("province");
  if (customer.postal_code.trim().length <= 2) missingCustomer.push("postal code");
  if (customer.postal_code.trim().length > 2 && !postalSupported) {
    missingCustomer.push("supported delivery postal code");
  }
  if (!customer.delivery_date.trim()) missingCustomer.push("delivery date");
  if (!customer.delivery_slot.trim()) missingCustomer.push("delivery time");
  const missingProof = requiresProof && !paymentFile;
  const missingStock = hasOutOfStockItems;
  const missingTotal = missingCustomer.length + (missingProof ? 1 : 0) + (missingStock ? 1 : 0);

  let missingHint = "";
  if (missingTotal === 0) {
    missingHint = "Looks good. You can send your order.";
  } else if (missingTotal <= 2) {
    const specific = [
      ...missingCustomer,
      ...(missingProof ? ["payment proof"] : []),
      ...(missingStock ? ["out-of-stock items removed"] : []),
    ];
    missingHint = `Please add: ${specific.join(" and ")}.`;
  } else if (missingCustomer.length >= 3 && missingProof) {
    missingHint = "Please complete your customer details and upload payment proof.";
  } else if (missingCustomer.length >= 3) {
    missingHint = "Please complete your customer details section.";
  } else {
    missingHint = "Please upload payment proof to continue.";
  }
  const missingWhat =
    missingTotal === 1 && missingProof && missingCustomer.length === 0
      ? "payment proof"
      : missingStock
        ? "out-of-stock items removed"
        : missingCustomer.length
        ? missingCustomer.length > 2
          ? "required details"
          : missingCustomer.join(" and ")
        : "payment proof";
  const confirmHint = isCheckoutValid
    ? "Everything looks good. You can confirm your order."
    : `You are missing ${missingWhat} before you can confirm the order.`;

  const autoResizeNotes = React.useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "40px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  React.useEffect(() => {
    autoResizeNotes(notesTextareaRef.current);
  }, [autoResizeNotes, customer.notes]);

  React.useEffect(() => {
    rightStepScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [checkoutStep]);

  const scrollTimeOptions = React.useCallback((direction: "up" | "down") => {
    const list = timePickerListRef.current;
    if (!list) return;
    const delta = direction === "up" ? -140 : 140;
    list.scrollBy({ top: delta, behavior: "smooth" });
  }, []);

  const scrollDateOptions = React.useCallback((direction: "up" | "down") => {
    const list = datePickerListRef.current;
    if (!list) return;
    const delta = direction === "up" ? -140 : 140;
    list.scrollBy({ top: delta, behavior: "smooth" });
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setTimePickerOpen(false);
      setDatePickerOpen(false);
      return;
    }
    if (!timePickerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const root = timePickerWrapRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      if (target && root.contains(target)) return;
      setTimePickerOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [isOpen, timePickerOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      setDatePickerOpen(false);
      return;
    }
    if (!datePickerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const root = datePickerWrapRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      if (target && root.contains(target)) return;
      setDatePickerOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [datePickerOpen, isOpen]);

  const isSummaryComplete = summaryLines.length > 0;
  const isCustomerComplete =
    customer.full_name.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) &&
    customer.phone.trim().length >= 7 &&
    customer.line1.trim().length > 3 &&
    customer.barangay.trim().length > 1 &&
    customer.city.trim().length > 1 &&
    customer.province.trim().length > 1 &&
    customer.postal_code.trim().length > 2 &&
    postalSupported;
  const isDeliveryComplete =
    customer.delivery_date.trim().length > 0 &&
    customer.delivery_slot.trim().length > 0 &&
    (!isWithin2h || customer.express_delivery);
  const isLogisticsComplete = isDeliveryComplete;
  const showDeliverySummary =
    checkoutStep > 2 &&
    Boolean(customer.delivery_date || customer.delivery_slot || customer.express_delivery);
  const isPaymentComplete = !requiresProof || !!paymentFile;
  const isReadyToSend = isCheckoutValid;
  const isOrderSent = checkoutState === "success";
  const summaryQty = summaryLines.reduce((sum: number, li: any) => sum + Number(li?.qty ?? 0), 0);
  const goToStep = (next: 1 | 2 | 3 | 4) => {
    if (next === 1) {
      setCheckoutStep(1);
      return;
    }
    if (next === 2) {
      if (!isSummaryComplete) return;
      setCheckoutStep(2);
      return;
    }
    if (next === 3) {
      if (!isSummaryComplete || !isCustomerComplete) return;
      setCheckoutStep(3);
      return;
    }
    if (!isSummaryComplete || !isCustomerComplete || !isLogisticsComplete) return;
    setCheckoutStep(4);
  };

  const stepValid = (step: 1 | 2 | 3 | 4) =>
    step === 1
      ? isSummaryComplete
      : step === 2
        ? isCustomerComplete
        : step === 3
          ? isLogisticsComplete
          : isPaymentComplete;

  const markStepAttempted = (step: 1 | 2 | 3 | 4) =>
    setStepAttempted((prev) => ({ ...prev, [step]: true }));

  const deliveryDateDisplay = (() => {
    if (!customer.delivery_date) return "";
    const d = new Date(`${customer.delivery_date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return customer.delivery_date;
    const weekday = d.toLocaleDateString("en-PH", { weekday: "long" });
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString("en-PH", { month: "long" });
    const year = d.getFullYear();
    return `${weekday} ${day} ${month} ${year}`;
  })();
  const deliveryDateLongDisplay = (() => {
    if (!customer.delivery_date) return "—";
    const d = new Date(`${customer.delivery_date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return customer.delivery_date;
    const weekday = d.toLocaleDateString("en-PH", { weekday: "long" });
    const month = d.toLocaleDateString("en-PH", { month: "long" });
    const year = d.getFullYear();
    return `${weekday}, ${ordinalDay(d.getDate())} of ${month} ${year}`;
  })();

  const openDatePicker = () => {
    setDatePickerOpen((prev) => !prev);
  };

  const dateOptions = useMemo(() => {
    const [y, m, d] = minDeliveryDate.split("-").map(Number);
    const start = new Date(y, (m || 1) - 1, d || 1);
    const out: Array<{ value: string; label: string }> = [];
    for (let i = 0; i < 35; i += 1) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      const value = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(
        cur.getDate()
      ).padStart(2, "0")}`;
      const label = cur.toLocaleDateString("en-PH", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      out.push({ value, label });
    }
    return out;
  }, [minDeliveryDate]);

  if (!isOpen) return null;

  const paymentSection = (
    <div style={styles.paymentBlock}>
      <div
        style={{
          ...styles.qrCardCompact,
          ...(isMobileViewport
            ? {
                gridTemplateColumns: "1fr",
                gap: 12,
                alignItems: "start",
              }
            : null),
        }}
      >
        <div
          style={{
            ...styles.qrLeft,
            ...(isMobileViewport
              ? {
                  display: "flex",
                  justifyContent: "center",
                }
              : {
                  marginLeft: 10,
                }),
          }}
        >
          {gcashQrUrl.trim() ? (
            <img
              src={gcashQrUrl.trim()}
              alt="GCash QR code"
              style={{
                ...styles.qrImage,
                width: isMobileViewport ? 220 : 270,
                height: isMobileViewport ? 220 : 270,
              }}
            />
          ) : (
            <svg
              viewBox="0 0 200 200"
              width={isMobileViewport ? 220 : 270}
              height={isMobileViewport ? 220 : 270}
              aria-label="QR placeholder"
              style={{ borderRadius: 14 }}
            >
              <rect x="0" y="0" width="200" height="200" fill="#fff" />
              <rect x="18" y="18" width="64" height="64" fill="#000" />
              <rect x="30" y="30" width="40" height="40" fill="#fff" />
              <rect x="118" y="18" width="64" height="64" fill="#000" />
              <rect x="130" y="30" width="40" height="40" fill="#fff" />
              <rect x="18" y="118" width="64" height="64" fill="#000" />
              <rect x="30" y="130" width="40" height="40" fill="#fff" />
              <rect x="95" y="95" width="12" height="12" fill="#000" />
              <rect x="112" y="95" width="12" height="12" fill="#000" />
              <rect x="95" y="112" width="12" height="12" fill="#000" />
              <rect x="132" y="112" width="12" height="12" fill="#000" />
              <rect x="150" y="95" width="12" height="12" fill="#000" />
              <rect x="112" y="132" width="12" height="12" fill="#000" />
            </svg>
          )}
          {gcashPhone.trim() ? (
            <div style={styles.gcashLine}>
              <span>GCASH to </span>
              <button
                type="button"
                style={styles.gcashNumberBtn}
                onClick={async () => {
                  const number = gcashPhone.trim();
                  if (!number) return;
                  try {
                    await navigator.clipboard.writeText(number);
                    setCopyNoticeVisible(true);
                  } catch {
                    // Clipboard may fail without secure context; keep silent.
                  }
                }}
                title="Copy GCash number"
              >
                {gcashPhone.trim()}
              </button>
              {copyNoticeVisible ? <span style={styles.copyNotice}>Copied</span> : null}
            </div>
          ) : null}
        </div>

        <div
          style={{
            ...styles.qrRightCompact,
            ...(isMobileViewport
              ? {
                  gap: 10,
                  alignItems: "flex-start",
                  justifyItems: "start",
                }
              : null),
          }}
        >
          <div
            style={{
              ...styles.paymentInstructionRow,
              ...(isMobileViewport ? { fontSize: 15, lineHeight: 1.3, marginBottom: 2 } : null),
            }}
          >
            Scan the QR code, complete your payment, take a screenshot, then upload it below.
          </div>
          <div style={styles.qrAmount}>₱ {formatMoney(grandTotal)}</div>
          <div style={{ ...styles.uploadBlock, ...(isMobileViewport ? styles.uploadBlockMobile : null) }}>
            <label
              style={{
                ...UI.btnGhost,
                ...styles.uploadBtnCompact,
                ...(isMobileViewport ? styles.uploadBtnFullMobile : null),
              }}
            >
              Upload Screenshot
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setPaymentFile?.(f);
                }}
              />
            </label>

            <div style={styles.uploadRow}>
              {paymentFile ? (
                <button
                  type="button"
                  style={styles.fileNameBtn}
                  onClick={() => {
                    if (!paymentFile.type.startsWith("image/")) return;
                    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
                    const nextUrl = URL.createObjectURL(paymentFile);
                    setProofPreviewUrl(nextUrl);
                    setProofPreviewOpen(true);
                  }}
                >
                  {paymentFile.name}
                </button>
              ) : null}
              {paymentFile ? (
                <button
                  type="button"
                  style={styles.removeFileBtn}
                  onClick={() => setPaymentFile?.(null)}
                  aria-label="Remove uploaded file"
                  title="Remove file"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop (ONLY below the white bar) */}
      <div
        style={{
          ...styles.backdrop,
          ...(backgroundStyle ?? null),
          top: panelTop,
          height: panelHeight,
        }}
      />

      {/* Panel (ONLY below the white bar) */}
      <aside
        className="tp-drawer-slide-up"
        style={{
          ...styles.panel,
          ...(backgroundStyle ?? null),
          top: panelTop,
          height: panelHeight,
        }}
        aria-hidden={!isOpen}
      >
        {/* Top row inside panel */}
        <div style={styles.topRow}>
          <AppButton type="button" variant="ghost" style={styles.backBtn} onClick={onBack}>
            BACK
          </AppButton>

          <div style={styles.topTitle}>CHECKOUT</div>
          {!isNarrow ? (
            <div style={styles.topProgressAnchor}>
              <div style={styles.topProgressBar}>
                {[
                  { step: 1 as const, label: "Cart" },
                  { step: 2 as const, label: "Customer" },
                  { step: 3 as const, label: "Delivery" },
                  { step: 4 as const, label: "Payment" },
                ].map((item) => (
                  <button
                    key={item.step}
                    type="button"
                    style={{
                      ...styles.topStepChipBtn,
                      ...(checkoutStep === item.step ? styles.topStepChipActive : null),
                    }}
                    onClick={() => goToStep(item.step)}
                  >
                    {item.label}
                    {stepValid(item.step) || isOrderSent ? (
                      <span style={styles.stepCheck}>✓</span>
                    ) : stepAttempted[item.step] ? (
                      <span style={styles.stepWarn} aria-label="Needs attention">
                        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                          <path
                            d="M12 3 22 20H2L12 3Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12 9v5m0 3v.01"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Content */}
        <div
          style={{
            ...styles.content,
            overflowY: isNarrow ? "auto" : "hidden",
            ...(isMobileViewport
              ? { padding: "10px 10px 20px", overflowX: "hidden" }
              : null),
          }}
        >
          {checkoutState === "success" ? (
            <div style={styles.successWrap}>
              <div style={styles.successCard}>
                <div style={styles.successTitle}>Order sent ✅</div>
                <div style={styles.successText}>
                  We received your order. We’ll confirm shortly.
                </div>
                <AppButton type="button" style={styles.backToShopBtn} onClick={onBack}>
                  BACK TO SHOP
                </AppButton>
              </div>
            </div>
          ) : (
            <div
              style={{
                ...styles.grid,
                gridTemplateColumns: isNarrow
                  ? "1fr"
                  : "minmax(260px, 0.55fr) minmax(0, 1.45fr)",
                height: isNarrow ? "auto" : "100%",
              }}
            >
              {/* LEFT: Summary */}
              <div style={{ ...styles.card, ...(isNarrow ? null : styles.leftCardFixed) }}>
                <div
                  style={{
                    ...styles.summaryCard,
                    ...(checkoutStep === 1 && !isNarrow ? styles.summaryCardStep1 : null),
                    ...(checkoutStep > 1 ? styles.summaryCardCollapsed : null),
                  }}
                >
                  <div style={styles.summaryLogisticsMiniTop}>
                    <div style={styles.summaryTopRow}>
                      <div style={styles.summaryMiniTitle}>CART</div>
                      <div>{summaryQty} items</div>
                    </div>
                    {hasOutOfStockItems ? (
                      <div style={styles.stockWarnBox}>
                        Some items are out of stock. Remove OOS items to continue checkout.
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      ...styles.summaryTotalRow,
                      ...styles.summaryTotalRowNoLine,
                      ...styles.summaryIndentedRow,
                    }}
                  >
                    <div style={styles.summaryMinorLabel}>Subtotal</div>
                    <div style={styles.summaryMinorValue}>
                      ₱ {formatMoney(computedTotal)}
                    </div>
                  </div>

                  {checkoutStep > 2 ? (
                    <div
                      style={{
                        ...styles.summaryTotalRow,
                        ...styles.summaryTotalRowNoLine,
                        ...styles.summaryIndentedRow,
                      }}
                    >
                      <div style={styles.summaryMinorLabel}>Delivery fee</div>
                      <div style={styles.summaryMinorValue}>
                        {!postalSupported && customer.postal_code.trim().length > 2 ? (
                          "—"
                        ) : deliveryFee <= 0 ? (
                          <span style={styles.freeTag}>FREE</span>
                        ) : (
                          `₱ ${formatMoney(deliveryFee)}`
                        )}
                      </div>
                    </div>
                  ) : null}

                  {checkoutStep > 2 ? (
                    <div
                      style={{
                        ...styles.summaryTotalRow,
                        ...styles.summaryTotalRowNoLine,
                        ...styles.summaryIndentedRow,
                      }}
                    >
                      <div style={styles.summaryMinorLabel}>
                        {referBagFee > 0 ? "Thermal bag" : "Standard bag"}
                      </div>
                      <div
                        style={{
                          ...styles.summaryMinorValue,
                          ...(referBagFee > 0 ? styles.summaryAccentText : null),
                        }}
                      >
                        {referBagFee > 0 ? "$200" : <span style={styles.freeTag}>FREE</span>}
                      </div>
                    </div>
                  ) : null}

                  <div style={styles.summaryShortDivider} />
                  <div
                    style={{
                      ...styles.summaryTotalRowFinal,
                      ...styles.summaryIndentedRow,
                    }}
                  >
                    <div style={styles.summaryTotalLabel}>TOTAL</div>
                    <div style={styles.summaryTotalValue}>
                      ₱ {formatMoney(displayedTotal)}
                    </div>
                  </div>

                  {checkoutStep === 3 && postalSupported && deliveryFee > 0 ? (
                    <div style={{ ...styles.deliveryHint, ...styles.summaryIndentedBlock }}>
                      The minimum order for your postal code is ₱ {formatMoney(freeDeliveryTarget)}.
                      {" "}Order ₱ {formatMoney(Math.max(freeDeliveryTarget - computedTotal, 0))} more
                      {" "}to get FREE delivery.
                    </div>
                  ) : null}
                  {checkoutStep > 1 && !postalSupported && customer.postal_code.trim().length > 0 ? (
                    <div style={styles.deliveryHintWarn}>
                      Postal code not yet covered for delivery.
                    </div>
                  ) : null}
                  {checkoutStep > 1 ? (
                    <div style={styles.summaryLogisticsMini}>
                      <div style={{ ...styles.summaryMiniTitle, marginTop: 0 }}>CUSTOMER</div>
                      <div style={styles.summaryDetailsGap} />
                      <div style={styles.summaryIndentedBlock}>{customer.full_name || "—"}</div>
                      <div style={styles.summaryIndentedBlock}>{customer.phone || "—"}</div>
                      <div style={styles.summaryIndentedBlock}>
                        {[
                          customer.attention_to,
                          customer.line1,
                          customer.barangay,
                          customer.city,
                          customer.province,
                          customer.postal_code,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </div>
                      {showDeliverySummary ? (
                        <>
                          <div style={{ ...styles.summaryMiniTitle, marginTop: 20 }}>DELIVERY</div>
                          <div style={{ ...styles.summaryIndentedBlock, marginTop: 10 }}>
                            {"Delivery scheduled on " +
                              (deliveryDateLongDisplay || customer.delivery_date || "—") +
                              (customer.delivery_slot ? ` at ${customer.delivery_slot}` : "") +
                              "."}
                          </div>
                          {customer.express_delivery ? (
                            <div style={{ ...styles.summaryIndentedBlock, ...styles.summaryAccentText }}>
                              Express delivery
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {checkoutStep > 1 ? (
                  <AppButton
                    variant="ghost"
                    style={{ ...styles.sendBtn, ...styles.backStepBtn }}
                    onClick={() =>
                      setCheckoutStep((prev) => (prev === 4 ? 3 : prev === 3 ? 2 : 1))
                    }
                  >
                    Previous
                  </AppButton>
                ) : null}
              </div>

              {/* RIGHT: Customer + Payment */}
              <div
                ref={rightStepScrollRef}
                style={{ ...styles.card, ...(isNarrow ? null : styles.rightCardScroll) }}
              >
                {isNarrow ? (
                  <div style={styles.progressBarInBody}>
                    <div
                      style={{
                        ...styles.topProgressBar,
                        ...(isMobileViewport
                          ? {
                              width: "100%",
                              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                            }
                          : null),
                      }}
                    >
                      {[
                        { step: 1 as const, label: "Cart" },
                        { step: 2 as const, label: "Customer" },
                        { step: 3 as const, label: "Delivery" },
                        { step: 4 as const, label: "Payment" },
                      ].map((item) => (
                        <button
                          key={item.step}
                          type="button"
                          style={{
                            ...styles.topStepChipBtn,
                            ...(isMobileViewport
                              ? { padding: "0 6px", gap: 4, fontSize: 11 }
                              : null),
                            ...(checkoutStep === item.step ? styles.topStepChipActive : null),
                          }}
                          onClick={() => goToStep(item.step)}
                        >
                          {item.label}
                          {stepValid(item.step) || isOrderSent ? (
                            <span style={styles.stepCheck}>✓</span>
                          ) : stepAttempted[item.step] ? (
                            <span style={styles.stepWarn} aria-label="Needs attention">
                              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                                <path
                                  d="M12 3 22 20H2L12 3Z"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M12 9v5m0 3v.01"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {checkoutStep === 1 ? (
                  <>
                    <div style={styles.cartStepItems}>
                      {summaryLines.length === 0 ? (
                        <div style={{ opacity: 0.7 }}>No items.</div>
                      ) : (
                        summaryLines.map((li: any) => (
                          <div key={String(li.productId)} style={styles.summaryLine}>
                            <div style={styles.summaryThumbWrap}>
                              {li.thumbnailUrl ? (
                                <img src={li.thumbnailUrl} alt="" style={styles.summaryThumbImg} />
                              ) : (
                                <LogoPlaceholder />
                              )}
                            </div>
                            <div style={styles.summaryLeft}>
                              <div style={styles.summaryName}>{li.name}</div>
                              <div style={styles.summaryMeta}>
                                {[li.size, li.temperature].filter(Boolean).join(" • ") || "—"}
                              </div>
                              <div style={styles.summaryPerPiece}>
                                ₱ {formatMoney(li.price ?? 0)} / pc
                              </div>
                            </div>
                            <div style={styles.summaryRight}>
                              <div style={styles.summaryLineTotal}>₱ {formatMoney(li.lineTotal)}</div>
                              {li.outOfStock ? (
                                <div style={styles.summaryOosGroup}>
                                  <span style={styles.summaryOosLabel}>OOS</span>
                                  <AppButton
                                    variant="ghost"
                                    style={{ ...styles.summaryPmBtn, opacity: li.qty > 0 ? 1 : 0.4 }}
                                    disabled={li.qty <= 0 || !onRemoveItem}
                                    onClick={() => onRemoveItem?.(String(li.productId))}
                                  >
                                    <span style={styles.summaryPmGlyph}>−</span>
                                  </AppButton>
                                  <div style={styles.summaryQty}>{li.qty}</div>
                                </div>
                              ) : (
                                <div style={styles.summaryPmRow}>
                                  <AppButton
                                    variant="ghost"
                                    style={{ ...styles.summaryPmBtn, opacity: li.qty > 0 ? 1 : 0.4 }}
                                    disabled={li.qty <= 0 || !onRemoveItem}
                                    onClick={() => onRemoveItem?.(String(li.productId))}
                                  >
                                    <span style={styles.summaryPmGlyph}>−</span>
                                  </AppButton>
                                  <div style={styles.summaryQty}>{li.qty}</div>
                                  <AppButton
                                    variant="ghost"
                                    style={styles.summaryPmBtn}
                                    disabled={!onAddItem}
                                    onClick={() => onAddItem?.(String(li.productId))}
                                  >
                                    <span style={styles.summaryPmGlyph}>+</span>
                                  </AppButton>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <AppButton
                      style={{
                        ...styles.sendBtn,
                        marginTop: 12,
                        marginBottom: 20,
                        opacity: isSummaryComplete ? 1 : 0.5,
                      }}
                      onClick={() => {
                        markStepAttempted(1);
                        if (isSummaryComplete) setCheckoutStep(2);
                      }}
                    >
                      Next
                    </AppButton>
                  </>
                ) : checkoutStep === 2 ? (
                  <>
	                <div
	                  style={isNarrow ? styles.detailsBodyScrollMobile : styles.detailsBodyScroll}
	                >

	                <div
	                  style={{
                    ...styles.detailsSectionBox,
                    ...(checkoutStep > 1 ? styles.detailsSectionBoxOffset : null),
                  }}
                >
	                <div style={{ ...fieldRowStyle, ...styles.firstFieldRow }}>
	                  <label style={fieldLabelStyle}>
	                    Full name<span style={styles.req}>*</span>
	                  </label>
                  <input
                    style={styles.input}
                    value={customer.full_name}
                    onChange={(e) =>
                      setCustomer({ ...customer, full_name: e.target.value })
                    }
                    placeholder="e.g. Juan Dela Cruz"
                  />
                </div>

                <div style={fieldRowStyle}>
                  <label style={fieldLabelStyle}>
                    Email<span style={styles.req}>*</span>
                  </label>
                  <input
                    style={styles.input}
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    placeholder="e.g. juan@email.com"
                  />
                </div>

                <div style={fieldRowStyle}>
                  <label style={fieldLabelStyle}>
                    Mobile number<span style={styles.req}>*</span>
                  </label>
                  <input
                    style={styles.input}
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="e.g. 09xx xxx xxxx"
                  />
                </div>

                {isLoggedIn ? (
                  <div style={{ ...fieldRowStyle, alignItems: "center" }}>
                    <label style={{ ...fieldLabelStyle, ...styles.deliveryAddressLabel }}>
                      Delivery address
                    </label>
	                    <label style={styles.profileAddressRow}>
	                      <input
	                        type="checkbox"
	                        style={styles.checkoutCheckbox}
	                        checked={useProfileAddress}
	                        onChange={(e) => {
                          const checked = e.target.checked;
                          setUseProfileAddress(checked);
                          if (checked && profileAddress) {
                            setCustomer({
                              ...customer,
                              attention_to: profileAddress.attention_to,
                              line1: profileAddress.line1,
                              line2: profileAddress.line2,
                              barangay: profileAddress.barangay,
                              city: profileAddress.city,
                              province: profileAddress.province,
                              postal_code: profileAddress.postal_code,
                              country: profileAddress.country || "Philippines",
                            });
                          } else {
                            setCustomer({
                              ...customer,
                              attention_to: "",
                              line1: "",
                              line2: "",
                              barangay: "",
                              city: "",
                              province: "",
                              postal_code: "",
                              country: "Philippines",
                            });
                          }
                        }}
                      />
                      <span style={styles.profileAddressText}>
                        use the address from
                        <button
                          type="button"
                          onClick={onOpenProfile}
                          style={styles.profileLinkBtn}
                        >
                          my profile
                        </button>
                      </span>
                    </label>
                  </div>
                ) : null}

                <div style={fieldRowStyle}>
                  <label style={fieldLabelStyle} aria-hidden="true" />
                  <div>
                    <input
                      style={styles.input}
                      value={customer.attention_to}
                      onChange={(e) =>
                        setCustomer({ ...customer, attention_to: e.target.value })
                      }
                      placeholder="Attention to (optional)"
                    />
                    <input
                      style={{ ...styles.input, marginTop: 8 }}
                      value={customer.line1}
                      onChange={(e) => setCustomer({ ...customer, line1: e.target.value })}
                      placeholder="Line 1 (house #, street)"
                    />
                    <input
                      style={{ ...styles.input, marginTop: 8 }}
                      value={customer.line2}
                      onChange={(e) => setCustomer({ ...customer, line2: e.target.value })}
                      placeholder="Line 2 (optional)"
                    />
                    <div style={styles.row2}>
                      <input
                        style={styles.input}
                        value={customer.barangay}
                        onChange={(e) => setCustomer({ ...customer, barangay: e.target.value })}
                        placeholder="Barangay"
                      />
                      <input
                        style={styles.input}
                        value={customer.city}
                        onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                        placeholder="City"
                      />
                    </div>
                    <div style={styles.row2}>
                      <input
                        style={styles.input}
                        value={customer.province}
                        onChange={(e) => setCustomer({ ...customer, province: e.target.value })}
                        placeholder="Province"
                      />
                      <input
                        style={styles.input}
                        value={customer.postal_code}
                        onChange={(e) =>
                          setCustomer({ ...customer, postal_code: e.target.value })
                        }
                        placeholder="Postal code"
                      />
                    </div>
                    <input
                      style={{ ...styles.input, marginTop: 8, opacity: 0.85 }}
                      value={customer.country}
                      disabled
                    />
                  </div>
                </div>

	                <div style={{ ...fieldRowStyle, alignItems: "flex-start" }}>
	                  <label style={{ ...fieldLabelStyle, ...styles.notesLabel }}>
                      Notes (optional)
                    </label>
	                  <textarea
	                    ref={notesTextareaRef}
	                    rows={1}
	                    style={styles.textarea}
	                    value={customer.notes}
	                    onChange={(e) => {
	                      setCustomer({ ...customer, notes: e.target.value });
	                      autoResizeNotes(e.currentTarget);
	                    }}
	                    placeholder="Preferred delivery time, gate instructions, etc."
	                  />
                </div>
                </div>

	                {!isLoggedIn && setCreateAccountFromDetails ? (
                  <label style={styles.optInRow}>
                    <input
                      type="checkbox"
                      style={styles.checkoutCheckbox}
                      checked={createAccountFromDetails}
                      onChange={(e) => setCreateAccountFromDetails(e.target.checked)}
                    />
                    <span>
                      Use my details to create an account and save for next time
                    </span>
                  </label>
                ) : null}
                {isLoggedIn && suggestSaveAddressToProfile && setSaveAddressToProfile ? (
                  <label style={styles.optInRow}>
                    <input
                      type="checkbox"
                      style={styles.checkoutCheckbox}
                      checked={saveAddressToProfile}
                      onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                    />
                    <span>Save this address to my profile</span>
                  </label>
                ) : null}
	                <AppButton
	                  style={{
	                    ...styles.sendBtn,
	                    marginTop: 12,
	                    marginBottom: 20,
	                    opacity: isCustomerComplete ? 1 : 0.5,
	                  }}
	                  onClick={() => {
	                    markStepAttempted(2);
	                    if (isCustomerComplete) setCheckoutStep(3);
	                  }}
		                >
		                  Next
		                </AppButton>
		                </div>
		                  </>
		                ) : checkoutStep === 3 ? (
		                  <>
		                <div
		                  style={isNarrow ? styles.detailsBodyScrollMobile : styles.detailsBodyScroll}
		                >
		                <div style={styles.detailsSectionBox}>
		                  <div style={{ ...fieldRowStyle, ...styles.firstFieldRow }}>
		                    <label style={fieldLabelStyle}>
		                      Delivery date<span style={styles.req}>*</span>
		                    </label>
		                    <div ref={datePickerWrapRef} style={styles.datePickerWrap}>
		                      <input
		                        type="text"
		                        readOnly
		                        style={{ ...styles.input, ...styles.dateDisplayInput }}
		                        value={deliveryDateDisplay}
		                        placeholder="dd mmm yyyy"
		                        onClick={openDatePicker}
		                      />
		                      <button
		                        type="button"
		                        style={styles.datePickerBtn}
		                        onClick={openDatePicker}
		                        aria-label="Select delivery date"
		                      >
		                        📅
		                      </button>
                              {datePickerOpen ? (
                                <div
                                  style={styles.datePickerPopup}
                                  onWheel={(e) => e.stopPropagation()}
                                  onTouchMove={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    style={{ ...styles.timeScrollBtn, ...styles.timeScrollBtnTop }}
                                    onClick={() => scrollDateOptions("up")}
                                    aria-label="Scroll date options up"
                                  >
                                    ▲
                                  </button>
                                  <div ref={datePickerListRef} style={styles.datePickerList}>
                                    {dateOptions.map((opt) => {
                                      const selected = opt.value === customer.delivery_date;
                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          style={{
                                            ...styles.dateOptionItem,
                                            ...(selected ? styles.dateOptionItemSelected : null),
                                          }}
                                          onClick={() => {
                                            setCustomer({
                                              ...customer,
                                              delivery_date: opt.value,
                                              delivery_slot: "",
                                            });
                                            setDatePickerOpen(false);
                                          }}
                                        >
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <button
                                    type="button"
                                    style={{ ...styles.timeScrollBtn, ...styles.timeScrollBtnBottom }}
                                    onClick={() => scrollDateOptions("down")}
                                    aria-label="Scroll date options down"
                                  >
                                    ▼
                                  </button>
                                </div>
                              ) : null}
		                    </div>
		                  </div>

		                  <div style={fieldRowStyle}>
		                    <label style={fieldLabelStyle}>
		                      Time slot<span style={styles.req}>*</span>
		                    </label>
		                    <div>
		                      <div ref={timePickerWrapRef} style={styles.timePickerWrap}>
		                        <button
		                          type="button"
		                          style={{ ...styles.input, ...styles.timeSelectInput, ...styles.timeSelectButton }}
		                          onClick={() => {
		                            if (!customer.delivery_date || validSlots.length === 0) return;
		                            setTimePickerOpen((prev) => !prev);
		                          }}
		                          aria-haspopup="listbox"
		                          aria-expanded={timePickerOpen}
		                          disabled={!customer.delivery_date}
		                        >
		                          <span
		                            style={
		                              customer.delivery_slot
		                                ? styles.timeSelectValue
		                                : styles.timeSelectPlaceholder
		                            }
		                          >
		                            {customer.delivery_slot || "Select time slot"}
		                          </span>
		                          <span style={styles.timeSelectCaret} aria-hidden="true">
		                            ▾
		                          </span>
		                        </button>
		                        {timePickerOpen ? (
		                          <div
		                            style={styles.timePickerMenu}
		                            role="listbox"
		                            onWheel={(e) => e.stopPropagation()}
		                            onTouchMove={(e) => e.stopPropagation()}
		                          >
                                <button
                                  type="button"
                                  style={{ ...styles.timeScrollBtn, ...styles.timeScrollBtnTop }}
                                  onClick={() => scrollTimeOptions("up")}
                                  aria-label="Scroll time options up"
                                >
                                  ▲
                                </button>
                                <div ref={timePickerListRef} style={styles.timePickerList}>
		                              {validSlots.length === 0 ? (
		                                <div style={styles.timePickerEmpty}>
		                                  No slots available for selected date
		                                </div>
		                              ) : (
		                                validSlots.map((slot) => {
		                                  const isSelected = slot === customer.delivery_slot;
		                                  return (
		                                    <button
		                                      key={slot}
		                                      type="button"
		                                      style={{
		                                        ...styles.timePickerItem,
		                                        ...(isSelected ? styles.timePickerItemSelected : null),
		                                      }}
		                                      onClick={() => {
		                                        setCustomer({ ...customer, delivery_slot: slot });
		                                        setTimePickerOpen(false);
		                                      }}
		                                      role="option"
		                                      aria-selected={isSelected}
		                                    >
		                                      {slot}
		                                    </button>
		                                  );
		                                })
		                              )}
                                </div>
                                <button
                                  type="button"
                                  style={{ ...styles.timeScrollBtn, ...styles.timeScrollBtnBottom }}
                                  onClick={() => scrollTimeOptions("down")}
                                  aria-label="Scroll time options down"
                                >
                                  ▼
                                </button>
		                          </div>
		                        ) : null}
		                      </div>
		                      {isWithin2h && !customer.express_delivery ? (
		                        <div style={styles.inlineTimeWarn}>Need 2h+ lead time or tick express.</div>
		                      ) : null}
		                    </div>
		                  </div>

		                  <div style={fieldRowStyle}>
		                    <label style={fieldLabelStyle}>Express delivery</label>
		                    <div style={styles.expressControl}>
		                      <label style={styles.optInRowInline}>
		                        <input
		                          type="checkbox"
                              style={styles.checkoutCheckbox}
		                          checked={customer.express_delivery}
		                          onChange={(e) =>
		                            setCustomer({ ...customer, express_delivery: e.target.checked })
		                          }
		                        />
		                        <span>Send as soon as possible</span>
		                      </label>
		                    </div>
		                  </div>
		                  <div style={{ ...fieldRowStyle, alignItems: "flex-start" }}>
		                    <label style={{ ...fieldLabelStyle, ...styles.packagingLabel }}>
                          Packaging
                        </label>
		                    <div style={styles.packagingOptions}>
		                      <label style={styles.packagingOptionLine}>
		                        <input
		                          type="checkbox"
                              style={styles.checkoutCheckbox}
		                          checked={!customer.add_refer_bag}
		                          onChange={(e) =>
		                            setCustomer({ ...customer, add_refer_bag: !e.target.checked })
		                          }
		                        />
		                        <span>
		                          Standard bag <strong style={styles.freeTag}>FREE</strong>
		                        </span>
		                      </label>
		                      <label style={styles.packagingOptionLine}>
		                        <input
		                          type="checkbox"
                              style={styles.checkoutCheckbox}
		                          checked={customer.add_refer_bag}
		                          onChange={(e) =>
		                            setCustomer({ ...customer, add_refer_bag: e.target.checked })
		                          }
		                        />
		                        <span>
		                          Thermal bag to keep item perfectly frozen/fresh{" "}
		                          <strong style={styles.freeTag}>$200</strong>
		                        </span>
		                      </label>
		                    </div>
		                  </div>
		                </div>

	                <AppButton
	                  style={{ ...styles.sendBtn, marginTop: 12, marginBottom: 20, opacity: isLogisticsComplete ? 1 : 0.5 }}
	                  onClick={() => {
	                    markStepAttempted(3);
	                    if (isLogisticsComplete) setCheckoutStep(4);
	                  }}
		                >
		                  Next
		                </AppButton>
		                </div>
		                  </>
		                ) : checkoutStep === 4 ? (
		                  <>
		                <div
		                  style={isNarrow ? styles.detailsBodyScrollMobile : styles.detailsBodyScroll}
		                >
		                  <div style={styles.detailsSectionBox}>
		                    {paymentSection}
		                  </div>
		                </div>
		                  </>
                ) : null}

                {proofPreviewOpen && proofPreviewUrl ? (
                  <>
                    <div
                      style={styles.previewBackdrop}
                      onClick={() => setProofPreviewOpen(false)}
                    />
                    <div style={styles.previewModal}>
                      <div style={styles.previewTop}>
                        <div style={styles.previewTitle}>ATTACHMENT PREVIEW</div>
                        <AppButton
                          variant="ghost"
                          style={styles.previewClose}
                          onClick={() => setProofPreviewOpen(false)}
                        >
                          CLOSE
                        </AppButton>
                      </div>
                      <img src={proofPreviewUrl} alt="Payment proof preview" style={styles.previewImg} />
                    </div>
                  </>
                ) : null}

	                {checkoutStep === 4 && isWithin2h && !customer.express_delivery ? (
                  <div style={styles.expressWarning}>
                    Allow at least 2h for delivery to happen. If you want express delivery, please check the box and we will send it the soonest possible.
                  </div>
                ) : null}
	                {checkoutStep === 4 ? (
                  <>
                    <div style={styles.reqHint}>{confirmHint}</div>
                    <AppButton
                      style={{
                        ...styles.sendBtn,
                        opacity: isCheckoutValid ? 1 : 0.4,
                      }}
                      onClick={() => {
                        markStepAttempted(4);
                        if (!isCheckoutValid) return;
                        onSubmit({
                          subtotal: computedTotal,
                          delivery_fee: deliveryFee,
                          thermal_bag_fee: referBagFee,
                          total: grandTotal,
                          postal_code: customer.postal_code,
                          delivery_date: customer.delivery_date,
                          delivery_slot: customer.delivery_slot,
                          express_delivery: customer.express_delivery,
                          add_thermal_bag: customer.add_refer_bag,
                        });
                      }}
                    >
                      Send Order
                    </AppButton>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    top: TOPBAR_H,
    left: 0,
    right: 0,
    height: `calc(100vh - ${TOPBAR_H}px)`,
    backgroundColor: "transparent",
    zIndex: 850,
  },

  panel: {
    position: "fixed",
    top: TOPBAR_H,
    left: "50%",
    transform: "translateX(-50%)",
    width: "var(--tp-rail-width)",
    height: `calc(100vh - ${TOPBAR_H}px)`,
    zIndex: 900,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    pointerEvents: "auto",
    backgroundColor: "transparent",
    borderRadius: 0,
    boxShadow: "none",
    border: "none",
  },

  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    padding: "18px 0 15px",
    color: "var(--tp-text-color)",
    position: "relative",
  },

  backBtn: {
    width: BACK_BTN_W,
    minWidth: BACK_BTN_W,
    height: 36,
    marginRight: TITLE_GAP,
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

  topTitle: {
    fontSize: TOPBAR_FONT_SIZE,
    fontWeight: 900,
    letterSpacing: 2,
    marginRight: TITLE_GAP,
  },

  topSubtitle: {
    fontSize: 15,
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  topProgressBar: {
    display: "grid",
    width: "100%",
    gridTemplateColumns: "repeat(4, minmax(96px, 1fr))",
    border: "1px solid var(--tp-border-color)",
    borderRadius: 999,
    overflow: "hidden",
  },
  topProgressAnchor: {
    // Align progress start with the right checkout column title ("CART").
    position: "absolute",
    left: `calc(${BACK_BTN_W + TITLE_GAP}px + ((100% - ${BACK_BTN_W + TITLE_GAP + CONTENT_RIGHT_PAD}px - ${CHECKOUT_GRID_GAP}px) * ${CHECKOUT_LEFT_COL_RATIO}) + ${CHECKOUT_GRID_GAP}px)`,
    right: `${CONTENT_RIGHT_PAD + PROGRESS_RIGHT_TRIM}px`,
    top: "50%",
    transform: "translateY(-50%)",
    display: "block",
    alignItems: "center",
  },
  progressBarInBody: {
    display: "flex",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 12,
  },
  topStepChipBtn: {
    height: 36,
    border: "none",
    borderRight: "1px solid var(--tp-border-color)",
    background: "transparent",
    color: "var(--tp-text-color)",
    opacity: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    padding: "0 clamp(10px, 4vw, 40px)",
  },
  topStepChipActive: {
    background: "var(--tp-control-bg-strong)",
    color: "var(--tp-text-color)",
    opacity: 1,
  },
  topStepChipDone: {
    color: "var(--tp-accent)",
  },
  stepCheck: {
    color: "var(--tp-accent)",
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1,
  },
  stepWarn: {
    color: "#ffb14a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },

  content: {
    flex: 1,
    overflowY: "hidden",
    padding: `10px ${CONTENT_RIGHT_PAD}px 46px ${BACK_BTN_W + TITLE_GAP}px`,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: CHECKOUT_GRID_GAP,
    alignItems: "start",
    maxWidth: "100%",
  },

  card: {
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: 0,
    color: "var(--tp-text-color)",
  },
  leftCardFixed: {
    position: "sticky",
    top: 0,
    alignSelf: "start",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    marginTop: -12,
  },
  rightCardScroll: {
    height: "100%",
    overflowY: "auto",
    paddingRight: 8,
    marginTop: 8,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: 2,
    opacity: 0.85,
    marginBottom: 12,
  },
  sectionTitleRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "flex-start",
    gap: 20,
  },
  sectionTitleRowSticky: {
    position: "static",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 20,
    background: "transparent",
    marginTop: 0,
    paddingBottom: 8,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 15,
    color: "var(--tp-accent)",
    fontWeight: 700,
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  },
  sectionDone: {
    display: "inline-block",
    alignSelf: "baseline",
  },
  sectionDoneBox: {
    color: "var(--tp-accent)",
    display: "inline-block",
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.2,
  },

  sectionTitle2: {
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: 2,
    opacity: 0.85,
    marginTop: 14,
    marginBottom: 10,
  },
  detailsSectionBox: {
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    background: "transparent",
  },
  detailsSectionBoxOffset: {
    marginTop: 0,
  },
  detailsSectionTitle: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.6,
    opacity: 0.9,
    marginBottom: 13,
    textTransform: "uppercase",
  },
  detailsBodyScroll: {
    maxHeight: "calc(100vh - 250px)",
    overflowY: "auto",
    // Keep box right edge aligned with cart step container.
    paddingRight: 0,
  },
  detailsBodyScrollMobile: {
    maxHeight: "none",
    overflowY: "visible",
    paddingRight: 0,
  },
  paymentBlock: {
    marginTop: 0,
    borderTop: "none",
    paddingTop: 0,
  },
  paymentInstructionRow: {
    fontSize: 15,
    opacity: 0.86,
    marginBottom: 8,
  },

  label: {
    display: "block",
    fontSize: 15,
    opacity: 0.85,
    marginBottom: 6,
    marginTop: 10,
  },
  labelDesktop: {
    display: "block",
    fontSize: 15,
    opacity: 0.85,
    marginBottom: 0,
    whiteSpace: "nowrap",
  },
  fieldRowDesktop: {
    display: "grid",
    gridTemplateColumns: "148px 1fr",
    alignItems: "center",
    columnGap: 14,
    marginTop: 8,
  },
  fieldRowMobile: {
    display: "grid",
  },
  firstFieldRow: {
    marginTop: 0,
  },

  req: {
    color: "rgba(255,255,255,0.7)",
    marginLeft: 4,
  },

  input: {
    width: "100%",
    height: 40,
    fontSize: 16,
    borderRadius: 12,
    border: "1px solid var(--tp-border-color-soft)",
    background: "transparent",
    color: "var(--tp-text-color)",
    padding: "0 15px",
    outline: "none",
  },

  textarea: {
    width: "100%",
    minHeight: 40,
    fontSize: 16,
    borderRadius: 12,
    border: "1px solid var(--tp-border-color-soft)",
    background: "transparent",
    color: "var(--tp-text-color)",
    padding: "9px 15px",
    outline: "none",
    resize: "none",
    overflow: "hidden",
    lineHeight: 1.3,
  },
  row2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 8,
  },
  optInRow: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 15,
    opacity: 0.9,
  },
  optInRowInline: {
    marginTop: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 15,
    opacity: 0.9,
  },
  expressControl: {
    display: "flex",
    alignItems: "center",
    minHeight: 40,
    padding: 0,
  },
  packagingOptions: {
    display: "grid",
    gap: 8,
    minHeight: 40,
    alignContent: "center",
  },
  packagingOptionLine: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 34,
    fontSize: 15,
    opacity: 0.9,
  },
  packagingLabel: {
    paddingTop: 8,
  },
  profileLinkBtn: {
    border: "none",
    background: "transparent",
    color: "var(--tp-accent)",
    textDecoration: "none",
    fontSize: 15,
    opacity: 1,
    padding: 0,
    marginLeft: 4,
    cursor: "pointer",
  },
  profileAddressText: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: 15,
    opacity: 0.85,
    lineHeight: "24px",
  },
  profileAddressRow: {
    marginTop: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    minHeight: 40,
    marginBottom: 0,
  },
  deliveryAddressLabel: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 40,
  },
  notesLabel: {
    paddingTop: 10,
  },
  checkoutCheckbox: {
    transform: "scale(1.2)",
    transformOrigin: "center",
  },

  uploadBlock: {
    marginTop: 4,
    display: "grid",
    gap: 8,
  },
  uploadBlockMobile: {
    marginTop: 10,
    width: "100%",
    justifySelf: "stretch",
  },
  uploadRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },

  uploadBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 15px",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  uploadBtnCompact: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 15px",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    width: "fit-content",
    whiteSpace: "nowrap",
  },
  uploadBtnFullMobile: {
    width: "100%",
    maxWidth: "100%",
    marginLeft: 0,
    justifyContent: "center",
    alignSelf: "stretch",
  },

  fileName: {
    fontSize: 18,
    opacity: 0.8,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
  fileNameBtn: {
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    opacity: 0.9,
    fontSize: 15,
    textAlign: "left",
    textDecoration: "underline",
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
    padding: 0,
  },
  removeFileBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
  },

  helper: {
    fontSize: 15,
    opacity: 0.65,
    marginTop: 8,
  },

  sendBtn: {
    width: "100%",
    height: 36,
    marginTop: 14,
    padding: "0 15px",
    borderRadius: 8,
    border: "1px solid var(--tp-cta-border)",
    background: "var(--tp-cta-bg)",
    color: "var(--tp-cta-fg)",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  backStepBtn: {
    marginTop: 20,
    border: "1px solid var(--tp-border-color)",
    background: "transparent",
    color: "var(--tp-text-color)",
    textTransform: "uppercase",
  },

  reqHint: {
    fontSize: 15,
    opacity: 0.9,
    marginTop: 10,
    marginBottom: -12,
    textAlign: "center",
    lineHeight: 1.35,
    color: "rgba(255,255,255,0.9)",
    padding: "8px 10px",
    border: "none",
    background: "transparent",
  },
  expressWarning: {
    marginTop: 8,
    color: "#ffb14a",
    fontSize: 15,
    lineHeight: 1.35,
  },
  inlineTimeWarn: {
    marginTop: 6,
    color: "#ffb14a",
    fontSize: 15,
    lineHeight: 1.2,
  },

  summaryCard: {
    borderRadius: 12,
    border: "1px solid var(--tp-border-color-soft)",
    background: "var(--tp-control-bg-soft)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    paddingBottom: 20,
  },
  summaryCardCollapsed: {
    borderRadius: 12,
    marginTop: 10,
  },
  summaryCardStep1: {
    marginTop: 10,
    borderRadius: 12,
    maxHeight: "calc(100vh - 320px)",
    minHeight: 0,
    overflow: "hidden",
  },
  summaryItemsScroll: {
    overflowY: "auto",
    maxHeight: "calc(100vh - 520px)",
    paddingRight: 4,
    paddingBottom: 8,
  },
  summaryItemsCollapsed: {
    overflow: "hidden",
  },
  cartStepItems: {
    overflowY: "auto",
    maxHeight: "calc(100vh - 430px)",
    paddingRight: 4,
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 12,
    padding: 12,
  },

  summaryLine: {
    display: "grid",
    gridTemplateColumns: "52px 1fr auto",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--tp-border-color-soft)",
  },
  summaryThumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid var(--tp-border-color-soft)",
    background: "var(--tp-control-bg-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryThumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  summaryCollapsedHint: {
    fontSize: 15,
    opacity: 0.72,
    padding: "8px 0 4px",
    borderBottom: "1px solid var(--tp-border-color-soft)",
    marginBottom: 8,
  },
  summaryLogisticsMini: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: "none",
    fontSize: 15,
    lineHeight: 1.35,
    opacity: 0.82,
    display: "grid",
    gap: 4,
  },
  summaryLogisticsMiniTop: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: "none",
    fontSize: 15,
    lineHeight: 1.35,
    opacity: 0.85,
    display: "grid",
    gap: 4,
  },
  summaryTopRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryMiniTitle: {
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: 1,
    opacity: 0.95,
    textTransform: "uppercase",
  },
  summaryDetailsGap: {
    height: 10,
  },
  summaryIndentedRow: {
    paddingLeft: 20,
  },
  summaryIndentedBlock: {
    paddingLeft: 20,
  },

  summaryLeft: {},
  summaryName: { fontSize: 15, fontWeight: 800, marginBottom: 4 },
  summaryMeta: { fontSize: 15, opacity: 0.75 },
  summaryPerPiece: { fontSize: 15, opacity: 0.72, marginTop: 6 },
  summaryRight: { textAlign: "right" },
  summaryLineTotal: { fontSize: 15, fontWeight: 900, marginBottom: 8 },
  summaryPmRow: {
    display: "grid",
    gridTemplateColumns: "32px 32px 32px",
    gap: 6,
    alignItems: "center",
    justifyContent: "end",
  },
  summaryPmBtn: {
    height: 28,
    width: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  summaryPmGlyph: {
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1,
    transform: "translateY(-1px)",
  },
  summaryQty: { fontSize: 15, fontWeight: 800, textAlign: "center" },
  summaryOosGroup: {
    display: "grid",
    gridTemplateColumns: "auto 32px 32px",
    gap: 6,
    alignItems: "center",
    justifyContent: "end",
  },
  summaryOosLabel: {
    height: 28,
    minWidth: 48,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(160,160,160,0.25)",
    color: "rgba(255,255,255,0.82)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.8,
  },

  summaryTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: 9,
    marginTop: 8,
    borderTop: "1px solid var(--tp-border-color-soft)",
  },
  summaryTotalRowNoLine: {
    borderTop: "none",
    paddingTop: 9,
    marginTop: 2,
  },
  summaryItemsCountRow: {
    fontSize: 15,
    opacity: 0.86,
    marginTop: 4,
    marginBottom: 2,
  },
  summaryTotalRowFinal: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: 12,
    marginTop: 0,
    marginBottom: 10,
    borderTop: "none",
  },
  summaryShortDivider: {
    height: 1,
    width: "calc(100% - 40px)",
    background: "var(--tp-border-color-soft)",
    marginLeft: 20,
    marginTop: 8,
    marginBottom: 0,
  },

  summaryTotalLabel: { fontSize: 15, opacity: 0.92, fontWeight: 900 },
  summaryTotalValue: { fontSize: 15, fontWeight: 900 },
  summaryMinorLabel: { fontSize: 15, fontWeight: 700, opacity: 0.8 },
  summaryMinorValue: { fontSize: 15, fontWeight: 800 },
  summaryAccentText: { color: "var(--tp-accent)" },
  freeTag: {
    color: "var(--tp-accent)",
  },
  deliveryHint: {
    marginTop: 8,
    fontSize: 15,
    color: "var(--tp-accent)",
  },
  deliveryHintWarn: {
    marginTop: 8,
    fontSize: 15,
    color: "#ffb14a",
  },
  stockWarnBox: {
    marginTop: 8,
    borderRadius: 10,
    border: "1px solid rgba(255,177,74,0.6)",
    background: "rgba(255,177,74,0.16)",
    color: "#ffd79d",
    padding: "8px 10px",
    fontSize: 13,
    lineHeight: 1.3,
  },
  datePickerWrap: {
    position: "relative",
  },
  datePickerPopup: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    zIndex: 45,
    border: "1px solid rgba(255,255,255,0.34)",
    borderRadius: 12,
    background: "rgba(0,0,0,0.96)",
    overflow: "hidden",
    height: 248,
    display: "grid",
    gridTemplateRows: "34px 1fr 34px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
  },
  datePickerList: {
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  dateOptionItem: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "#ffffff",
    textAlign: "left",
    padding: "10px 14px",
    fontSize: 15,
    cursor: "pointer",
  },
  dateOptionItemSelected: {
    color: "var(--tp-accent)",
    background: "rgba(255,255,255,0.08)",
    fontWeight: 700,
  },
  datePickerBtn: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    border: "1px solid var(--tp-border-color-soft)",
    background: "rgba(0,0,0,0.92)",
    color: "var(--tp-accent)",
    borderRadius: 8,
    width: 26,
    height: 26,
    fontSize: 16,
    cursor: "pointer",
    padding: 0,
    lineHeight: "24px",
    textAlign: "center",
  },
  dateDisplayInput: {
    background: "transparent",
    color: "var(--tp-text-color)",
    borderColor: "var(--tp-border-color-soft)",
  },
  timeSelectInput: {
    background: "transparent",
    color: "var(--tp-text-color)",
    borderColor: "var(--tp-border-color-soft)",
    colorScheme: "dark",
    accentColor: "var(--tp-accent)",
  },
  timePickerWrap: {
    position: "relative",
  },
  timeSelectButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    textAlign: "left",
    cursor: "pointer",
  },
  timeSelectValue: {
    color: "#ffffff",
  },
  timeSelectPlaceholder: {
    color: "rgba(255,255,255,0.55)",
  },
  timeSelectCaret: {
    color: "var(--tp-accent)",
    fontSize: 16,
    marginLeft: 10,
    lineHeight: 1,
  },
  timePickerMenu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    zIndex: 40,
    border: "1px solid rgba(255,255,255,0.34)",
    borderRadius: 12,
    background: "rgba(0,0,0,0.96)",
    overflow: "hidden",
    // Top arrow + ~5 rows + bottom arrow, compact enough to stay visible.
    height: 220,
    display: "grid",
    gridTemplateRows: "34px 1fr 34px",
    overscrollBehavior: "contain",
    boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
  },
  timePickerList: {
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  timeScrollBtn: {
    border: "none",
    background: "rgba(255,255,255,0.07)",
    color: "var(--tp-accent)",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.5,
    cursor: "pointer",
  },
  timeScrollBtnTop: {
    borderBottom: "1px solid rgba(255,255,255,0.14)",
  },
  timeScrollBtnBottom: {
    borderTop: "1px solid rgba(255,255,255,0.14)",
  },
  timePickerItem: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "#ffffff",
    textAlign: "left",
    padding: "10px 14px",
    fontSize: 15,
    cursor: "pointer",
  },
  timePickerItemSelected: {
    color: "var(--tp-accent)",
    background: "rgba(255,255,255,0.08)",
    fontWeight: 700,
  },
  timePickerEmpty: {
    color: "rgba(255,255,255,0.72)",
    padding: "12px 14px",
    fontSize: 15,
  },

  qrCard: {
    borderRadius: 0,
    border: "1px solid var(--tp-border-color-soft)",
    background: "transparent",
    padding: 14,
    display: "grid",
    gridTemplateColumns: "160px 1fr",
    gap: 14,
    alignItems: "center",
  },
  qrCardCompact: {
    marginTop: 8,
    border: "none",
    borderRadius: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 24,
    alignItems: "start",
  },
  qrRightCompact: {
    display: "grid",
    alignContent: "start",
    justifyItems: "start",
    gap: 14,
  },

  qrLeft: {},
  qrRight: { display: "flex", flexDirection: "column", gap: 8 },
  qrImage: {
    borderRadius: 14,
    objectFit: "cover",
    display: "block",
    border: "1px solid rgba(255,255,255,0.22)",
    background: "#fff",
  },
  gcashLine: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 1.2,
    color: "var(--tp-text-color)",
    textAlign: "center",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  gcashNumberBtn: {
    border: "none",
    background: "transparent",
    color: "var(--tp-accent)",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
  },
  copyNotice: {
    marginLeft: 5,
    fontSize: 12,
    color: "var(--tp-accent)",
    lineHeight: 1,
  },

  qrText: { fontSize: 15, opacity: 0.95, lineHeight: 1.25, fontWeight: 700 },
  qrAmount: { fontSize: 25, opacity: 1, fontWeight: 900, lineHeight: 1.1 },
  previewBackdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    zIndex: 1200,
  },
  previewModal: {
    position: "absolute",
    inset: 12,
    background: "var(--tp-control-bg-soft)",
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 10,
    padding: 12,
    zIndex: 1210,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  previewTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewTitle: {
    fontSize: 15,
    letterSpacing: 1.3,
    fontWeight: 900,
  },
  previewClose: {
    height: 36,
    minWidth: 88,
    borderRadius: 8,
    padding: "0 15px",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  previewImg: {
    width: "100%",
    height: "100%",
    minHeight: 0,
    objectFit: "contain",
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 8,
    background: "transparent",
  },

  successWrap: {
    maxWidth: 720,
    margin: "30px auto 0",
  },

  successCard: {
    background: "transparent",
    border: "1px solid var(--tp-border-color-soft)",
    borderRadius: 0,
    padding: 22,
    color: "var(--tp-text-color)",
    textAlign: "center",
  },

  successTitle: {
    fontSize: 16,
    fontWeight: 1000 as any,
    marginBottom: 8,
  },

  successText: {
    opacity: 0.75,
    marginBottom: 16,
  },

  backToShopBtn: {
    borderRadius: 14,
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    padding: "15px 15px",
    fontSize: TOPBAR_FONT_SIZE,
    fontWeight: 900,
    cursor: "pointer",
    width: "100%",
    textTransform: "uppercase",
  },
};
