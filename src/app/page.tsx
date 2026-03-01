// src/app/page.tsx
"use client";

import * as React from "react";

import Navbar from "@/components/Navbar";
import ProductGrid from "@/components/ProductGrid";
import ProductDrawer from "@/components/ProductDrawer";
import ProductEditorDrawer from "@/components/ProductEditorDrawer";
import CartDrawer from "@/components/CartDrawer";
import CheckoutDrawer from "@/components/CheckoutDrawer";
import AuthModal from "@/components/AuthModal";
import MyDetailsDrawer from "@/components/MyDetailsDrawer";
import MyOrdersDrawer, { type MyOrderItem } from "@/components/MyOrdersDrawer";
import OrderDrawer from "@/components/OrderDrawer";
import InventoryDrawer, { type InventoryLine } from "@/components/InventoryDrawer";
import AnalyticsDrawer from "@/components/AnalyticsDrawer";
import ZoneStyleModal, {
  type ZoneStyleDraft,
  type ThemeColorsDraft,
  type BannerDraft,
  type CheckoutPaymentDraft,
} from "@/components/ZoneStyleModal";
import LogoEditorModal from "@/components/LogoEditorModal";

import { formatMoney } from "@/lib/money";
import { getSessionId } from "@/lib/session";
import {
  fetchProducts,
  fetchProductImages,
  matchesProductQuery,
  type DbProduct,
  type ProductImage,
} from "@/lib/products";
import { fetchCartView, setCartLineQty } from "@/lib/cartApi";
import * as Cart from "@/lib/cart";
import {
  addOrderLinesByAdmin,
  deleteOrderByAdmin,
  fetchOrderDetail,
  fetchOrders,
  updateOrderAmountPaid,
  updateOrderAdminFields,
  updateOrderPaymentProof,
  updateOrderLinePackedQty,
  updateOrderStatuses,
  type OrderAdminPatch,
  type OrderDetail,
  type OrderStatusPatch,
} from "@/lib/ordersApi";
import { supabase } from "@/lib/supabase";
import type { CheckoutSubmitPayload, CustomerDraft } from "@/types/checkout";

type Panel = null | "product" | "checkout" | "edit";
type ZoneName = "header" | "navbar" | "main";
type FilterKey = "status" | "type" | "cut" | "country" | "preparation" | "temperature";

type ZoneRow = {
  zone: ZoneName;
  mode: "dark" | "light";
  bg_type: "color" | "image";
  bg_color: string | null;
  bg_image_url: string | null;
};

const DEFAULT_ZONE_STYLES: Record<ZoneName, ZoneStyleDraft> = {
  header: { bg_type: "color", bg_color: "#000000", bg_image_url: "" },
  navbar: { bg_type: "color", bg_color: "#ffffff", bg_image_url: "" },
  main: { bg_type: "color", bg_color: "#000000", bg_image_url: "" },
};
const DEFAULT_ZONE_STYLES_BY_MODE: Record<"dark" | "light", Record<ZoneName, ZoneStyleDraft>> = {
  dark: {
    header: { ...DEFAULT_ZONE_STYLES.header },
    navbar: { ...DEFAULT_ZONE_STYLES.navbar },
    main: { ...DEFAULT_ZONE_STYLES.main },
  },
  light: {
    header: { ...DEFAULT_ZONE_STYLES.header },
    navbar: { ...DEFAULT_ZONE_STYLES.navbar },
    main: { ...DEFAULT_ZONE_STYLES.main },
  },
};

const UI_ASSETS_BUCKET = "ui-assets";

type BrandingRow = {
  logo_url: string | null;
  logo_url_dark?: string | null;
  logo_url_light?: string | null;
  gcash_qr_url?: string | null;
  gcash_phone?: string | null;
};

type ThemeColorsRow = ThemeColorsDraft & {
  mode: "dark" | "light";
};

type BannerRow = {
  id: string;
  image_url: string | null;
  link_url: string | null;
  sort_order: number | null;
};

function normalizeInventorySnapshot(row: Record<string, unknown>): {
  qty_on_hand: number;
  qty_allocated: number;
  qty_available: number;
} {
  const qtyOnHand = Math.max(0, Number(row.qty_on_hand ?? 0));
  const qtyAllocated = Math.max(0, Number(row.qty_allocated ?? 0));
  const rawAvailable = row.qty_available == null ? Number.NaN : Number(row.qty_available);
  const qtyAvailable = Number.isFinite(rawAvailable)
    ? Math.max(0, rawAvailable)
    : Math.max(qtyOnHand - qtyAllocated, 0);
  return {
    qty_on_hand: qtyOnHand,
    qty_allocated: qtyAllocated,
    qty_available: qtyAvailable,
  };
}

function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="2.2" fill="currentColor" />
      <circle cx="15" cy="12" r="2.2" fill="currentColor" />
      <circle cx="11" cy="17" r="2.2" fill="currentColor" />
    </svg>
  );
}

function isDarkColor(hexOrColor: string | null | undefined): boolean {
  const raw = String(hexOrColor ?? "").trim();
  if (!raw) return false;
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) return false;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5;
}

