import { UserIntent, ChatMessage } from '../../../shared/types';

/**
 * IntentRecognitionService - Detects user intent from natural language
 * 
 * Used by AI to understand what the user wants to do:
 * - Search for products
 * - Add to cart
 * - View cart
 * - Checkout
 * - etc.
 */
export class IntentRecognitionService {
  /**
   * Detect user intent from message
   */
  detectIntent(message: string, conversationHistory: ChatMessage[] = []): UserIntent {
    const normalized = this.normalizeText(message);

    // Check for cart-related intents
    if (this.isAddToCart(normalized)) {
      return UserIntent.ADD_TO_CART;
    }

    if (this.isViewCart(normalized)) {
      return UserIntent.VIEW_CART;
    }

    if (this.isRemoveFromCart(normalized)) {
      return UserIntent.REMOVE_FROM_CART;
    }

    // Check for checkout-related intents
    if (this.isCheckoutInit(normalized)) {
      return UserIntent.CHECKOUT_INIT;
    }

    if (this.isAddressProvision(normalized, conversationHistory)) {
      return UserIntent.PROVIDE_ADDRESS;
    }

    if (this.isPaymentProvision(normalized, conversationHistory)) {
      return UserIntent.PROVIDE_PAYMENT;
    }

    if (this.isOrderConfirmation(normalized)) {
      return UserIntent.CONFIRM_ORDER;
    }

    if (this.isOrderTracking(normalized)) {
      return UserIntent.TRACK_ORDER;
    }

    // Default to product search
    return UserIntent.PRODUCT_SEARCH;
  }

  /**
   * Normalize Turkish text for better matching
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .trim();
  }

  /**
   * Check if message is about adding to cart
   */
  private isAddToCart(normalized: string): boolean {
    const patterns = [
      /sepete\s+(ekle|at|koy)/,
      /sepete/,
      /al(ayim|icam|mak\s+istiyorum)/,
      /satin\s+al/,
      /bunu\s+(istiyorum|alcam|almak)/,
      /ekle/,
      /add\s+to\s+cart/i,
    ];

    return patterns.some((pattern) => pattern.test(normalized));
  }

  /**
   * Check if message is about viewing cart
   */
  private isViewCart(normalized: string): boolean {
    const patterns = [
      /sepet(im|imi)?\s*(goster|ne\s+var|kontrol|bak)/,
      /sepet(te)?\s+(ne|neler)\s+var/,
      /sepet/,
      /sepetimde\s+ne/,
      /view\s+cart/i,
      /show\s+cart/i,
    ];

    return patterns.some((pattern) => pattern.test(normalized));
  }

  /**
   * Check if message is about removing from cart
   */
  private isRemoveFromCart(normalized: string): boolean {
    const patterns = [
      /sepet(ten|imden)\s+(cikar|sil|kaldir)/,
      /cikar/,
      /iptal/,
      /istemiyorum/,
      /remove\s+from\s+cart/i,
    ];

    return patterns.some((pattern) => pattern.test(normalized));
  }

  /**
   * Check if message is about starting checkout
   */
  private isCheckoutInit(normalized: string): boolean {
    const patterns = [
      /satin\s+al(mak|ayim|icam)?/,
      /odeme/,
      /checkout/i,
      /siparis\s+(ver|olustur|tamamla)/,
      /hemen\s+al/,
      /tamamla/,
    ];

    return patterns.some((pattern) => pattern.test(normalized));
  }

  /**
   * Check if message contains address information
   */
  private isAddressProvision(
    normalized: string,
    conversationHistory: ChatMessage[]
  ): boolean {
    // Check if AI recently asked for address
    const recentMessages = conversationHistory.slice(-3);
    const aiAskedForAddress = recentMessages.some(
      (msg) =>
        msg.role === 'assistant' &&
        (msg.content.includes('adres') ||
          msg.content.includes('teslimat') ||
          msg.content.includes('gönder'))
    );

    if (!aiAskedForAddress) {
      return false;
    }

    // Check if message contains address-like information
    const addressPatterns = [
      /\d+\.\s*sokak/i,
      /mahalle/i,
      /cadde/i,
      /apartman/i,
      /\d{5}/,  // Postal code
      /no:\s*\d+/i,
      /kat:\s*\d+/i,
      /daire:\s*\d+/i,
    ];

    return addressPatterns.some((pattern) => pattern.test(normalized));
  }

