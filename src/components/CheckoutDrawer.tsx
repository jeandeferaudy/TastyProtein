// src/components/CheckoutDrawer.tsx
"use client";

import React, { useMemo } from "react";
import type { Order } from "@/types/order";
import type { CheckoutSubmitPayload, CustomerDraft } from "@/types/checkout";
import { AppButton, UI } from "@/components/ui";
import LogoPlaceholder from "@/components/LogoPlaceholder";
import { supabase } from "@/lib/supabase";

const TOPBAR_H = 88; // <-- adjust to match your white bar height (try 80-96)
const BACK_BTN_W = 68;
const TITLE_GAP = 40;

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
  const deliveryDateInputRef = React.useRef<HTMLInputElement | null>(null);
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
  const minDateObj = new Date(minDeliveryMs);
  const minDeliveryDate = `${minDateObj.getFullYear()}-${String(
    minDateObj.getMonth() + 1
  ).padStart(2, "0")}-${String(minDateObj.getDate()).padStart(2, "0")}`;

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

  const defaultDeliveryTarget = useMemo(() => {
    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    const fmtSlot = (d: Date) =>
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

    const now = new Date();
    let target = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    // If +3h goes to 9pm or later, default to next day at 10:00.
    if (target.getHours() >= 21) {
      target = new Date(target);
      target.setDate(target.getDate() + 1);
      target.setHours(10, 0, 0, 0);
      return { date: fmtDate(target), slot: fmtSlot(target) };
    }

    // Round up to nearest 30-minute slot.
    const rounded = new Date(target);
    const mins = rounded.getMinutes();
    if (mins === 0 || mins === 30) {
      // keep
    } else if (mins < 30) {
      rounded.setMinutes(30, 0, 0);
    } else {
      rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
    }

    if (rounded.getHours() >= 21) {
      rounded.setDate(rounded.getDate() + 1);
      rounded.setHours(10, 0, 0, 0);
    }

    return { date: fmtDate(rounded), slot: fmtSlot(rounded) };
  }, []);

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
    if (!customer.delivery_date) {
      const next = { ...customer, delivery_date: defaultDeliveryTarget.date };
      const nextSlots = validSlots.length ? validSlots : daytimeSlots;
      next.delivery_slot = nextSlots.includes(defaultDeliveryTarget.slot)
        ? defaultDeliveryTarget.slot
        : nextSlots[0] ?? "";
      setCustomer(next);
      return;
    }
    if (!validSlots.length) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(tomorrow.getDate()).padStart(2, "0")}`;
      setCustomer({
        ...customer,
        delivery_date: nextDate,
        delivery_slot: "10:00",
      });
      return;
    }
    if (customer.delivery_slot && !validSlots.includes(customer.delivery_slot)) {
      setCustomer({
        ...customer,
        delivery_slot: validSlots[0] ?? "",
      });
    } else if (!customer.delivery_slot && validSlots[0]) {
      setCustomer({
        ...customer,
        delivery_slot: validSlots[0],
      });
    }
  }, [customer, daytimeSlots, defaultDeliveryTarget.date, defaultDeliveryTarget.slot, isOpen, setCustomer, validSlots]);

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
    (!requiresProof || !!paymentFile);
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
  const missingTotal = missingCustomer.length + (missingProof ? 1 : 0);

  let missingHint = "";
  if (missingTotal === 0) {
    missingHint = "Looks good. You can send your order.";
  } else if (missingTotal <= 2) {
    const specific = [...missingCustomer, ...(missingProof ? ["payment proof"] : [])];
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

  if (!isOpen) return null;

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
    const el = deliveryDateInputRef.current as
      | (HTMLInputElement & { showPicker?: () => void })
      | null;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      el.showPicker();
      return;
    }
    el.click();
  };

  const paymentSection = (
    <div style={styles.paymentBlock}>
      <div
        style={{
          ...styles.paymentInstructionRow,
          ...(isMobileViewport ? { fontSize: 13, lineHeight: 1.3, marginBottom: 10 } : null),
        }}
      >
        Scan the QR code, complete your payment, take a screenshot, then upload it below.
      </div>
      <div
        style={{
          ...styles.qrCardCompact,
          ...(isMobileViewport
            ? {
                gridTemplateColumns: "auto 1fr",
                gap: 12,
                alignItems: "center",
              }
            : null),
        }}
      >
        <div style={styles.qrLeft}>
          <svg
            viewBox="0 0 200 200"
            width={isMobileViewport ? 152 : 208}
            height={isMobileViewport ? 152 : 208}
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
        </div>

        <div
          style={{
            ...styles.qrRightCompact,
            ...(isMobileViewport ? { gap: 10, alignItems: "flex-start", justifyItems: "start" } : null),
          }}
        >
          <div style={styles.qrAmount}>₱ {formatMoney(grandTotal)}</div>
        </div>
      </div>
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
                    {stepAttempted[item.step] ? (
                      stepValid(item.step) || isOrderSent ? (
                        <span style={styles.stepCheck}>✓</span>
                      ) : (
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
                      )
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
                      <div style={styles.summaryMinorValue}>
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
                      <div style={{ ...styles.summaryMiniTitle, marginTop: 20 }}>DELIVERY</div>
                      <div style={{ ...styles.summaryIndentedBlock, marginTop: 10 }}>
                        {"Delivery scheduled on " +
                          (deliveryDateLongDisplay || customer.delivery_date || "—") +
                          (customer.delivery_slot ? ` at ${customer.delivery_slot}` : "") +
                          "."}
                      </div>
                      {customer.express_delivery ? <div style={styles.summaryIndentedBlock}>Express delivery</div> : null}
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
                          {stepAttempted[item.step] ? (
                            stepValid(item.step) || isOrderSent ? (
                              <span style={styles.stepCheck}>✓</span>
                            ) : (
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
                            )
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {checkoutStep === 1 ? (
                  <>
                    <div style={styles.sectionTitleRowSticky}>
                      <div style={styles.sectionTitle}>CART</div>
                      {null}
                    </div>
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
	                <div style={styles.sectionTitleRowSticky}>
	                  <div style={styles.sectionTitle}>CUSTOMER DETAILS</div>
		                  {null}
	                </div>
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
                    <label style={fieldLabelStyle}>Delivery address</label>
	                    <label style={styles.profileAddressRow}>
	                      <input
	                        type="checkbox"
	                        style={styles.profileAddressCheckbox}
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
                      <span>
                        use the address from{" "}
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
	                  <label style={fieldLabelStyle}>Notes (optional)</label>
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
		                <div style={styles.sectionTitleRowSticky}>
		                  <div style={styles.sectionTitle}>DELIVERY</div>
		                  {null}
		                </div>
		                <div
		                  style={isNarrow ? styles.detailsBodyScrollMobile : styles.detailsBodyScroll}
		                >
		                <div style={styles.detailsSectionBox}>
		                  <div style={{ ...fieldRowStyle, ...styles.firstFieldRow }}>
		                    <label style={fieldLabelStyle}>
		                      Delivery date<span style={styles.req}>*</span>
		                    </label>
		                    <div style={styles.datePickerWrap}>
		                      <input
		                        type="text"
		                        readOnly
		                        style={styles.input}
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
		                      <input
		                        ref={deliveryDateInputRef}
		                        type="date"
		                        min={minDeliveryDate}
		                        style={styles.dateInputNative}
		                        value={customer.delivery_date}
		                        onChange={(e) =>
		                          setCustomer({ ...customer, delivery_date: e.target.value })
		                        }
		                      />
		                    </div>
		                  </div>

		                  <div style={fieldRowStyle}>
		                    <label style={fieldLabelStyle}>
		                      Time slot<span style={styles.req}>*</span>
		                    </label>
		                    <div>
		                      <select
		                        style={styles.input}
		                        value={customer.delivery_slot}
		                        onChange={(e) =>
		                          setCustomer({ ...customer, delivery_slot: e.target.value })
		                        }
		                      >
		                        {validSlots.map((slot) => (
		                          <option key={slot} value={slot}>
		                            {slot}
		                          </option>
		                        ))}
		                      </select>
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
		                    <label style={fieldLabelStyle}>Packaging</label>
		                    <div style={styles.packagingOptions}>
		                      <label style={styles.packagingOptionLine}>
		                        <input
		                          type="checkbox"
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
		                <div style={styles.sectionTitleRowSticky}>
		                  <div style={styles.sectionTitle}>PAYMENT</div>
		                  {null}
		                </div>
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
    padding: "18px 0 12px",
    color: "var(--tp-text-color)",
  },

  backBtn: {
    width: BACK_BTN_W,
    minWidth: BACK_BTN_W,
    height: 36,
    marginRight: TITLE_GAP,
    padding: 0,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
  },

  topTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 2,
    marginRight: TITLE_GAP,
  },

  topSubtitle: {
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  topProgressBar: {
    display: "inline-grid",
    gridTemplateColumns: "repeat(4, minmax(96px, 1fr))",
    border: "1px solid var(--tp-border-color)",
    borderRadius: 999,
    overflow: "hidden",
  },
  topProgressAnchor: {
    marginLeft: "clamp(96px, 10vw, 180px)",
    display: "flex",
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
    opacity: 0.78,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    padding: "0 clamp(10px, 4vw, 40px)",
  },
  topStepChipActive: {
    background: "var(--tp-control-bg)",
    color: "var(--tp-text-color)",
    opacity: 1,
  },
  topStepChipDone: {
    color: "#3aaaf5",
  },
  stepCheck: {
    color: "#3aaaf5",
    fontSize: 14,
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
    padding: `10px 24px 26px ${BACK_BTN_W + TITLE_GAP}px`,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 26,
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
  },
  rightCardScroll: {
    height: "100%",
    overflowY: "auto",
    paddingRight: 8,
  },

  sectionTitle: {
    fontSize: 13,
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
    fontSize: 13,
    color: "#3aaaf5",
    fontWeight: 700,
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  },
  sectionDone: {
    display: "inline-block",
    alignSelf: "baseline",
  },
  sectionDoneBox: {
    color: "#3aaaf5",
    display: "inline-block",
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.2,
  },

  sectionTitle2: {
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.6,
    opacity: 0.9,
    marginBottom: 13,
    textTransform: "uppercase",
  },
  detailsBodyScroll: {
    maxHeight: "calc(100vh - 330px)",
    overflowY: "auto",
    paddingRight: 8,
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
    fontSize: 13,
    opacity: 0.85,
    marginBottom: 6,
    marginTop: 10,
  },
  labelDesktop: {
    display: "block",
    fontSize: 13,
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
    borderRadius: 12,
    border: "1px solid var(--tp-border-color-soft)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "0 12px",
    outline: "none",
  },

  textarea: {
    width: "100%",
    minHeight: 40,
    borderRadius: 12,
    border: "1px solid var(--tp-border-color-soft)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    padding: "9px 12px",
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
    fontSize: 13,
    opacity: 0.9,
  },
  optInRowInline: {
    marginTop: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
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
    fontSize: 14,
    opacity: 0.9,
  },
  profileLinkBtn: {
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    textDecoration: "underline",
    fontSize: 13,
    padding: 0,
    cursor: "pointer",
  },
  profileAddressRow: {
    marginTop: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontSize: 17,
    opacity: 0.95,
  },
  profileAddressCheckbox: {
    transform: "scale(1.3)",
    transformOrigin: "center",
  },

  uploadBlock: {
    marginTop: 4,
    display: "grid",
    gap: 8,
  },
  uploadBlockMobile: {
    marginTop: 10,
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
    padding: "0 12px",
    cursor: "pointer",
    fontSize: 13,
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
    padding: "0 12px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    width: "fit-content",
    whiteSpace: "nowrap",
  },
  uploadBtnFullMobile: {
    width: "calc(100% + 20px)",
    marginLeft: -10,
    justifyContent: "center",
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
    fontSize: 14,
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
    fontSize: 13,
    opacity: 0.65,
    marginTop: 8,
  },

  sendBtn: {
    width: "100%",
    height: 36,
    marginTop: 14,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid var(--tp-cta-border)",
    background: "var(--tp-cta-bg)",
    color: "var(--tp-cta-fg)",
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 13,
    lineHeight: 1.35,
  },
  inlineTimeWarn: {
    marginTop: 6,
    color: "#ffb14a",
    fontSize: 12,
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
    fontSize: 13,
    opacity: 0.72,
    padding: "8px 0 4px",
    borderBottom: "1px solid var(--tp-border-color-soft)",
    marginBottom: 8,
  },
  summaryLogisticsMini: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: "none",
    fontSize: 12,
    lineHeight: 1.35,
    opacity: 0.82,
    display: "grid",
    gap: 4,
  },
  summaryLogisticsMiniTop: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: "none",
    fontSize: 12,
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
    fontSize: 13,
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
  summaryName: { fontSize: 13, fontWeight: 800, marginBottom: 4 },
  summaryMeta: { fontSize: 13, opacity: 0.75 },
  summaryPerPiece: { fontSize: 13, opacity: 0.72, marginTop: 6 },
  summaryRight: { textAlign: "right" },
  summaryLineTotal: { fontSize: 13, fontWeight: 900, marginBottom: 8 },
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
  summaryQty: { fontSize: 13, fontWeight: 800, textAlign: "center" },

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
    fontSize: 12,
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

  summaryTotalLabel: { fontSize: 13, opacity: 0.92, fontWeight: 900 },
  summaryTotalValue: { fontSize: 14, fontWeight: 900 },
  summaryMinorLabel: { fontSize: 14, fontWeight: 700, opacity: 0.8 },
  summaryMinorValue: { fontSize: 14, fontWeight: 800 },
  freeTag: {
    color: "#3aaaf5",
  },
  deliveryHint: {
    marginTop: 8,
    fontSize: 13,
    color: "#3aaaf5",
  },
  deliveryHintWarn: {
    marginTop: 8,
    fontSize: 13,
    color: "#ffb14a",
  },
  datePickerWrap: {
    position: "relative",
  },
  datePickerBtn: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    fontSize: 16,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  dateInputNative: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    pointerEvents: "none",
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

  qrText: { fontSize: 14, opacity: 0.95, lineHeight: 1.25, fontWeight: 700 },
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
    fontSize: 13,
    letterSpacing: 1.3,
    fontWeight: 900,
  },
  previewClose: {
    height: 36,
    minWidth: 88,
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 13,
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
    fontSize: 18,
    fontWeight: 1000 as any,
    marginBottom: 8,
  },

  successText: {
    opacity: 0.75,
    marginBottom: 16,
  },

  backToShopBtn: {
    borderRadius: 14,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg)",
    color: "var(--tp-text-color)",
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
    width: "100%",
    textTransform: "uppercase",
  },
};
