import { Router, Request, Response } from 'express';
import { CartService } from '../services/cartService';
import { Product, PaymentMethod, ShippingAddress } from '../../../shared/types';

const router = Router();
const cartService = new CartService();

/**
 * GET /api/cart/:sessionId - Get cart for session
 */
router.get('/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { siteId } = req.query;

    if (!siteId) {
      return res.status(400).json({ error: 'siteId is required' });
    }

    const cart = cartService.getCart(sessionId, siteId as string);
    const summary = cartService.getCartSummary(sessionId);

    res.json({ cart, summary });
  } catch (error: any) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cart/:sessionId/add - Add product to cart
 */
router.post('/:sessionId/add', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { siteId, product, quantity, size, color } = req.body;

    if (!siteId || !product) {
      return res.status(400).json({ error: 'siteId and product are required' });
    }

    const cart = cartService.addToCart(
      sessionId,
      siteId,
      product as Product,
      quantity || 1,
      size,
      color
    );

    const summary = cartService.getCartSummary(sessionId);

    res.json({ cart, summary });
  } catch (error: any) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/cart/:sessionId/remove - Remove product from cart
 */
router.delete('/:sessionId/remove', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { productId, size, color } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const cart = cartService.removeFromCart(sessionId, productId, size, color);
    const summary = cartService.getCartSummary(sessionId);

    res.json({ cart, summary });
  } catch (error: any) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/cart/:sessionId/update - Update product quantity
 */
router.put('/:sessionId/update', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { productId, quantity, size, color } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({ error: 'productId and quantity are required' });
    }

    const cart = cartService.updateQuantity(sessionId, productId, quantity, size, color);
    const summary = cartService.getCartSummary(sessionId);

    res.json({ cart, summary });
  } catch (error: any) {
    console.error('Update cart error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/cart/:sessionId/clear - Clear cart
 */
router.delete('/:sessionId/clear', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    cartService.clearCart(sessionId);
    const summary = cartService.getCartSummary(sessionId);

    res.json({ summary });
  } catch (error: any) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cart/:sessionId/checkout - Start checkout process
 */
router.post('/:sessionId/checkout', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const hasItems = cartService.hasItems(sessionId);
    if (!hasItems) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const checkoutState = cartService.startCheckout(sessionId);
    const summary = cartService.getCartSummary(sessionId);

    res.json({ checkoutState, summary });
  } catch (error: any) {
    console.error('Checkout init error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cart/:sessionId/address - Set shipping address
 */
router.post('/:sessionId/address', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const address: ShippingAddress = req.body;

    if (!address.fullName || !address.phone || !address.addressLine1) {
      return res.status(400).json({ 
        error: 'fullName, phone, and addressLine1 are required' 
      });
    }

    const checkoutState = cartService.setShippingAddress(sessionId, address);

    res.json({ checkoutState });
  } catch (error: any) {
    console.error('Set address error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cart/:sessionId/payment - Set payment method
 */
router.post('/:sessionId/payment', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { paymentMethod } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({ error: 'paymentMethod is required' });
    }

    const checkoutState = cartService.setPaymentMethod(
      sessionId,
      paymentMethod as PaymentMethod
    );

    res.json({ checkoutState });
  } catch (error: any) {
    console.error('Set payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cart/:sessionId/confirm - Confirm and create order
 */
router.post('/:sessionId/confirm', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { siteId } = req.body;

    if (!siteId) {
      return res.status(400).json({ error: 'siteId is required' });
    }

    const order = cartService.createOrder(sessionId, siteId);
    const checkoutState = cartService.getCheckoutState(sessionId);

    res.json({ order, checkoutState });
  } catch (error: any) {
    console.error('Confirm order error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/cart/:sessionId/orders - Get all orders for session
 */
router.get('/:sessionId/orders', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const orders = cartService.getSessionOrders(sessionId);

    res.json({ orders });
  } catch (error: any) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cart/order/:orderId - Get specific order
 */
router.get('/order/:orderId', (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const order = cartService.getOrder(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error: any) {
    console.error('Get order error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;