  /**
   * Check if message is about payment selection
   */
  private isPaymentProvision(
    normalized: string,
    conversationHistory: ChatMessage[]
  ): boolean {
    // Check if AI recently asked for payment method
    const recentMessages = conversationHistory.slice(-3);
    const aiAskedForPayment = recentMessages.some(
      (msg) =>
        msg.role === 'assistant' &&
        (msg.content.includes('ödeme') ||
          msg.content.includes('nasıl ödemek') ||
          msg.content.includes('kredi kartı') ||
          msg.content.includes('kapıda'))
    );

    if (!aiAskedForPayment) {
      return false;
    }

    const paymentPatterns = [
      /kredi\s+kart/i,
      /banka\s+kart/i,
      /kapida\s+odeme/i,
      /havale/i,
      /eft/i,
      /nakit/i,
    ];

    return paymentPatterns.some((pattern) => pattern.test(normalized));
  }

  /**
   * Check if message is confirming order
   */
  private isOrderConfirmation(normalized: string): boolean {
    const patterns = [
      /^(evet|evet|tamam|onayla|onayliyorum|ok|okay)$/,
      /siparis(i)?\s+(onayla|ver|gonder)/,
      /confirm/i,
    ];

    return patterns.some((pattern) => pattern.test(normalized));
  }

  /**
   * Check if message is about order tracking
   */
  private isOrderTracking(normalized: string): boolean {
    const patterns = [
      /siparis(im)?\s+(nerede|durum|takip)/,
      /kargo\s+(nerede|durum)/,
      /nerede\s+(siparis|kargo)/,
      /track/i,
      /ORD\d+/i, // Order ID pattern
    ];

    return patterns.some((pattern) => pattern.test(normalized));
  }

  /**
   * Extract product reference from message (if any)
   * Returns product index or keywords
   */
  extractProductReference(message: string): { index?: number; keywords?: string } {
    const normalized = this.normalizeText(message);

    // Check for numeric references: "1'i sepete ekle", "ilk ürün", "2. ürünü"
    const numericMatch = normalized.match(/(\d+)[\.\s]*(numaray?i?|inci|nci|uncu|uncu)?/);
    if (numericMatch) {
      return { index: parseInt(numericMatch[1]) - 1 }; // Convert to 0-based index
    }

    // Check for positional references
    if (/ilk|birinci|first/i.test(normalized)) {
      return { index: 0 };
    }
    if (/ikinci|two|second/i.test(normalized)) {
      return { index: 1 };
    }
    if (/ucuncu|three|third/i.test(normalized)) {
      return { index: 2 };
    }

    // Check for "bunu", "şunu" (this one)
    if (/bunu|sunu|this/i.test(normalized)) {
      return { index: 0 }; // Assume first product if context unclear
    }

    // Extract keywords (product attributes)
    const keywords: string[] = [];
    
    // Size patterns
    const sizeMatch = normalized.match(/(\d{2})\s*(numara)?/);
    if (sizeMatch) {
      keywords.push(sizeMatch[1]);
    }

    // Color patterns
    const colorWords = ['siyah', 'beyaz', 'kirmizi', 'mavi', 'yesil', 'sari', 'pembe', 'gri', 'kahverengi'];
    colorWords.forEach((color) => {
      if (normalized.includes(color)) {
        keywords.push(color);
      }
    });

    return keywords.length > 0 ? { keywords: keywords.join(' ') } : {};
  }

  /**
   * Extract quantity from message
   */
  extractQuantity(message: string): number {
    const normalized = this.normalizeText(message);
    
    const quantityMatch = normalized.match(/(\d+)\s*(adet|tane|piece)?/);
    if (quantityMatch) {
      return parseInt(quantityMatch[1]);
    }

    return 1; // Default quantity
  }
}
