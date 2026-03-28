import {
  Cart,
  CartItem,
  CartSummary,
  Product,
  CheckoutState,
  CheckoutStep,
  ShippingAddress,
  PaymentMethod,
  Order,
  OrderStatus,
} from '../../../shared/types';

/**
 * CartService - Manages shopping carts and checkout flow in conversation context
 * 
 * Key Features:
 * - Session-based cart storage
 * - Add/remove/update cart items
 * - Cart summary calculation
 * - Checkout state management
 * - Order creation
 */
export class CartService {
  private carts: Map<string, Cart> = new Map();
  private checkoutStates: Map<string, CheckoutState> = new Map();
  private orders: Map<string, Order> = new Map();

  /**
   * Get or create cart for a session
   */
  getCart(sessionId: string, siteId: string): Cart {
    let cart = this.carts.get(sessionId);
    
    if (!cart) {
      cart = {
        sessionId,
        siteId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.carts.set(sessionId, cart);
    }
    
    return cart;
  }

  /**
   * Add product to cart
   */
  addToCart(
    sessionId: string,
    siteId: string,
    product: Product,
    quantity: number = 1,
    selectedSize?: string,
    selectedColor?: string
  ): Cart {
    const cart = this.getCart(sessionId, siteId);
    
    // Check if product already exists in cart (consider size and color)
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.product.id === product.id &&
        item.selectedSize === selectedSize &&
        item.selectedColor === selectedColor
    );

    if (existingItemIndex >= 0) {
      // Update quantity of existing item
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      const newItem: CartItem = {
        product,
        quantity,
        selectedSize,
        selectedColor,
        addedAt: new Date(),
      };
      cart.items.push(newItem);
    }

    cart.updatedAt = new Date();
    this.carts.set(sessionId, cart);
    
    return cart;
  }

  /**
   * Remove product from cart
   */
  removeFromCart(
    sessionId: string,
    productId: string,
    selectedSize?: string,
    selectedColor?: string
  ): Cart {
    const cart = this.getCart(sessionId, '');
    
    cart.items = cart.items.filter(
      (item) =>
        !(
          item.product.id === productId &&
          item.selectedSize === selectedSize &&
          item.selectedColor === selectedColor
        )
    );

    cart.updatedAt = new Date();
    this.carts.set(sessionId, cart);
    
    return cart;
  }

  /**
   * Update item quantity
   */
  updateQuantity(
    sessionId: string,
    productId: string,
    quantity: number,
    selectedSize?: string,
    selectedColor?: string
  ): Cart {
    const cart = this.getCart(sessionId, '');
    
    const item = cart.items.find(
      (item) =>
        item.product.id === productId &&
        item.selectedSize === selectedSize &&
        item.selectedColor === selectedColor
    );

    if (item) {
      if (quantity <= 0) {
        return this.removeFromCart(sessionId, productId, selectedSize, selectedColor);
      }
      item.quantity = quantity;
    }

    cart.updatedAt = new Date();
    this.carts.set(sessionId, cart);
    
    return cart;
  }

  /**
   * Clear entire cart
   */
  clearCart(sessionId: string): void {
    const cart = this.carts.get(sessionId);
    if (cart) {
      cart.items = [];
      cart.updatedAt = new Date();
      this.carts.set(sessionId, cart);
    }
  }

  /**
   * Get cart summary with calculated totals
   */
  getCartSummary(sessionId: string): CartSummary {
    const cart = this.carts.get(sessionId);
    
    if (!cart || cart.items.length === 0) {
      return {
        itemCount: 0,
        totalPrice: 0,
        items: [],
      };
    }

    let totalPrice = 0;
    const items = cart.items.map((item) => {
      const priceStr = item.product.salePrice || item.product.price;
      const price = this.parsePrice(priceStr);
      const itemTotal = price * item.quantity;
      totalPrice += itemTotal;

      return {
        title: item.product.title,
        quantity: item.quantity,
        price: itemTotal,
        size: item.selectedSize,
        color: item.selectedColor,
      };
    });

    return {
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice,
      items,
    };
  }

