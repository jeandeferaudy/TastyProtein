export type CustomerDraft = {
  full_name: string;
  email: string;
  phone: string;
  placed_for_someone_else: boolean;
  attention_to: string;
  line1: string;
  line2: string;
  barangay: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  notes: string;
  delivery_date: string;
  delivery_slot: string;
  express_delivery: boolean;
  add_refer_bag: boolean;
};

export type CheckoutSubmitPayload = {
  subtotal: number;
  delivery_fee: number;
  thermal_bag_fee: number;
  total: number;
  postal_code: string;
  delivery_date: string;
  delivery_slot: string;
  express_delivery: boolean;
  add_thermal_bag: boolean;
};
