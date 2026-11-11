export type Lang = 'ar' | 'en';
export type L = { ar: string; en: string };

export type Category = { id: string; name: L; sort: number };

export type Product = {
  id: string;
  categoryId: string;
  name: L;
  desc: L;
  price: number;
  compareAt?: number | null;
  images: string[];
  active: boolean;
  featured?: boolean;
  soldOut?: boolean;
  leadDays?: number | null;
  sort: number;
  createdAt: string;
  updatedAt: string;
};

export type GalleryItem = {
  id: string;
  image: string;
  /** Product the "order one like it" button adds to the cart. */
  productId?: string;
  tilt: number;
  title: L;
  occasion: L;
  note: L;
  active: boolean;
  sort: number;
};

export type ReviewStatus = 'approved' | 'pending' | 'hidden';
export type Review = {
  id: string;
  name: L;
  occasion: L;
  quote: L;
  rating: number;
  status: ReviewStatus;
  orderCode?: string;
  createdAt: string;
};

export type Zone = { id: string; name: L; fee: number; active: boolean };

export type Coupon = {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal: number;
  active: boolean;
  uses: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  createdAt: string;
};

export type BuilderOccasion = { id: string; name: L; topper: L };
export type BuilderSize = { id: string; tiers: number; price: number; name: L; serves: L };
export type BuilderFlavour = { id: string; name: L; surcharge: number };
export type BuilderColour = { id: string; name: L; base: string; light: string; dark: string; messageColour?: string };
export type BuilderDecoration = { id: string; icon: string; price: number; perTier: boolean; name: L };
export type BuilderConfig = {
  enabled: boolean;
  occasions: BuilderOccasion[];
  sizes: BuilderSize[];
  flavours: BuilderFlavour[];
  colours: BuilderColour[];
  decorations: BuilderDecoration[];
};

export type PaymentMethod = 'cod' | 'instapay' | 'wallet';

export type Settings = {
  whatsapp: string;
  instagramUrl: string;
  instagramHandle: string;
  tiktokUrl: string;
  facebookUrl: string;
  storeOpen: boolean;
  showPrices: boolean;
  closedMessage: L;
  leadDays: number;
  standardLeadDays: number;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  pickupAddress: L;
  zones: Zone[];
  timeSlots: { id: string; name: L }[];
  payments: {
    cod: { enabled: boolean };
    instapay: { enabled: boolean; handle: string };
    wallet: { enabled: boolean; number: string };
  };
  builder: BuilderConfig;
};

export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';

export type CustomDesign = {
  occasionId: string;
  sizeId: string;
  flavourId: string;
  colourId: string;
  decorations: string[];
  message: string;
  date: string;
};

export type OrderItem = {
  kind: 'product' | 'custom';
  productId?: string;
  name: L;
  image?: string;
  unitPrice: number;
  qty: number;
  design?: CustomDesign;
  summary?: { k: L; v: L }[];
  colour?: string;
};

export type Order = {
  id: string;
  code: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  history: { status: OrderStatus; at: string; note?: string }[];
  customer: { name: string; phone: string; email?: string };
  fulfillment: {
    type: 'delivery' | 'pickup';
    zoneId?: string;
    zoneName?: L;
    address?: string;
    date: string;
    slotId?: string;
    slotName?: L;
  };
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode?: string;
  total: number;
  payment: { method: PaymentMethod; status: 'unpaid' | 'paid' };
  notes?: string;
  /** Customer's reference photos (uploaded at checkout). */
  refImages?: string[];
  /** Final price confirmed by the shop — shown to the customer even when public prices are hidden. */
  quote?: { total: number; at: string; note?: string };
  adminNotes?: string;
  lang: Lang;
  seen: boolean;
  userId?: string;
  demo?: boolean;
};

export type DB = {
  version: number;
  categories: Category[];
  products: Product[];
  gallery: GalleryItem[];
  reviews: Review[];
  coupons: Coupon[];
  orders: Order[];
  settings: Settings;
  admin: { passwordHash: string; secret: string };
  counters: { order: number };
  users: User[];
  push: PushState;
  /** Screenshots of customer chats, shown as the tap-to-open wall in the reviews area. */
  reviewShots: string[];
};

/** A phone/browser the owner turned order notifications on for. */
export type PushSub = { id: string; endpoint: string; p256dh: string; auth: string; ua?: string; createdAt: string };
export type PushState = { vapid?: { publicKey: string; privateKey: string }; subs: PushSub[] };

export type TrackEvent = {
  t: number;
  type: string;
  sid?: string;
  path?: string;
  ref?: string;
  device?: 'mobile' | 'tablet' | 'desktop';
  meta?: Record<string, string | number>;
  demo?: boolean;
};

/** What the storefront needs; never includes admin data. */
export type PublicData = {
  categories: Category[];
  products: Product[];
  gallery: GalleryItem[];
  reviews: Review[];
  reviewShots: string[];
  settings: Omit<Settings, 'payments'> & { payments: Settings['payments'] };
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  googleId?: string;
  avatar?: string;
  zoneId?: string;
  address?: string;
  createdAt: string;
  lastLoginAt: string;
};

/** What the browser may know about the signed-in customer. */
export type PublicUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  zoneId: string;
  address: string;
  google: boolean;
  hasPassword: boolean;
};
