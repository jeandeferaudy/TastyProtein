// src/components/Navbar.tsx
"use client";

import * as React from "react";
import {
  AppButton,
  GearIcon,
  TOPBAR_FONT_SIZE,
  TOPBAR_FONT_SIZE_MOBILE,
} from "@/components/ui";
const NAV_CONTROL_H = 36;
const NAV_SECTION_GAP = 12;
const NAV_INLINE_GAP = 10;

type Props = {
  search: string;
  setSearch: (v: string) => void;

  onOpenCart: () => void;
  totalUnits: number;
  onShop: () => void;
  gridView: "list" | "4" | "5";
  onChangeGridView: (next: "list" | "4" | "5") => void;
  authLabel: string | null;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenOrders: () => void;
  isAdmin: boolean;
  editMode: boolean;
  onToggleEditMode: (next: boolean) => void;
  onOpenAllOrders: () => void;
  onOpenAllProducts: () => void;
  onOpenInventory: () => void;
  onLogout: () => void;
  navTone?: "dark-bg" | "light-bg";
  zoneStyle?: React.CSSProperties;
  showZoneEditor?: boolean;
  onOpenZoneEditor?: () => void;

  searchStartOffset?: number;
  isMobile?: boolean;
  showSearch?: boolean;
};

export default function Navbar({
  search,
  setSearch,
  onOpenCart,
  totalUnits,
  onShop,
  gridView,
  onChangeGridView,
  authLabel,
  onOpenAuth,
  onOpenProfile,
  onOpenOrders,
  isAdmin,
  editMode,
  onToggleEditMode,
  onOpenAllOrders,
  onOpenAllProducts,
  onOpenInventory,
  onLogout,
  navTone = "light-bg",
  zoneStyle,
  showZoneEditor = false,
  onOpenZoneEditor,
  searchStartOffset = 0,
  isMobile = false,
  showSearch = true,
}: Props) {
  const [authMenuOpen, setAuthMenuOpen] = React.useState(false);
  const authWrapRef = React.useRef<HTMLDivElement | null>(null);
  const authDisplayName = React.useMemo(() => {
    const raw = String(authLabel ?? "").trim();
    if (!raw) return "";
    if (raw.includes("@")) return "";
    return raw;
  }, [authLabel]);
  const authInitial = React.useMemo(() => {
    const raw = String(authLabel ?? "").trim();
    if (!raw) return "U";
    if (raw.includes("@")) {
      const firstChar = raw.trim().charAt(0);
      return firstChar ? firstChar.toUpperCase() : "U";
    }
    return "";
  }, [authLabel]);

  React.useEffect(() => {
    if (!authLabel) setAuthMenuOpen(false);
  }, [authLabel]);

  React.useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!authWrapRef.current || !target) return;
      if (!authWrapRef.current.contains(target)) setAuthMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const navVars: React.CSSProperties =
    navTone === "dark-bg"
      ? ({ "--tp-nav-fg": "#ffffff", "--tp-nav-inverse": "#000000" } as React.CSSProperties)
      : ({ "--tp-nav-fg": "#111111", "--tp-nav-inverse": "#ffffff" } as React.CSSProperties);
  const navCenterWidth = !isMobile
    ? `min(1000px, calc(var(--tp-rail-width) - ${searchStartOffset}px + 20px))`
    : "100%";
  return (
    <nav
      className="tp-navbar"
      style={{
        ...styles.navbar,
        ...navVars,
        ...(zoneStyle ?? null),
        ["--tp-nav-center-width" as string]: navCenterWidth,
      }}
    >
      <div
        className="tp-content-rail"
        style={{ ...styles.navInner, ...(isMobile ? styles.navInnerMobile : null) }}
      >
        <div
          style={{
            ...styles.navLeft,
            ...(isMobile ? styles.navLeftMobile : null),
            minWidth:
              !isMobile && searchStartOffset > 0 ? searchStartOffset : undefined,
          }}
        >
          <AppButton
            variant="nav"
            style={{
              ...styles.navBtn,
              justifyContent: "flex-start",
              marginLeft: 0,
              ...(isMobile ? styles.navBtnMobile : null),
              ...(!isMobile ? { padding: "0 15px 0 0" } : null),
              ...(isMobile ? { padding: "0 15px 0 0" } : null),
            }}
            onClick={onShop}
          >
            Shop
          </AppButton>

          {authLabel ? (
            <div ref={authWrapRef} style={styles.authWrap}>
              <button
                type="button"
                style={{
                  ...styles.userButton,
                  ...(editMode ? styles.userBtnEditMode : null),
                }}
                onClick={() => setAuthMenuOpen((v) => !v)}
                aria-label="Account menu"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path
                    d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-6 2.1-6 4.7V20h12v-1.3c0-2.6-2.7-4.7-6-4.7Z"
                    fill="currentColor"
                  />
                </svg>
                {authDisplayName ? (
                  <span style={styles.userName} title={authDisplayName}>
                    {authDisplayName}
                  </span>
                ) : authInitial ? (
                  <span style={styles.userName} title={authInitial}>
                    {authInitial}
                  </span>
                ) : null}
              </button>
              {authMenuOpen && (
                <div style={styles.authMenu}>
                  <button
                    type="button"
                    style={styles.menuItem}
                    onClick={() => {
                      setAuthMenuOpen(false);
                      onOpenProfile();
                    }}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    style={styles.menuItem}
                    onClick={() => {
                      setAuthMenuOpen(false);
                      onOpenOrders();
                    }}
                  >
                    My Orders
                  </button>

                  {isAdmin && (
                    <>
                      <div style={styles.menuDivider} />
                      <div style={styles.menuLabel}>ADMIN</div>

                      <label style={styles.toggleRow}>
                        <span>Edit Mode</span>
                        <input
                          type="checkbox"
                          checked={editMode}
                          onChange={(e) => onToggleEditMode(e.target.checked)}
                          style={styles.editModeToggle}
                        />
                      </label>

                      <button
                        type="button"
                        style={styles.menuItem}
                        onClick={() => {
                          setAuthMenuOpen(false);
                          onOpenAllProducts();
                        }}
                      >
                        Products
                      </button>

                      <button
                        type="button"
                        style={styles.menuItem}
                        onClick={() => {
                          setAuthMenuOpen(false);
                          onOpenAllOrders();
                        }}
                      >
                        Orders
                      </button>

                      <button
                        type="button"
                        style={styles.menuItem}
                        onClick={() => {
                          setAuthMenuOpen(false);
                          onOpenInventory();
                        }}
                      >
                        Inventory
                      </button>
                    </>
                  )}

                  <AppButton
                    variant="nav"
                    style={styles.authMenuLogoutBtn}
                    onClick={() => {
                      setAuthMenuOpen(false);
                      onLogout();
                    }}
                  >
                    Logout
                  </AppButton>
                </div>
              )}
            </div>
          ) : (
            <AppButton
              variant="nav"
              style={{ ...styles.navBtn, ...(isMobile ? styles.navBtnMobile : null) }}
              onClick={onOpenAuth}
            >
              Login
            </AppButton>
          )}
        </div>

        {showSearch ? (
          <div
            style={{
              ...styles.navCenter,
              ...(isMobile ? styles.navCenterMobile : styles.navCenterDesktop),
            }}
          >
            <div
              style={{
                ...styles.navSearchWrap,
                ...(isMobile ? styles.navSearchWrapMobile : styles.navSearchWrapDesktop),
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                aria-hidden="true"
                style={{
                  ...styles.navSearchIcon,
                  ...(isMobile ? styles.navSearchIconMobile : null),
                }}
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                className="tp-nav-search"
                style={{ ...styles.navSearchInput, ...(isMobile ? styles.navSearchMobile : null) }}
                placeholder="Search here"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search products"
              />
              {search.trim().length > 0 && (
                <button
                  type="button"
                  style={styles.navClearText}
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  Clear
                </button>
              )}
            </div>
            {!isMobile ? (
              <div style={styles.viewToggleWrapCenter}>
                <div style={{ ...styles.viewToggle, ...(isMobile ? styles.viewToggleMobile : null) }}>
                  <button
                    type="button"
                    style={{
                      ...styles.viewBtn,
                      ...(isMobile ? styles.viewBtnMobile : null),
                      ...(gridView === "list" ? styles.viewBtnActive : null),
                    }}
                    onClick={() => onChangeGridView("list")}
                    aria-label="List view"
                    title="List view"
                  >
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    aria-hidden="true"
                    style={{ display: "block", transform: "translate(2px, -1px)" }}
                  >
                    <path
                      d="M5 6h14M5 12h14M5 18h14"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.viewBtn,
                    ...(isMobile ? styles.viewBtnMobile : null),
                    ...(gridView === "4" ? styles.viewBtnActive : null),
                  }}
                  onClick={() => onChangeGridView("4")}
                  aria-label="3-up grid view"
                  title="3-up grid view"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    aria-hidden="true"
                    style={{ display: "block", transform: "translateY(-1px)" }}
                  >
                    <rect x="4.5" y="4.5" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
                    <rect x="13" y="4.5" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
                    <rect x="4.5" y="13" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
                    <rect x="13" y="13" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
                  </svg>
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.viewBtn,
                    ...(isMobile ? styles.viewBtnMobile : null),
                    ...styles.viewBtnLast,
                    ...(gridView === "5" ? styles.viewBtnActive : null),
                  }}
                  onClick={() => onChangeGridView("5")}
                  aria-label="5-up grid view"
                  title="5-up grid view"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    aria-hidden="true"
                    style={{ display: "block", transform: "translate(-2px, -1px)" }}
                  >
                    <rect x="4.5" y="4.5" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="10.1" y="4.5" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="15.7" y="4.5" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="4.5" y="10.1" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="10.1" y="10.1" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="15.7" y="10.1" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="4.5" y="15.7" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="10.1" y="15.7" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="15.7" y="15.7" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                  </svg>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ ...styles.navRight, ...(isMobile ? styles.navRightMobile : null) }}>
          {isMobile && showSearch ? (
            <div style={styles.viewToggleWrapMobile}>
              <div style={{ ...styles.viewToggle, ...(isMobile ? styles.viewToggleMobile : null) }}>
                <button
                  type="button"
                  style={{
                    ...styles.viewBtn,
                    ...(isMobile ? styles.viewBtnMobile : null),
                    ...(gridView === "list" ? styles.viewBtnActive : null),
                  }}
                  onClick={() => onChangeGridView("list")}
                  aria-label="List view"
                  title="List view"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    aria-hidden="true"
                    style={{ display: "block", transform: "translate(2px, -1px)" }}
                  >
                    <path
                      d="M5 6h14M5 12h14M5 18h14"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.viewBtn,
                    ...(isMobile ? styles.viewBtnMobile : null),
                    ...(gridView === "4" ? styles.viewBtnActive : null),
                  }}
                  onClick={() => onChangeGridView("4")}
                  aria-label="3-up grid view"
                  title="3-up grid view"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    aria-hidden="true"
                    style={{ display: "block", transform: "translateY(-1px)" }}
                  >
                    <rect x="4.5" y="4.5" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
                    <rect x="13" y="4.5" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
                    <rect x="4.5" y="13" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
                    <rect x="13" y="13" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
                  </svg>
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.viewBtn,
                    ...(isMobile ? styles.viewBtnMobile : null),
                    ...styles.viewBtnLast,
                    ...(gridView === "5" ? styles.viewBtnActive : null),
                  }}
                  onClick={() => onChangeGridView("5")}
                  aria-label="5-up grid view"
                  title="5-up grid view"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    aria-hidden="true"
                    style={{ display: "block", transform: "translate(-2px, -1px)" }}
                  >
                    <rect x="4.5" y="4.5" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="10.1" y="4.5" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="15.7" y="4.5" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="4.5" y="10.1" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="10.1" y="10.1" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="15.7" y="10.1" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="4.5" y="15.7" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="10.1" y="15.7" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                    <rect x="15.7" y="15.7" width="4.4" height="4.4" rx="1.2" fill="currentColor" />
                  </svg>
                </button>
              </div>
            </div>
          ) : null}
          <div
            style={
              isMobile
                ? styles.cartWrapMobile
                : {
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    marginLeft: "auto",
                  }
            }
          >
            <AppButton
              variant="nav"
              style={{
                ...styles.navBtn,
                ...(isMobile ? styles.navBtnMobile : null),
                ...styles.navCartCompact,
                ...(!isMobile ? styles.navCartDesktopAligned : null),
                ...(isMobile ? styles.navCartMobile : null),
              }}
              onClick={onOpenCart}
            >
              <span style={styles.cartLabelBold}>CART</span>
              <span style={styles.cartLabelQty}>({Math.max(0, totalUnits)})</span>
            </AppButton>
          </div>
        </div>
      </div>
      {showZoneEditor && onOpenZoneEditor ? (
        <AppButton
          variant="nav"
          style={{ ...styles.navBtn, ...styles.navEditBtn, ...styles.navEditFloating }}
          onClick={onOpenZoneEditor}
          aria-label="Edit navbar zone"
          title="Edit navbar zone"
        >
          <GearIcon size={16} />
        </AppButton>
      ) : null}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  navbar: {
    position: "relative",
    zIndex: 1300,
    width: "100vw",
    marginLeft: "calc(50% - 50vw)",
    background: "transparent",
    color: "#000",
    borderTop: "none",
    borderBottom: "2px solid transparent",
  },
  navInner: {
    margin: "0 auto",
    padding: "4.5px 0",
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: NAV_SECTION_GAP,
    position: "relative",
  },
  navInnerMobile: {
    gridTemplateColumns: "1fr auto",
    gridTemplateRows: "auto auto",
    columnGap: 8,
    rowGap: 0,
    padding: "6px 10px",
  },
  navLeft: { display: "flex", alignItems: "center", gap: NAV_INLINE_GAP },
  navLeftMobile: { gridColumn: "1 / 2", gridRow: "1 / 2", minWidth: 0, gap: 8 },
  navCenter: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 0,
  },
  navCenterDesktop: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    width: "var(--tp-nav-center-width)",
    justifyContent: "flex-start",
  },
  navCenterMobile: {
    gridColumn: "1 / 2",
    gridRow: "2 / 3",
  },
  navRight: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: NAV_INLINE_GAP,
  },
  navRightMobile: {
    gridColumn: "2 / 3",
    gridRow: "1 / 3",
    display: "contents",
  },
  navBtn: {
    height: NAV_CONTROL_H,
    padding: "0 15px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: TOPBAR_FONT_SIZE,
    border: "1px solid transparent",
    background: "transparent",
  },
  navBtnMobile: {
    height: 40,
    fontSize: TOPBAR_FONT_SIZE_MOBILE,
    padding: "0 15px",
    whiteSpace: "nowrap",
  },
  navCartMobile: {
    fontSize: 15,
    padding: "0 0 0 10px",
    minWidth: 126,
    maxWidth: "44vw",
    whiteSpace: "nowrap",
    justifyContent: "flex-end",
    textAlign: "right",
  },
  navCartCompact: {
    padding: "0 12px",
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  },
  navCartDesktopAligned: {
    justifyContent: "flex-end",
    padding: "0 0 0 12px",
    border: "none",
    transform: "translateX(5px)",
  },
  cartLabelBold: {
    fontWeight: 700,
  },
  cartLabelQty: {
    fontWeight: 400,
    marginLeft: 4,
  },
  cartWrapMobile: {
    gridColumn: "2 / 3",
    gridRow: "1 / 2",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    justifySelf: "end",
  },
  viewToggleWrapMobile: {
    gridColumn: "2 / 3",
    gridRow: "2 / 3",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    justifySelf: "end",
    transform: "translateX(10px)",
  },
  viewToggleWrapCenter: {
    display: "flex",
    alignItems: "center",
  },
  navEditBtn: {
    width: NAV_CONTROL_H,
    minWidth: NAV_CONTROL_H,
    padding: 0,
    borderColor: "#66c7ff",
    color: "#66c7ff",
    background: "rgba(102,199,255,0.08)",
  },
  navEditFloating: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 1210,
  },
  userButton: {
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: "var(--tp-accent)",
    background: "transparent",
    cursor: "pointer",
    padding: "0 6px",
    fontSize: 15,
    fontWeight: 700,
    maxWidth: 130,
  },
  userName: {
    color: "var(--tp-accent)",
    maxWidth: 90,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  authWrap: {
    position: "relative",
    zIndex: 1250,
    marginLeft: -10,
  },
  userBtnEditMode: {
    borderColor: "#66c7ff",
    background: "rgba(102,199,255,0.3)",
  },
  authMenu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    zIndex: 1300,
    width: 180,
    padding: 8,
    border: "1px solid var(--tp-nav-fg)",
    borderRadius: 8,
    background: "var(--tp-nav-inverse)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
    pointerEvents: "auto",
  },
  menuItem: {
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "transparent",
    color: "var(--tp-nav-fg)",
    padding: "8px 8px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    lineHeight: "20px",
  },
  menuDivider: {
    height: 1,
    background: "var(--tp-nav-fg)",
    opacity: 0.2,
    margin: "8px 0",
  },
  menuLabel: {
    fontSize: 15,
    letterSpacing: 1,
    fontWeight: 700,
    color: "var(--tp-nav-fg)",
    opacity: 0.75,
    margin: "6px 0 6px",
    padding: "0 8px",
  },
  toggleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 15,
    padding: "8px 8px",
    marginBottom: 0,
    color: "var(--tp-nav-fg)",
    lineHeight: "20px",
  },
  editModeToggle: {
    accentColor: "#3aaaf5",
  },
  authMenuLogoutBtn: {
    width: "100%",
    marginTop: 8,
    height: 34,
    padding: "0 10px",
    justifyContent: "center",
  },
  navSearchWrap: {
    width: "100%",
    height: NAV_CONTROL_H,
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "0 8px",
    borderRadius: 8,
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--tp-nav-fg)",
    position: "relative",
  },
  navSearchWrapDesktop: {
    marginRight: 40,
  },
  navSearchWrapMobile: {
    height: 40,
    marginRight: 0,
    padding: "0 8px 0 0",
    gap: 8,
  },
  navSearchIconMobile: {
    transform: "none",
  },
  navSearchIcon: {
    opacity: 0.9,
    transform: "translateX(10px) scale(1.3)",
  },
  navSearchInput: {
    width: "100%",
    height: "100%",
    border: "none",
    fontSize: 15,
    fontWeight: 600,
    outline: "none",
    background: "transparent",
    backgroundColor: "transparent",
    WebkitAppearance: "none",
    color: "var(--tp-nav-fg)",
  },
  navSearchMobile: {
    fontSize: 15,
  },
  navClearText: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
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
  viewToggle: {
    display: "inline-flex",
    border: "1px solid transparent",
    borderRadius: 8,
    overflow: "hidden",
    background: "transparent",
    height: NAV_CONTROL_H,
  },
  viewToggleMobile: {
    height: 40,
  },
  viewBtn: {
    height: NAV_CONTROL_H,
    minWidth: NAV_CONTROL_H,
    border: "none",
    borderRight: "none",
    background: "transparent",
    color: "var(--tp-nav-fg)",
    cursor: "pointer",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 0,
  },
  viewBtnMobile: {
    height: 40,
    minWidth: 40,
  },
  viewBtnActive: {
    background: "transparent",
    color: "var(--tp-accent)",
  },
  viewBtnLast: {
    borderRight: "none",
  },
};
