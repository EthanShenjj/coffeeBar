export type CartKind = "MENU" | "SHOP";

export type ProductOptionView = {
  id: string;
  name: string;
  priceDelta: number;
  isDefault?: boolean;
};

export type ProductOptionGroupView = {
  id: string;
  name: string;
  required: boolean;
  maxSelect: number;
  options: ProductOptionView[];
};

export type ProductView = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  channel: CartKind;
  category: string;
  menuCollection?: "CLASSIC" | "SEASONAL";
  menuSection?: string;
  price: number;
  imageUrl: string;
  stock: number | null;
  isAvailable: boolean;
  optionGroups: ProductOptionGroupView[];
};

export type CartLine = {
  lineId: string;
  product: ProductView;
  quantity: number;
  optionIds: string[];
};

export type CheckoutInput = {
  token: string;
  kind: CartKind;
  pickupName: string;
  pickupPhone: string;
  pickupAt: string;
  note?: string;
  useGiftCard: boolean;
  items: Array<{ productId: string; quantity: number; optionIds: string[] }>;
};