export default function Page() {
  const blankCustomer = React.useCallback(
    (): CustomerDraft => ({
      full_name: "",
      email: "",
      phone: "",
      placed_for_someone_else: false,
      attention_to: "",
      line1: "",
      line2: "",
      barangay: "",
      city: "",
      province: "",
      postal_code: "",
      country: "Philippines",
      notes: "",
      delivery_date: "",
      delivery_slot: "",
      express_delivery: false,
      add_refer_bag: false,
    }),
    []
  );
  const getEditModeKey = React.useCallback(
    (uid: string | null) => `tp_edit_mode_${uid ?? "anon"}`,
    []
  );
  // ----------------------------
  // Session + layout refs
  // ----------------------------
  const sessionIdRef = React.useRef<string>("");

  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const navRef = React.useRef<HTMLDivElement | null>(null);
  const listScrollRef = React.useRef<HTMLDivElement | null>(null);

  const [topOffset, setTopOffset] = React.useState<number>(0);
  const [isMobileViewport, setIsMobileViewport] = React.useState<boolean>(false);

  // remember list scroll position for "back to where I was"
  const listScrollTopRef = React.useRef<number>(0);
  const windowScrollTopRef = React.useRef<number>(0);

  // ----------------------------
  // Products
  // ----------------------------
  const [products, setProducts] = React.useState<DbProduct[]>([]);
  const [productImagesById, setProductImagesById] = React.useState<
    Record<string, ProductImage[]>
  >({});
  const [loadingProducts, setLoadingProducts] = React.useState<boolean>(true);
  const [selectedFilters, setSelectedFilters] = React.useState<Record<FilterKey, string[]>>({
    status: [],
    type: [],
    cut: [],
    country: [],
    preparation: [],
    temperature: [],
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState<boolean>(false);

  const [search, setSearch] = React.useState<string>("");
  const [gridView, setGridView] = React.useState<"list" | "4" | "5">("4");
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  const [authOpen, setAuthOpen] = React.useState<boolean>(false);
  const [authLabel, setAuthLabel] = React.useState<string | null>(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [authProfileName, setAuthProfileName] = React.useState<string>("");
  const [authUserId, setAuthUserId] = React.useState<string | null>(null);
  const [authEmail, setAuthEmail] = React.useState<string>("");
  const [authPhone, setAuthPhone] = React.useState<string>("");
  const [detailsOpen, setDetailsOpen] = React.useState<boolean>(false);
  const [ordersOpen, setOrdersOpen] = React.useState<boolean>(false);
  const [allOrdersOpen, setAllOrdersOpen] = React.useState<boolean>(false);
  const [inventoryOpen, setInventoryOpen] = React.useState<boolean>(false);
  const [analyticsOpen, setAnalyticsOpen] = React.useState<boolean>(false);
  const [inventoryRows, setInventoryRows] = React.useState<InventoryLine[]>([]);
  const [loadingInventory, setLoadingInventory] = React.useState<boolean>(false);
  const [editMode, setEditMode] = React.useState<boolean>(false);
  const [myOrders, setMyOrders] = React.useState<MyOrderItem[]>([]);
  const [allOrders, setAllOrders] = React.useState<MyOrderItem[]>([]);
  const [selectedMyOrderId, setSelectedMyOrderId] = React.useState<string | null>(null);
  const [selectedAllOrderId, setSelectedAllOrderId] = React.useState<string | null>(null);
  const [orderDrawerSource, setOrderDrawerSource] = React.useState<"my" | "all" | "public" | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = React.useState<OrderDetail | null>(
    null
  );
  const [loadingOrderDetail, setLoadingOrderDetail] = React.useState<boolean>(false);
  const [submittingCheckout, setSubmittingCheckout] = React.useState<boolean>(false);
  const [adminAllProductsMode, setAdminAllProductsMode] = React.useState<boolean>(false);
  const [zoneStylesByMode, setZoneStylesByMode] = React.useState<
    Record<"dark" | "light", Record<ZoneName, ZoneStyleDraft>>
  >(DEFAULT_ZONE_STYLES_BY_MODE);
  const [zoneEditorOpen, setZoneEditorOpen] = React.useState<boolean>(false);
  const [zoneEditorTarget, setZoneEditorTarget] = React.useState<ZoneName>("header");
  const [zoneEditorSaving, setZoneEditorSaving] = React.useState<boolean>(false);
  const [zoneEditorError, setZoneEditorError] = React.useState<string>("");
  const [themeMode] = React.useState<"dark" | "light">("dark");
  const [logoUrlsByMode, setLogoUrlsByMode] = React.useState<Record<"dark" | "light", string>>({
    dark: "",
    light: "",
  });
  const [checkoutPaymentDraft, setCheckoutPaymentDraft] = React.useState<CheckoutPaymentDraft>({
    gcash_qr_url: "",
    gcash_phone: "",
  });
  const [logoEditorOpen, setLogoEditorOpen] = React.useState<boolean>(false);
  const [logoEditorSaving, setLogoEditorSaving] = React.useState<boolean>(false);
  const [logoEditorError, setLogoEditorError] = React.useState<string>("");
  const [isMainBgReady, setIsMainBgReady] = React.useState<boolean>(false);
  const [banners, setBanners] = React.useState<BannerRow[]>([]);
  const [bannerIndex, setBannerIndex] = React.useState(0);
  const DEFAULT_THEME_COLORS_BY_MODE: Record<"dark" | "light", ThemeColorsDraft> = React.useMemo(
    () => ({
      dark: {
        accent_color: "#b89958",
        text_color: "#ffffff",
        line_color: "#ffffff",
        button_border_color: "#ffffff",
        button_bg_color: "transparent",
        checkbox_color: "#cfd6dd",
        background_color: "#000000",
      },
      light: {
        accent_color: "#b89958",
        text_color: "#111111",
        line_color: "#111111",
        button_border_color: "#111111",
        button_bg_color: "transparent",
        checkbox_color: "#6c747c",
        background_color: "#ffffff",
      },
    }),
    []
  );
  const [themeColorsByMode, setThemeColorsByMode] = React.useState<
    Record<"dark" | "light", ThemeColorsDraft>
  >(DEFAULT_THEME_COLORS_BY_MODE);

  const activeBanners = React.useMemo(
    () =>
      banners
        .filter((b) => String(b.image_url ?? "").trim())
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [banners]
  );

  const handlePrevBanner = React.useCallback(() => {
    if (activeBanners.length <= 1) return;
    setBannerIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);
  }, [activeBanners.length]);

  const handleNextBanner = React.useCallback(() => {
    if (activeBanners.length <= 1) return;
    setBannerIndex((prev) => (prev + 1) % activeBanners.length);
  }, [activeBanners.length]);

  React.useEffect(() => {
    if (activeBanners.length === 0) {
      setBannerIndex(0);
      return;
    }
    if (bannerIndex >= activeBanners.length) {
      setBannerIndex(0);
    }
  }, [activeBanners.length, bannerIndex]);

  React.useEffect(() => {
    if (activeBanners.length <= 1) return;
    const timer = window.setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % activeBanners.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeBanners.length]);

  // ----------------------------
  // Panels
  // ----------------------------
  const [panel, setPanel] = React.useState<Panel>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editorReturnToProduct, setEditorReturnToProduct] = React.useState<boolean>(false);

  // ----------------------------
  // Cart
  // ----------------------------
  const [cartOpen, setCartOpen] = React.useState<boolean>(false);
  const [cart, setCart] = React.useState<Cart.CartState>({});
  const [cartItems, setCartItems] = React.useState<Cart.CartItem[]>([]);
  const [{ totalUnits, subtotal }, setTotals] = React.useState({
    totalUnits: 0,
    subtotal: 0,
  });

  // ----------------------------
  // Customer
  // ----------------------------
  const [customer, setCustomer] = React.useState<CustomerDraft>(blankCustomer);
  const [createAccountFromDetails, setCreateAccountFromDetails] =
    React.useState<boolean>(false);
  const [saveAddressToProfile, setSaveAddressToProfile] = React.useState<boolean>(false);
  const [profileHasAddress, setProfileHasAddress] = React.useState<boolean>(false);
  const [profileAddress, setProfileAddress] = React.useState({
    attention_to: "",
    line1: "",
    line2: "",
    barangay: "",
    city: "",
    province: "",
    postal_code: "",
    country: "Philippines",
  });
  const [paymentFile, setPaymentFile] = React.useState<File | null>(null);
  const [checkoutOpening, setCheckoutOpening] = React.useState<boolean>(false);
  const [orderPlacedModal, setOrderPlacedModal] = React.useState<{
    orderId: string;
    orderNumber: string;
    emailSent: boolean;
    summaryReady: boolean;
    summaryTimedOut: boolean;
    isPublic: boolean;
  } | null>(null);
  const [publicOrderNotice, setPublicOrderNotice] = React.useState<string>("");
  const resolvedGridView: "list" | "4" | "5" = gridView;
  const mobileLogoHeight = Math.round(136 * 0.805);
  const desktopNavLeftWidth = Math.round(252 * 1.15);
  const desktopNavGap = 10;
  const desktopCenterColWidthCss = `min(980px, calc(var(--tp-rail-width) - ${desktopNavLeftWidth}px))`;
  const desktopSideColWidthCss = `calc((var(--tp-rail-width) - ${desktopCenterColWidthCss}) / 2 - ${desktopNavGap}px)`;
  const pendingRouteRef = React.useRef<{ path: string; search: string } | null>(null);
  const isApplyingRouteRef = React.useRef(false);
  const handleSetCustomer = React.useCallback((next: CustomerDraft) => {
    setCustomer(next);
  }, []);
  const formatSupabaseError = React.useCallback((e: unknown, fallback: string) => {
    if (!e || typeof e !== "object") return fallback;
    const err = e as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const message =
      typeof err.message === "string" && err.message.trim()
        ? err.message.trim()
        : fallback;
    const details = typeof err.details === "string" ? err.details : "";
    const hint = typeof err.hint === "string" ? err.hint : "";
    const code = typeof err.code === "string" ? `code:${err.code}` : "";
    return [message, details, hint, code].filter(Boolean).join(" — ");
  }, []);

  // ----------------------------
  // Layout measure
  // ----------------------------
  React.useLayoutEffect(() => {
    const measure = () => {
      const h = headerRef.current?.offsetHeight ?? 0;
      const n = navRef.current?.offsetHeight ?? 64;
      setTopOffset(h + n);
      setIsMobileViewport(window.innerWidth < 768);
    };
    measure();
    window.addEventListener("resize", measure);
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) {
      if (headerRef.current) ro.observe(headerRef.current);
      if (navRef.current) ro.observe(navRef.current);
    }
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

  React.useEffect(() => {
    if (!isMobileViewport) setMobileFiltersOpen(false);
  }, [isMobileViewport]);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-tp-mode", "dark");
  }, []);

  React.useEffect(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    setGridView(isMobile ? "5" : "4");
  }, []);

  // ----------------------------
  // Session init
  // ----------------------------
  React.useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  React.useEffect(() => {
    if (!authUserId) {
      setEditMode(false);
      return;
    }
    const raw = window.localStorage.getItem(getEditModeKey(authUserId));
    setEditMode(raw === "1");
  }, [authUserId, getEditModeKey]);

  const toggleEditMode = React.useCallback(
    (next: boolean) => {
      setEditMode(next);
      if (!authUserId) return;
      window.localStorage.setItem(getEditModeKey(authUserId), next ? "1" : "0");
    },
    [authUserId, getEditModeKey]
  );
  React.useEffect(() => {
  const sid = getSessionId();
  sessionIdRef.current = sid;
  (globalThis as { __TP_SESSION_ID?: string }).__TP_SESSION_ID = sid; // <-- needed for RLS policies on carts
}, []);

  // ----------------------------
  // Load products
  // ----------------------------
  const loadCatalog = React.useCallback(async () => {
    setLoadingProducts(true);
    try {
      const p = await fetchProducts({
        includeInactive: isAdmin && (editMode || adminAllProductsMode),
      });
      const safeProducts = Array.isArray(p) ? p : [];
      const ids = safeProducts.map((item) => String(item.id));
      const allImages = await fetchProductImages(ids);
      const inventoryResult = ids.length
        ? await supabase
            .from("inventory")
            .select("product_id,qty_on_hand,qty_allocated,qty_available")
            .in("product_id", ids)
        : { data: [], error: null as unknown };
      if (inventoryResult.error) {
        console.warn("[page] inventory fetch failed:", inventoryResult.error);
      }
      const inventoryById = new Map<
        string,
        { qty_on_hand: number; qty_allocated: number; qty_available: number }
      >();
      for (const row of (inventoryResult.data ?? []) as Array<Record<string, unknown>>) {
        const id = String(row.product_id ?? "");
        if (!id) continue;
        inventoryById.set(id, normalizeInventorySnapshot(row));
      }

      const imagesById: Record<string, ProductImage[]> = {};
      for (const img of allImages) {
        const pid = String(img.product_id);
        if (!imagesById[pid]) imagesById[pid] = [];
        imagesById[pid].push(img);
      }

      const withThumbnailFallback = safeProducts.map((prod) => {
        const pid = String(prod.id);
        const images = (imagesById[pid] ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order);
        const orderOne = images.find((img) => img.sort_order === 1)?.url ?? null;
        const firstImage = images[0]?.url ?? null;
        const ownThumb = prod.thumbnail_url?.trim() || null;
        const inventory = inventoryById.get(pid);
        return {
          ...prod,
          thumbnail_url: ownThumb ?? orderOne ?? firstImage,
          qty_on_hand: inventory?.qty_on_hand ?? 0,
          qty_allocated: inventory?.qty_allocated ?? 0,
          qty_available: inventory?.qty_available ?? 0,
        };
      });

      setProductImagesById(imagesById);
      setProducts(withThumbnailFallback);
    } catch (e: unknown) {
      console.error("[page] fetchProducts failed:", e);
      const message = e instanceof Error ? e.message : String(e);
      alert(`Products failed to load: ${message}`);
      setProductImagesById({});
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [adminAllProductsMode, editMode, isAdmin]);

  React.useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  React.useEffect(() => {
    const loadZoneStyles = async () => {
      let rows: ZoneRow[] = [];
      let hasMode = true;
      const withMode = await supabase
        .from("ui_zone_styles")
        .select("zone,mode,bg_type,bg_color,bg_image_url");
      if (withMode.error) {
        hasMode = false;
        const legacy = await supabase
          .from("ui_zone_styles")
          .select("zone,bg_type,bg_color,bg_image_url");
        if (!legacy.error) {
          rows = ((legacy.data ?? []) as Array<Omit<ZoneRow, "mode">>).map((row) => ({
            ...row,
            mode: "dark",
          }));
        }
      } else {
        rows = (withMode.data ?? []) as ZoneRow[];
      }
      setZoneStylesByMode((prev) => {
        const next: Record<"dark" | "light", Record<ZoneName, ZoneStyleDraft>> = {
          dark: { ...DEFAULT_ZONE_STYLES_BY_MODE.dark },
          light: { ...DEFAULT_ZONE_STYLES_BY_MODE.light },
        };
        for (const row of rows) {
          if (row.zone !== "header" && row.zone !== "navbar" && row.zone !== "main") continue;
          if (row.mode !== "dark" && row.mode !== "light") continue;
          const styleDraft: ZoneStyleDraft = {
            bg_type: row.bg_type === "image" ? "image" : "color",
            bg_color:
              row.bg_color ??
              (row.zone === "navbar" ? "#ffffff" : "#000000"),
            bg_image_url: row.bg_image_url ?? "",
          };
          if (hasMode) {
            next[row.mode][row.zone] = styleDraft;
          } else {
            next.dark[row.zone] = styleDraft;
            next.light[row.zone] = styleDraft;
          }
        }
        try {
          window.localStorage.setItem("tp_zone_styles_by_mode", JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
    };
    loadZoneStyles();
  }, []);

  React.useEffect(() => {
    const loadLogo = async () => {
      const { data, error } = await supabase
        .from("ui_branding")
        .select("logo_url,logo_url_dark,logo_url_light,gcash_qr_url,gcash_phone")
        .limit(1)
        .maybeSingle();
      let row = (data ?? null) as BrandingRow | null;
      if (error) {
        const legacy = await supabase
          .from("ui_branding")
          .select("logo_url")
          .limit(1)
          .maybeSingle();
        row = (legacy.data ?? null) as BrandingRow | null;
      }
      const fallback = row?.logo_url ?? "";
      const next: Record<"dark" | "light", string> = {
        dark: (row?.logo_url_dark ?? "").trim() || fallback,
        light: (row?.logo_url_light ?? "").trim() || fallback,
      };
      setCheckoutPaymentDraft({
        gcash_qr_url: String(row?.gcash_qr_url ?? "").trim(),
        gcash_phone: String(row?.gcash_phone ?? "").trim(),
      });
      try {
        window.localStorage.setItem("tp_logo_urls_by_mode", JSON.stringify(next));
      } catch {
        // ignore local cache parse issues
      }
      setLogoUrlsByMode(next);
    };
    loadLogo();
  }, []);

  React.useEffect(() => {
    const loadThemeColors = async () => {
      const { data, error } = await supabase
        .from("ui_theme_colors")
        .select(
          "mode,accent_color,text_color,line_color,button_border_color,button_bg_color,checkbox_color,background_color"
        );
      if (error || !data || data.length === 0) return;
      setThemeColorsByMode((prev) => {
        const next = {
          dark: { ...DEFAULT_THEME_COLORS_BY_MODE.dark },
          light: { ...DEFAULT_THEME_COLORS_BY_MODE.light },
        };
        for (const row of data as ThemeColorsRow[]) {
          if (row.mode !== "dark" && row.mode !== "light") continue;
          next[row.mode] = {
            ...next[row.mode],
            accent_color: row.accent_color ?? next[row.mode].accent_color,
            text_color: row.text_color ?? next[row.mode].text_color,
            line_color: row.line_color ?? next[row.mode].line_color,
            button_border_color:
              row.button_border_color ?? next[row.mode].button_border_color,
            button_bg_color: row.button_bg_color ?? next[row.mode].button_bg_color,
            checkbox_color: row.checkbox_color ?? next[row.mode].checkbox_color,
            background_color: row.background_color ?? next[row.mode].background_color,
          };
        }
        try {
          window.localStorage.setItem("tp_theme_colors_by_mode", JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
    };
    loadThemeColors();
  }, [DEFAULT_THEME_COLORS_BY_MODE]);

  React.useEffect(() => {
    const loadBanners = async () => {
      const { data, error } = await supabase
        .from("ui_banners")
        .select("id,image_url,link_url,sort_order")
        .order("sort_order", { ascending: true, nullsFirst: false });
      if (error || !data) return;
      setBanners((data ?? []) as BannerRow[]);
    };
    loadBanners();
  }, []);

  const hexToRgba = React.useCallback((value: string, alpha: number) => {
    const raw = String(value || "").trim();
    if (!raw) return `rgba(255,255,255,${alpha})`;
    if (raw.startsWith("rgba") || raw.startsWith("rgb")) return raw;
    const hex = raw.startsWith("#") ? raw.slice(1) : raw;
    if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) return raw;
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  const themeColors = themeColorsByMode[themeMode];
  const activeBanner = activeBanners[bannerIndex] ?? null;

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--tp-accent", themeColors.accent_color || "#b89958");
    root.style.setProperty("--tp-text-color", themeColors.text_color || "#ffffff");
    root.style.setProperty("--tp-border-color", themeColors.line_color || "#ffffff");
    root.style.setProperty(
      "--tp-border-color-soft",
      hexToRgba(themeColors.line_color || "#ffffff", 0.35)
    );
    root.style.setProperty("--tp-cta-border", themeColors.button_border_color || "#ffffff");
    root.style.setProperty("--tp-cta-bg", themeColors.button_bg_color || "transparent");
    root.style.setProperty("--tp-cta-fg", themeColors.text_color || "#ffffff");
    root.style.setProperty("--tp-checkbox-color", themeColors.checkbox_color || "#cfd6dd");
    root.style.setProperty("--tp-page-bg", themeColors.background_color || "#000000");
  }, [hexToRgba, themeColors]);

  React.useEffect(() => {
    let mounted = true;
    const loadRole = async () => {
      if (mounted) setAuthReady(false);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user || !mounted) {
        setIsAdmin(false);
        setEditMode(false);
        setAdminAllProductsMode(false);
        setAuthLabel(null);
        setAuthProfileName("");
        setAuthUserId(null);
        setAuthEmail("");
        setAuthPhone("");
        setAuthReady(true);
        return;
      }

      const rawLabel =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email ||
        user.phone;
      const fallbackLabel = rawLabel ? String(rawLabel).trim() : null;
      setAuthLabel(authProfileName ? authProfileName : fallbackLabel);
      setAuthUserId(user.id);
      setAuthEmail(user.email ?? "");
      setAuthPhone(user.phone ?? "");

      let role: string | null = null;

      const byId = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!byId.error && byId.data?.role) role = String(byId.data.role);

      if (!role) {
        const byUserId = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!byUserId.error && byUserId.data?.role) role = String(byUserId.data.role);
      }

      if (mounted) {
        setIsAdmin(role === "admin");
        setAuthReady(true);
      }
    };

    loadRole();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      loadRole();
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [authProfileName]);


  React.useEffect(() => {
    if (!authUserId) return;
    const fillCustomer = async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "first_name,last_name,phone,attention_to,address_line1,address_line2,barangay,city,province,postal_code,delivery_note,country"
        )
        .eq("id", authUserId)
        .maybeSingle();

      const firstName = String(data?.first_name ?? "").trim();
      const lastName = String(data?.last_name ?? "").trim();
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      const profilePhone = String(data?.phone ?? "").trim();
      const deliveryNote = String(data?.delivery_note ?? "").trim();
      const hasAddress =
        String(data?.address_line1 ?? "").trim().length > 0 &&
        String(data?.barangay ?? "").trim().length > 0 &&
        String(data?.city ?? "").trim().length > 0 &&
        String(data?.province ?? "").trim().length > 0 &&
        String(data?.postal_code ?? "").trim().length > 0;
      setProfileAddress({
        attention_to: String(data?.attention_to ?? "").trim(),
        line1: String(data?.address_line1 ?? "").trim(),
        line2: String(data?.address_line2 ?? "").trim(),
        barangay: String(data?.barangay ?? "").trim(),
        city: String(data?.city ?? "").trim(),
        province: String(data?.province ?? "").trim(),
        postal_code: String(data?.postal_code ?? "").trim(),
        country: String(data?.country ?? "").trim() || "Philippines",
      });
      setProfileHasAddress(hasAddress);
      setSaveAddressToProfile(!hasAddress);

      setCustomer((prev: CustomerDraft) => ({
        ...prev,
        full_name: prev.placed_for_someone_else ? prev.full_name : prev.full_name || fullName,
        email: prev.placed_for_someone_else ? prev.email : prev.email || authEmail || "",
        phone: prev.placed_for_someone_else ? prev.phone : prev.phone || profilePhone || authPhone || "",
        attention_to: prev.placed_for_someone_else
          ? prev.attention_to
          : prev.attention_to || String(data?.attention_to ?? "").trim(),
        line1: prev.placed_for_someone_else
          ? prev.line1
          : prev.line1 || String(data?.address_line1 ?? "").trim(),
        line2: prev.placed_for_someone_else
          ? prev.line2
          : prev.line2 || String(data?.address_line2 ?? "").trim(),
        barangay: prev.placed_for_someone_else
          ? prev.barangay
          : prev.barangay || String(data?.barangay ?? "").trim(),
        city: prev.placed_for_someone_else
          ? prev.city
          : prev.city || String(data?.city ?? "").trim(),
        province: prev.placed_for_someone_else
          ? prev.province
          : prev.province || String(data?.province ?? "").trim(),
        postal_code: prev.placed_for_someone_else
          ? prev.postal_code
          : prev.postal_code || String(data?.postal_code ?? "").trim(),
        country: prev.placed_for_someone_else
          ? prev.country || "Philippines"
          : prev.country || String(data?.country ?? "").trim() || "Philippines",
        notes: prev.placed_for_someone_else ? prev.notes : prev.notes || deliveryNote,
      }));

      if (firstName) {
        setAuthProfileName(firstName);
        setAuthLabel(firstName);
      }
    };
    void fillCustomer();
  }, [authUserId, authEmail, authPhone]);

  const openZoneEditor = React.useCallback((zone: ZoneName) => {
    setZoneEditorError("");
    setZoneEditorTarget(zone);
    setZoneEditorOpen(true);
  }, []);

  const saveZoneStyle = React.useCallback(
    async (next: ZoneStyleDraft): Promise<boolean> => {
      setZoneEditorSaving(true);
      setZoneEditorError("");
      try {
        const payload = {
          zone: zoneEditorTarget,
          mode: themeMode,
          bg_type: next.bg_type,
          bg_color: next.bg_color || null,
          bg_image_url: next.bg_image_url || null,
        };
        const modern = await supabase
          .from("ui_zone_styles")
          .upsert(payload, { onConflict: "zone,mode" });
        if (modern.error) {
          // Legacy compatibility: older schema may not have "mode" or composite conflict.
          const legacyPayload = {
            zone: zoneEditorTarget,
            bg_type: next.bg_type,
            bg_color: next.bg_color || null,
            bg_image_url: next.bg_image_url || null,
          };
          const legacy = await supabase
            .from("ui_zone_styles")
            .upsert(legacyPayload, { onConflict: "zone" });
          if (legacy.error) throw legacy.error;
        }
        setZoneStylesByMode((prev) => {
          const updated = {
            ...prev,
            [themeMode]: {
              ...prev[themeMode],
              [zoneEditorTarget]: next,
            },
          };
          window.localStorage.setItem("tp_zone_styles_by_mode", JSON.stringify(updated));
          return updated;
        });
        return true;
      } catch (e: unknown) {
        const message =
          typeof e === "object" && e && "message" in e
            ? String((e as { message?: string }).message)
            : e instanceof Error
            ? e.message
            : "Failed to save style.";
        const details =
          typeof e === "object" && e && "details" in e
            ? String((e as { details?: string }).details)
            : "";
        setZoneEditorError(details ? `${message} (${details})` : message);
        console.error("[zone-style] save failed", e);
        return false;
      } finally {
        setZoneEditorSaving(false);
      }
    },
    [themeMode, zoneEditorTarget]
  );

  const uploadUiAsset = React.useCallback(
    async (file: File, kind: "zone" | "logo" | "banner" | "payment"): Promise<string> => {
      const extension = file.name.includes(".")
        ? file.name.split(".").pop()?.toLowerCase() ?? "jpg"
        : "jpg";
      const safeExt = extension.replace(/[^a-z0-9]/g, "") || "jpg";
      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 9);
      const path = `${kind}/${stamp}-${rand}.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from(UI_ASSETS_BUCKET)
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(UI_ASSETS_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    },
    []
  );

  const saveLogo = React.useCallback(async (nextUrl: string) => {
    setLogoEditorSaving(true);
    setLogoEditorError("");
    try {
      const payload =
        themeMode === "light"
          ? { id: 1, logo_url_light: nextUrl || null }
          : { id: 1, logo_url_dark: nextUrl || null };
      const { error } = await supabase
        .from("ui_branding")
        .upsert(payload, { onConflict: "id" });
      if (error) {
        // Legacy compatibility: keep a single shared logo_url when per-mode columns are absent.
        const legacy = await supabase
          .from("ui_branding")
          .upsert({ id: 1, logo_url: nextUrl || null }, { onConflict: "id" });
        if (legacy.error) throw legacy.error;
      }
      setLogoUrlsByMode((prev) => {
        const updated = { ...prev, [themeMode]: nextUrl };
        window.localStorage.setItem("tp_logo_urls_by_mode", JSON.stringify(updated));
        return updated;
      });
      setLogoEditorOpen(false);
    } catch (e: unknown) {
      setLogoEditorError(e instanceof Error ? e.message : "Failed to save logo.");
    } finally {
      setLogoEditorSaving(false);
    }
  }, [themeMode]);

  const saveBanners = React.useCallback(async (next: BannerDraft[]): Promise<boolean> => {
    try {
      const cleaned = next
        .map((banner, index) => ({
          id: banner.id,
          image_url: String(banner.image_url ?? "").trim(),
          link_url: String(banner.link_url ?? "").trim(),
          sort_order: Number.isFinite(banner.sort_order)
            ? banner.sort_order
            : index,
        }))
        .filter((banner) => banner.image_url);

      const { error: deleteError } = await supabase
        .from("ui_banners")
        .delete()
        .not("id", "is", null);
      if (deleteError) throw deleteError;

      if (cleaned.length === 0) {
        setBanners([]);
        return true;
      }

      const payload = cleaned.map((banner) => {
        const base = {
          image_url: banner.image_url,
          link_url: banner.link_url || null,
          sort_order: banner.sort_order,
        };
        if (banner.id && !banner.id.startsWith("tmp-")) {
          return { id: banner.id, ...base };
        }
        return base;
      });

      const { data, error } = await supabase
        .from("ui_banners")
        .insert(payload)
        .select("id,image_url,link_url,sort_order");
      if (error) throw error;
      setBanners((data ?? []) as BannerRow[]);
      return true;
    } catch (e: unknown) {
      const message = formatSupabaseError(e, "Failed to save banners.");
      setZoneEditorError(message);
      console.error("[banners] save failed", e);
      return false;
    }
  }, [formatSupabaseError]);

  const saveCheckoutPaymentDraft = React.useCallback(
    async (next: CheckoutPaymentDraft): Promise<boolean> => {
      try {
        const payload = {
          id: 1,
          gcash_qr_url: String(next.gcash_qr_url ?? "").trim() || null,
          gcash_phone: String(next.gcash_phone ?? "").trim() || null,
        };
        const { error } = await supabase
          .from("ui_branding")
          .upsert(payload, { onConflict: "id" });
        if (error) throw error;
        setCheckoutPaymentDraft({
          gcash_qr_url: String(next.gcash_qr_url ?? "").trim(),
          gcash_phone: String(next.gcash_phone ?? "").trim(),
        });
        return true;
      } catch (e: unknown) {
        const message = formatSupabaseError(
          e,
          "Failed to save checkout payment settings. Apply DB migration for ui_branding first."
        );
        setZoneEditorError(message);
        console.error("[checkout-payment] save failed", e);
        return false;
      }
    },
    [formatSupabaseError]
  );

  const saveThemeColors = React.useCallback(
    async (next: ThemeColorsDraft): Promise<boolean> => {
      const current = themeColorsByMode[themeMode];
      const cleaned: ThemeColorsDraft = {
        accent_color: String(next.accent_color || current.accent_color || "").trim(),
        text_color: String(next.text_color || current.text_color || "").trim(),
        line_color: String(next.line_color || current.line_color || "").trim(),
        button_border_color: String(next.button_border_color || current.button_border_color || "").trim(),
        button_bg_color: String(next.button_bg_color || current.button_bg_color || "").trim(),
        checkbox_color: String(next.checkbox_color || current.checkbox_color || "").trim(),
        background_color: String(next.background_color || current.background_color || "").trim(),
      };

      setThemeColorsByMode((prev) => {
        const updated = { ...prev, [themeMode]: { ...prev[themeMode], ...cleaned } };
        try {
          window.localStorage.setItem("tp_theme_colors_by_mode", JSON.stringify(updated));
        } catch {
          // ignore storage errors
        }
        return updated;
      });

      try {
        setZoneEditorError("");
        const modernPayload = { mode: themeMode, ...cleaned };
        let saved = false;

        // Attempt 1: full modern schema (mode + all color fields).
        {
          const { error: updateError, data: updatedRows } = await supabase
            .from("ui_theme_colors")
            .update(modernPayload)
            .eq("mode", themeMode)
            .select("mode");
          if (!updateError) {
            if (!updatedRows || updatedRows.length === 0) {
              const { error: insertError } = await supabase
                .from("ui_theme_colors")
                .insert(modernPayload);
              if (!insertError) saved = true;
            } else {
              saved = true;
            }
          }
        }

        // Attempt 2: legacy-ish schema with fewer columns.
        if (!saved) {
          const reducedPayload = {
            mode: themeMode,
            accent_color: cleaned.accent_color,
            text_color: cleaned.text_color,
            line_color: cleaned.line_color,
            button_border_color: cleaned.button_border_color,
            button_bg_color: cleaned.button_bg_color,
          };
          const { error: updateError, data: updatedRows } = await supabase
            .from("ui_theme_colors")
            .update(reducedPayload)
            .eq("mode", themeMode)
            .select("mode");
          if (!updateError) {
            if (!updatedRows || updatedRows.length === 0) {
              const { error: insertError } = await supabase
                .from("ui_theme_colors")
                .insert(reducedPayload);
              if (!insertError) saved = true;
            } else {
              saved = true;
            }
          }
        }

        // Attempt 3: very old schema without mode (single row config).
        if (!saved) {
          const legacyPayload = {
            accent_color: cleaned.accent_color,
            text_color: cleaned.text_color,
            line_color: cleaned.line_color,
            button_border_color: cleaned.button_border_color,
            button_bg_color: cleaned.button_bg_color,
          };
          const { error: updateError } = await supabase
            .from("ui_theme_colors")
            .update(legacyPayload)
            .not("accent_color", "is", null);
          if (!updateError) {
            saved = true;
          } else {
            const { error: insertError } = await supabase
              .from("ui_theme_colors")
              .insert(legacyPayload);
            if (!insertError) saved = true;
          }
        }

        if (!saved) {
          throw new Error("Unable to save theme colors (schema or RLS mismatch).");
        }
        return true;
      } catch (e) {
        const message = formatSupabaseError(e, "Failed to save theme colors.");
        setZoneEditorError(message);
        console.error("[theme-colors] save failed", e);
        return false;
      }
    },
    [formatSupabaseError, themeColorsByMode, themeMode]
  );

  const headerZoneStyle = React.useMemo<React.CSSProperties>(() => {
    return { background: "transparent" };
  }, []);

  const navbarZoneStyle = React.useMemo<React.CSSProperties>(() => {
    return { background: "transparent" };
  }, []);

  const navbarDisplayStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...navbarZoneStyle,
    }),
    [navbarZoneStyle]
  );
  const navbarTone: "dark-bg" | "light-bg" = React.useMemo(
    () => (themeMode === "dark" ? "dark-bg" : "light-bg"),
    [themeMode]
  );

  const mainZoneStyle = React.useMemo<React.CSSProperties>(() => {
    const cfg = zoneStylesByMode[themeMode].main;
    if (cfg.bg_type === "image" && cfg.bg_image_url.trim()) {
      return {
        backgroundColor: cfg.bg_color || themeColors.background_color || "#000000",
        backgroundImage: `url("${cfg.bg_image_url.trim()}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    }
    return { background: cfg.bg_color || themeColors.background_color || "#000000" };
  }, [themeColors.background_color, themeMode, zoneStylesByMode]);

  const mainBgImageUrl = React.useMemo(() => {
    const cfg = zoneStylesByMode[themeMode].main;
    if (cfg.bg_type !== "image") return "";
    return cfg.bg_image_url.trim();
  }, [themeMode, zoneStylesByMode]);

  React.useEffect(() => {
    if (!mainBgImageUrl) {
      setIsMainBgReady(true);
      return;
    }
    let cancelled = false;
    setIsMainBgReady(false);
    const img = new Image();
    const finalize = () => {
      if (!cancelled) setIsMainBgReady(true);
    };
    img.onload = finalize;
    img.onerror = finalize;
    img.src = mainBgImageUrl;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [mainBgImageUrl]);

  const closePrimaryDrawers = React.useCallback(() => {
    setPanel(null);
    setDetailsOpen(false);
    setOrdersOpen(false);
    setAllOrdersOpen(false);
    setInventoryOpen(false);
    setAnalyticsOpen(false);
    setOrderDrawerSource(null);
    setSelectedOrderDetail(null);
  }, []);

  React.useEffect(() => {
    if (!authReady) return;
    if (authUserId) return;
    if (!pendingRouteRef.current) return;
    setAuthOpen(true);
    closePrimaryDrawers();
    setCartOpen(false);
  }, [authReady, authUserId, closePrimaryDrawers]);

  const isPrimaryDrawerOpen = React.useMemo(
    () =>
      panel !== null ||
      detailsOpen ||
      ordersOpen ||
      allOrdersOpen ||
      inventoryOpen ||
      !!orderDrawerSource,
    [allOrdersOpen, detailsOpen, inventoryOpen, orderDrawerSource, ordersOpen, panel]
  );

  React.useEffect(() => {
    if (isPrimaryDrawerOpen) setMobileFiltersOpen(false);
  }, [isPrimaryDrawerOpen]);

  // ----------------------------
  // Cart refresh (IMPORTANT: declared BEFORE changeQty)
  // fetchCartView returns CartItem[] already
  // ----------------------------
const refreshCart = React.useCallback(async () => {
  const sessionId = sessionIdRef.current;
  if (!sessionId || sessionId === "server") return;

  const rows = await fetchCartView(sessionId); // rows from cart_view (array)

  const items = Cart.buildCartItems(Array.isArray(rows) ? rows : []);
  setCartItems(items);

  // Build cart map { [productId]: qty }
  const nextCart: Cart.CartState = {};
  for (const it of items) nextCart[it.productId] = it.qty;
  setCart(nextCart);

  setTotals(Cart.cartTotals(items));
}, []);

React.useEffect(() => {
  if (!sessionIdRef.current || sessionIdRef.current === "server") return;
  refreshCart();
}, [refreshCart]);

  // ----------------------------
  // Cart actions (optimistic + sync)
  // ----------------------------
  const changeQty = React.useCallback(
    async (productId: string, nextQty: number) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || sessionId === "server") return;
      const requested = Math.max(nextQty, 0);

      // optimistic local update
      setCart((prev: Cart.CartState) => {
        const v = Math.max(nextQty, 0);
        const copy = { ...prev };
        if (v <= 0) delete copy[productId];
        else copy[productId] = v;
        return copy;
      });

      try {
        await setCartLineQty(sessionId, productId, nextQty);
        await refreshCart();
      } catch (e: unknown) {
        console.error("changeQty failed:", e);
        await refreshCart(); // rollback to server truth
        const message = e instanceof Error ? e.message : "Cart update failed (RLS / permissions).";
        alert(message);
      }
    },
    [refreshCart]
  );

  const addToCart = React.useCallback(
    async (id: string) => {
      const cur = cart[id] ?? 0;
      await changeQty(id, cur + 1);
    },
    [cart, changeQty]
  );

  const removeFromCart = React.useCallback(
    async (id: string) => {
      const cur = cart[id] ?? 0;
      await changeQty(id, Math.max(cur - 1, 0));
    },
    [cart, changeQty]
  );
  const setQtyInCart = React.useCallback(
    async (id: string, qty: number) => {
      await changeQty(id, Math.max(0, Math.floor(Number(qty) || 0)));
    },
    [changeQty]
  );

  // ----------------------------
  // Filtered products + selection
  // ----------------------------
  const normalizeFilterValue = React.useCallback(
    (value: unknown) => String(value ?? "").trim().toLowerCase(),
    []
  );
  const filterGroups = React.useMemo(
    () =>
      [
        ...(isAdmin && adminAllProductsMode
          ? [
              {
                key: "status" as const,
                label: "Status",
                valueOf: (p: DbProduct) => String(p.status ?? "").trim(),
              },
            ]
          : []),
        {
          key: "type" as const,
          label: "Type",
          valueOf: (p: DbProduct) => String(p.type ?? "").trim() || "Other",
        },
        {
          key: "cut" as const,
          label: "Cuts",
          valueOf: (p: DbProduct) => String(p.cut ?? "").trim(),
        },
        {
          key: "country" as const,
          label: "Country",
          valueOf: (p: DbProduct) => String(p.country_of_origin ?? "").trim(),
        },
        {
          key: "preparation" as const,
          label: "Preparation",
          valueOf: (p: DbProduct) => String(p.preparation ?? "").trim(),
        },
        {
          key: "temperature" as const,
          label: "Temperature",
          valueOf: (p: DbProduct) => String(p.temperature ?? "").trim(),
        },
      ] as const,
    [adminAllProductsMode, isAdmin]
  );

  const filterOptionsByGroup = React.useMemo(() => {
    const next: Record<FilterKey, Array<{ key: string; label: string }>> = {
      status: [],
      type: [],
      cut: [],
      country: [],
      preparation: [],
      temperature: [],
    };
    for (const group of filterGroups) {
      const map = new Map<string, string>();
      for (const product of products) {
        const label = group.valueOf(product);
        if (!label) continue;
        const key = normalizeFilterValue(label);
        if (!key) continue;
        if (!map.has(key)) map.set(key, label);
      }
      next[group.key] = [...map.entries()]
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    return next;
  }, [filterGroups, normalizeFilterValue, products]);

  React.useEffect(() => {
    setSelectedFilters((prev) => {
      const next: Record<FilterKey, string[]> = {
        status: [],
        type: [],
        cut: [],
        country: [],
        preparation: [],
        temperature: [],
      };
      let changed = false;
      (Object.keys(next) as FilterKey[]).forEach((key) => {
        const valid = new Set(filterOptionsByGroup[key].map((option) => option.key));
        next[key] = (prev[key] ?? []).filter((value) => valid.has(value));
        if (next[key].length !== (prev[key] ?? []).length) changed = true;
      });
      return changed ? next : prev;
    });
  }, [filterOptionsByGroup]);

  const selectedFilterCount = React.useMemo(
    () =>
      (Object.values(selectedFilters) as string[][]).reduce(
        (sum, values) => sum + values.length,
        0
      ),
    [selectedFilters]
  );

  const filteredProducts = React.useMemo(() => {
    const q = search.trim();
    return products.filter((p) => {
      const matchesFilters = filterGroups.every((group) => {
        const selectedValues = selectedFilters[group.key];
        if (!selectedValues.length) return true;
        const valueKey = normalizeFilterValue(group.valueOf(p));
        return !!valueKey && selectedValues.includes(valueKey);
      });
      return matchesFilters && matchesProductQuery(p, q);
    });
  }, [filterGroups, normalizeFilterValue, products, search, selectedFilters]);

  const selectedProduct = React.useMemo(() => {
    if (!selectedId) return null;
    return products.find((p) => String(p.id) === selectedId) ?? null;
  }, [products, selectedId]);

  const cartItemsForDisplay = React.useMemo(() => {
    const enriched = cartItems.map((item) => {
      const product = products.find((p) => String(p.id) === item.productId);
      const hasStockSnapshot = !!product && !loadingProducts;
      return {
        ...item,
        country: item.country ?? product?.country_of_origin ?? null,
        type: product?.type ?? null,
        temperature: product?.temperature ?? null,
        thumbnailUrl: item.thumbnailUrl ?? product?.thumbnail_url ?? null,
        unlimitedStock: Boolean(product?.unlimited_stock),
        qtyAvailable: hasStockSnapshot
          ? Math.max(0, Number(product?.qty_available ?? 0))
          : undefined,
        outOfStock:
          hasStockSnapshot &&
          !Boolean(product?.unlimited_stock) &&
          Math.max(0, Number(product?.qty_available ?? 0)) < 1,
      };
    });
    return enriched.sort((a, b) => {
      const typeA = String(a.type ?? "").toLowerCase();
      const typeB = String(b.type ?? "").toLowerCase();
      if (typeA !== typeB) return typeA.localeCompare(typeB);
      const nameCmp = String(a.name ?? "").localeCompare(String(b.name ?? ""));
      if (nameCmp !== 0) return nameCmp;
      const sizeCmp = String(a.size ?? "").localeCompare(String(b.size ?? ""));
      if (sizeCmp !== 0) return sizeCmp;
      return String(a.productId ?? "").localeCompare(String(b.productId ?? ""));
    });
  }, [cartItems, loadingProducts, products]);
  const hasCartQtyOverLimit = React.useMemo(
    () =>
      cartItemsForDisplay.some(
        (it) =>
          !Boolean(it.unlimitedStock) &&
          typeof it.qtyAvailable === "number" &&
          Math.max(0, Number(it.qty) || 0) > Math.max(0, Number(it.qtyAvailable ?? 0))
      ),
    [cartItemsForDisplay]
  );

  // ----------------------------
  // UI navigation
  // ----------------------------
  const scrollToProducts = React.useCallback(() => {
    setAdminAllProductsMode(false);
    closePrimaryDrawers();
    const el = listScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, [closePrimaryDrawers]);

  const logout = React.useCallback(async () => {
    await supabase.auth.signOut();
    setAuthLabel(null);
    setAuthProfileName("");
    setAuthUserId(null);
    setAuthEmail("");
    setAuthPhone("");
    setIsAdmin(false);
    setEditMode(false);
    setAdminAllProductsMode(false);
    setDetailsOpen(false);
    setOrdersOpen(false);
    setAllOrdersOpen(false);
    setInventoryOpen(false);
    setMyOrders([]);
    setAllOrders([]);
    setInventoryRows([]);
    setSelectedMyOrderId(null);
    setSelectedAllOrderId(null);
    setOrderDrawerSource(null);
    setSelectedOrderDetail(null);
    setProfileHasAddress(false);
    setSaveAddressToProfile(false);
    setCreateAccountFromDetails(false);
    setCustomer(blankCustomer());
    setPaymentFile(null);
    setProfileAddress({
      attention_to: "",
      line1: "",
      line2: "",
      barangay: "",
      city: "",
      province: "",
      postal_code: "",
      country: "Philippines",
    });
    setPanel(null);
    setCartOpen(false);
    setSelectedId(null);
    setEditorReturnToProduct(false);
    scrollToProducts();
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/shop");
    }
  }, [blankCustomer, scrollToProducts]);

  const openAllProductsView = React.useCallback((opts?: { skipNavigate?: boolean }) => {
    if (!isAdmin) return;
    closePrimaryDrawers();
    setCartOpen(false);
    setAdminAllProductsMode(true);
    const el = listScrollRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
    if (!opts?.skipNavigate && typeof window !== "undefined") {
      window.history.pushState({}, "", "/allproducts");
    }
  }, [closePrimaryDrawers, isAdmin]);

  const openProduct = React.useCallback((id: string, opts?: { skipNavigate?: boolean }) => {
    windowScrollTopRef.current =
      typeof window !== "undefined" ? window.scrollY || window.pageYOffset || 0 : 0;
    listScrollTopRef.current = listScrollRef.current?.scrollTop ?? 0;
    setSelectedId(id);
    setDetailsOpen(false);
    setOrdersOpen(false);
    setAllOrdersOpen(false);
    setInventoryOpen(false);
    setOrderDrawerSource(null);
    setSelectedOrderDetail(null);
    setPanel("product");
    if (!opts?.skipNavigate && typeof window !== "undefined") {
      const params = new URLSearchParams({ id: String(id) });
      window.history.pushState({}, "", `/shop/product?${params.toString()}`);
    }
  }, []);

  const openEditProduct = React.useCallback(
    (id: string, opts?: { skipNavigate?: boolean }) => {
      if (!isAdmin) return;
      windowScrollTopRef.current =
        typeof window !== "undefined" ? window.scrollY || window.pageYOffset || 0 : 0;
      listScrollTopRef.current = listScrollRef.current?.scrollTop ?? 0;
      setEditorReturnToProduct(panel === "product");
      setSelectedId(id);
      setDetailsOpen(false);
      setOrdersOpen(false);
      setAllOrdersOpen(false);
      setInventoryOpen(false);
      setOrderDrawerSource(null);
      setSelectedOrderDetail(null);
      setPanel("edit");
      if (!opts?.skipNavigate && typeof window !== "undefined") {
        const params = new URLSearchParams({ id: String(id) });
        window.history.pushState({}, "", `/shop/product/edit?${params.toString()}`);
      }
    },
    [isAdmin, panel]
  );

  const createProduct = React.useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from("products")
      .insert({
        name: "New Product",
        long_name: "New Product",
        status: "Disabled",
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      alert(error?.message ?? "Failed to create product.");
      return;
    }
    await loadCatalog();
    listScrollTopRef.current = listScrollRef.current?.scrollTop ?? 0;
    setEditorReturnToProduct(false);
    setSelectedId(String(data.id));
    setDetailsOpen(false);
    setOrdersOpen(false);
    setAllOrdersOpen(false);
    setOrderDrawerSource(null);
    setSelectedOrderDetail(null);
    setPanel("edit");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams({ id: String(data.id) });
      window.history.pushState({}, "", `/shop/product/edit?${params.toString()}`);
    }
  }, [isAdmin, loadCatalog]);

  const closeEditor = React.useCallback(() => {
    if (editorReturnToProduct && selectedId) {
      setPanel("product");
      if (typeof window !== "undefined") {
        const params = new URLSearchParams({ id: String(selectedId) });
        window.history.pushState({}, "", `/shop/product?${params.toString()}`);
      }
      return;
    }
    closePrimaryDrawers();
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", isAdmin ? "/allproducts" : "/shop");
    }
    requestAnimationFrame(() => {
      const el = listScrollRef.current;
      if (el) el.scrollTop = listScrollTopRef.current;
      if (typeof window !== "undefined") {
        window.scrollTo({ top: windowScrollTopRef.current, left: 0, behavior: "auto" });
      }
    });
  }, [closePrimaryDrawers, editorReturnToProduct, isAdmin, selectedId]);

  const updateProductStatus = React.useCallback(
    async (id: string, nextStatus: "Active" | "Disabled" | "Archived") => {
      const { error } = await supabase
        .from("products")
        .update({ status: nextStatus })
        .eq("id", id);
      if (error) {
        if (error.message.toLowerCase().includes("row-level security")) {
          alert(
            "Status update blocked by RLS policy on products. We need to adjust update policy to allow admins."
          );
        } else {
          alert(error.message);
        }
        return;
      }
      setProducts((prev) =>
        prev
          .map((p) => (String(p.id) === id ? { ...p, status: nextStatus } : p))
          .filter((p) =>
            isAdmin && (editMode || adminAllProductsMode)
              ? true
              : String(p.status).toLowerCase() === "active"
          )
      );
    },
    [adminAllProductsMode, editMode, isAdmin]
  );

  const backToList = React.useCallback(() => {
    closePrimaryDrawers();
    requestAnimationFrame(() => {
      const el = listScrollRef.current;
      if (el) el.scrollTop = listScrollTopRef.current;
      if (typeof window !== "undefined") {
        window.scrollTo({ top: windowScrollTopRef.current, left: 0, behavior: "auto" });
      }
    });
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/shop");
    }
  }, [closePrimaryDrawers]);

  const openCheckout = React.useCallback(async (opts?: { skipNavigate?: boolean }) => {
    setCheckoutOpening(true);
    const loadProfileForCheckout = async () => {
      if (!authUserId) {
        setProfileHasAddress(false);
        setSaveAddressToProfile(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select(
          "first_name,last_name,phone,attention_to,address_line1,address_line2,barangay,city,province,postal_code,country,delivery_note"
        )
        .eq("id", authUserId)
        .maybeSingle();

      const firstName = String(data?.first_name ?? "").trim();
      const lastName = String(data?.last_name ?? "").trim();
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      const hasAddress =
        String(data?.address_line1 ?? "").trim().length > 0 &&
        String(data?.barangay ?? "").trim().length > 0 &&
        String(data?.city ?? "").trim().length > 0 &&
        String(data?.province ?? "").trim().length > 0 &&
        String(data?.postal_code ?? "").trim().length > 0;
      setProfileAddress({
        attention_to: String(data?.attention_to ?? "").trim(),
        line1: String(data?.address_line1 ?? "").trim(),
        line2: String(data?.address_line2 ?? "").trim(),
        barangay: String(data?.barangay ?? "").trim(),
        city: String(data?.city ?? "").trim(),
        province: String(data?.province ?? "").trim(),
        postal_code: String(data?.postal_code ?? "").trim(),
        country: String(data?.country ?? "").trim() || "Philippines",
      });

      setProfileHasAddress(hasAddress);
      setSaveAddressToProfile(!hasAddress);

      setCustomer((prev: CustomerDraft) => ({
        ...prev,
        full_name: prev.placed_for_someone_else ? prev.full_name : prev.full_name || fullName,
        email: prev.placed_for_someone_else ? prev.email : prev.email || authEmail || "",
        phone: prev.placed_for_someone_else
          ? prev.phone
          : prev.phone || String(data?.phone ?? "").trim() || authPhone || "",
        attention_to: prev.placed_for_someone_else
          ? prev.attention_to
          : prev.attention_to || String(data?.attention_to ?? "").trim(),
        line1: prev.placed_for_someone_else
          ? prev.line1
          : prev.line1 || String(data?.address_line1 ?? "").trim(),
        line2: prev.placed_for_someone_else
          ? prev.line2
          : prev.line2 || String(data?.address_line2 ?? "").trim(),
        barangay: prev.placed_for_someone_else
          ? prev.barangay
          : prev.barangay || String(data?.barangay ?? "").trim(),
        city: prev.placed_for_someone_else
          ? prev.city
          : prev.city || String(data?.city ?? "").trim(),
        province: prev.placed_for_someone_else
          ? prev.province
          : prev.province || String(data?.province ?? "").trim(),
        postal_code: prev.placed_for_someone_else
          ? prev.postal_code
          : prev.postal_code || String(data?.postal_code ?? "").trim(),
        country: prev.placed_for_someone_else
          ? prev.country || "Philippines"
          : prev.country || String(data?.country ?? "").trim() || "Philippines",
        notes: prev.placed_for_someone_else
          ? prev.notes
          : prev.notes || String(data?.delivery_note ?? "").trim(),
      }));
    };

    try {
      setCartOpen(false);
      setDetailsOpen(false);
      setOrdersOpen(false);
      setAllOrdersOpen(false);
      setInventoryOpen(false);
      setOrderDrawerSource(null);
      setSelectedOrderDetail(null);
      if (hasCartQtyOverLimit) {
        alert("You need to reduce some quantites in your cart.");
        return;
      }
      const profileTask = loadProfileForCheckout();
      setPanel("checkout");
      if (!opts?.skipNavigate && typeof window !== "undefined") {
        window.history.pushState({}, "", "/checkout");
      }
      await profileTask;
    } finally {
      setCheckoutOpening(false);
    }
  }, [authEmail, authPhone, authUserId, hasCartQtyOverLimit]);

  const openProfileDrawer = React.useCallback((opts?: { skipNavigate?: boolean }) => {
    closePrimaryDrawers();
    setCartOpen(false);
    setDetailsOpen(true);
    if (!opts?.skipNavigate && typeof window !== "undefined") {
      window.history.pushState({}, "", "/profile");
    }
  }, [closePrimaryDrawers]);

  const loadAndSelectOrder = React.useCallback(
    async (orderId: string, opts?: { retries?: number; delayMs?: number }) => {
      const retries = Math.max(0, opts?.retries ?? 0);
      const delayMs = Math.max(0, opts?.delayMs ?? 0);
      setLoadingOrderDetail(true);
      setSelectedOrderDetail(null);
      try {
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          try {
            const detail = await fetchOrderDetail(orderId);
            if (detail) {
              setSelectedOrderDetail(detail);
              return detail;
            }
          } catch (e) {
            if (attempt >= retries) {
              console.error("Failed to load order detail", e);
            }
          }
          if (attempt < retries && delayMs > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, delayMs));
          }
        }
        setSelectedOrderDetail(null);
        return null;
      } finally {
        setLoadingOrderDetail(false);
      }
    },
    []
  );

  const handleOrderStatusChange = React.useCallback(
    async (orderId: string, patch: OrderStatusPatch) => {
      await updateOrderStatuses(orderId, patch);
      const resolvedStatus =
        String(patch.delivery_status ?? "").toLowerCase() === "delivered"
          ? "completed"
          : patch.status;

      setMyOrders((prev) =>
        prev.map((row) =>
          row.id === orderId
            ? {
                ...row,
                ...patch,
                status: resolvedStatus ?? row.status,
              }
            : row
        )
      );
      setAllOrders((prev) =>
        prev.map((row) =>
          row.id === orderId
            ? {
                ...row,
                ...patch,
                status: resolvedStatus ?? row.status,
              }
            : row
        )
      );
      setSelectedOrderDetail((prev) =>
        prev && prev.id === orderId
          ? {
              ...prev,
              status: resolvedStatus ?? prev.status,
              paid_status: patch.paid_status ?? prev.paid_status,
              delivery_status: patch.delivery_status ?? prev.delivery_status,
            }
          : prev
      );
    },
    []
  );

  const handleOrderPackedQtyChange = React.useCallback(
    async (orderLineId: string, packedQty: number | null) => {
      await updateOrderLinePackedQty(orderLineId, packedQty);
      setSelectedOrderDetail((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) =>
                it.id === orderLineId ? { ...it, packed_qty: packedQty } : it
              ),
            }
          : prev
      );
    },
    []
  );

  const handleOrderAddLines = React.useCallback(
    async (orderId: string, items: Array<{ productId: string; qty: number }>) => {
      await addOrderLinesByAdmin(orderId, items);
      await loadAndSelectOrder(orderId);
    },
    [loadAndSelectOrder]
  );

  const handleOrderAmountPaidChange = React.useCallback(
    async (orderId: string, amountPaid: number | null) => {
      await updateOrderAmountPaid(orderId, amountPaid);
      setSelectedOrderDetail((prev) =>
        prev && prev.id === orderId
          ? {
              ...prev,
              amount_paid:
                amountPaid === null || Number.isNaN(Number(amountPaid))
                  ? null
                  : Math.max(0, Number(amountPaid)),
            }
          : prev
      );
    },
    []
  );

  const handleOrderPaymentProofChange = React.useCallback(
    async (orderId: string, file: File | null, currentPath: string | null) => {
      await updateOrderPaymentProof(orderId, file, currentPath);
      if (selectedOrderDetail?.id === orderId) {
        await loadAndSelectOrder(orderId);
      }
    },
    [loadAndSelectOrder, selectedOrderDetail?.id]
  );

  const handleOrderAdminFieldsChange = React.useCallback(
    async (orderId: string, patch: OrderAdminPatch) => {
      await updateOrderAdminFields(orderId, patch);
      setMyOrders((prev) =>
        prev.map((row) =>
          row.id === orderId
            ? {
                ...row,
                full_name: patch.full_name ?? row.full_name,
                email: patch.email ?? row.email,
                phone: patch.phone ?? row.phone,
                delivery_date: patch.delivery_date ?? row.delivery_date,
              }
            : row
        )
      );
      setAllOrders((prev) =>
        prev.map((row) =>
          row.id === orderId
            ? {
                ...row,
                full_name: patch.full_name ?? row.full_name,
                email: patch.email ?? row.email,
                phone: patch.phone ?? row.phone,
                delivery_date: patch.delivery_date ?? row.delivery_date,
              }
            : row
        )
      );
      setSelectedOrderDetail((prev) =>
        prev && prev.id === orderId
          ? {
              ...prev,
              created_at: patch.created_at ?? prev.created_at,
              full_name: patch.full_name ?? prev.full_name,
              email: patch.email ?? prev.email,
              phone: patch.phone ?? prev.phone,
              address: patch.address ?? prev.address,
              notes: patch.notes ?? prev.notes,
              delivery_date: patch.delivery_date ?? prev.delivery_date,
              delivery_slot: patch.delivery_slot ?? prev.delivery_slot,
              express_delivery: patch.express_delivery ?? prev.express_delivery,
              add_thermal_bag: patch.add_thermal_bag ?? prev.add_thermal_bag,
              delivery_fee:
                patch.delivery_fee === undefined ? prev.delivery_fee : Number(patch.delivery_fee),
              total_selling_price:
                patch.total_selling_price === undefined
                  ? prev.total_selling_price
                  : Number(patch.total_selling_price),
            }
          : prev
      );
    },
    []
  );

  const handleOrderDelete = React.useCallback(
    async (orderId: string, paymentProofPath: string | null) => {
      await deleteOrderByAdmin(orderId, { paymentProofPath });
      setMyOrders((prev) => prev.filter((row) => row.id !== orderId));
      setAllOrders((prev) => prev.filter((row) => row.id !== orderId));
      setSelectedMyOrderId((prev) => (prev === orderId ? null : prev));
      setSelectedAllOrderId((prev) => (prev === orderId ? null : prev));
      setSelectedOrderDetail((prev) => (prev?.id === orderId ? null : prev));
      setOrderDrawerSource(null);
      setAllOrdersOpen(true);
    },
    []
  );

  const openMyOrdersDrawer = React.useCallback((opts?: { skipNavigate?: boolean }) => {
    const loadMyOrders = async () => {
      if (!authUserId) {
        setMyOrders([]);
        return;
      }
      try {
        const rows = await fetchOrders({
          userId: authUserId,
          email: authEmail || null,
          phone: authPhone || null,
          all: false,
        });
        setMyOrders(rows);
      } catch (e) {
        console.error("Failed to load my orders", e);
      }
    };
    closePrimaryDrawers();
    setCartOpen(false);
    setSelectedMyOrderId(null);
    setSelectedAllOrderId(null);
    void loadMyOrders();
    setOrdersOpen(true);
    if (!opts?.skipNavigate && typeof window !== "undefined") {
      window.history.pushState({}, "", "/myorders");
    }
  }, [authEmail, authPhone, authUserId, closePrimaryDrawers]);

  const openAllOrdersDrawer = React.useCallback((opts?: { skipNavigate?: boolean }) => {
    const loadAllOrders = async () => {
      try {
        const rows = await fetchOrders({ all: true });
        setAllOrders(rows);
      } catch (e) {
        console.error("Failed to load all orders", e);
      }
    };
    closePrimaryDrawers();
    setCartOpen(false);
    setSelectedMyOrderId(null);
    setSelectedAllOrderId(null);
    void loadAllOrders();
    setAllOrdersOpen(true);
    if (!opts?.skipNavigate && typeof window !== "undefined") {
      window.history.pushState({}, "", "/allorders");
    }
  }, [closePrimaryDrawers]);

  const loadInventoryRows = React.useCallback(async () => {
    setLoadingInventory(true);
    try {
      const allProducts = await fetchProducts({ includeInactive: true });
      const safeProducts = Array.isArray(allProducts) ? allProducts : [];
      const ids = safeProducts.map((item) => String(item.id));
      const allImages = ids.length ? await fetchProductImages(ids) : [];
      const { data, error } = await supabase
        .from("inventory")
        .select("product_id,qty_on_hand,qty_allocated,qty_available");
      if (error) throw error;

      const byProductId = new Map<
        string,
        { qty_on_hand: number; qty_allocated: number; qty_available: number }
      >();
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const id = String(row.product_id ?? "");
        if (!id) continue;
        byProductId.set(id, normalizeInventorySnapshot(row));
      }

      const imagesById: Record<string, ProductImage[]> = {};
      for (const img of allImages) {
        const pid = String(img.product_id);
        if (!imagesById[pid]) imagesById[pid] = [];
        imagesById[pid].push(img);
      }

      const nextRows: InventoryLine[] = safeProducts
        .map((p) => {
          const id = String(p.id);
          const inv = byProductId.get(id) ?? {
            qty_on_hand: 0,
            qty_allocated: 0,
            qty_available: 0,
          };
          const images = (imagesById[id] ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
          const orderOne = images.find((img) => img.sort_order === 1)?.url ?? null;
          const firstImage = images[0]?.url ?? null;
          const ownThumb = p.thumbnail_url?.trim() || null;
          return {
            product_id: id,
            name: String(p.long_name ?? p.name ?? "Unnamed item"),
            status: String(p.status ?? ""),
            format: String(p.size ?? "").trim(),
            preparation: String(p.preparation ?? "").trim(),
            temperature: String(p.temperature ?? "").trim(),
            thumbnail_url: ownThumb ?? orderOne ?? firstImage,
            unlimited_stock: Boolean(p.unlimited_stock),
            qty_on_hand: inv.qty_on_hand,
            qty_allocated: inv.qty_allocated,
            qty_available: inv.qty_available,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      setInventoryRows(nextRows);
    } catch (e) {
      console.error("Failed to load inventory", e);
      setInventoryRows([]);
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  const handleInventoryUnlimitedChange = React.useCallback(
    async (productId: string, next: boolean) => {
      const { error } = await supabase
        .from("products")
        .update({ unlimited_stock: next })
        .eq("id", productId);
      if (error) {
        alert(error.message);
        throw error;
      }
      setProducts((prev) =>
        prev.map((p) => (String(p.id) === productId ? { ...p, unlimited_stock: next } : p))
      );
      setInventoryRows((prev) =>
        prev.map((row) =>
          row.product_id === productId ? { ...row, unlimited_stock: next } : row
        )
      );
    },
    []
  );

  const handleInventoryQtyOnHandChange = React.useCallback(
    async (productId: string, next: number) => {
      const safeQty = Math.max(0, Math.floor(Number(next) || 0));
      const allocatedRead = await supabase
        .from("inventory")
        .select("qty_allocated")
        .eq("product_id", productId)
        .maybeSingle();

      if (allocatedRead.error) {
        const message = allocatedRead.error.message ?? "Failed to read current allocated inventory.";
        alert(message);
        throw new Error(message);
      }

      const allocatedFromDb = Math.max(0, Number(allocatedRead.data?.qty_allocated ?? 0));

      const persist = await supabase
        .from("inventory")
        .upsert(
          {
            product_id: productId,
            qty_on_hand: safeQty,
          },
          { onConflict: "product_id" }
        );

      if (persist.error) {
        const message = persist.error.message ?? "Failed to update inventory.";
        alert(message);
        throw new Error(message);
      }

      const availableFromDb = Math.max(safeQty - allocatedFromDb, 0);
      setInventoryRows((prev) =>
        prev.map((row) =>
          row.product_id === productId
            ? {
                ...row,
                qty_on_hand: safeQty,
                qty_allocated: allocatedFromDb,
                qty_available: availableFromDb,
              }
            : row
        )
      );
      setProducts((prev) =>
        prev.map((p) =>
          String(p.id) === productId
            ? {
                ...p,
                qty_on_hand: safeQty,
                qty_allocated: allocatedFromDb,
                qty_available: availableFromDb,
              }
            : p
        )
      );
    },
    []
  );

  const handleInventoryBulkUnlimitedChange = React.useCallback(
    async (productIds: string[], next: boolean) => {
      const ids = [...new Set(productIds.map((id) => String(id)).filter(Boolean))];
      if (!ids.length) return;
      const { error } = await supabase
        .from("products")
        .update({ unlimited_stock: next })
        .in("id", ids);
      if (error) {
        alert(error.message);
        throw error;
      }
      const idSet = new Set(ids);
      setProducts((prev) =>
        prev.map((p) =>
          idSet.has(String(p.id)) ? { ...p, unlimited_stock: next } : p
        )
      );
      setInventoryRows((prev) =>
        prev.map((row) =>
          idSet.has(row.product_id) ? { ...row, unlimited_stock: next } : row
        )
      );
    },
    []
  );

  const handleInventoryBulkQtyOnHandChange = React.useCallback(
    async (productIds: string[], next: number) => {
      const ids = [...new Set(productIds.map((id) => String(id)).filter(Boolean))];
      if (!ids.length) return;
      const safeQty = Math.max(0, Math.floor(Number(next) || 0));
      const idSet = new Set(ids);
      const allocResponse = await supabase
        .from("inventory")
        .select("product_id,qty_allocated")
        .in("product_id", ids);

      if (allocResponse.error) {
        const message = allocResponse.error.message ?? "Failed to read current inventory allocation.";
        alert(message);
        throw new Error(message);
      }

      const allocatedById = new Map<string, number>();
      for (const row of (allocResponse.data ?? []) as Array<Record<string, unknown>>) {
        const id = String(row.product_id ?? "");
        if (!id) continue;
        allocatedById.set(id, Math.max(0, Number(row.qty_allocated ?? 0)));
      }

      const payload = ids.map((id) => {
        return {
          product_id: id,
          qty_on_hand: safeQty,
        };
      });

      const persist = await supabase
        .from("inventory")
        .upsert(payload, { onConflict: "product_id" });

      if (persist.error) {
        const message = persist.error.message ?? "Failed to bulk update inventory.";
        alert(message);
        throw new Error(message);
      }

      setProducts((prev) =>
        prev.map((p) => {
          const id = String(p.id);
          if (!idSet.has(id)) return p;
          const allocated = allocatedById.get(id) ?? 0;
          return {
            ...p,
            qty_on_hand: safeQty,
            qty_allocated: allocated,
            qty_available: Math.max(safeQty - allocated, 0),
          };
        })
      );
      setInventoryRows((prev) =>
        prev.map((row) => {
          if (!idSet.has(row.product_id)) return row;
          const allocated = allocatedById.get(row.product_id) ?? 0;
          return {
            ...row,
            qty_on_hand: safeQty,
            qty_allocated: allocated,
            qty_available: Math.max(safeQty - allocated, 0),
          };
        })
      );
    },
    []
  );

  const openInventoryDrawer = React.useCallback(
    (opts?: { skipNavigate?: boolean }) => {
      if (!isAdmin) return;
      closePrimaryDrawers();
      setCartOpen(false);
      void loadInventoryRows();
      setInventoryOpen(true);
      if (!opts?.skipNavigate && typeof window !== "undefined") {
        window.history.pushState({}, "", "/inventory");
      }
    },
    [closePrimaryDrawers, isAdmin, loadInventoryRows]
  );

  const openAnalyticsDrawer = React.useCallback(
    async (opts?: { skipNavigate?: boolean }) => {
      if (!isAdmin) return;
      closePrimaryDrawers();
      setCartOpen(false);
      try {
        const rows = await fetchOrders({ all: true });
        setAllOrders(rows);
      } catch (e) {
        console.error("Failed to load analytics orders", e);
      }
      setAnalyticsOpen(true);
      if (!opts?.skipNavigate && typeof window !== "undefined") {
        window.history.pushState({}, "", "/analytics");
      }
    },
    [closePrimaryDrawers, isAdmin]
  );

  const openCart = React.useCallback((opts?: { skipNavigate?: boolean }) => {
    // Cart should never coexist with orders/all-orders drawers.
    closePrimaryDrawers();
    setInventoryOpen(false);
    setCartOpen(true);
    if (!opts?.skipNavigate && typeof window !== "undefined") {
      window.history.pushState({}, "", "/cart");
    }
  }, [closePrimaryDrawers]);

  React.useEffect(() => {
    if (!cartOpen) return;
    // Defensive guard: while cart is visible, force all-orders context off.
    if (allOrdersOpen) setAllOrdersOpen(false);
    if (orderDrawerSource === "all") {
      setOrderDrawerSource(null);
      setSelectedOrderDetail(null);
    }
  }, [allOrdersOpen, cartOpen, orderDrawerSource]);

  const resolveRouteWithoutCart = React.useCallback(() => {
    if (panel === "checkout") return "/checkout";
    if (panel === "edit" && selectedId) {
      const params = new URLSearchParams({ id: String(selectedId) });
      return `/shop/product/edit?${params.toString()}`;
    }
    if (panel === "product" && selectedId) {
      const params = new URLSearchParams({ id: String(selectedId) });
      return `/shop/product?${params.toString()}`;
    }
    if (orderDrawerSource && selectedOrderDetail?.id) {
      const params = new URLSearchParams({ id: String(selectedOrderDetail.id) });
      if (orderDrawerSource !== "public") {
        params.set("source", orderDrawerSource);
      }
      return `/order?${params.toString()}`;
    }
    if (inventoryOpen) return "/inventory";
    if (analyticsOpen) return "/analytics";
    if (allOrdersOpen) return "/allorders";
    if (ordersOpen) return "/myorders";
    if (detailsOpen) return "/profile";
    if (isAdmin && adminAllProductsMode) return "/allproducts";
    return "/shop";
  }, [
    adminAllProductsMode,
    analyticsOpen,
    allOrdersOpen,
    detailsOpen,
    inventoryOpen,
    isAdmin,
    orderDrawerSource,
    ordersOpen,
    panel,
    selectedId,
    selectedOrderDetail?.id,
  ]);

  const closeCart = React.useCallback(() => {
    setCartOpen(false);
    if (typeof window === "undefined") return;
    const next = resolveRouteWithoutCart();
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== next) {
      window.history.pushState({}, "", next);
    }
  }, [resolveRouteWithoutCart]);

  const openShop = React.useCallback((opts?: { skipNavigate?: boolean }) => {
    closePrimaryDrawers();
    setCartOpen(false);
    setAdminAllProductsMode(false);
    scrollToProducts();
    if (!opts?.skipNavigate && typeof window !== "undefined") {
      window.history.pushState({}, "", "/shop");
    }
  }, [closePrimaryDrawers, scrollToProducts]);

  const applyRouteFromLocation = React.useCallback(
    (rawPath: string, rawSearch: string) => {
      if (isApplyingRouteRef.current) return;
      isApplyingRouteRef.current = true;
      try {
        const path = rawPath || "/shop";
        const search = rawSearch || "";
        const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

        const requireAuth = (next: { path: string; search: string }) => {
          if (authUserId) {
            pendingRouteRef.current = null;
            return true;
          }
          pendingRouteRef.current = next;
          if (!authReady) return false;
          setAuthOpen(true);
          closePrimaryDrawers();
          setCartOpen(false);
          return false;
        };

        const requireAdmin = (next: { path: string; search: string }) => {
          if (!authReady) return false;
          if (!authUserId) {
            pendingRouteRef.current = next;
            setAuthOpen(true);
            closePrimaryDrawers();
            setCartOpen(false);
            return false;
          }
          if (isAdmin) {
            pendingRouteRef.current = null;
            return true;
          }
          pendingRouteRef.current = null;
          closePrimaryDrawers();
          setCartOpen(false);
          if (typeof window !== "undefined") {
            window.history.replaceState({}, "", "/shop");
          }
          return false;
        };

        if (path === "/" || path === "/shop") {
          openShop({ skipNavigate: true });
          return;
        }
        if (path === "/shop/product") {
          const id = params.get("id") || params.get("product");
          if (id) {
            openProduct(id, { skipNavigate: true });
          } else {
            openShop({ skipNavigate: true });
          }
          return;
        }
        if (path === "/shop/product/edit") {
          const id = params.get("id") || params.get("product");
          if (!id) {
            openShop({ skipNavigate: true });
            return;
          }
          if (!requireAdmin({ path, search })) return;
          openEditProduct(id, { skipNavigate: true });
          return;
        }
        if (path === "/cart") {
          closePrimaryDrawers();
          openCart({ skipNavigate: true });
          return;
        }
        if (path === "/checkout") {
          openCheckout({ skipNavigate: true });
          return;
        }
        if (path === "/order") {
          const id = params.get("id") || params.get("order");
          const sourceParam = params.get("source");
          if (!id) {
            openShop({ skipNavigate: true });
            return;
          }
          const nextSource =
            sourceParam === "all" && isAdmin
              ? "all"
              : sourceParam === "my" && authUserId
                ? "my"
                : "public";
          setOrderDrawerSource(nextSource);
          setOrdersOpen(false);
          setAllOrdersOpen(false);
          setPanel(null);
          setCartOpen(false);
          void loadAndSelectOrder(id);
          return;
        }
        if (path === "/myorders") {
          if (!requireAuth({ path, search })) return;
          openMyOrdersDrawer({ skipNavigate: true });
          return;
        }
        if (path === "/profile") {
          if (!requireAuth({ path, search })) return;
          openProfileDrawer({ skipNavigate: true });
          return;
        }
        if (path === "/allorders") {
          if (!requireAdmin({ path, search })) return;
          openAllOrdersDrawer({ skipNavigate: true });
          return;
        }
        if (path === "/allproducts") {
          if (!requireAdmin({ path, search })) return;
          openAllProductsView({ skipNavigate: true });
          return;
        }
        if (path === "/inventory") {
          // Inventory is intentionally opened only from the user menu action.
          openShop({ skipNavigate: true });
          return;
        }
        if (path === "/analytics") {
          if (!requireAdmin({ path, search })) return;
          void openAnalyticsDrawer({ skipNavigate: true });
          return;
        }

        openShop({ skipNavigate: true });
      } finally {
        isApplyingRouteRef.current = false;
      }
    },
    [
      authReady,
      authUserId,
      closePrimaryDrawers,
      isAdmin,
      loadAndSelectOrder,
      openAllOrdersDrawer,
      openAllProductsView,
      openCart,
      openCheckout,
      openMyOrdersDrawer,
      openProduct,
      openProfileDrawer,
      openAnalyticsDrawer,
      openShop,
    ]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      applyRouteFromLocation(window.location.pathname, window.location.search);
    };
    onPopState();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyRouteFromLocation]);

  React.useEffect(() => {
    if (!authReady || !pendingRouteRef.current) return;
    const next = pendingRouteRef.current;
    pendingRouteRef.current = null;
    applyRouteFromLocation(next.path, next.search);
  }, [applyRouteFromLocation, authReady, authUserId, isAdmin]);

  React.useEffect(() => {
    if (!orderPlacedModal || orderPlacedModal.summaryReady || orderPlacedModal.summaryTimedOut) return;
    let cancelled = false;
    const poll = async () => {
      const startedAt = Date.now();
      while (!cancelled) {
        const detail = await loadAndSelectOrder(orderPlacedModal.orderId, { retries: 0, delayMs: 0 });
        if (cancelled) return;
        if (detail) {
          setOrderPlacedModal((prev) =>
            prev && prev.orderId === orderPlacedModal.orderId ? { ...prev, summaryReady: true } : prev
          );
          return;
        }
        if (Date.now() - startedAt >= 15000) {
          setOrderPlacedModal((prev) =>
            prev && prev.orderId === orderPlacedModal.orderId
              ? { ...prev, summaryTimedOut: true }
              : prev
          );
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [loadAndSelectOrder, orderPlacedModal]);

  const composeAddress = React.useCallback((draft: CustomerDraft) => {
    const d = draft as Record<string, unknown>;
    return [
      d["attention_to"],
      d["line1"],
      d["line2"],
      d["barangay"],
      d["city"],
      d["province"],
      d["postal_code"],
      d["country"] || "Philippines",
    ]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }, []);

  const openOrderSummary = React.useCallback(
    (
      orderId: string,
      opts?: {
        skipNavigate?: boolean;
        detail?: OrderDetail | null;
        noticeText?: string;
      }
    ) => {
      closePrimaryDrawers();
      setPanel(null);
      setCartOpen(false);
      setOrderDrawerSource("public");
      setOrdersOpen(false);
      setAllOrdersOpen(false);
      setPublicOrderNotice(opts?.noticeText ?? "");
      if (opts?.detail) {
        setLoadingOrderDetail(false);
        setSelectedOrderDetail(opts.detail);
      } else {
        void loadAndSelectOrder(orderId);
      }
      if (!opts?.skipNavigate && typeof window !== "undefined") {
        const params = new URLSearchParams();
        params.set("id", orderId);
        params.set("source", "public");
        window.history.pushState({}, "", `/order?${params.toString()}`);
      }
    },
    [closePrimaryDrawers, loadAndSelectOrder]
  );

  const submitCheckout = React.useCallback(async (payload: CheckoutSubmitPayload) => {
    let activeSessionId = sessionIdRef.current;
    if (!activeSessionId || activeSessionId === "server") return;
    if (submittingCheckout) return;

    setSubmittingCheckout(true);

    try {

    if (!paymentFile) {
      alert("Please upload your payment confirmation screenshot first.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const ext = paymentFile.name.includes(".")
      ? paymentFile.name.split(".").pop()?.toLowerCase() ?? "jpg"
      : "jpg";
    const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
    const stamp = Date.now();
    const ownerKey = user?.id ? `u-${user.id}` : `anon-${activeSessionId}`;
    const path = `${ownerKey}/${stamp}.${safeExt}`;

    const uploadedA = await supabase.storage
      .from("payment-proofs")
      .upload(path, paymentFile, { upsert: false });
    let uploadError = uploadedA.error;
    const shouldTryLegacyBucket =
      !!uploadError && String(uploadError.message ?? "").toLowerCase().includes("bucket not found");
    if (shouldTryLegacyBucket) {
      const uploadedB = await supabase.storage
        .from("payment_proofs")
        .upload(path, paymentFile, { upsert: false });
      uploadError = uploadedB.error;
    }
    if (uploadError) {
      console.error("[checkout] payment proof upload failed", uploadError);
      alert(`Payment proof upload failed: ${uploadError.message}`);
      return;
    }

    const customerData = customer as Record<string, unknown>;
    const customerEmail = String(customerData["email"] ?? "");
    const customerDeliveryDate = String(customerData["delivery_date"] ?? "");
    const customerDeliverySlot = String(customerData["delivery_slot"] ?? "");
    const customerExpress = Boolean(customerData["express_delivery"]);
    const customerAddThermalBag = Boolean(customerData["add_refer_bag"]);

    const referBagLine = customerAddThermalBag ? "Add thermal bag: yes" : "";
    const composedNotes = [customer.notes.trim(), referBagLine]
      .filter(Boolean)
      .join(" | ");

    const runCheckoutRpc = async (sid: string) => {
      let data: unknown;
      let error: { message: string } | null = null;

      const v2 = await supabase.rpc("checkout_cart_v2", {
        p_session_id: sid,
        p_full_name: customer.full_name,
        p_email: customerEmail,
        p_phone: customer.phone,
        p_address: composeAddress(customer),
        p_postal_code: payload.postal_code,
        p_notes: composedNotes,
        p_delivery_date: payload.delivery_date,
        p_delivery_slot: payload.delivery_slot,
        p_express_delivery: payload.express_delivery,
        p_add_thermal_bag: payload.add_thermal_bag,
        p_subtotal: payload.subtotal,
        p_delivery_fee: payload.delivery_fee,
        p_thermal_bag_fee: payload.thermal_bag_fee,
        p_total: payload.total,
        p_payment_proof_url: path,
      });
      data = v2.data;
      error = (v2.error as any) ?? null;

      // Backward compatibility until SQL v2 is applied.
      if (error && String(error.message).toLowerCase().includes("checkout_cart_v2")) {
        const v1 = await supabase.rpc("checkout_cart", {
          p_session_id: sid,
          p_full_name: customer.full_name,
          p_phone: customer.phone,
          p_address: composeAddress(customer),
          p_notes: composedNotes,
          p_payment_proof_url: path,
        });
        data = v1.data;
        error = (v1.error as any) ?? null;
      }
      return { data, error };
    };

    let { data, error } = await runCheckoutRpc(activeSessionId);
    const noOpenCart =
      !!error &&
      String(error.message ?? "")
        .toLowerCase()
        .includes("no open cart for session_id");
    if (noOpenCart && cartItems.length > 0) {
      // Recover legacy/stale cart state by forcing a fresh cart for this session, then retry once.
      // Some DB functions detect "open cart" by cart metadata and can ignore older/closed carts.
      try {
        const created = await supabase
          .from("carts")
          .insert([{ session_id: activeSessionId }])
          .select("id")
          .single();

        const freshCartId = created.data?.id ? String(created.data.id) : "";
        if (created.error || !freshCartId) {
          throw created.error ?? new Error("Failed to create fresh cart.");
        }

        const lines = cartItems
          .map((it) => ({
            cart_id: freshCartId,
            product_id: String(it.productId),
            qty: Math.max(0, Number(it.qty) || 0),
          }))
          .filter((line) => line.product_id && line.qty > 0);

        if (lines.length > 0) {
          const up = await supabase.from("cart_lines").upsert(lines, {
            onConflict: "cart_id,product_id",
          });
          if (up.error) throw up.error;
        }
      } catch (recoveryErr) {
        console.warn("[checkout] fresh cart recovery failed, fallback to setCartLineQty:", recoveryErr);
        await Promise.all(
          cartItems.map((it) =>
            setCartLineQty(activeSessionId, String(it.productId), Math.max(0, Number(it.qty) || 0)).catch(
              () => null
            )
          )
        );
      }
      await refreshCart();
      const retried = await runCheckoutRpc(activeSessionId);
      data = retried.data;
      error = retried.error;

      const stillNoOpenCart =
        !!error &&
        String(error.message ?? "")
          .toLowerCase()
          .includes("no open cart for session_id");
      if (stillNoOpenCart) {
        const freshSid =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem("tastyprotein_session_id", freshSid);
          }
        } catch {
          // ignore storage write failures
        }
        sessionIdRef.current = freshSid;
        (globalThis as { __TP_SESSION_ID?: string }).__TP_SESSION_ID = freshSid;
        activeSessionId = freshSid;

        await Promise.all(
          cartItems.map((it) =>
            setCartLineQty(activeSessionId, String(it.productId), Math.max(0, Number(it.qty) || 0)).catch(
              () => null
            )
          )
        );
        await refreshCart();
        const rotated = await runCheckoutRpc(activeSessionId);
        data = rotated.data;
        error = rotated.error;
      }
    }

    if (error) {
      console.error("[checkout] checkout RPC failed", error);
      alert(`Checkout failed: ${error.message}`);
      return;
    }

    // Enforce initial workflow statuses for newly submitted orders.
    const orderId =
      typeof data === "string"
        ? data
        : data && typeof data === "object"
          ? (() => {
              const row = data as Record<string, unknown>;
              const candidate =
                row["id"] ?? row["order_id"] ?? row["checkout_cart_v2"] ?? row["checkout_cart"];
              return typeof candidate === "string" ? candidate : null;
            })()
          : null;
    if (orderId) {
      const { error: statusError } = await supabase
        .from("orders")
        .update({
          status: "submitted",
          paid_status: "processed",
          delivery_status: "unpacked",
          amount_paid: 0,
          placed_for_someone_else: customer.placed_for_someone_else,
        })
        .eq("id", orderId);
      if (statusError) {
        console.warn("[checkout] initial status update failed:", statusError.message);
      }
    }

    let resolvedOrderNumber = "";
    if (orderId) {
      try {
        const { data: orderMeta } = await supabase
          .from("orders")
          .select("order_number")
          .eq("id", orderId)
          .maybeSingle();
        resolvedOrderNumber = String(orderMeta?.order_number ?? "").trim();
      } catch {
        // best effort only
      }
    }

    let emailSent = false;
    if (orderId && customerEmail.trim()) {
      try {
        const origin =
          typeof window !== "undefined" ? window.location.origin : undefined;
        const emailPayload = {
          email: customerEmail.trim(),
          name: customer.full_name?.trim() || null,
          orderId,
          orderNumber: resolvedOrderNumber || null,
          origin,
        };
        const response = await fetch("/api/send-order-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(emailPayload),
        });
        if (!response.ok) {
          const details = await response.text();
          console.warn("[checkout] email failed:", details);
        } else {
          emailSent = true;
        }
      } catch (err) {
        console.warn("[checkout] email error:", err);
      }
    }

    // Try to clear the cart lines on the backend for this session.
    await Promise.all(
      cartItems.map((it) =>
        setCartLineQty(activeSessionId, String(it.productId), 0).catch(() => null)
      )
    );
    await refreshCart();
    if (user?.id && saveAddressToProfile) {
      const profileDraft = customer as Record<string, unknown>;
      const nameParts = customer.full_name.trim().split(/\s+/);
      const firstName = nameParts[0] ?? "";
      const lastName = nameParts.slice(1).join(" ");
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          first_name: firstName || null,
          last_name: lastName || null,
          phone: String(profileDraft["phone"] ?? "") || null,
          attention_to: String(profileDraft["attention_to"] ?? "") || null,
          address_line1: String(profileDraft["line1"] ?? "") || null,
          address_line2: String(profileDraft["line2"] ?? "") || null,
          barangay: String(profileDraft["barangay"] ?? "") || null,
          city: String(profileDraft["city"] ?? "") || null,
          province: String(profileDraft["province"] ?? "") || null,
          postal_code: String(profileDraft["postal_code"] ?? "") || null,
          country: String(profileDraft["country"] ?? "") || "Philippines",
          delivery_note: String(profileDraft["notes"] ?? "") || null,
        },
        { onConflict: "id" }
      );
    }
    if (!user?.id && createAccountFromDetails) {
      setAuthOpen(true);
    }
    setPaymentFile(null);
    setCustomer(blankCustomer());
    setCreateAccountFromDetails(false);
    setSaveAddressToProfile(false);
    setPanel(null);
    if (orderId) {
      setOrderPlacedModal({
        orderId,
        orderNumber: resolvedOrderNumber || orderId.slice(0, 8).toUpperCase(),
        emailSent,
        summaryReady: true,
        summaryTimedOut: false,
        isPublic: !user?.id,
      });
    } else {
      scrollToProducts();
      alert("Your order has been placed successfully.");
    }
    } finally {
      setSubmittingCheckout(false);
    }
  }, [blankCustomer, cartItems, composeAddress, createAccountFromDetails, customer, paymentFile, refreshCart, saveAddressToProfile, scrollToProducts, submittingCheckout]);

  const selectedProductImages: ProductImage[] = React.useMemo(() => {
    if (!selectedId) return [];
    return productImagesById[selectedId] ?? [];
  }, [productImagesById, selectedId]);

  const handleCheckoutSubmit: (payload: CheckoutSubmitPayload) => void = React.useCallback(
    (payload: CheckoutSubmitPayload) => {
      void submitCheckout(payload);
    },
    [submitCheckout]
  );

  const handleCartOpenProduct: (id: string) => void = React.useCallback(
    (id: string) => {
      openProduct(id);
    },
    [openProduct]
  );

  const toggleFilterOption = React.useCallback((group: FilterKey, key: string) => {
    setSelectedFilters((prev) => {
      const current = prev[group] ?? [];
      const nextValues = current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key];
      return { ...prev, [group]: nextValues };
    });
  }, []);

  const clearAllFilters = React.useCallback(() => {
    setSelectedFilters({
      status: [],
      type: [],
      cut: [],
      country: [],
      preparation: [],
      temperature: [],
    });
  }, []);

  const scrollGridToTop = React.useCallback(() => {
    const el = listScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "auto" });
  }, []);
  const hideMobileChromeForFullDrawer =
    isMobileViewport &&
    (panel === "product" || panel === "edit" || panel === "checkout");
  const mobileFullDrawerTopOffset = hideMobileChromeForFullDrawer ? 0 : topOffset;
  const showPageLoader = !isMainBgReady || loadingProducts;

  return (
    <div
      data-tp-mode={themeMode}
      style={{
        ...styles.page,
        ...(mainZoneStyle ?? null),
      }}
    >
      <style>{`
        @keyframes tp-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .tp-filter-checkbox {
          opacity: 0.8;
        }
        .tp-filter-checkbox:checked {
          opacity: 1;
        }
      `}</style>
      {showPageLoader ? (
        <div style={styles.loaderWrap} aria-label="Loading">
          <div style={styles.loaderSpinner} />
        </div>
      ) : null}
      <div
        style={{
          ...styles.pageInner,
          opacity: showPageLoader ? 0 : 1,
          visibility: showPageLoader ? "hidden" : "visible",
          pointerEvents: showPageLoader ? "none" : "auto",
        }}
      >
      {/* Header */}
      {!hideMobileChromeForFullDrawer ? (
      <div ref={headerRef} style={{ ...styles.headerWrap, ...headerZoneStyle }}>
        <div
          style={{
            ...styles.headerInner,
            ...(isMobileViewport ? { minHeight: mobileLogoHeight } : null),
          }}
        >
          {null}
          <div style={styles.brandWrap}>
            {(logoUrlsByMode[themeMode] ?? "").trim() ? (
              <img
                src={(logoUrlsByMode[themeMode] ?? "").trim()}
                alt="Tasty Protein logo"
                style={{
                  ...styles.brandLogo,
                  ...(isMobileViewport
                    ? {
                        height: mobileLogoHeight,
                        maxWidth: "min(63vw, 527px)",
                      }
                    : null),
                }}
              />
            ) : null}
            {isAdmin && editMode ? (
              <button
                type="button"
                style={styles.logoEditBtn}
                onClick={() => {
                  setLogoEditorError("");
                  setLogoEditorOpen(true);
                }}
                aria-label="Edit logo"
                title="Edit logo"
              >
                <SettingsIcon size={16} />
              </button>
            ) : null}
          </div>
          {isAdmin && editMode ? (
          <button
            type="button"
            style={styles.zoneEditBtn}
            onClick={() => openZoneEditor("main")}
            aria-label="Edit header zone"
            title="Edit header zone"
          >
            <SettingsIcon size={16} />
          </button>
          ) : null}
        </div>
      </div>
      ) : null}

      {/* Navbar */}
      {!hideMobileChromeForFullDrawer && !(isMobileViewport && mobileFiltersOpen) ? (
      <div ref={navRef}>
        <Navbar
          search={search}
          setSearch={setSearch}
          totalUnits={totalUnits}
          onOpenCart={() => {
            openCart();
          }}
          onShop={() => {
            openShop();
          }}
          gridView={resolvedGridView}
          onChangeGridView={setGridView}
          authLabel={authLabel}
          onOpenAuth={() => setAuthOpen(true)}
          onOpenProfile={openProfileDrawer}
          onOpenOrders={openMyOrdersDrawer}
          isAdmin={isAdmin}
          editMode={editMode}
          onToggleEditMode={toggleEditMode}
          onOpenAllOrders={openAllOrdersDrawer}
          onOpenAllProducts={openAllProductsView}
          onOpenInventory={openInventoryDrawer}
          onOpenAnalytics={openAnalyticsDrawer}
          onLogout={logout}
          navTone={navbarTone}
          zoneStyle={navbarDisplayStyle}
          showZoneEditor={false}
          searchStartOffset={isMobileViewport ? 0 : desktopNavLeftWidth}
          isMobile={isMobileViewport}
          showSearch={!isPrimaryDrawerOpen && panel === null && !detailsOpen}
        />
      </div>
      ) : null}

      {/* Products list */}
      {!isPrimaryDrawerOpen ? (
        <div
          ref={listScrollRef}
          style={{
            ...styles.listScroll,
            ...(mainZoneStyle ?? null),
            height: `calc(100vh - ${topOffset}px)`,
          }}
        >
          {activeBanner && String(activeBanner.image_url ?? "").trim() ? (
            <div style={styles.bannerWrap}>
              <div style={styles.bannerRail}>
                {activeBanners.length > 1 ? (
                  <button
                    type="button"
                    style={styles.bannerNavBtn}
                    onClick={handlePrevBanner}
                    aria-label="Previous banner"
                  >
                    {"<"}
                  </button>
                ) : null}
                <div style={styles.bannerFrame}>
                  {activeBanner.link_url?.trim() ? (
                    <a
                      href={activeBanner.link_url.trim()}
                      style={styles.bannerLink}
                    >
                      <img
                        src={activeBanner.image_url ?? ""}
                        alt="Promotion banner"
                        style={styles.bannerImage}
                      />
                    </a>
                  ) : (
                    <img
                      src={activeBanner.image_url ?? ""}
                      alt="Promotion banner"
                      style={styles.bannerImage}
                    />
                  )}
                </div>
                {activeBanners.length > 1 ? (
                  <button
                    type="button"
                    style={styles.bannerNavBtn}
                    onClick={handleNextBanner}
                    aria-label="Next banner"
                  >
                    {">"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div
            style={{
              ...styles.productsLayout,
              gap: isMobileViewport ? 18 : desktopNavGap,
              ...(isMobileViewport
                ? {
                    width: "100%",
                    gridTemplateColumns: "1fr",
                  }
                : {
                    ["--tp-center-col" as string]: desktopCenterColWidthCss,
                    ["--tp-side-col" as string]: desktopSideColWidthCss,
                    width: "var(--tp-rail-width)",
                    gridTemplateColumns: `var(--tp-side-col) var(--tp-center-col) var(--tp-side-col)`,
                  }),
            }}
          >
            {!isMobileViewport ? (
              <aside
                style={{
                  ...styles.filterPanel,
                  maxHeight: `calc(100vh - ${topOffset + 30}px)`,
                }}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {isAdmin && adminAllProductsMode ? (
                  <button
                    type="button"
                    style={styles.createBtn}
                    onClick={() => void createProduct()}
                  >
                    CREATE
                  </button>
                ) : null}
                <div style={styles.filterHeaderRow}>
                  <div style={{ ...styles.filterTitle, ...styles.filterTitleInline }}>FILTERS</div>
                  {selectedFilterCount > 0 ? (
                    <button
                      type="button"
                      style={styles.filterClearText}
                      onClick={() => {
                        clearAllFilters();
                        scrollGridToTop();
                      }}
                      aria-label="Clear filters"
                      title="Clear filters"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <div style={styles.filterScrollArea}>
                  {filterGroups.map((group, index) => (
                    <div
                      key={group.key}
                      style={{
                        ...styles.filterGroup,
                        ...(index === 0 ? styles.filterGroupFirst : null),
                      }}
                    >
                      <div style={styles.filterSubheader}>{group.label}</div>
                      <div style={styles.filterList}>
                        {filterOptionsByGroup[group.key].map((option) => (
                          <label
                            key={`${group.key}-${option.key}`}
                            style={{ ...styles.filterItem, ...styles.filterItemDesktop }}
                          >
                            <input
                              className="tp-filter-checkbox"
                              style={styles.filterCheckboxDesktop}
                              type="checkbox"
                              checked={selectedFilters[group.key].includes(option.key)}
                              onChange={() => {
                                toggleFilterOption(group.key, option.key);
                                scrollGridToTop();
                              }}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            ) : null}

            <div
              style={{
                ...styles.gridWrap,
                ...(isMobileViewport ? null : { padding: 0 }),
              }}
            >
              <ProductGrid
                products={filteredProducts}
                loading={loadingProducts}
                cart={cart}
                viewMode={resolvedGridView}
                contained
                canEditProducts={isAdmin && (editMode || adminAllProductsMode)}
                onAdd={addToCart}
                onRemove={removeFromCart}
                onSetQty={setQtyInCart}
                onOpenProduct={openProduct}
                onEditProduct={openEditProduct}
                onQuickStatusChange={updateProductStatus}
                formatMoney={formatMoney}
              />
            </div>

            {!isMobileViewport ? (
              <aside
                style={styles.summaryPanel}
                role="button"
                tabIndex={0}
                aria-label="Open cart"
                onClick={() => openCart()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openCart();
                  }
                }}
              >
                <div style={styles.summaryRows}>
                  <div style={styles.summaryRow}>
                    <span>Items</span>
                    <span>{totalUnits}</span>
                  </div>
                  <div style={{ ...styles.summaryRow, ...styles.summaryTotalRow }}>
                    <span>Total</span>
                    <span>₱ {formatMoney(subtotal)}</span>
                  </div>
              </div>
              </aside>
            ) : null}
          </div>

          {isMobileViewport ? (
            <button
              type="button"
              style={{
                ...styles.mobileFilterFab,
                ...(selectedFilterCount > 0 ? styles.mobileFilterFabActive : null),
              }}
              onClick={() => setMobileFiltersOpen((v) => !v)}
              aria-label="Open filters"
              title="Filters"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M4 7h16M7 12h10M10 17h4"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              {selectedFilterCount > 0 ? (
                <span style={styles.mobileFilterBadge}>{selectedFilterCount}</span>
              ) : null}
            </button>
          ) : null}
          {isMobileViewport && mobileFiltersOpen ? (
            <div
              style={styles.mobileFilterModalBackdrop}
              onClick={() => setMobileFiltersOpen(false)}
            >
              <aside
                className="tp-sheet-slide-up"
                style={{ ...styles.mobileFilterModal, ...(mainZoneStyle ?? null) }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={styles.mobileFilterTopRow}>
                  <div style={{ ...styles.filterHeaderRow, ...styles.mobileFilterHeaderRow }}>
                    <div style={{ ...styles.filterTitle, ...styles.filterTitleInline }}>FILTERS</div>
                    {selectedFilterCount > 0 ? (
                      <button
                        type="button"
                        style={styles.filterClearText}
                        onClick={() => {
                          clearAllFilters();
                          scrollGridToTop();
                        }}
                        aria-label="Clear filters"
                        title="Clear filters"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    style={styles.mobileFilterTopCloseBtn}
                    onClick={() => setMobileFiltersOpen(false)}
                  >
                    CLOSE
                  </button>
                </div>
                {isAdmin && adminAllProductsMode ? (
                  <button
                    type="button"
                    style={styles.createBtn}
                    onClick={() => void createProduct()}
                  >
                    CREATE
                  </button>
                ) : null}
                <div style={styles.mobileFilterScrollArea}>
                  {filterGroups.map((group, index) => (
                    <div
                      key={group.key}
                      style={{
                        ...styles.filterGroup,
                        ...(index === 0 ? styles.filterGroupFirst : null),
                      }}
                    >
                      <div style={styles.filterSubheader}>{group.label}</div>
                      <div style={styles.filterList}>
                        {filterOptionsByGroup[group.key].map((option) => (
                          <label
                            key={`${group.key}-${option.key}`}
                            style={{ ...styles.filterItem, ...styles.filterItemMobile }}
                          >
                            <input
                              className="tp-filter-checkbox"
                              style={styles.filterCheckboxMobile}
                              type="checkbox"
                              checked={selectedFilters[group.key].includes(option.key)}
                              onChange={() => {
                                toggleFilterOption(group.key, option.key);
                                scrollGridToTop();
                              }}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Product drawer */}
      <ProductDrawer
        isOpen={panel === "product"}
        topOffset={mobileFullDrawerTopOffset}
        product={selectedProduct}
        images={selectedProductImages}
        qty={selectedId ? cart[selectedId] ?? 0 : 0}
        onBack={backToList}
        canEdit={isAdmin && editMode}
        onEdit={openEditProduct}
        onAdd={addToCart}
        onRemove={removeFromCart}
        formatMoney={formatMoney}
      />

      <ProductEditorDrawer
        isOpen={panel === "edit"}
        topOffset={mobileFullDrawerTopOffset}
        product={selectedProduct}
        images={selectedProductImages}
        onClose={closeEditor}
        onSaved={async ({ product: nextProduct, images: nextImages }) => {
          setProducts((prev) =>
            prev.map((prod) => (String(prod.id) === String(nextProduct.id) ? nextProduct : prod))
          );
          setProductImagesById((prev) => ({
            ...prev,
            [String(nextProduct.id)]: nextImages,
          }));
        }}
        onDeleted={async () => {
          await loadCatalog();
          setPanel(null);
          setSelectedId(null);
          setEditorReturnToProduct(false);
        }}
      />

      {/* Checkout drawer */}
      <CheckoutDrawer
        isOpen={panel === "checkout"}
        topOffset={mobileFullDrawerTopOffset}
        items={cartItemsForDisplay}
        total={subtotal}
        customer={customer as CustomerDraft}
        setCustomer={handleSetCustomer}
        isAdmin={isAdmin}
        isLoggedIn={!!authUserId}
        createAccountFromDetails={createAccountFromDetails}
        setCreateAccountFromDetails={setCreateAccountFromDetails}
        suggestSaveAddressToProfile={!!authUserId && !profileHasAddress}
        saveAddressToProfile={saveAddressToProfile}
        setSaveAddressToProfile={setSaveAddressToProfile}
        profileAddress={profileAddress}
        paymentFile={paymentFile}
        setPaymentFile={setPaymentFile}
        gcashQrUrl={checkoutPaymentDraft.gcash_qr_url}
        gcashPhone={checkoutPaymentDraft.gcash_phone}
        onBack={backToList}
        onSubmit={handleCheckoutSubmit as (payload: CheckoutSubmitPayload) => void}
        submitting={submittingCheckout}
        onOpenProfile={openProfileDrawer}
        onAddItem={addToCart}
        onRemoveItem={removeFromCart}
        formatMoney={formatMoney}
      />

      {/* Cart drawer */}
      <CartDrawer
        isOpen={cartOpen}
        items={cartItemsForDisplay}
        subtotal={subtotal}
        backgroundStyle={mainZoneStyle}
        onClose={closeCart}
        onOpenProduct={handleCartOpenProduct as (id: string) => void}
        onAdd={addToCart}
        onRemove={removeFromCart}
        onSetQty={setQtyInCart}
        onCheckout={openCheckout}
        checkoutLoading={checkoutOpening}
        formatMoney={formatMoney}
      />

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      <MyDetailsDrawer
        isOpen={detailsOpen}
        topOffset={topOffset}
        userId={authUserId}
        onClose={() => setDetailsOpen(false)}
        onProfileSaved={(firstName) => {
          if (firstName) setAuthLabel(firstName);
        }}
      />

      <MyOrdersDrawer
        isOpen={ordersOpen}
        topOffset={topOffset}
        title="MY ORDERS"
        orders={myOrders}
        selectedOrderId={selectedMyOrderId}
        onSelectOrder={(id) => {
          setSelectedMyOrderId(id);
          setOrderDrawerSource("my");
          setOrdersOpen(false);
          if (typeof window !== "undefined") {
            const params = new URLSearchParams({ id, source: "my" });
            window.history.pushState({}, "", `/order?${params.toString()}`);
          }
          void loadAndSelectOrder(id);
        }}
        onClose={() => {
          setOrderDrawerSource(null);
          setSelectedOrderDetail(null);
          setOrdersOpen(false);
        }}
      />

      <MyOrdersDrawer
        isOpen={allOrdersOpen}
        topOffset={topOffset}
        title="ALL ORDERS"
        showSearch
        orders={allOrders}
        selectedOrderId={selectedAllOrderId}
        onSelectOrder={(id) => {
          setSelectedAllOrderId(id);
          setOrderDrawerSource("all");
          setAllOrdersOpen(false);
          if (typeof window !== "undefined") {
            const params = new URLSearchParams({ id, source: "all" });
            window.history.pushState({}, "", `/order?${params.toString()}`);
          }
          void loadAndSelectOrder(id);
        }}
        onClose={() => {
          setOrderDrawerSource(null);
          setSelectedOrderDetail(null);
          setAllOrdersOpen(false);
        }}
      />

      <InventoryDrawer
        isOpen={inventoryOpen}
        topOffset={topOffset}
        rows={inventoryRows}
        loading={loadingInventory}
        onChangeUnlimited={handleInventoryUnlimitedChange}
        onChangeQtyOnHand={handleInventoryQtyOnHandChange}
        onBulkChangeUnlimited={handleInventoryBulkUnlimitedChange}
        onBulkChangeQtyOnHand={handleInventoryBulkQtyOnHandChange}
        onClose={() => {
          openShop();
        }}
      />

      <AnalyticsDrawer
        isOpen={analyticsOpen}
        topOffset={topOffset}
        orders={allOrders}
        backgroundStyle={mainZoneStyle}
        onClose={() => {
          openShop();
        }}
      />

      <OrderDrawer
        isOpen={!!orderDrawerSource && (loadingOrderDetail || !!selectedOrderDetail)}
        topOffset={topOffset}
        detail={selectedOrderDetail}
        products={products}
        loading={loadingOrderDetail}
        canEdit={orderDrawerSource === "all"}
        onChangeStatuses={handleOrderStatusChange}
        onChangePackedQty={handleOrderPackedQtyChange}
        onAddLines={handleOrderAddLines}
        onChangeAmountPaid={handleOrderAmountPaidChange}
        onChangePaymentProof={handleOrderPaymentProofChange}
        onChangeAdminFields={handleOrderAdminFieldsChange}
        onDeleteOrder={handleOrderDelete}
        noticeText={orderDrawerSource === "public" ? publicOrderNotice : ""}
        onBack={() => {
          const source = orderDrawerSource;
          setPublicOrderNotice("");
          setOrderDrawerSource(null);
          setSelectedOrderDetail(null);
          if (source === "public") {
            openShop();
            return;
          }
          if (source === "my") {
            setOrdersOpen(true);
            if (typeof window !== "undefined") {
              window.history.pushState({}, "", "/myorders");
            }
            return;
          }
          if (source === "all") {
            setAllOrdersOpen(true);
            if (typeof window !== "undefined") {
              window.history.pushState({}, "", "/allorders");
            }
          }
        }}
      />

      {submittingCheckout || orderPlacedModal ? (
        <div style={styles.orderPlacedBackdrop}>
          <div style={{ ...styles.orderPlacedModal, ...(mainZoneStyle ?? null) }}>
            {!orderPlacedModal ? (
              <>
                <div style={styles.orderPlacedTitle}>Ordering in progress...</div>
                <div style={styles.orderPlacedText}>Do not close this window.</div>
              </>
            ) : (
              <>
                <div style={styles.orderPlacedTitle}>
                  Your order number {orderPlacedModal.orderNumber} has been placed successfully.
                </div>
                <div style={styles.orderPlacedText}>
                  {orderPlacedModal.emailSent
                    ? orderPlacedModal.isPublic
                      ? "Your order has been sent to your email with a link to open this order summary and track its status."
                      : "Your order has been sent to your email."
                    : orderPlacedModal.isPublic
                      ? "Use the OK button below to open your order summary and track its status."
                      : "Use the OK button below to open your order summary."}
                </div>
                {orderPlacedModal.summaryReady || orderPlacedModal.summaryTimedOut ? (
                  <button
                    type="button"
                    style={styles.orderPlacedOkBtn}
                    onClick={() => {
                      const orderId = orderPlacedModal.orderId;
                      const noticeText = orderPlacedModal.emailSent
                        ? "Your order has been sent to your email with a link to open this order summary and track its status."
                        : "Your order has been placed. Use this order summary to track its status.";
                      setOrderPlacedModal(null);
                      void openOrderSummary(orderId, { noticeText });
                    }}
                  >
                    OK
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      <ZoneStyleModal
        isOpen={zoneEditorOpen}
        zoneLabel={zoneEditorTarget}
        initial={zoneStylesByMode[themeMode][zoneEditorTarget]}
        saving={zoneEditorSaving}
        error={zoneEditorError}
        onClose={() => setZoneEditorOpen(false)}
        onSave={saveZoneStyle}
        onUploadFile={(file) => uploadUiAsset(file, "zone")}
        themeMode={themeMode}
        themeColors={themeColors}
        onSaveThemeColors={saveThemeColors}
        banners={
          zoneEditorTarget === "main"
            ? banners.map((banner, index) => ({
                id: banner.id,
                image_url: banner.image_url ?? "",
                link_url: banner.link_url ?? "",
                sort_order: Number.isFinite(banner.sort_order)
                  ? (banner.sort_order as number)
                  : index,
              }))
            : undefined
        }
        onSaveBanners={zoneEditorTarget === "main" ? saveBanners : undefined}
        onUploadBanner={
          zoneEditorTarget === "main"
            ? (file) => uploadUiAsset(file, "banner")
            : undefined
        }
        paymentDraft={zoneEditorTarget === "main" ? checkoutPaymentDraft : undefined}
        onSavePaymentDraft={
          zoneEditorTarget === "main" ? saveCheckoutPaymentDraft : undefined
        }
        onUploadPaymentQr={
          zoneEditorTarget === "main"
            ? (file) => uploadUiAsset(file, "payment")
            : undefined
        }
      />

      <LogoEditorModal
        isOpen={logoEditorOpen}
        initialUrl={logoUrlsByMode[themeMode] ?? ""}
        saving={logoEditorSaving}
        error={logoEditorError}
        onClose={() => setLogoEditorOpen(false)}
        onSave={saveLogo}
        onUploadFile={(file) => uploadUiAsset(file, "logo")}
        themeMode={themeMode}
      />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "var(--tp-page-bg)",
    color: "var(--tp-text-color)",
  },
  pageInner: {
    minHeight: "100vh",
  },
  loaderWrap: {
    position: "fixed",
    inset: 0,
    zIndex: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.72)",
    backdropFilter: "blur(3px)",
    WebkitBackdropFilter: "blur(3px)",
    color: "#f2f2f2",
    textTransform: "uppercase",
    letterSpacing: 2.2,
    fontSize: 15,
    fontWeight: 700,
    gap: 14,
  },
  loaderSpinner: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "3px solid rgba(102,199,255,0.25)",
    borderTopColor: "var(--tp-accent, #66c7ff)",
    animation: "tp-spin 1s linear infinite",
  },
  headerWrap: {
    position: "sticky",
    top: 0,
    zIndex: 40,
    background: "black",
    borderBottom: "none",
  },
  headerInner: {
    position: "relative",
    minHeight: 136,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 0,
    padding: "0",
  },
  brandWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  },
  headerThemeBtn: {
    position: "absolute",
    left: 8,
    top: 10,
    height: 40,
    borderRadius: 12,
    border: "1px solid var(--tp-text-color)",
    background: "transparent",
    color: "var(--tp-text-color)",
    padding: "0 15px",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  brand: {
    fontSize: 34,
    fontWeight: 900,
    letterSpacing: 4,
    opacity: 0.9,
  },
  brandLogo: {
    height: 136,
    maxWidth: "min(79vw, 655px)",
    width: "auto",
    objectFit: "contain",
  },
  logoEditBtn: {
    height: 40,
    width: 40,
    minWidth: 40,
    borderRadius: 12,
    border: "1px solid #66c7ff",
    background: "rgba(24, 72, 102, 0.16)",
    color: "#66c7ff",
    padding: 0,
    cursor: "pointer",
  },
  zoneEditBtn: {
    position: "absolute",
    right: 8,
    top: 10,
    height: 40,
    width: 40,
    minWidth: 40,
    borderRadius: 12,
    border: "1px solid #66c7ff",
    background: "rgba(24, 72, 102, 0.16)",
    color: "#66c7ff",
    padding: 0,
    cursor: "pointer",
  },
  listScroll: {
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    position: "relative",
    zIndex: 10,
    paddingBottom: 20,
  },
  bannerWrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    padding: "18px 0 8px",
  },
  bannerRail: {
    width: "var(--tp-rail-width)",
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 12,
  },
  bannerFrame: {
    width: "100%",
    height: 175,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.2)",
  },
  bannerLink: {
    display: "block",
    width: "100%",
    height: "100%",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  bannerNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(0,0,0,0.35)",
    color: "#fff",
    fontSize: 22,
    cursor: "pointer",
  },
  mainZoneEditBtn: {
    position: "absolute",
    top: 12,
    right: 8,
    zIndex: 35,
    height: 40,
    width: 40,
    minWidth: 40,
    borderRadius: 12,
    border: "1px solid #66c7ff",
    background: "rgba(24, 72, 102, 0.16)",
    color: "#66c7ff",
    padding: 0,
    cursor: "pointer",
  },
  productsLayout: {
    width: "var(--tp-rail-width)",
    margin: "0 auto",
    display: "grid",
    gap: 18,
    alignItems: "start",
  },
  filterPanel: {
    position: "sticky",
    top: 14,
    marginTop: 16,
    overflow: "hidden",
    border: "none",
    borderRadius: 12,
    padding: "15px 15px 15px 0",
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  filterScrollArea: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overscrollBehaviorY: "contain",
    paddingRight: 4,
  },
  summaryPanel: {
    position: "sticky",
    top: 14,
    marginTop: 16,
    border: "none",
    borderRadius: 12,
    padding: "15px 0 15px 15px",
    background: "transparent",
    display: "grid",
    gap: 12,
    alignSelf: "start",
  },
  summaryRows: {
    display: "grid",
    gap: 4,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 15,
    opacity: 0.92,
  },
  summaryTotalRow: {
    paddingTop: 0,
    marginTop: 0,
    opacity: 1,
  },
  createBtn: {
    height: 42,
    minHeight: 42,
    borderRadius: 12,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 1,
    padding: "0 15px",
    cursor: "pointer",
    marginBottom: 20,
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    boxSizing: "border-box",
    appearance: "none",
  },
  mobileFilterFab: {
    position: "fixed",
    right: 20,
    bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
    zIndex: 60,
    width: 40,
    height: 40,
    borderRadius: 999,
    border: "1px solid var(--tp-accent)",
    background: "var(--tp-accent)",
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
  },
  mobileFilterFabActive: {
    border: "1px solid var(--tp-accent)",
    color: "#ffffff",
    background: "var(--tp-accent)",
  },
  mobileFilterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    background: "#ffffff",
    color: "#000000",
    border: "1px solid rgba(0,0,0,0.16)",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: "15px",
    padding: "0 4px",
    textAlign: "center",
  },
  mobileFilterPanel: {
    marginBottom: 10,
    border: "1px solid var(--tp-border-color)",
    borderRadius: 12,
    padding: 12,
    background: "var(--tp-control-bg-soft)",
  },
  mobileFilterModalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1600,
    background: "transparent",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: 10,
    boxSizing: "border-box",
  },
  mobileFilterModal: {
    width: "min(520px, calc(100vw - 20px))",
    maxHeight: "80vh",
    overflow: "hidden",
    border: "1px solid var(--tp-border-color)",
    borderRadius: 12,
    padding: 20,
    background: "var(--tp-page-bg)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  mobileFilterScrollArea: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overscrollBehaviorY: "contain",
    paddingRight: 2,
    marginTop: 8,
  },
  mobileFilterCloseBtn: {
    marginTop: 4,
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "transparent",
    color: "var(--tp-text-color)",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 1,
    cursor: "pointer",
  },
  mobileFilterTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
  },
  mobileFilterHeaderRow: {
    justifyContent: "flex-start",
    gap: 15,
    marginBottom: 0,
  },
  mobileFilterTopCloseBtn: {
    width: 68,
    minWidth: 68,
    height: 36,
    padding: 0,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 1,
    border: "none",
    background: "transparent",
    color: "var(--tp-text-color)",
    textAlign: "right",
    cursor: "pointer",
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 1.1,
    marginBottom: 20,
  },
  filterTitleInline: {
    marginBottom: 0,
  },
  filterHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  filterClearText: {
    border: "none",
    background: "transparent",
    boxShadow: "none",
    color: "var(--tp-accent)",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.4,
    cursor: "pointer",
    padding: 0,
    outline: "none",
    appearance: "none",
  },
  filterList: {
    display: "grid",
    gap: 8,
  },
  filterGroup: {
    display: "grid",
    gap: 8,
    marginTop: 20,
  },
  filterGroupFirst: {
    marginTop: 0,
  },
  filterSubheader: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.4,
    opacity: 0.95,
    marginTop: 6,
  },
  filterItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 15,
    minHeight: 24,
    cursor: "pointer",
  },
  filterItemDesktop: {
    fontSize: 14,
  },
  filterItemMobile: {
    fontSize: 16,
  },
  filterCheckboxDesktop: {
    transform: "scale(1.08)",
    transformOrigin: "left center",
    marginLeft: 10,
    marginRight: 4,
  },
  filterCheckboxMobile: {
    transform: "scale(1.2)",
    transformOrigin: "left center",
    marginLeft: 20,
    marginRight: 4,
  },
  gridWrap: {
    minWidth: 0,
    padding: "0 10px",
    boxSizing: "border-box",
  },
  emptyHint: {
    width: "min(1200px, 96vw)",
    margin: "0 auto",
    opacity: 0.7,
    paddingBottom: 40,
  },
  orderPlacedBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.58)",
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    zIndex: 1400,
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  orderPlacedModal: {
    width: "min(560px, 92vw)",
    minHeight: 300,
    borderRadius: 12,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-page-bg)",
    padding: 18,
    color: "var(--tp-text-color)",
    display: "grid",
    alignContent: "center",
    gap: 18,
    textAlign: "center",
  },
  orderPlacedTitle: {
    fontSize: 17,
    fontWeight: 800,
    lineHeight: 1.35,
  },
  orderPlacedText: {
    fontSize: 15,
    opacity: 0.92,
    lineHeight: 1.35,
  },
  orderPlacedOkBtn: {
    width: 92,
    height: 36,
    justifySelf: "center",
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
};
