"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Search helper used by the product grid.
 * IMPORTANT: This filters ONLY the product list on screen, never the cart.
 */
function matchesQuery(product: any, rawQuery: string) {
  const q = (rawQuery || "").trim().toLowerCase();
  if (!q) return true;

  const hay = [
    product.name,
    product.size,
    product.note,
    product.description,
    String(product.price),
    product.keywords || "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
}

function formatMoney(n: any) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function makeOrderId() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `MP-${t}-${r}`;
}

export default function PremiumButchery() {
  const products = [
    {
      id: 1,
      name: "Brazilian Ribeye",
      size: "1 kg (4 pcs)",
      price: 1390,
      note: "Rich marbling, bold flavor",
      description:
        "A classic steakhouse cut with generous marbling for deep beef flavor. Best pan-seared or grilled. Finish with butter and rest well.",
      keywords: "ribeye steak beef marbling grill",
    },
    {
      id: 2,
      name: "Brazilian Tenderloin",
      size: "1 kg (4–6 pcs)",
      price: 1615,
      note: "Ultra-tender, refined cut",
      description:
        "Lean, exceptionally tender, and clean in taste. Perfect for quick sear + butter baste. A premium cut for effortless success.",
      keywords: "tenderloin filet steak lean",
    },
    {
      id: 3,
      name: "USDA Angus Ribeye",
      size: "1 kg (2 pcs)",
      price: 2200,
      note: "Deep beef flavor, premium grade",
      description:
        "Thicker steaks with a rich, bold profile. Great for reverse-sear or grill. Salt early, sear hard, rest properly.",
      keywords: "usda angus ribeye premium",
    },
    {
      id: 4,
      name: "USDA Angus Tenderloin",
      size: "1 kg",
      price: 2450,
      note: "Luxury cut, butter-soft",
      description:
        "Exceptionally fine-grained and tender. Minimal seasoning needed. Ideal for special occasions.",
      keywords: "usda angus tenderloin filet",
    },
    {
      id: 5,
      name: "Australian T-Bone",
      size: "1 kg (3 pcs)",
      price: 1180,
      note: "Two cuts, one steak",
      description:
        "Tenderloin on one side, strip on the other. A butcher’s classic with bold character.",
      keywords: "tbone steak australian",
    },
    {
      id: 6,
      name: "Australian Porterhouse",
      size: "1 kg (3 pcs)",
      price: 1200,
      note: "Balanced & juicy",
      description:
        "A refined alternative to T-bone with a larger tenderloin section.",
      keywords: "porterhouse steak",
    },
    {
      id: 7,
      name: "Wagyu Beef Cubes",
      size: "500 g",
      price: 1580,
      note: "Intensely marbled",
      description:
        "Perfect for quick sear or yakiniku-style cooking. Rich, indulgent bites.",
      keywords: "wagyu cubes japanese",
    },
    {
      id: 8,
      name: "Sous-vide Chicken Breast",
      size: "200 g",
      price: 233,
      note: "Juicy, ready in minutes",
      description:
        "Gently cooked for consistent tenderness. Ideal for meal plans.",
      keywords: "sous vide chicken meal prep protein",
    },
    {
      id: 9,
      name: "Sous-vide Pork Chop",
      size: "250 g",
      price: 295,
      note: "Perfectly cooked",
      description:
        "Moist, tender pork chop cooked sous-vide for foolproof results.",
      keywords: "pork chop sous vide",
    },
    {
      id: 10,
      name: "Beef Burger Patties",
      size: "4 pcs (500 g)",
      price: 520,
      note: "Juicy & flavorful",
      description:
        "Made from premium beef, perfect for smash or classic burgers.",
      keywords: "burger patties beef",
    },
    {
      id: 11,
      name: "Baby Potatoes Sous-vide",
      size: "200 g",
      price: 125,
      note: "Butter-soft",
      description:
        "Pre-cooked for convenience. Crisp in pan or oven.",
      keywords: "potatoes side sous vide",
    },
    {
      id: 12,
      name: "Garlic Butter",
      size: "100 g",
      price: 295,
      note: "Steak essential",
      description:
        "Compound butter with roasted garlic. Melts beautifully on hot meat.",
      keywords: "garlic butter sauce",
    },
    {
      id: 13,
      name: "Chimichurri Sauce",
      size: "100 g",
      price: 285,
      note: "Fresh & herby",
      description:
        "Classic Argentine sauce for grilled meats.",
      keywords: "chimichurri sauce",
    },
    {
      id: 14,
      name: "Roasted Vegetables",
      size: "250 g",
      price: 195,
      note: "Colorful side",
      description:
        "Seasonal vegetables, lightly seasoned and ready to reheat.",
      keywords: "vegetables side",
    },
    {
      id: 15,
      name: "Beef Bourguignon",
      size: "400 g",
      price: 480,
      note: "Slow-cooked comfort",
      description:
        "Classic French beef stew, rich and deeply flavorful.",
      keywords: "beef stew bourguignon",
    },
  ];

  const [cart, setCart] = useState<Record<number, number>>({});
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // panel: null | 'product' | 'cart' | 'checkout'
  const [panel, setPanel] = useState<null | "product" | "cart" | "checkout">(
    null
  );

  // "Database" for MVP preview: localStorage
  const [orders, setOrders] = useState<any[]>([]);

  // Draft order created on checkout
  const [draft, setDraft] = useState<any | null>(null);
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentPreviewUrl, setPaymentPreviewUrl] = useState<string | null>(null);
  const [checkoutState, setCheckoutState] = useState<"form" | "success">("form");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("MP_ORDERS");
      if (raw) setOrders(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("MP_ORDERS", JSON.stringify(orders));
    } catch {
      // ignore
    }
  }, [orders]);

  useEffect(() => {
    // cleanup blob urls
    return () => {
      if (paymentPreviewUrl) URL.revokeObjectURL(paymentPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => matchesQuery(p, search));
  }, [products, search]);

  const selected = useMemo(() => {
    return products.find((p) => p.id === selectedId) || null;
  }, [products, selectedId]);

  const add = (id: number) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const remove = (id: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (!next[id]) return next;
      next[id] -= 1;
      if (next[id] <= 0) delete next[id];
      return next;
    });
  };

  const openProduct = (id: number) => {
    setSelectedId(id);
    setPanel("product");
  };

  const openCart = () => setPanel("cart");
  const closePanel = () => setPanel(null);

  const items = Object.entries(cart)
    .map(([id, qty]) => {
      const p = products.find((x) => x.id === Number(id));
      return p ? { ...p, qty } : null;
    })
    .filter(Boolean) as any[];

  const totalUnits = items.reduce((sum, i) => sum + i.qty, 0);
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  // Checkout logic
  const resetCheckoutArtifacts = () => {
    setCustomer({ name: "", phone: "", address: "", notes: "" });
    setDraft(null);
    setCheckoutState("form");

    if (paymentPreviewUrl) {
      URL.revokeObjectURL(paymentPreviewUrl);
      setPaymentPreviewUrl(null);
    }
    setPaymentFile(null);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startCheckout = () => {
    if (items.length === 0) return;

    // Create a draft snapshot of current cart
    const now = new Date().toISOString();
    const newDraft = {
      id: makeOrderId(),
      status: "draft",
      createdAt: now,
      items: items.map((i) => ({
        productId: i.id,
        name: i.name,
        size: i.size,
        unitPrice: i.price,
        qty: i.qty,
        lineTotal: i.price * i.qty,
      })),
      totalUnits,
      total,
    };

    setDraft(newDraft);
    setPanel("checkout");
  };

  const isCheckoutValid = useMemo(() => {
    if (!draft) return false;
    const nameOk = customer.name.trim().length >= 2;
    const phoneOk = customer.phone.trim().length >= 7;
    const addressOk = customer.address.trim().length >= 6;
    const paymentOk = !!paymentFile;
    return nameOk && phoneOk && addressOk && paymentOk;
  }, [draft, customer, paymentFile]);

  const onPickPaymentProof = (file: File | null) => {
    if (!file) return;
    if (paymentPreviewUrl) URL.revokeObjectURL(paymentPreviewUrl);

    const url = URL.createObjectURL(file);
    setPaymentFile(file);
    setPaymentPreviewUrl(url);
  };

  const submitOrder = () => {
    if (!draft) return;
    if (!isCheckoutValid) return;

    // MVP: store proof metadata only (no binary upload in this preview)
    const finalOrder = {
      ...draft,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        address: customer.address.trim(),
        notes: customer.notes.trim(),
      },
      paymentProof: paymentFile
        ? {
            name: paymentFile.name,
            size: paymentFile.size,
            type: paymentFile.type,
          }
        : null,
    };

    setOrders((prev) => [finalOrder, ...prev]);
    setCheckoutState("success");

    // Clear cart after submit (common flow)
    setCart({});
  };

  const closeCheckout = () => {
    resetCheckoutArtifacts();
    closePanel();
  };

  // Optional lightweight tests (disabled by default)
  const __TESTS__ = false;
  if (__TESTS__) {
    console.assert(
      matchesQuery(products[0], "ribeye") === true,
      "search: ribeye should match"
    );
    console.assert(
      matchesQuery(products[0], "tenderloin") === false,
      "search: tenderloin should not match ribeye"
    );
    console.assert(
      matchesQuery(products[1], "4–6") === true,
      "search: should match size text"
    );

    console.assert(
      matchesQuery(products[0], "") === true,
      "search: empty query should match all"
    );
    console.assert(
      matchesQuery(products[0], "RIBEYE") === true,
      "search: should be case-insensitive"
    );
    console.assert(
      matchesQuery(products[1], "filet") === true,
      "search: should match keywords"
    );

    const oid = makeOrderId();
    console.assert(
      oid.startsWith("MP-") === true,
      "order id should start with MP-"
    );

    console.assert(
      formatMoney(1000) === "1,000" || formatMoney(1000) === "1000",
      "formatMoney should format with locale grouping"
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.stickyWrap}>
        <div style={styles.containerTop}>
          <header style={styles.header}>
            <h1 style={styles.logo}>MERVILLE PRIME</h1>
            <p style={styles.tagline}>
              Old-school butchery • Modern preparation • Trusted quality
            </p>
          </header>
        </div>

        <nav style={styles.navbar}>
          <div style={styles.navInner}>
            <div style={styles.navLeft}>
              <button
                style={styles.navBtn}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                Shop
              </button>
            </div>

            <div style={styles.navCenter}>
              <input
                style={styles.navSearch}
                placeholder="Search cuts, weight, format, keywords…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search products"
              />
              {search.trim().length > 0 && (
                <button style={styles.navClear} onClick={() => setSearch("")}
                >
                  Clear
                </button>
              )}
            </div>

            <div style={styles.navRight}>
              <button style={styles.navBtn} onClick={openCart}>
                Cart ({totalUnits}) — ₱ {formatMoney(total)}
              </button>
            </div>
          </div>
        </nav>
      </div>

      <div style={styles.container}>
        <section style={styles.products}>
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              style={styles.card}
              role="button"
              tabIndex={0}
              onClick={() => openProduct(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openProduct(p.id);
              }}
            >
              <div style={styles.imageTile}>
                <div style={styles.imageTileInner}>
                  <div style={styles.imageTileLabel}>IMAGE</div>
                </div>
              </div>

              <h3 style={styles.productName}>{p.name}</h3>
              <div style={styles.size}>{p.size}</div>
              <div style={styles.note}>{p.note}</div>
              <div style={styles.price}>₱ {formatMoney(p.price)}</div>

              <div style={styles.qtyRow} onClick={(e) => e.stopPropagation()}>
                <button style={styles.qtyBtn} onClick={() => remove(p.id)}>
                  -
                </button>
                <div style={styles.qty}>{cart[p.id] || 0}</div>
                <button style={styles.qtyBtn} onClick={() => add(p.id)}>
                  +
                </button>
              </div>
            </div>
          ))}
        </section>

        {filteredProducts.length === 0 && (
          <div style={styles.emptyHint}>
            No results for “{search.trim()}”. Try a different keyword.
          </div>
        )}

        {items.length === 0 && (
          <div style={styles.emptyHint}>
            Add items to your cart using the +/- controls.
          </div>
        )}
      </div>

      {/* Backdrop for drawers/panels */}
      <div
        style={{
          ...styles.backdrop,
          opacity: panel ? 1 : 0,
          pointerEvents: panel ? "auto" : "none",
        }}
        onClick={() => {
          if (panel === "checkout") return; // checkout must be closed via controls
          closePanel();
        }}
      />

      {/* PRODUCT PANEL */}
      <aside
        style={{
          ...styles.productPanel,
          opacity: panel === "product" ? 1 : 0,
          pointerEvents: panel === "product" ? "auto" : "none",
          transform:
            panel === "product"
              ? "translateX(-50%) scale(1)"
              : "translateX(-50%) scale(0.985)",
        }}
        aria-hidden={panel !== "product"}
      >
        {selected && (
          <div style={styles.productPanelInner}>
            <div style={styles.productTopBand}>
              <button style={styles.drawerBackBtnTop} onClick={closePanel}>
                Back
              </button>
            </div>

            <div style={styles.drawerGrid}>
              <div style={styles.drawerLeft}>
                <div style={styles.drawerImage}>
                  <div style={styles.drawerImageInner}>
                    <div style={styles.drawerImageLabel}>MAIN IMAGE</div>
                    <div style={styles.thumbRow}>
                      <div style={styles.thumb}>IMG</div>
                      <div style={styles.thumb}>IMG</div>
                      <div style={styles.thumb}>IMG</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.drawerRight}>
                <div style={styles.drawerBody}>
                  <div style={styles.drawerName}>{selected.name}</div>
                  <div style={styles.drawerMeta}>{selected.size}</div>
                  <div style={styles.drawerNote}>{selected.note}</div>
                  <div style={styles.drawerPrice}>
                    ₱ {formatMoney(selected.price)}
                  </div>

                  <div style={styles.drawerDesc}>{selected.description}</div>

                  <div style={styles.drawerQtyRow}>
                    <button style={styles.qtyBtn} onClick={() => remove(selected.id)}>
                      -
                    </button>
                    <div style={{ ...styles.qty, width: 40 }}>
                      {cart[selected.id] || 0}
                    </div>
                    <button style={styles.qtyBtn} onClick={() => add(selected.id)}>
                      +
                    </button>
                  </div>

                  <div style={styles.drawerFooterHint}>
                    Delivered chilled • Vacuum packed • Prepared with care
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* CART PANEL */}
      <aside
        style={{
          ...styles.cartPanel,
          transform: panel === "cart" ? "translateX(0)" : "translateX(100%)",
          pointerEvents: panel === "cart" ? "auto" : "none",
        }}
        aria-hidden={panel !== "cart"}
      >
        <div style={styles.cartPanelHeader}>
          <div style={styles.cartPanelTitle}>Your Cart</div>
          <button style={styles.closeBtn} onClick={closePanel}>
            Close
          </button>
        </div>

        <div style={styles.cartPanelBody}>
          {items.length === 0 ? (
            <div style={{ color: "#aaa", lineHeight: 1.6 }}>
              Your cart is empty.
              <div style={{ marginTop: 10, color: "#777", fontSize: 13 }}>
                Add items using the +/- controls on any product.
              </div>
            </div>
          ) : (
            <>
              {items.map((i) => (
                <div key={i.id} style={styles.cartLine}>
                  <div style={styles.cartLineName}>
                    <div style={{ fontSize: 14 }}>{i.name}</div>
                    <div style={{ color: "#777", fontSize: 12, marginTop: 2 }}>
                      {i.size}
                    </div>
                  </div>

                  <div style={styles.cartLineRight}>
                    <button style={styles.qtyBtnSm} onClick={() => remove(i.id)}>
                      -
                    </button>
                    <div style={styles.qtySm}>{i.qty}</div>
                    <button style={styles.qtyBtnSm} onClick={() => add(i.id)}>
                      +
                    </button>
                    <div style={styles.cartLineTotal}>
                      ₱ {formatMoney(i.price * i.qty)}
                    </div>
                  </div>
                </div>
              ))}

              <div style={styles.cartPanelTotalRow}>
                <div style={{ color: "#bbb" }}>Total</div>
                <div style={styles.cartPanelTotalValue}>₱ {formatMoney(total)}</div>
              </div>

              <button style={styles.confirmBtnWide} onClick={startCheckout}>
                Checkout
              </button>

              <div style={styles.cartPanelFootnote}>
                Delivery within Merville • Cashless payment • Prepared with care
              </div>
            </>
          )}
        </div>
      </aside>

      {/* CHECKOUT PANEL (full width under navbar) */}
      <aside
        style={{
          ...styles.checkoutPanel,
          transform: panel === "checkout" ? "translateY(0)" : "translateY(10px)",
          opacity: panel === "checkout" ? 1 : 0,
          pointerEvents: panel === "checkout" ? "auto" : "none",
        }}
        aria-hidden={panel !== "checkout"}
      >
        <div style={styles.checkoutHeader}>
          <div style={styles.checkoutHeaderLeft}>
            <button style={styles.checkoutBackBtn} onClick={closeCheckout}>
              Back
            </button>
            <div>
              <div style={styles.checkoutTitle}>Checkout</div>
              <div style={styles.checkoutSub}>Pay via QR • Upload proof • Send order</div>
            </div>
          </div>

          <div style={styles.checkoutHeaderRight}>
            <div style={styles.checkoutOrderId}>{draft ? draft.id : ""}</div>
          </div>
        </div>

        <div style={styles.checkoutBody}>
          {checkoutState === "success" && draft ? (
            <div style={styles.successWrap}>
              <div style={styles.successBadge}>ORDER RECEIVED</div>
              <div style={styles.successTitle}>Thank you.</div>
              <div style={styles.successText}>
                We’ll confirm your payment and message you for delivery.
              </div>
              <div style={styles.successCard}>
                <div style={{ color: "#bbb", fontSize: 12, letterSpacing: 1 }}>
                  Order ID
                </div>
                <div style={{ fontSize: 18, marginTop: 6 }}>{draft.id}</div>
                <div style={{ marginTop: 10, color: "#bbb" }}>
                  Total: ₱ {formatMoney(draft.total)}
                </div>
              </div>
              <button
                style={styles.successBtn}
                onClick={() => {
                  resetCheckoutArtifacts();
                  closePanel();
                }}
              >
                Back to Shop
              </button>
            </div>
          ) : (
            <div style={styles.checkoutGrid}>
              {/* LEFT: customer + proof */}
              <div style={styles.checkoutLeft}>
                <div style={styles.sectionTitle}>Customer Details</div>

                <div style={styles.fieldGrid}>
                  <label style={styles.fieldLabel}>
                    Full name*
                    <input
                      style={styles.input}
                      value={customer.name}
                      onChange={(e) =>
                        setCustomer((c) => ({ ...c, name: e.target.value }))
                      }
                      placeholder="e.g. Juan Dela Cruz"
                    />
                  </label>

                  <label style={styles.fieldLabel}>
                    Mobile number*
                    <input
                      style={styles.input}
                      value={customer.phone}
                      onChange={(e) =>
                        setCustomer((c) => ({ ...c, phone: e.target.value }))
                      }
                      placeholder="e.g. 09xx xxx xxxx"
                      inputMode="tel"
                    />
                  </label>

                  <label style={styles.fieldLabel}>
                    Delivery address*
                    <textarea
                      style={{ ...styles.input, height: 88, resize: "none" }}
                      value={customer.address}
                      onChange={(e) =>
                        setCustomer((c) => ({ ...c, address: e.target.value }))
                      }
                      placeholder="House #, street, barangay (Merville)"
                    />
                  </label>

                  <label style={styles.fieldLabel}>
                    Notes (optional)
                    <textarea
                      style={{ ...styles.input, height: 72, resize: "none" }}
                      value={customer.notes}
                      onChange={(e) =>
                        setCustomer((c) => ({ ...c, notes: e.target.value }))
                      }
                      placeholder="Preferred delivery time, gate instructions, etc."
                    />
                  </label>
                </div>

                <div style={styles.sectionTitle}>Payment Proof</div>

                <div style={styles.proofRow}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => onPickPaymentProof(e.target.files?.[0] || null)}
                    style={{ display: "none" }}
                  />

                  <button
                    style={styles.uploadBtn}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  >
                    Upload Screenshot
                  </button>

                  {paymentFile && (
                    <button
                      style={styles.secondaryBtn}
                      onClick={() => {
                        if (paymentPreviewUrl) URL.revokeObjectURL(paymentPreviewUrl);
                        setPaymentPreviewUrl(null);
                        setPaymentFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {paymentPreviewUrl ? (
                  <div style={styles.proofPreview}>
                    <img
                      src={paymentPreviewUrl}
                      alt="Payment proof preview"
                      style={styles.proofImg}
                    />
                  </div>
                ) : (
                  <div style={styles.proofHint}>
                    Upload a screenshot/photo of your payment confirmation.
                  </div>
                )}

                <div style={styles.checkoutActions}>
                  <button
                    style={{
                      ...styles.sendBtn,
                      opacity: isCheckoutValid ? 1 : 0.4,
                      cursor: isCheckoutValid ? "pointer" : "not-allowed",
                    }}
                    onClick={submitOrder}
                    disabled={!isCheckoutValid}
                  >
                    Send Order
                  </button>

                  <div style={styles.validationHint}>
                    * Required fields. Payment proof required.
                  </div>
                </div>
              </div>

              {/* RIGHT: summary + QR */}
              <div style={styles.checkoutRight}>
                <div style={styles.sectionTitle}>Order Summary</div>

                <div style={styles.summaryCard}>
                  {(draft?.items || []).map((li: any) => (
                    <div key={`${li.productId}`} style={styles.summaryLine}>
                      <div style={styles.summaryLineLeft}>
                        <div style={{ fontSize: 14 }}>{li.name}</div>
                        <div style={{ color: "#777", fontSize: 12, marginTop: 2 }}>
                          {li.size} • x{li.qty}
                        </div>
                      </div>
                      <div style={styles.summaryLineRight}>₱ {formatMoney(li.lineTotal)}</div>
                    </div>
                  ))}

                  <div style={styles.summaryTotalRow}>
                    <div style={{ color: "#bbb" }}>Total</div>
                    <div style={styles.summaryTotalValue}>
                      ₱ {formatMoney(draft?.total || 0)}
                    </div>
                  </div>
                </div>

                <div style={styles.sectionTitle}>Pay via QR</div>

                <div style={styles.qrCard}>
                  <div style={styles.qrTile}>
                    <svg viewBox="0 0 200 200" width="160" height="160" aria-label="QR code placeholder">
                      <rect x="0" y="0" width="200" height="200" fill="#fff" />
                      <rect x="16" y="16" width="56" height="56" fill="#000" />
                      <rect x="128" y="16" width="56" height="56" fill="#000" />
                      <rect x="16" y="128" width="56" height="56" fill="#000" />
                      <rect x="92" y="92" width="16" height="16" fill="#000" />
                      <rect x="112" y="92" width="16" height="16" fill="#000" />
                      <rect x="92" y="112" width="16" height="16" fill="#000" />
                      <rect x="60" y="92" width="16" height="16" fill="#000" />
                      <rect x="140" y="112" width="16" height="16" fill="#000" />
                      <rect x="112" y="140" width="16" height="16" fill="#000" />
                      <rect x="92" y="140" width="16" height="16" fill="#000" />
                      <rect x="140" y="92" width="16" height="16" fill="#000" />
                      <rect x="92" y="60" width="16" height="16" fill="#000" />
                      <rect x="112" y="60" width="16" height="16" fill="#000" />
                    </svg>
                  </div>

                  <div style={styles.qrText}>
                    <div style={styles.qrTitle}>Merville Prime</div>
                    <div style={styles.qrSub}>
                      Scan this QR to pay. Then upload your confirmation screenshot.
                    </div>
                    <div style={styles.qrMeta}>Amount: ₱ {formatMoney(draft?.total || 0)}</div>
                  </div>
                </div>

                <div style={styles.qrHint}>Tip: Use the exact total amount for faster verification.</div>
              </div>
            </div>
          )}
        </div>
      </aside>

      
    </div>
  );
}

const styles: Record<string, any> = {
  page: {
    background: "#000",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "\"Playfair Display\", Georgia, serif",
    backgroundImage:
      "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.04), transparent 40%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.03), transparent 45%), radial-gradient(circle at 50% 80%, rgba(255,255,255,0.025), transparent 50%)",
    backgroundBlendMode: "overlay",
  },
  stickyWrap: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "#000",
    paddingTop: 8,
  },
  containerTop: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "20px 20px 10px",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "28px 20px 80px",
  },
  header: { textAlign: "center", marginBottom: 8 },
  logo: { letterSpacing: 4, fontSize: 28, margin: 0 },
  tagline: { color: "#aaa", fontStyle: "italic", fontSize: 13, margin: 0 },

  // White bar
  navbar: {
    width: "100vw",
    marginLeft: "calc(50% - 50vw)",
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    color: "#000",
    borderTop: "1px solid #e6e6e6",
    borderBottom: "1px solid #e6e6e6",

  },
  navInner: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "8px 20px",
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 12,
  },
  navLeft: { display: "flex", alignItems: "center" },
  navCenter: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  navRight: { display: "flex", justifyContent: "flex-end" },
  navBtn: {
    background: "transparent",
    border: "1px solid #111",
    color: "#000",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    transition: "background 160ms ease, color 160ms ease, transform 120ms ease",

  },
  navSearch: {
    width: "min(520px, 100%)",
    padding: "10px 78px 10px 14px",
    borderRadius: 999,
    border: "1px solid #cfcfcf",
    fontSize: 13,
    outline: "none",
    background: "#fff",
    color: "#000",
  },
  navClear: {
    position: "absolute",
    right: 6,
    top: "50%",
    transform: "translateY(-50%)",
    padding: "8px 12px",
    background: "#000",
    border: "1px solid #000",
    color: "#fff",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  products: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, 260px)",
    justifyContent: "start",
    gap: 24,
  },
  card: {
    borderRadius: 16,
    border: "1px solid #333",
    padding: 20,
    background: "#0b0b0b",
    cursor: "pointer",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    transition: "transform 180ms ease, box-shadow 180ms ease",

  },
  imageTile: {
    borderRadius: 14,
    border: "1px solid #333",
    background: "#070707",
    height: 150,
    marginBottom: 14,
  },
  imageTileInner: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))",
  },
  imageTileLabel: { letterSpacing: 2, fontSize: 12, color: "#888" },
  productName: { margin: "0 0 6px" },
  size: { fontSize: 13, color: "#bbb", marginBottom: 6 },
  note: { fontSize: 14, color: "#888", marginBottom: 12 },
  price: { fontSize: 18, marginBottom: 12 },
  qtyRow: { display: "flex", alignItems: "center", gap: 10 },
  qtyBtn: {
    borderRadius: 10,
    width: 36,
    height: 36,
    background: "transparent",
    color: "#fff",
    border: "1px solid #555",
    cursor: "pointer",
    transition: "background 140ms ease, transform 120ms ease",

  },
  qty: {
    width: 30,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  },
  emptyHint: {
    marginTop: 18,
    color: "#777",
    fontSize: 13,
    letterSpacing: 0.2,
  },

  // Backdrop
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.62)",
    transition: "opacity 200ms ease",
    zIndex: 70,
  },

  // PRODUCT PANEL
  productPanel: {
    position: "fixed",
    top: 132,
    left: "50%",
    height: "calc(100vh - 156px)",
    width: "90vw",
    maxWidth: 1200,
    background: "#0b0b0b",
    border: "1px solid #333",
    borderRadius: 16,
    zIndex: 80,
    transition: "opacity 200ms ease, transform 220ms ease",
    overflow: "hidden",
    boxShadow: "0 30px 90px rgba(0,0,0,0.6)",
  },
  productPanelInner: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  productTopBand: {
    height: 72,
    borderBottom: "1px solid #222",
    display: "flex",
    alignItems: "center",
    padding: "0 18px",
  },
  drawerBackBtnTop: {
    borderRadius: 12,
    background: "transparent",
    border: "1px solid #555",
    color: "#fff",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  drawerGrid: {
    height: "100%",
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
  },
  drawerLeft: { padding: 18, borderRight: "1px solid #222" },
  drawerRight: { display: "flex", flexDirection: "column", minWidth: 0 },
  drawerBody: { padding: 18, overflowY: "auto" },
  drawerImage: {
    border: "1px solid #333",
    borderRadius: 14,
    background: "#070707",
    height: "100%",
    minHeight: 420,
  },
  drawerImageInner: {
    height: "100%",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    alignItems: "center",
    justifyItems: "center",
    borderRadius: 14,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))",
  },
  drawerImageLabel: { letterSpacing: 2, fontSize: 12, color: "#888" },
  thumbRow: {
    width: "100%",
    display: "flex",
    gap: 10,
    padding: 12,
    justifyContent: "center",
  },
  thumb: {
    width: 70,
    height: 70,
    borderRadius: 10,
    border: "1px solid #333",
    background: "#111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    color: "#777",
    cursor: "pointer",
  },
  drawerName: { fontSize: 22, marginBottom: 6 },
  drawerMeta: { color: "#bbb", fontSize: 13, marginBottom: 8 },
  drawerNote: { color: "#888", marginBottom: 10 },
  drawerPrice: { fontSize: 18, marginBottom: 14 },
  drawerDesc: {
    color: "#cfcfcf",
    lineHeight: 1.55,
    fontSize: 14,
    borderTop: "1px solid #222",
    paddingTop: 14,
  },
  drawerQtyRow: {
    marginTop: 16,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  drawerFooterHint: {
    marginTop: 18,
    color: "#777",
    fontSize: 12,
    letterSpacing: 0.5,
  },

  // CART PANEL
  cartPanel: {
    position: "fixed",
    top: 0,
    right: 0,
    height: "100vh",
    width: "min(420px, 92vw)",
    background: "#0b0b0b",
    borderLeft: "1px solid #333",
    zIndex: 90,
    transition: "transform 220ms ease",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-20px 0 70px rgba(0,0,0,0.6)",
    borderRadius: "16px 0 0 16px",
  },
  cartPanelHeader: {
    padding: "16px 18px",
    borderBottom: "1px solid #222",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cartPanelTitle: {
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#ddd",
  },
  closeBtn: {
    background: "transparent",
    border: "1px solid #555",
    color: "#fff",
    padding: "8px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
  cartPanelBody: {
    padding: 18,
    overflowY: "auto",
    flex: 1,
  },
  cartLine: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #222",
  },
  cartLineName: { flex: 1, minWidth: 0 },
  cartLineRight: {
    display: "grid",
    gridTemplateColumns: "28px 28px 28px 1fr",
    alignItems: "center",
    columnGap: 8,
    width: 200,
  },
  qtyBtnSm: {
    width: 28,
    height: 28,
    borderRadius: 999,
    background: "transparent",
    color: "#fff",
    border: "1px solid #555",
    cursor: "pointer",
  },
  qtySm: {
    width: 28,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    color: "#fff",
  },
  cartLineTotal: {
    justifySelf: "end",
    textAlign: "right",
    width: "100%",
    fontVariantNumeric: "tabular-nums",
    color: "#fff",
  },
  cartPanelTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    paddingTop: 12,
    borderTop: "1px solid #222",
    fontSize: 16,
  },
  cartPanelTotalValue: {
    fontVariantNumeric: "tabular-nums",
    fontWeight: "bold",
  },
  confirmBtnWide: {
    marginTop: 16,
    width: "100%",
    padding: "14px 16px",
    background: "#fff",
    color: "#000",
    border: "none",
    fontWeight: "bold",
    letterSpacing: 1,
    cursor: "pointer",
    borderRadius: 999,
  },
  cartPanelFootnote: {
    marginTop: 12,
    color: "#777",
    fontSize: 12,
    letterSpacing: 0.3,
    lineHeight: 1.4,
  },

  // CHECKOUT PANEL
  checkoutPanel: {
    position: "fixed",
    left: 0,
    right: 0,
    top: 132,
    height: "calc(100vh - 132px)",
    background: "#050505",
    borderTop: "1px solid #222",
    zIndex: 95,
    boxShadow: "0 -10px 60px rgba(0,0,0,0.7)",
    transition: "opacity 180ms ease, transform 180ms ease",
    overflow: "hidden",
  },
  checkoutHeader: {
    height: 78,
    padding: "0 20px",
    borderBottom: "1px solid #222",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))",
  },
  checkoutHeaderLeft: { display: "flex", gap: 14, alignItems: "center" },
  checkoutHeaderRight: { display: "flex", alignItems: "center" },
  checkoutBackBtn: {
    borderRadius: 12,
    background: "transparent",
    border: "1px solid #555",
    color: "#fff",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  checkoutTitle: { fontSize: 16, letterSpacing: 2, textTransform: "uppercase" },
  checkoutSub: { color: "#aaa", fontSize: 12, marginTop: 4 },
  checkoutOrderId: {
    color: "#bbb",
    fontSize: 12,
    letterSpacing: 1,
    fontVariantNumeric: "tabular-nums",
  },
  checkoutBody: {
    height: "calc(100% - 78px)",
    overflowY: "auto",
    padding: 20,
  },
  checkoutGrid: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  checkoutLeft: {
    border: "1px solid #222",
    borderRadius: 16,
    background: "#0b0b0b",
    padding: 18,
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
  },
  checkoutRight: {
    border: "1px solid #222",
    borderRadius: 16,
    background: "#0b0b0b",
    padding: 18,
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#ddd",
    marginBottom: 12,
  },
  fieldGrid: { display: "grid", gap: 12, marginBottom: 18 },
  fieldLabel: { display: "grid", gap: 6, color: "#bbb", fontSize: 12 },
  input: {
    borderRadius: 12,
    border: "1px solid #333",
    background: "#070707",
    color: "#fff",
    padding: "10px 12px",
    outline: "none",
    fontFamily: "inherit",
    fontSize: 14,
  },
  proofRow: { display: "flex", gap: 10, alignItems: "center" },
  uploadBtn: {
    borderRadius: 999,
    padding: "12px 14px",
    border: "1px solid #555",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    letterSpacing: 0.6,
  },
  secondaryBtn: {
    borderRadius: 999,
    padding: "12px 14px",
    border: "1px solid #333",
    background: "#111",
    color: "#ddd",
    cursor: "pointer",
    fontWeight: "bold",
  },
  proofPreview: {
    marginTop: 12,
    borderRadius: 14,
    border: "1px solid #222",
    overflow: "hidden",
    background: "#060606",
  },
  proofImg: { width: "100%", height: 260, objectFit: "cover", display: "block" },
  proofHint: {
    marginTop: 12,
    color: "#777",
    fontSize: 13,
    lineHeight: 1.5,
  },
  checkoutActions: { marginTop: 16 },
  sendBtn: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 999,
    border: "none",
    background: "#fff",
    color: "#000",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  validationHint: { marginTop: 10, color: "#777", fontSize: 12 },

  summaryCard: {
    borderRadius: 14,
    border: "1px solid #222",
    background: "#070707",
    overflow: "hidden",
  },
  summaryLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderBottom: "1px solid #1c1c1c",
  },
  summaryLineLeft: { minWidth: 0 },
  summaryLineRight: {
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    color: "#fff",
    whiteSpace: "nowrap",
  },
  summaryTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 14px",
  },
  summaryTotalValue: { fontWeight: "bold", fontVariantNumeric: "tabular-nums" },

  qrCard: {
    marginTop: 8,
    borderRadius: 14,
    border: "1px solid #222",
    background: "#070707",
    padding: 14,
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: 14,
    alignItems: "center",
  },
  qrTile: {
    width: 180,
    height: 180,
    borderRadius: 14,
    background: "#fff",
    display: "grid",
    placeItems: "center",
  },
  qrText: { color: "#ddd" },
  qrTitle: { fontSize: 16, letterSpacing: 1, marginBottom: 6 },
  qrSub: { color: "#aaa", fontSize: 13, lineHeight: 1.5 },
  qrMeta: { marginTop: 12, color: "#ddd", fontSize: 13 },
  qrHint: { marginTop: 10, color: "#777", fontSize: 12 },

  successWrap: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "36px 20px",
    textAlign: "center",
  },
  successBadge: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid #333",
    color: "#ddd",
    letterSpacing: 2,
    textTransform: "uppercase",
    fontSize: 12,
  },
  successTitle: { fontSize: 34, marginTop: 18 },
  successText: { color: "#aaa", marginTop: 8, lineHeight: 1.6 },
  successCard: {
    marginTop: 18,
    borderRadius: 16,
    border: "1px solid #222",
    background: "#0b0b0b",
    padding: 16,
  },
  successBtn: {
    marginTop: 18,
    padding: "14px 18px",
    borderRadius: 999,
    border: "none",
    background: "#fff",
    color: "#000",
    fontWeight: "bold",
    cursor: "pointer",
  },

  
};
