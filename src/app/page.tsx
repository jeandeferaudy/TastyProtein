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
import ZoneStyleModal, { type ZoneStyleDraft, type ThemeColorsDraft } from "@/components/ZoneStyleModal";
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
  fetchOrderDetail,
  fetchOrders,
  updateOrderAmountPaid,
  updateOrderPaymentProof,
  updateOrderLinePackedQty,
  updateOrderStatuses,
  type OrderDetail,
  type OrderStatusPatch,
} from "@/lib/ordersApi";
import { supabase } from "@/lib/supabase";
import type { CheckoutSubmitPayload, CustomerDraft } from "@/types/checkout";

type Panel = null | "product" | "checkout" | "edit";
type ZoneName = "header" | "navbar" | "main";

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
};

type ThemeColorsRow = ThemeColorsDraft & {
  mode: "dark" | "light";
};

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

  // ----------------------------
  // Products
  // ----------------------------
  const [products, setProducts] = React.useState<DbProduct[]>([]);
  const [productImagesById, setProductImagesById] = React.useState<
    Record<string, ProductImage[]>
  >({});
  const [loadingProducts, setLoadingProducts] = React.useState<boolean>(true);
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState<boolean>(false);

  const [search, setSearch] = React.useState<string>("");
  const [gridView, setGridView] = React.useState<"list" | "4" | "6">("4");
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  const [authOpen, setAuthOpen] = React.useState<boolean>(false);
  const [authLabel, setAuthLabel] = React.useState<string | null>(null);
  const [authUserId, setAuthUserId] = React.useState<string | null>(null);
  const [authEmail, setAuthEmail] = React.useState<string>("");
  const [authPhone, setAuthPhone] = React.useState<string>("");
  const [detailsOpen, setDetailsOpen] = React.useState<boolean>(false);
  const [ordersOpen, setOrdersOpen] = React.useState<boolean>(false);
  const [allOrdersOpen, setAllOrdersOpen] = React.useState<boolean>(false);
  const [editMode, setEditMode] = React.useState<boolean>(false);
  const [myOrders, setMyOrders] = React.useState<MyOrderItem[]>([]);
  const [allOrders, setAllOrders] = React.useState<MyOrderItem[]>([]);
  const [selectedMyOrderId, setSelectedMyOrderId] = React.useState<string | null>(null);
  const [selectedAllOrderId, setSelectedAllOrderId] = React.useState<string | null>(null);
  const [orderDrawerSource, setOrderDrawerSource] = React.useState<"my" | "all" | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = React.useState<OrderDetail | null>(
    null
  );
  const [loadingOrderDetail, setLoadingOrderDetail] = React.useState<boolean>(false);
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
  const [logoEditorOpen, setLogoEditorOpen] = React.useState<boolean>(false);
  const [logoEditorSaving, setLogoEditorSaving] = React.useState<boolean>(false);
  const [logoEditorError, setLogoEditorError] = React.useState<string>("");
  const DEFAULT_THEME_COLORS_BY_MODE: Record<"dark" | "light", ThemeColorsDraft> = React.useMemo(
    () => ({
      dark: {
        accent_color: "#66c7ff",
        text_color: "#ffffff",
        line_color: "#ffffff",
        button_border_color: "#ffffff",
        button_bg_color: "transparent",
        checkbox_color: "#cfd6dd",
        background_color: "#000000",
      },
      light: {
        accent_color: "#2b8cff",
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
  const resolvedGridView: "list" | "4" | "6" = gridView;
  const handleSetCustomer = React.useCallback((next: CustomerDraft) => {
    setCustomer(next);
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
        return {
          ...prod,
          thumbnail_url: ownThumb ?? orderOne ?? firstImage,
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
        .select("logo_url,logo_url_dark,logo_url_light")
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
      if (error || !data) return;
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

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--tp-accent", themeColors.accent_color || "#66c7ff");
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user || !mounted) {
        setIsAdmin(false);
        setEditMode(false);
        setAdminAllProductsMode(false);
        setAuthLabel(null);
        setAuthUserId(null);
        setAuthEmail("");
        setAuthPhone("");
        return;
      }

      const rawLabel =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email ||
        user.phone;
      setAuthLabel(rawLabel ? String(rawLabel).trim() : null);
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

      if (mounted) setIsAdmin(role === "admin");
    };

    loadRole();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      loadRole();
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const logout = React.useCallback(async () => {
    await supabase.auth.signOut();
    setAuthLabel(null);
    setAuthUserId(null);
    setAuthEmail("");
    setAuthPhone("");
    setIsAdmin(false);
    setEditMode(false);
    setAdminAllProductsMode(false);
    setDetailsOpen(false);
    setOrdersOpen(false);
    setAllOrdersOpen(false);
    setMyOrders([]);
    setAllOrders([]);
    setSelectedMyOrderId(null);
    setSelectedAllOrderId(null);
    setOrderDrawerSource(null);
    setSelectedOrderDetail(null);
    setProfileHasAddress(false);
    setSaveAddressToProfile(false);
    setCreateAccountFromDetails(false);
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
  }, []);

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
        full_name: prev.full_name || fullName,
        email: prev.email || authEmail || "",
        phone: prev.phone || profilePhone || authPhone || "",
        attention_to: prev.attention_to || String(data?.attention_to ?? "").trim(),
        line1: prev.line1 || String(data?.address_line1 ?? "").trim(),
        line2: prev.line2 || String(data?.address_line2 ?? "").trim(),
        barangay: prev.barangay || String(data?.barangay ?? "").trim(),
        city: prev.city || String(data?.city ?? "").trim(),
        province: prev.province || String(data?.province ?? "").trim(),
        postal_code: prev.postal_code || String(data?.postal_code ?? "").trim(),
        country: prev.country || String(data?.country ?? "").trim() || "Philippines",
        notes: prev.notes || deliveryNote,
      }));
    };
    void fillCustomer();
  }, [authUserId, authEmail, authPhone]);

  const openZoneEditor = React.useCallback((zone: ZoneName) => {
    setZoneEditorError("");
    setZoneEditorTarget(zone);
    setZoneEditorOpen(true);
  }, []);

  const saveZoneStyle = React.useCallback(
    async (next: ZoneStyleDraft) => {
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
        const { error } = await supabase
          .from("ui_zone_styles")
          .upsert(payload, { onConflict: "zone,mode" });
        if (error) throw error;
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
        setZoneEditorOpen(false);
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
      } finally {
        setZoneEditorSaving(false);
      }
    },
    [themeMode, zoneEditorTarget]
  );

  const uploadUiAsset = React.useCallback(
    async (file: File, kind: "zone" | "logo"): Promise<string> => {
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
      if (error) throw error;
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

  const saveThemeColors = React.useCallback(async (next: ThemeColorsDraft) => {
    try {
      const payload = { mode: themeMode, ...next };
      const { error } = await supabase
        .from("ui_theme_colors")
        .upsert(payload, { onConflict: "mode" });
      if (error) throw error;
      setThemeColorsByMode((prev) => ({ ...prev, [themeMode]: { ...prev[themeMode], ...next } }));
    } catch (e) {
      console.error("[theme-colors] save failed", e);
    }
  }, [themeMode]);

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

  const closePrimaryDrawers = React.useCallback(() => {
    setPanel(null);
    setDetailsOpen(false);
    setOrdersOpen(false);
    setAllOrdersOpen(false);
    setOrderDrawerSource(null);
    setSelectedOrderDetail(null);
  }, []);

  const isPrimaryDrawerOpen = React.useMemo(
    () => panel !== null || detailsOpen || ordersOpen || allOrdersOpen || !!orderDrawerSource,
    [allOrdersOpen, detailsOpen, orderDrawerSource, ordersOpen, panel]
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

  // ----------------------------
  // Filtered products + selection
  // ----------------------------
  const normalizeType = React.useCallback(
    (value: unknown) => String(value ?? "").trim().toLowerCase(),
    []
  );

  const productTypes = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const raw = String(p.type ?? "").trim();
      const key = normalizeType(raw) || "other";
      if (!map.has(key)) map.set(key, raw || "Other");
    }
    return [...map.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [normalizeType, products]);

  React.useEffect(() => {
    const valid = new Set(productTypes.map((t) => t.key));
    setSelectedTypes((prev) => prev.filter((t) => valid.has(t)));
  }, [productTypes]);

  const filteredProducts = React.useMemo(() => {
    const q = search.trim();
    const hasTypeFilter = selectedTypes.length > 0;
    return products.filter((p) => {
      const typeKey = normalizeType(p.type) || "other";
      const typeOk = !hasTypeFilter || selectedTypes.includes(typeKey);
      return typeOk && matchesProductQuery(p, q);
    });
  }, [normalizeType, products, search, selectedTypes]);

  const selectedProduct = React.useMemo(() => {
    if (!selectedId) return null;
    return products.find((p) => String(p.id) === selectedId) ?? null;
  }, [products, selectedId]);

  const cartItemsForDisplay = React.useMemo(() => {
    const enriched = cartItems.map((item) => {
      const product = products.find((p) => String(p.id) === item.productId);
      if (item.temperature && item.thumbnailUrl) return item;
      return {
        ...item,
        country: item.country ?? product?.country_of_origin ?? null,
        type: product?.type ?? null,
        temperature: product?.temperature ?? null,
        thumbnailUrl: item.thumbnailUrl ?? product?.thumbnail_url ?? null,
      };
    });
    return enriched.sort((a, b) => {
      const typeA = String(a.type ?? "").toLowerCase();
      const typeB = String(b.type ?? "").toLowerCase();
      if (typeA !== typeB) return typeA.localeCompare(typeB);
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
  }, [cartItems, products]);

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

  const openAllProductsView = React.useCallback(() => {
    if (!isAdmin) return;
    closePrimaryDrawers();
    setCartOpen(false);
    setAdminAllProductsMode(true);
    const el = listScrollRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
  }, [closePrimaryDrawers, isAdmin]);

  const openProduct = React.useCallback((id: string) => {
    listScrollTopRef.current = listScrollRef.current?.scrollTop ?? 0;
    setSelectedId(id);
    setDetailsOpen(false);
    setOrdersOpen(false);
    setAllOrdersOpen(false);
    setOrderDrawerSource(null);
    setSelectedOrderDetail(null);
    setPanel("product");
  }, []);

  const openEditProduct = React.useCallback(
    (id: string) => {
      if (!isAdmin) return;
      listScrollTopRef.current = listScrollRef.current?.scrollTop ?? 0;
      setEditorReturnToProduct(panel === "product");
      setSelectedId(id);
      setDetailsOpen(false);
      setOrdersOpen(false);
      setAllOrdersOpen(false);
      setOrderDrawerSource(null);
      setSelectedOrderDetail(null);
      setPanel("edit");
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
  }, [isAdmin, loadCatalog]);

  const closeEditor = React.useCallback(() => {
    if (editorReturnToProduct && selectedId) {
      setPanel("product");
      return;
    }
    closePrimaryDrawers();
    const el = listScrollRef.current;
    if (el) el.scrollTop = listScrollTopRef.current;
  }, [closePrimaryDrawers, editorReturnToProduct, selectedId]);

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
    const el = listScrollRef.current;
    if (el) el.scrollTop = listScrollTopRef.current;
  }, [closePrimaryDrawers]);

  const openCheckout = React.useCallback(() => {
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
        full_name: prev.full_name || fullName,
        email: prev.email || authEmail || "",
        phone: prev.phone || String(data?.phone ?? "").trim() || authPhone || "",
        attention_to: prev.attention_to || String(data?.attention_to ?? "").trim(),
        line1: prev.line1 || String(data?.address_line1 ?? "").trim(),
        line2: prev.line2 || String(data?.address_line2 ?? "").trim(),
        barangay: prev.barangay || String(data?.barangay ?? "").trim(),
        city: prev.city || String(data?.city ?? "").trim(),
        province: prev.province || String(data?.province ?? "").trim(),
        postal_code: prev.postal_code || String(data?.postal_code ?? "").trim(),
        country: prev.country || String(data?.country ?? "").trim() || "Philippines",
        notes: prev.notes || String(data?.delivery_note ?? "").trim(),
      }));
    };

    setCartOpen(false);
    setDetailsOpen(false);
    setOrdersOpen(false);
    setAllOrdersOpen(false);
    setOrderDrawerSource(null);
    setSelectedOrderDetail(null);
    void loadProfileForCheckout();
    setPanel("checkout");
  }, [authEmail, authPhone, authUserId]);

  const openProfileDrawer = React.useCallback(() => {
    closePrimaryDrawers();
    setCartOpen(false);
    setDetailsOpen(true);
  }, [closePrimaryDrawers]);

  const loadAndSelectOrder = React.useCallback(async (orderId: string) => {
    setLoadingOrderDetail(true);
    setSelectedOrderDetail(null);
    try {
      const detail = await fetchOrderDetail(orderId);
      setSelectedOrderDetail(detail);
    } catch (e) {
      console.error("Failed to load order detail", e);
      setSelectedOrderDetail(null);
    } finally {
      setLoadingOrderDetail(false);
    }
  }, []);

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

  const openMyOrdersDrawer = React.useCallback(() => {
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
  }, [authEmail, authPhone, authUserId, closePrimaryDrawers]);

  const openAllOrdersDrawer = React.useCallback(() => {
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
  }, [closePrimaryDrawers]);

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

  const submitCheckout = React.useCallback(async (payload: CheckoutSubmitPayload) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || sessionId === "server") return;

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
    const ownerKey = user?.id ? `u-${user.id}` : `anon-${sessionId}`;
    const path = `${ownerKey}/${stamp}.${safeExt}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(path, paymentFile, { upsert: true });
    if (uploadError) {
      alert(uploadError.message);
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

    let data: unknown;
    let error: { message: string } | null = null;

    const v2 = await supabase.rpc("checkout_cart_v2", {
      p_session_id: sessionId,
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
        p_session_id: sessionId,
        p_full_name: customer.full_name,
        p_phone: customer.phone,
        p_address: composeAddress(customer),
        p_notes: composedNotes,
        p_payment_proof_url: path,
      });
      data = v1.data;
      error = (v1.error as any) ?? null;
    }

    if (error) {
      console.error(error);
      alert(error.message);
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
          amount_paid: payload.total,
        })
        .eq("id", orderId);
      if (statusError) {
        console.warn("[checkout] initial status update failed:", statusError.message);
      }
    }

    // Try to clear the cart lines on the backend for this session.
    await Promise.all(
      cartItems.map((it) =>
        setCartLineQty(sessionId, String(it.productId), 0).catch(() => null)
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
    scrollToProducts();
    alert(`Order created: ${data}`);
  }, [blankCustomer, cartItems, composeAddress, createAccountFromDetails, customer, paymentFile, refreshCart, saveAddressToProfile, scrollToProducts]);

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
      setCartOpen(false);
      openProduct(id);
    },
    [openProduct]
  );

  return (
    <div
      data-tp-mode={themeMode}
      style={{
        ...styles.page,
        ...(mainZoneStyle ?? null),
      }}
    >
      {/* Header */}
      <div ref={headerRef} style={{ ...styles.headerWrap, ...headerZoneStyle }}>
        <div style={styles.headerInner}>
          {null}
          <div style={styles.brandWrap}>
            {(logoUrlsByMode[themeMode] ?? "").trim() ? (
              <img src={(logoUrlsByMode[themeMode] ?? "").trim()} alt="Merville Prime" style={styles.brandLogo} />
            ) : (
              <div style={styles.brand}>MERVILLE PRIME</div>
            )}
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

      {/* Navbar */}
      <div ref={navRef}>
        <Navbar
          search={search}
          setSearch={setSearch}
          totalUnits={totalUnits}
          subtotal={subtotal}
          onOpenCart={() => {
            setCartOpen(true);
          }}
          onShop={() => {
            closePrimaryDrawers();
            setCartOpen(false);
            setAdminAllProductsMode(false);
            scrollToProducts();
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
          onLogout={logout}
          navTone={navbarTone}
          zoneStyle={navbarDisplayStyle}
          showZoneEditor={false}
          formatMoney={formatMoney}
          searchStartOffset={isMobileViewport ? 0 : 252}
          isMobile={isMobileViewport}
        />
      </div>

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
          {null}
          <div
            style={{
              ...styles.productsLayout,
              width: isMobileViewport ? "100%" : "var(--tp-rail-width)",
              gridTemplateColumns: isMobileViewport ? "1fr" : "250px minmax(0, 1fr)",
            }}
          >
            {!isMobileViewport ? (
              <aside style={styles.filterPanel}>
                {isAdmin && adminAllProductsMode ? (
                  <button
                    type="button"
                    style={styles.createBtn}
                    onClick={() => void createProduct()}
                  >
                    CREATE
                  </button>
                ) : null}
                <div style={styles.filterTitle}>FILTERS</div>
                <div style={styles.filterActions}>
                  <button
                    type="button"
                    style={styles.filterActionBtn}
                    onClick={() => setSelectedTypes(productTypes.map((t) => t.key))}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    style={styles.filterActionBtn}
                    onClick={() => setSelectedTypes([])}
                  >
                    None
                  </button>
                </div>
                <div style={styles.filterList}>
                  {productTypes.map((typeItem) => (
                    <label key={typeItem.key} style={styles.filterItem}>
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(typeItem.key)}
                        onChange={() =>
                          setSelectedTypes((prev) =>
                            prev.includes(typeItem.key)
                              ? prev.filter((t) => t !== typeItem.key)
                              : [...prev, typeItem.key]
                          )
                        }
                      />
                      <span>{typeItem.label}</span>
                    </label>
                  ))}
                </div>
              </aside>
            ) : null}

            <div style={styles.gridWrap}>
              <ProductGrid
                products={filteredProducts}
                loading={loadingProducts}
                cart={cart}
                viewMode={resolvedGridView}
                contained
                canEditProducts={isAdmin && (editMode || adminAllProductsMode)}
                onAdd={addToCart}
                onRemove={removeFromCart}
                onOpenProduct={openProduct}
                onEditProduct={openEditProduct}
                onQuickStatusChange={updateProductStatus}
                formatMoney={formatMoney}
              />
            </div>
          </div>

          {isMobileViewport ? (
            <button
              type="button"
              style={{
                ...styles.mobileFilterFab,
                ...(selectedTypes.length > 0 ? styles.mobileFilterFabActive : null),
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
              {selectedTypes.length > 0 ? (
                <span style={styles.mobileFilterBadge}>{selectedTypes.length}</span>
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
                style={styles.mobileFilterModal}
                onClick={(e) => e.stopPropagation()}
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
                <div style={styles.filterTitle}>FILTERS</div>
                <div style={styles.filterActions}>
                  <button
                    type="button"
                    style={styles.filterActionBtn}
                    onClick={() => setSelectedTypes(productTypes.map((t) => t.key))}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    style={styles.filterActionBtn}
                    onClick={() => setSelectedTypes([])}
                  >
                    None
                  </button>
                </div>
                <div style={styles.filterList}>
                  {productTypes.map((typeItem) => (
                    <label key={typeItem.key} style={styles.filterItem}>
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(typeItem.key)}
                        onChange={() =>
                          setSelectedTypes((prev) =>
                            prev.includes(typeItem.key)
                              ? prev.filter((t) => t !== typeItem.key)
                              : [...prev, typeItem.key]
                          )
                        }
                      />
                      <span>{typeItem.label}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  style={styles.mobileFilterCloseBtn}
                  onClick={() => setMobileFiltersOpen(false)}
                >
                  CLOSE
                </button>
              </aside>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Product drawer */}
      <ProductDrawer
        isOpen={panel === "product"}
        topOffset={topOffset}
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
        topOffset={topOffset}
        product={selectedProduct}
        images={selectedProductImages}
        onClose={closeEditor}
        onSaved={async () => {
          await loadCatalog();
          if (!selectedId) return;
          try {
            const refreshedImages = await fetchProductImages([selectedId]);
            setProductImagesById((prev) => ({ ...prev, [selectedId]: refreshedImages }));
            setProducts((prev) =>
              prev.map((prod) => {
                if (String(prod.id) !== String(selectedId)) return prod;
                const images = refreshedImages
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order);
                const orderOne = images.find((img) => img.sort_order === 1)?.url ?? null;
                const firstImage = images[0]?.url ?? null;
                const ownThumb = prod.thumbnail_url?.trim() || null;
                return { ...prod, thumbnail_url: ownThumb ?? orderOne ?? firstImage };
              })
            );
          } catch (e) {
            console.error("[page] refresh product images failed", e);
          }
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
        topOffset={topOffset}
        items={cartItemsForDisplay}
        total={subtotal}
        customer={customer as CustomerDraft}
        setCustomer={handleSetCustomer}
        isLoggedIn={!!authUserId}
        createAccountFromDetails={createAccountFromDetails}
        setCreateAccountFromDetails={setCreateAccountFromDetails}
        suggestSaveAddressToProfile={!!authUserId && !profileHasAddress}
        saveAddressToProfile={saveAddressToProfile}
        setSaveAddressToProfile={setSaveAddressToProfile}
        profileAddress={profileAddress}
        paymentFile={paymentFile}
        setPaymentFile={setPaymentFile}
        onBack={backToList}
        onSubmit={handleCheckoutSubmit as (payload: CheckoutSubmitPayload) => void}
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
        onClose={() => setCartOpen(false)}
        onOpenProduct={handleCartOpenProduct as (id: string) => void}
        onAdd={addToCart}
        onRemove={removeFromCart}
        onCheckout={openCheckout}
        formatMoney={formatMoney}
      />

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      <MyDetailsDrawer
        isOpen={detailsOpen}
        topOffset={topOffset}
        userId={authUserId}
        onClose={() => setDetailsOpen(false)}
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
          void loadAndSelectOrder(id);
        }}
        onClose={() => {
          setOrderDrawerSource(null);
          setSelectedOrderDetail(null);
          setAllOrdersOpen(false);
        }}
      />

      <OrderDrawer
        isOpen={!!orderDrawerSource && !!selectedOrderDetail}
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
        onBack={() => {
          const source = orderDrawerSource;
          setOrderDrawerSource(null);
          setSelectedOrderDetail(null);
          if (source === "my") {
            setOrdersOpen(true);
            return;
          }
          if (source === "all") {
            setAllOrdersOpen(true);
          }
        }}
      />

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
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "var(--tp-page-bg)",
    color: "var(--tp-text-color)",
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
    minHeight: 116,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 0,
    padding: "28px 0 8px",
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
    padding: "0 14px",
    cursor: "pointer",
    fontSize: 12,
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
    height: 90,
    maxWidth: "min(68vw, 560px)",
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
    border: "none",
    borderRadius: 12,
    padding: 12,
    background: "transparent",
  },
  createBtn: {
    height: 34,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg-soft)",
    color: "var(--tp-text-color)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    padding: "0 12px",
    cursor: "pointer",
    marginBottom: 10,
    width: "100%",
  },
  mobileFilterFab: {
    position: "fixed",
    right: 20,
    bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
    zIndex: 60,
    width: 40,
    height: 40,
    borderRadius: 999,
    border: "1px solid var(--tp-border-color)",
    background: "var(--tp-control-bg)",
    color: "var(--tp-text-color)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
  },
  mobileFilterFabActive: {
    border: "1px solid #66c7ff",
    color: "#66c7ff",
    background: "rgba(102,199,255,0.12)",
  },
  mobileFilterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    background: "#66c7ff",
    color: "#ffffff",
    border: "1px solid rgba(0,0,0,0.16)",
    fontSize: 10,
    fontWeight: 800,
    lineHeight: "14px",
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
    zIndex: 1000,
    background: "rgba(135,135,135,0.94)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: 10,
    boxSizing: "border-box",
  },
  mobileFilterModal: {
    width: "min(520px, calc(100vw - 20px))",
    maxHeight: "80vh",
    overflowY: "auto",
    border: "1px solid var(--tp-border-color)",
    borderRadius: 12,
    padding: 12,
    background: "#d3d3d3",
    display: "grid",
    gap: 10,
  },
  mobileFilterCloseBtn: {
    marginTop: 4,
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "transparent",
    color: "var(--tp-text-color)",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 1,
    cursor: "pointer",
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 1.1,
    marginBottom: 20,
  },
  filterActions: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
  },
  filterActionBtn: {
    height: 28,
    borderRadius: 8,
    border: "1px solid var(--tp-border-color)",
    background: "transparent",
    color: "var(--tp-text-color)",
    fontSize: 14,
    padding: "0 8px",
    cursor: "pointer",
  },
  filterList: {
    display: "grid",
    gap: 8,
  },
  filterItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 15,
    minHeight: 24,
    cursor: "pointer",
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
};