  /**
   * Parse price string to number (handles "2450 TL", "2.450,00 TL", etc.)
   */
  private parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    
    // Remove currency symbols and normalize
    const normalized = priceStr
      .replace(/[^\d,.-]/g, '') // Remove non-numeric chars except comma, dot, dash
      .replace(/\./g, '') // Remove thousand separators
      .replace(',', '.'); // Replace decimal comma with dot
    
    return parseFloat(normalized) || 0;
  }

  /**
   * Initialize checkout flow
   */
  startCheckout(sessionId: string): CheckoutState {
    const state: CheckoutState = {
      step: CheckoutStep.CART_REVIEW,
    };
    
    this.checkoutStates.set(sessionId, state);
    return state;
  }

  /**
   * Get current checkout state
   */
  getCheckoutState(sessionId: string): CheckoutState | undefined {
    return this.checkoutStates.get(sessionId);
  }

  /**
   * Update checkout state
   */
  updateCheckoutState(sessionId: string, updates: Partial<CheckoutState>): CheckoutState {
    const currentState = this.checkoutStates.get(sessionId) || {
      step: CheckoutStep.CART_REVIEW,
    };
    
    const newState = { ...currentState, ...updates };
    this.checkoutStates.set(sessionId, newState);
    
    return newState;
  }

  /**
   * Set shipping address and move to payment step
   */
  setShippingAddress(sessionId: string, address: ShippingAddress): CheckoutState {
    return this.updateCheckoutState(sessionId, {
      shippingAddress: address,
      step: CheckoutStep.PAYMENT_SELECTION,
    });
  }

  /**
   * Set payment method and move to confirmation step
   */
  setPaymentMethod(sessionId: string, method: PaymentMethod): CheckoutState {
    return this.updateCheckoutState(sessionId, {
      paymentMethod: method,
      step: CheckoutStep.ORDER_CONFIRMATION,
    });
  }

  /**
   * Create order from cart and checkout state
   */
  createOrder(sessionId: string, siteId: string): Order | null {
    const cart = this.carts.get(sessionId);
    const checkoutState = this.checkoutStates.get(sessionId);

    if (!cart || cart.items.length === 0) {
      throw new Error('Sepetiniz boş');
    }

    if (!checkoutState?.shippingAddress) {
      throw new Error('Teslimat adresi eksik');
    }

    if (!checkoutState?.paymentMethod) {
      throw new Error('Ödeme yöntemi seçilmedi');
    }

    const summary = this.getCartSummary(sessionId);
    const orderId = this.generateOrderId();

    const order: Order = {
      orderId,
      sessionId,
      siteId,
      items: [...cart.items],
      shippingAddress: checkoutState.shippingAddress,
      paymentMethod: checkoutState.paymentMethod,
      totalAmount: summary.totalPrice,
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(orderId, order);
    
    // Update checkout state with order ID and mark as completed
    this.updateCheckoutState(sessionId, {
      orderId,
      step: CheckoutStep.COMPLETED,
    });

    // Clear cart after order creation
    this.clearCart(sessionId);

    return order;
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all orders for a session
   */
  getSessionOrders(sessionId: string): Order[] {
    return Array.from(this.orders.values()).filter(
      (order) => order.sessionId === sessionId
    );
  }

  /**
   * Update order status
   */
  updateOrderStatus(orderId: string, status: OrderStatus): Order | null {
    const order = this.orders.get(orderId);
    
    if (!order) {
      return null;
    }

    order.status = status;
    order.updatedAt = new Date();
    this.orders.set(orderId, order);
    
    return order;
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `ORD${timestamp}${random}`;
  }

  /**
   * Check if cart has items
   */
  hasItems(sessionId: string): boolean {
    const cart = this.carts.get(sessionId);
    return cart ? cart.items.length > 0 : false;
  }

  /**
   * Get item count in cart
   */
  getItemCount(sessionId: string): number {
    const cart = this.carts.get(sessionId);
    return cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
  }
}
