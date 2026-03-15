export type DeliveryRule = {
  postal_code: string;
  area_name: string;
  min_order_free_delivery_php: number;
  delivery_fee_below_min_php: number;
};

export type DeliveryPricingMatrixRow = {
  postalCodes: string;
  area: string;
  freeFromPhp: number;
  feeBelowMinPhp: number;
};

export function fallbackDeliveryRule(postal: string, area: string): DeliveryRule | null {
  const p = postal.replace(/\D/g, "");
  if (!p) return null;

  if (p === "1709") {
    return {
      postal_code: p,
      area_name: "Merville/Moonwalk",
      min_order_free_delivery_php: 2000,
      delivery_fee_below_min_php: 100,
    };
  }
  if (p === "1700" || p === "1701" || p === "1702") {
    return {
      postal_code: p,
      area_name: "San Dionisio/Tambo/Baclaran",
      min_order_free_delivery_php: 2000,
      delivery_fee_below_min_php: 100,
    };
  }
  if (p === "1713" || p === "1720") {
    return {
      postal_code: p,
      area_name: "Sucat/Marcelo Green",
      min_order_free_delivery_php: 3000,
      delivery_fee_below_min_php: 150,
    };
  }
  if (["1711", "1715"].includes(p) || /^130\d$/.test(p)) {
    return {
      postal_code: p,
      area_name: "Medium zone",
      min_order_free_delivery_php: 3000,
      delivery_fee_below_min_php: 150,
    };
  }
  return {
    postal_code: p,
    area_name: "Far zone",
    min_order_free_delivery_php: 4000,
    delivery_fee_below_min_php: 200,
  };
}

export function getDeliveryPricingMatrixRows(): DeliveryPricingMatrixRow[] {
  return [
    {
      area: "Merville / Moonwalk",
      freeFromPhp: 2000,
      feeBelowMinPhp: 100,
      postalCodes: "1709",
    },
    {
      area: "San Dionisio / Tambo / Baclaran",
      freeFromPhp: 2000,
      feeBelowMinPhp: 100,
      postalCodes: "1700, 1701, 1702",
    },
    {
      area: "Medium zone (incl. Sucat / Marcelo Green)",
      freeFromPhp: 3000,
      feeBelowMinPhp: 150,
      postalCodes: "1711, 1713, 1715, 1720, 1300-1309",
    },
    {
      area: "Far zone",
      freeFromPhp: 4000,
      feeBelowMinPhp: 200,
      postalCodes: "All other supported postcodes",
    },
  ].sort((a, b) => a.freeFromPhp - b.freeFromPhp || a.feeBelowMinPhp - b.feeBelowMinPhp || a.area.localeCompare(b.area));
}
