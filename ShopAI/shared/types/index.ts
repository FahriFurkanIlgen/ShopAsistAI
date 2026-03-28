// Shared type definitions for ShopAsistAI

export interface Product {
  id: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  price: string;
  salePrice?: string;
  availability: string;
  brand?: string;
  gtin?: string;
  mpn?: string;
  condition?: string;
  googleProductCategory?: string;
  productType?: string;
  additionalImageLinks?: string[];
  color?: string;
  size?: string;
  gender?: string; // Erkek, Kadın, Kız, Erkek Çocuk, etc.
}

export interface GoogleFeed {
  siteId: string;
  siteName: string;
  feedUrl: string;
  lastUpdated: Date;
  products: Product[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatRequest {
  siteId: string;
  message: string;
  conversationHistory?: ChatMessage[];
}

export interface ChatResponse {
  message: string;
  recommendedProducts?: Product[];
  conversationHistory?: ChatMessage[];
  confidence?: number;
  cart?: CartSummary;
  checkoutState?: CheckoutState;
  debug?: {
    originalQuery: string;
    enhancedQuery: string;
    isFollowUp: boolean;
    queryType?: string; // 'irrelevant' for non-product queries
    intent?: UserIntent;
  };
}

export interface SiteConfig {
  id: string;
  name: string;
  feedUrl: string;
  domain: string;
  active: boolean;
}

// Cart & Checkout Types
export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  addedAt: Date;
}

export interface Cart {
  sessionId: string;
  siteId: string;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CartSummary {
  itemCount: number;
  totalPrice: number;
  items: Array<{
    title: string;
    quantity: number;
    price: number;
    size?: string;
    color?: string;
  }>;
}

export enum UserIntent {
  PRODUCT_SEARCH = 'PRODUCT_SEARCH',
  ADD_TO_CART = 'ADD_TO_CART',
  VIEW_CART = 'VIEW_CART',
  REMOVE_FROM_CART = 'REMOVE_FROM_CART',
  CHECKOUT_INIT = 'CHECKOUT_INIT',
  PROVIDE_ADDRESS = 'PROVIDE_ADDRESS',
  PROVIDE_PAYMENT = 'PROVIDE_PAYMENT',
  CONFIRM_ORDER = 'CONFIRM_ORDER',
  TRACK_ORDER = 'TRACK_ORDER',
  GENERAL_QUESTION = 'GENERAL_QUESTION',
}

export enum CheckoutStep {
  CART_REVIEW = 'CART_REVIEW',
  ADDRESS_COLLECTION = 'ADDRESS_COLLECTION',
  PAYMENT_SELECTION = 'PAYMENT_SELECTION',
  ORDER_CONFIRMATION = 'ORDER_CONFIRMATION',
  COMPLETED = 'COMPLETED',
}

export interface CheckoutState {
  step: CheckoutStep;
  shippingAddress?: ShippingAddress;
  paymentMethod?: PaymentMethod;
  orderId?: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  district: string;
  postalCode: string;
  country: string;
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export interface Order {
  orderId: string;
  sessionId: string;
  siteId: string;
  items: CartItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

// Re-export config types
export * from './config';
