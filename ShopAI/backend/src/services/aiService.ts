import OpenAI from 'openai';
import { ChatMessage, ChatRequest, ChatResponse, Product, UserIntent, CheckoutStep } from '../../../shared/types';
import { CacheService } from './cacheService';
import { SimpleCache } from './simpleCache';
import { CartService } from './cartService';
import { IntentRecognitionService } from './intentService';
import { extractSize, extractBrand, extractColor, extractGender, normalizeTurkish } from '../search/utils';

export class AIService {
  private openai: OpenAI;
  private cacheService: CacheService;
  private responseCache: SimpleCache<ChatResponse>;
  private cartService: CartService;
  private intentService: IntentRecognitionService;

  constructor(cacheService: CacheService, cartService?: CartService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.openai = new OpenAI({ apiKey });
    this.cacheService = cacheService;
    this.responseCache = new SimpleCache<ChatResponse>(500, 300000); // Cache 500 responses for 5 min
    this.cartService = cartService || new CartService();
    this.intentService = new IntentRecognitionService();
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const { siteId, message, conversationHistory = [] } = request;

      // Generate session ID from conversation (use first user message timestamp or create new)
      const sessionId = this.getSessionId(conversationHistory);

      // STEP 1: Detect user intent
      const intent = this.intentService.detectIntent(message, conversationHistory);
      console.log(`[AIService] Detected intent: ${intent}`);

      // STEP 2: Handle cart-related intents
      if (intent === UserIntent.VIEW_CART) {
        return this.handleViewCart(sessionId, siteId, message, conversationHistory);
      }

      if (intent === UserIntent.ADD_TO_CART) {
        return this.handleAddToCart(sessionId, siteId, message, conversationHistory);
      }

      if (intent === UserIntent.REMOVE_FROM_CART) {
        return this.handleRemoveFromCart(sessionId, siteId, message, conversationHistory);
      }

      // STEP 3: Handle checkout-related intents
      if (intent === UserIntent.CHECKOUT_INIT) {
        return this.handleCheckoutInit(sessionId, siteId, message, conversationHistory);
      }

      if (intent === UserIntent.PROVIDE_ADDRESS) {
        return this.handleProvideAddress(sessionId, siteId, message, conversationHistory);
      }

      if (intent === UserIntent.PROVIDE_PAYMENT) {
        return this.handleProvidePayment(sessionId, siteId, message, conversationHistory);
      }

      if (intent === UserIntent.CONFIRM_ORDER) {
        return this.handleConfirmOrder(sessionId, siteId, message, conversationHistory);
      }

      if (intent === UserIntent.TRACK_ORDER) {
        return this.handleTrackOrder(sessionId, siteId, message, conversationHistory);
      }

      // STEP 4: Continue with normal product search flow
      // Check for irrelevant queries first
      const irrelevantResponse = this.checkIrrelevantQuery(message, siteId, conversationHistory);
      if (irrelevantResponse) {
        console.log(`[AIService] Irrelevant query detected: "${message}"`);
        return irrelevantResponse;
      }

      const products = this.cacheService.getProducts(siteId);
      if (!products || products.length === 0) {
        const errorMessage = 'Üzgünüm, şu anda ürün bilgilerine erişemiyorum. Lütfen daha sonra tekrar deneyin.';
        const updatedHistory: ChatMessage[] = [
          ...conversationHistory,
          { role: 'user', content: message, timestamp: new Date() },
          { role: 'assistant', content: errorMessage, timestamp: new Date() },
        ];
        return {
          message: errorMessage,
          conversationHistory: updatedHistory,
        };
      }

      // CHECK FOR SKU/MPN/PRODUCT CODE QUERIES
      // Pattern: SK2520052-1602, 253010 BBK, 100439-BBK, etc.
      const skuMatch = message.match(/\b([A-Z]{2,}[\d]{4,}[\-\s]?[\w]{2,}|\d{6}[\-\s]?[A-Z]{2,})\b/i);
      if (skuMatch) {
        const skuQuery = skuMatch[1].toUpperCase().replace(/\s+/g, ' ').trim();
        console.log(`[AIService] SKU/MPN detected: "${skuQuery}"`);
        
        // Search for exact SKU match in id or mpn fields
        const skuProducts = products.filter(p => {
          const productId = (p.id || '').toUpperCase().replace(/\s+/g, ' ').trim();
          const productMpn = (p.mpn || '').toUpperCase().replace(/\s+/g, ' ').trim();
          
          return productId.includes(skuQuery) || 
                 productMpn.includes(skuQuery) ||
                 productId.replace(/[\s\-]/g, '') === skuQuery.replace(/[\s\-]/g, '') ||
                 productMpn.replace(/[\s\-]/g, '') === skuQuery.replace(/[\s\-]/g, '');
        });
        
        console.log(`[AIService] Found ${skuProducts.length} products matching SKU "${skuQuery}"`);
        
        if (skuProducts.length > 0) {
          // Deduplicate and sort by availability
          const uniqueProducts = this.deduplicateProductsBySku(skuProducts);
          
          const availableProducts = uniqueProducts.filter(p => 
            p.availability?.toLowerCase().includes('in stock')
          );
          
          const finalSkuProducts = availableProducts.length > 0 ? availableProducts : uniqueProducts;
          
          // Build AI response for SKU query
          const skuMessages = this.buildMessages(message, conversationHistory, finalSkuProducts.slice(0, 10), siteId);
          
          const completion = await this.openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
            messages: skuMessages,
            temperature: 0.7,
            max_tokens: 500,
          });
          
          const aiMessage = completion.choices[0]?.message?.content || 
            `${skuQuery} kodlu ürünümüzü buldum! ${finalSkuProducts.length} farklı varyant mevcut.`;

          const updatedHistory: ChatMessage[] = [
            ...conversationHistory,
            { role: 'user', content: message, timestamp: new Date() },
            { role: 'assistant', content: aiMessage, timestamp: new Date() },
          ];

          return {
            message: aiMessage,
            recommendedProducts: finalSkuProducts.slice(0, 4),
            conversationHistory: updatedHistory,
            debug: {
              originalQuery: message,
              enhancedQuery: `SKU Search: ${skuQuery}`,
              isFollowUp: false,
            },
          };
        } else {
          // SKU not found, try fuzzy match
          const fuzzyProducts = this.findSimilarSkuProducts(products, skuQuery);
          
          if (fuzzyProducts.length > 0) {
            const fuzzyMessages = this.buildMessages(
              `Kullanıcı ${skuQuery} kodlu ürün arıyor ama tam eşleşme yok. Benzer kodlu ürünler öner.`,
              conversationHistory,
              fuzzyProducts,
              siteId
            );
            
            const completion = await this.openai.chat.completions.create({
              model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
              messages: fuzzyMessages,
              temperature: 0.7,
              max_tokens: 500,
            });

            const aiMessage = completion.choices[0]?.message?.content || 
              `${skuQuery} kodlu ürünü bulamadım, ancak benzer ürünlerimiz var.`;

            const updatedHistory: ChatMessage[] = [
              ...conversationHistory,
              { role: 'user', content: message, timestamp: new Date() },
              { role: 'assistant', content: aiMessage, timestamp: new Date() },
            ];

            return {
              message: aiMessage,
              recommendedProducts: fuzzyProducts.slice(0, 4),
              conversationHistory: updatedHistory,
              debug: {
                originalQuery: message,
                enhancedQuery: `Fuzzy SKU Search: ${skuQuery}`,
                isFollowUp: false,
              },
            };
          }
        }
      }

      // Check response cache (after SKU check to allow SKU queries to bypass cache)
      const cacheKey = this.buildCacheKey(message, conversationHistory);
      const cachedResponse = this.responseCache.get(cacheKey);
      if (cachedResponse) {
        console.log(`[AIService] Response cache HIT for: "${message}"`);
        return cachedResponse;
      }

      // CONTEXT-AWARE SEARCH: Build search query with conversation context
      // If user says "erkek için var mı", we need previous context (28 numara, ışıklı, ayakkabı)
      const searchQuery = this.buildSearchQuery(message, conversationHistory);
      const isFollowUp = searchQuery !== message; // Enhanced query indicates follow-up
      
      console.log(`[AIService] Original message: "${message}"`);
      console.log(`[AIService] Search query with context: "${searchQuery}"`);
      console.log(`[AIService] Is follow-up: ${isFollowUp}`);
      
      // Use hybrid search engine (BM25 + attribute boosting)
      // Fetch MORE products (100) so size filtering has enough candidates
      const relevantProducts = await this.cacheService.hybridSearch(siteId, searchQuery, 100);
      
      console.log(`[AIService] Hybrid search found ${relevantProducts.length} products`);
      console.log(`[AIService] Top 10 product sizes:`, relevantProducts.slice(0, 10).map(p => `${p.id}:${p.size}`).join(', '));
      
      // Apply additional filters and deduplication
      const finalProducts = this.postProcessResults(relevantProducts, searchQuery);
      
      // Check if user requested specific size but no products found
      // Let AI handle this case - it can suggest alternatives
      const requestedSize = extractSize(message);
      if (requestedSize && finalProducts.length === 0) {
        
        // Don't immediately give up - let AI suggest alternatives
        console.log(`[AIService] No products found for size ${requestedSize}, letting AI suggest alternatives`);
        
        // Get products without size filter for AI to suggest alternatives
        const allProducts = this.postProcessAlternatives(relevantProducts, message);
        
        if (allProducts.length === 0) {
          const errorMessage = `Üzgünüm, ${requestedSize} numara için stokta ürün bulamadım. Farklı bir numara denemek ister misiniz?`;
          const updatedHistory: ChatMessage[] = [
            ...conversationHistory,
            { role: 'user', content: message, timestamp: new Date() },
            { role: 'assistant', content: errorMessage, timestamp: new Date() },
          ];
          return {
            message: errorMessage,
            conversationHistory: updatedHistory,
          };
        }
        
        // Build messages with alternative products
        const altMessages = this.buildMessages(message, conversationHistory, allProducts, siteId);
        
        const completion = await this.openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
          messages: altMessages,
          temperature: 0.7,
          max_tokens: 500,
          presence_penalty: 0.6,
          frequency_penalty: 0.3,
        });

        const aiMessage = completion.choices[0]?.message?.content || 
          `Üzgünüm, ${requestedSize} numara için ürün bulamadım ama yakın bedenlerimiz var.`;

        const updatedHistory: ChatMessage[] = [
          ...conversationHistory,
          { role: 'user', content: message, timestamp: new Date() },
          { role: 'assistant', content: aiMessage, timestamp: new Date() },
        ];

        return {
          message: aiMessage,
          recommendedProducts: allProducts.slice(0, 4),
          conversationHistory: updatedHistory,
          debug: {
            originalQuery: message,
            enhancedQuery: searchQuery,
            isFollowUp,
          },
        };
      }
      
      const messages = this.buildMessages(message, conversationHistory, finalProducts, siteId);

      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
      });

      const aiMessage = completion.choices[0]?.message?.content || 'Üzgünüm, bir yanıt oluşturamadım.';

      const updatedHistory: ChatMessage[] = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: aiMessage, timestamp: new Date() },
      ];

      // Determine which products to show based on "wants more" pattern
      const wantsMore = /^(evet|başka|farklı|daha|göster|var mı|olur)/i.test(message.trim());
      const startIndex = wantsMore ? 4 : 0;
      const displayProducts = finalProducts.slice(startIndex, startIndex + 4);

      const response: ChatResponse = {
        message: aiMessage,
        recommendedProducts: displayProducts,
        conversationHistory: updatedHistory,
        debug: {
          originalQuery: message,
          enhancedQuery: searchQuery,
          isFollowUp,
        },
      };

      // Cache the response
      this.responseCache.set(cacheKey, response);

      return response;
    } catch (error) {
      console.error('AI Service Error:', error);
      const errorMessage = 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
      // Since we're in catch block, conversationHistory might not be accessible
      // Return minimal response with empty history
      return {
        message: errorMessage,
        conversationHistory: [],
      };
    }
  }

  /**
   * Post-process search results: deduplication, availability filtering, size filtering
   */
  private postProcessResults(products: Product[], query: string): Product[] {
    console.log(`[AIService] postProcessResults: input ${products.length} products`);
    
    // Extract attributes from query using utility functions
    const requestedSize = extractSize(query);
    const requestedColor = extractColor(query);
    const requestedBrand = extractBrand(query);
    const requestedGender = extractGender(query);
    
    console.log(`[AIService] Extracted filters:`, {
      size: requestedSize,
      color: requestedColor,
      brand: requestedBrand,
      gender: requestedGender
    });
    
    const hasColorKeyword = requestedColor !== null;

    // ✨ CRITICAL FIX: Category hard filtering
    // If user explicitly mentions a category, ONLY show that category
    const normalizeText = (text: string) => normalizeTurkish(text.toLowerCase());
    const normalizedQuery = normalizeText(query);
    
    const categoryKeywords = {
      'ayakkabi': ['ayakkab', 'shoe', 'sneaker', 'spor ayak'],
      'bot': ['bot', 'boot'],
      'canta': ['canta', 'bag', 'backpack'],
      'terlik': ['terlik', 'sandal'],
      'corap': ['corap', 'sock'],
      'tshirt': ['tshirt', 't-shirt', 'tisort', 'ust giyim'],
      'sort': ['sort', 'short'],
      'esofman': ['esofman', 'tracksuit', 'jogger'],
    };
    
    let requiredCategory: string[] | null = null;
    for (const [catName, catVariants] of Object.entries(categoryKeywords)) {
      for (const variant of catVariants) {
        if (normalizedQuery.includes(variant)) {
          requiredCategory = catVariants;
          console.log(`[AIService] 🏷️ CATEGORY FILTER: "${catName}" -> must match:`, catVariants.join(', '));
          break;
        }
      }
      if (requiredCategory) break;
    }

    // Apply category filter FIRST
    let filtered = products;
    if (requiredCategory) {
      filtered = products.filter(p => {
        const pType = normalizeText(p.productType || '');
        const pTitle = normalizeText(p.title);
        const hasCategory = requiredCategory!.some(cat => pType.includes(cat) || pTitle.includes(cat));
        return hasCategory;
      });
      console.log(`[AIService] ✅ After category filter: ${products.length} -> ${filtered.length} products`);
    }

    // Filter out of stock products
    filtered = filtered.filter(p => {
      const availability = p.availability?.toLowerCase() || '';
      return availability.includes('in stock') || availability.includes('stokta') || !p.availability;
    });
    
    console.log(`[AIService] After stock filter: ${filtered.length} products`);
    
    // Filter out kids products when user asks for adult sizes (>= 40)
    if (requestedSize && parseFloat(requestedSize) >= 40) {
      const adultFiltered = filtered.filter(p => {
        const category = (p.productType || '').toLowerCase();
        // Exclude kids/children categories
        return !category.includes('çocuk') && !category.includes('cocuk') && 
               !category.includes('kids') && !category.includes('children');
      });
      
      console.log(`[AIService] Adult category filter: ${filtered.length} -> ${adultFiltered.length} products`);
      
      // Only apply if we have adult products
      if (adultFiltered.length > 0) {
        filtered = adultFiltered;
      }
    }

    // SMART: Size filter with fallback to nearby sizes
    if (requestedSize) {
      console.log(`[AIService] 🎯 SIZE FILTER: Requested size = ${requestedSize}`);
      const availableSizes = [...new Set(filtered.map(p => p.size).filter(Boolean))];
      console.log(`[AIService] Available sizes (${availableSizes.length}):`, availableSizes.slice(0, 20).join(', '));
      
      // Try exact match first
      const exactSizeFiltered = this.filterByExactSize(filtered, requestedSize);
      
      console.log(`[AIService] ✓ Exact size (${requestedSize}): ${exactSizeFiltered.length} products`);
      
      if (exactSizeFiltered.length >= 3) {
        // Enough exact matches - use them!
        filtered = exactSizeFiltered;
        console.log(`[AIService] ✅ Using exact size matches`);
      } else if (exactSizeFiltered.length > 0) {
        // Some exact matches but not many - keep them but also try nearby
        const nearbySizeFiltered = this.filterByNearbySize(filtered, requestedSize, 1.0);
        console.log(`[AIService] ⚠️ Only ${exactSizeFiltered.length} exact - trying nearby: ${nearbySizeFiltered.length}`);
        
        if (nearbySizeFiltered.length > exactSizeFiltered.length * 2) {
          // Nearby sizes give much more results
          filtered = nearbySizeFiltered;
          console.log(`[AIService] ✅ Using nearby sizes (±1)`);
        } else {
          filtered = exactSizeFiltered;
          console.log(`[AIService] ✅ Using exact size matches (few nearby)`);
        }
      } else {
        // NO exact match - try nearby sizes (±1)
        const nearbySizeFiltered = this.filterByNearbySize(filtered, requestedSize, 1.0);
        console.log(`[AIService] ❌ No exact match - trying nearby (±1): ${nearbySizeFiltered.length}`);
        
        if (nearbySizeFiltered.length === 0) {
          // Still nothing - try wider range (±2)
          const widerSizeFiltered = this.filterByNearbySize(filtered, requestedSize, 2.0);
          console.log(`[AIService] ❌ No nearby - trying wider (±2): ${widerSizeFiltered.length}`);
          filtered = widerSizeFiltered;
        } else {
          filtered = nearbySizeFiltered;
        }
      }
    }
    
    // Brand filter (if extracted)
    if (requestedBrand && filtered.length > 0) {
      const brandFiltered = filtered.filter(p => 
        p.brand?.toLowerCase().includes(requestedBrand.toLowerCase())
      );
      console.log(`[AIService] 🏷️ Brand filter (${requestedBrand}): ${filtered.length} -> ${brandFiltered.length}`);
      if (brandFiltered.length > 0) {
        filtered = brandFiltered;
      }
    }
    
    // Gender filter (if extracted)
    if (requestedGender && filtered.length > 0) {
      const genderFiltered = filtered.filter(p => {
        const productGender = p.gender?.toLowerCase() || '';
        const productType = p.productType?.toLowerCase() || '';
        const targetGender = requestedGender.toLowerCase();
        
        // Match gender or unisex
        return productGender.includes(targetGender) || 
               productGender.includes('unisex') ||
               productType.includes(targetGender === 'male' ? 'erkek' : 'kadın');
      });
      console.log(`[AIService] 👤 Gender filter (${requestedGender}): ${filtered.length} -> ${genderFiltered.length}`);
      if (genderFiltered.length > 0) {
        filtered = genderFiltered;
      }
    }

    // Apply deduplication if needed
    const hasSizeKeyword = Boolean(requestedSize);
    if (!hasColorKeyword || !hasSizeKeyword) {
      const deduplicated = this.deduplicateProducts(filtered, hasColorKeyword, hasSizeKeyword);
      console.log(`[AIService] After deduplication: ${deduplicated.length} products`);
      return deduplicated;
    }

    console.log(`[AIService] Final results: ${filtered.length} products`);
    return filtered.slice(0, 10);
  }

  /**
   * Post-process for alternative suggestions (no size filter, only stock)
   * Used when exact size not found to suggest nearby sizes
   */
  private postProcessAlternatives(products: Product[], query: string): Product[] {
    console.log(`[AIService] postProcessAlternatives: input ${products.length} products`);
    
    const hasColorKeyword = /beyaz|siyah|white|black|k[ıi]rm[ıi]z[ıi]|mavi|ye[şs]il|gri/i.test(query);
    
    // Extract requested size to filter by nearby sizes
    const sizeMatch = query.match(/\b(\d{1,2}(?:\.\d)?)\s*(?:numara|beden|size)?\b/i);
    const requestedSize = sizeMatch ? sizeMatch[1] : null;

    // Filter out of stock products
    let filtered = products.filter(p => {
      const availability = p.availability?.toLowerCase() || '';
      return availability.includes('in stock') || availability.includes('stokta') || !p.availability;
    });
    
    console.log(`[AIService] After stock filter: ${filtered.length} products`);
    
    // If size was requested, filter for nearby sizes (±2 sizes for alternatives)
    if (requestedSize) {
      const nearbySizeFiltered = this.filterByNearbySize(filtered, requestedSize, 2.0);
      
      console.log(`[AIService] Nearby size filter (±2) for alternatives: ${filtered.length} -> ${nearbySizeFiltered.length} products`);
      filtered = nearbySizeFiltered;
    }
    
    // Filter out kids products when user asks for adult sizes (>= 40)
    if (requestedSize && parseFloat(requestedSize) >= 40) {
      const adultFiltered = filtered.filter(p => {
        const category = (p.productType || '').toLowerCase();
        // Exclude kids/children categories
        return !category.includes('çocuk') && !category.includes('cocuk') && 
               !category.includes('kids') && !category.includes('children');
      });
      
      console.log(`[AIService] Adult category filter: ${filtered.length} -> ${adultFiltered.length} products`);
      
      // Only apply if we have adult products
      if (adultFiltered.length > 0) {
        filtered = adultFiltered;
      }
    }

    // Light deduplication (keep more variety for alternatives)
    const deduplicated = this.deduplicateProducts(filtered, hasColorKeyword, false);
    console.log(`[AIService] After deduplication: ${deduplicated.length} products`);
    
    return deduplicated.slice(0, 10);
  }

  /**
   * Deduplicate products by model (keeping highest scored variant)
   * Updated: Uses product.id as primary deduplication key to prevent same product variants
   */
  private deduplicateProducts(products: Product[], hasColor: boolean, hasSize: boolean): Product[] {
    const seenKeys = new Set<string>();
    const deduplicated: Product[] = [];

    for (const product of products) {
      let dedupeKey: string;

      // Primary deduplication: Use product ID to prevent exact duplicates
      const productIdBase = product.id.split(/\s+/)[0]; // Get base ID without variants
      
      if (!hasColor && !hasSize) {
        // No color or size -> dedupe by base product ID only (prevents variant duplicates)
        dedupeKey = productIdBase;
      } else if (hasColor && !hasSize) {
        // Has color but no size -> group by base ID + color (show one per color)
        dedupeKey = `${productIdBase}_${product.color || ''}`;
      } else if (!hasColor && hasSize) {
        // Has size but no color -> group by base ID + size (show one per size)
        dedupeKey = `${productIdBase}_${product.size || ''}`;
      } else {
        // Has both color and size -> show specific variant
        dedupeKey = `${productIdBase}_${product.color || ''}_${product.size || ''}`;
      }

      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        deduplicated.push(product);
      }
    }

    return deduplicated;
  }

  /**
   * Extract model key from product title (remove color and size codes)
   */
 private extractModelKey(title: string): string {
    return title
      .replace(/\s+(BLK|WHT|BLU|RED|GRY|BBK|WSL|NVY|PNK|GRN|YLW|ORG|PRP|MLT|BKMT|CCMT|CHAR|GYBK|GYMT|NVHP|NVRD|OFBK|OFMT|TAN|TPE|DKTP|OLBK|GYBL|NVBL|NVLM|NVGR|NVPK|TPBK|OFWT|NVCC|TPMT|BKFS|BKRG|CHBK|GYAQ|NVAQ|TPAQ|WBK|WMLT|WNVY|WTPK)\s*$/i, '')
      .replace(/\s+\d{1,2}(\.\d)?$/i, '')
      .trim();
  }

  /**
   * Legacy method kept for backward compatibility
   * Now just redirects to hybrid search
   */
  // @ts-ignore - Kept for backward compatibility
  private findRelevantProducts(products: Product[], query: string): Product[] {
    const lowerQuery = query.toLowerCase();
    
    const normalizeText = (text: string) => 
      text.toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');
    
    const normalizedQuery = normalizeText(lowerQuery);
    
    // Extract size/number patterns
    const sizePattern = /\b(\d{1,2})\s*(numara|beden|size)?\b/i;
    const sizeMatch = query.match(sizePattern);
    const searchedSize = sizeMatch ? sizeMatch[1] : null;
    
    // Extract price limit (e.g., "4000 liradan ucuz", "1000 TL altı")
    const pricePattern = /(\d+)\s*(lira|tl)?\s*(dan|den|altı|az|ucuz|üstü|üzeri|fazla)/i;
    const priceMatch = query.match(pricePattern);
    let maxPrice = null;
    let minPrice = null;
    
    if (priceMatch) {
      const priceValue = parseFloat(priceMatch[1]);
      const priceQualifier = priceMatch[3]?.toLowerCase();
      
      if (priceQualifier.includes('dan') || priceQualifier.includes('den') || 
          priceQualifier.includes('ucuz') || priceQualifier.includes('alt') || 
          priceQualifier.includes('az')) {
        maxPrice = priceValue;
      } else if (priceQualifier.includes('üst') || priceQualifier.includes('üzer') || 
                 priceQualifier.includes('fazla')) {
        minPrice = priceValue;
      }
    }
    
    // Extract color from query
    const colorMap = {
      'beyaz': ['beyaz', 'white', 'wht', 'wsl'],
      'siyah': ['siyah', 'black', 'blk', 'bbk'],
      'kirmizi': ['kirmizi', 'kırmızı', 'red'],
      'mavi': ['mavi', 'blue', 'blu'],
      'yesil': ['yesil', 'yeşil', 'green'],
      'gri': ['gri', 'gray', 'grey'],
      'sari': ['sari', 'sarı', 'yellow'],
      'pembe': ['pembe', 'pink'],
      'turuncu': ['turuncu', 'orange'],
      'mor': ['mor', 'purple'],
    };
    
    let searchedColor: string | null = null;
    let searchedColorVariants: string[] = [];
    
    for (const [colorKey, variants] of Object.entries(colorMap)) {
      for (const variant of variants) {
        if (normalizedQuery.includes(variant)) {
          searchedColor = colorKey;
          searchedColorVariants = variants;
          break;
        }
      }
      if (searchedColor) break;
    }
    
    // Include shorter keywords (for size numbers like 43)
    const keywords = normalizedQuery.split(/\s+/).filter((w) => w.length > 1);
    
    // Category synonyms - expand keywords with common synonyms
    const categorySynonyms: { [key: string]: string[] } = {
      'canta': ['canta', 'bag', 'backpack', 'sirt cantasi', 'omuz cantasi'],
      'bag': ['canta', 'bag', 'backpack'],
      'backpack': ['canta', 'bag', 'backpack', 'sirt cantasi'],
      'bot': ['bot', 'boot', 'cizme'],
      'boot': ['bot', 'boot', 'cizme'],
      'cizme': ['bot', 'boot', 'cizme'],
      'terlik': ['terlik', 'sandal', 'sandalet', 'slipper'],
      'sandal': ['terlik', 'sandal', 'sandalet', 'slipper'],
      'sneaker': ['sneaker', 'spor ayakkabi', 'ayakkabi'],
      'corap': ['corap', 'sock', 'socks'],
    };
    
    // Expand keywords with synonyms
    const expandedKeywords = new Set<string>();
    const originalKeywords = new Set(keywords);
    keywords.forEach(keyword => {
      expandedKeywords.add(keyword);
      if (categorySynonyms[keyword]) {
        categorySynonyms[keyword].forEach(syn => expandedKeywords.add(syn));
      }
    });
    const allKeywords = Array.from(expandedKeywords);

    // Only keep broad demographic filters
    const demographics = {
      kids: /çocuk|kids|child|bebek|baby/i.test(query),
      men: /erkek|men|adam|bay/i.test(query),
      women: /kadın|women|bayan/i.test(query),
    };

    // ✨ CRITICAL FIX: Category hard filtering
    // If user explicitly mentions a category, ONLY show that category
    const categoryKeywords = {
      'ayakkabi': ['ayakkab', 'shoe', 'sneaker', 'spor ayak'],
      'bot': ['bot', 'boot'],
      'canta': ['canta', 'bag', 'backpack'],
      'terlik': ['terlik', 'sandal'],
      'corap': ['corap', 'sock'],
      'tshirt': ['tshirt', 't-shirt', 'tisort', 'ust giyim'],
      'sort': ['sort', 'short'],
      'esofman': ['esofman', 'tracksuit', 'jogger'],
    };
    
    let requiredCategory: string[] | null = null;
    for (const [catName, catVariants] of Object.entries(categoryKeywords)) {
      for (const variant of catVariants) {
        if (normalizedQuery.includes(variant)) {
          requiredCategory = catVariants;
          console.log(`[AIService] 🏷️ Category filter active: "${catName}" -> productType must contain one of:`, catVariants.slice(0, 3));
          break;
        }
      }
      if (requiredCategory) break;
    }

    // Filter: in stock products + price range + CATEGORY
    const eligibleProducts = products.filter((p) => {
      // Check availability
      const availability = p.availability?.toLowerCase() || '';
      const isInStock = availability.includes('in stock') || availability.includes('stokta') || !p.availability;
      if (!isInStock) return false;
      
      // Check price range
      if (maxPrice || minPrice) {
        const productPrice = this.extractPrice(p.salePrice || p.price);
        if (productPrice) {
          if (maxPrice && productPrice > maxPrice) return false;
          if (minPrice && productPrice < minPrice) return false;
        }
      }
      
      // ✨ NEW: Category hard filter
      if (requiredCategory) {
        const pType = normalizeText(p.productType || '');
        const pTitle = normalizeText(p.title);
        const hasCategory = requiredCategory.some(cat => pType.includes(cat) || pTitle.includes(cat));
        if (!hasCategory) return false; // ❌ Wrong category, filter out!
      }
      
      return true;
    });

    console.log(`[AIService] After category filter: ${products.length} -> ${eligibleProducts.length} products`);

    const scored = eligibleProducts.map((product) => {
      let score = 0;
      const productText = normalizeText(`${product.title} ${product.description} ${product.productType || ''} ${product.googleProductCategory || ''}`);
      const productTitle = normalizeText(product.title);
      const productTypeNorm = normalizeText(product.productType || '');
      
      // Check size match (high priority)
      if (searchedSize && product.size) {
        const productSize = product.size.toString().trim();
        if (productSize === searchedSize || productSize.includes(searchedSize)) {
          score += 30; // High score for exact size match
        }
      }
      
      // Check color match (very high priority)
      if (searchedColor && product.color) {
        const productColorNorm = normalizeText(product.color);
        let colorMatch = false;
        let colorMismatch = false;
        
        // Check if product color matches searched color
        for (const variant of searchedColorVariants) {
          if (productColorNorm.includes(variant)) {
            score += 35; // Very high score for color match
            colorMatch = true;
            break;
          }
        }
        
        // Penalty for wrong color (check against other colors)
        if (!colorMatch) {
          for (const [otherColorKey, otherVariants] of Object.entries(colorMap)) {
            if (otherColorKey !== searchedColor) {
              for (const variant of otherVariants) {
                if (productColorNorm.includes(variant)) {
                  score -= 20; // Penalty for wrong color
                  colorMismatch = true;
                  break;
                }
              }
              if (colorMismatch) break;
            }
          }
        }
      }
      
      keywords.forEach((keyword) => {
        // Skip color keywords as we handle them separately
        const isColorKeyword = searchedColorVariants.includes(keyword);
        if (!isColorKeyword) {
          // High priority: keyword in title
          if (productTitle.includes(keyword)) score += 15;
          
          // Very high priority: keyword in product category/type
          if (productTypeNorm.includes(keyword)) score += 20;
          
          // Medium priority: keyword in description or other text
          if (productText.includes(keyword)) score += 5;
          
          // Lower priority: brand match
          if (product.brand && normalizeText(product.brand).includes(keyword)) score += 3;
        }
      });
      
      // Check expanded keywords (synonyms) for better category matching
      allKeywords.forEach((keyword) => {
        if (originalKeywords.has(keyword)) return; // Skip already processed original keywords
        
        const productType = normalizeText(product.productType || '');
        // Synonym match in category is very important - same as original keyword
        if (productType.includes(keyword)) score += 20;
        // Synonym match in title is also high priority
        if (productTitle.includes(keyword)) score += 15;
        // Synonym in description
        if (productText.includes(keyword)) score += 5;
      });

      // Demographics scoring (only broad categories)
      if (demographics.kids && /çocuk|kids|child/i.test(productText)) score += 20;
      if (demographics.men && /erkek|men|adam/i.test(productText)) score += 10;
      if (demographics.women && /kadın|women|bayan/i.test(productText)) score += 10;

      if (product.brand?.toLowerCase() === 'high5') score += 2;

      return { product, score };
    });

    // Sort by score
    const sorted = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    // DEBUG: Log top 10 scores
    console.log(`[AIService] 🎯 Top 10 scores:`, sorted.slice(0, 10).map(s => ({
      score: s.score,
      title: s.product.title.substring(0, 50),
      productType: s.product.productType?.substring(0, 30) || 'N/A'
    })));

    // Deduplicate products based on what user specified
    let deduplicated = sorted;
    const seenKeys = new Set<string>();
    deduplicated = [];
    
    for (const item of sorted) {
      let dedupeKey: string;
      
      // Build deduplication key based on what user DID NOT specify
      if (!searchedColor && !searchedSize) {
        // No color or size specified -> dedupe by model only (ignore both color and size)
        dedupeKey = item.product.title
          .replace(/\s+(BLK|WHT|BLU|RED|GRY|BBK|WSL|NVY|PNK|GRN|YLW|ORG|PRP|MLT|BKMT|CCMT|CHAR|GYBK|GYMT|NVHP|NVRD|OFBK|OFMT|TAN|TPE|DKTP|OLBK|GYBL|NVBL|NVLM|NVGR|NVPK|TPBK|OFWT|NVCC|TPMT|BKFS|BKRG|CHBK|GYAQ|NVAQ|TPAQ|WBK|WMLT|WNVY|WTPK)\s*$/i, '')
          .replace(/\s+\d{1,2}(\.\d)?$/i, '')
          .trim();
      } else if (searchedColor && !searchedSize) {
        // Color specified but not size -> dedupe by model+color (same model+color, different sizes = duplicate)
        dedupeKey = `${item.product.title.replace(/\s+\d{1,2}(\.\d)?$/i, '').trim()}_${item.product.color || ''}`;
      } else if (!searchedColor && searchedSize) {
        // Size specified but not color -> dedupe by model+size (same model+size, different colors = duplicate)
        dedupeKey = `${item.product.title.replace(/\s+(BLK|WHT|BLU|RED|GRY|BBK|WSL|NVY|PNK|GRN|YLW|ORG|PRP|MLT|BKMT|CCMT|CHAR|GYBK|GYMT|NVHP|NVRD|OFBK|OFMT|TAN|TPE|DKTP|OLBK|GYBL|NVBL|NVLM|NVGR|NVPK|TPBK|OFWT|NVCC|TPMT|BKFS|BKRG|CHBK|GYAQ|NVAQ|TPAQ|WBK|WMLT|WNVY|WTPK)\s*$/i, '').trim()}_${item.product.size || ''}`;
      } else {
        // Both color and size specified -> no deduplication, show all exact matches
        dedupeKey = item.product.id + '_' + (item.product.color || '') + '_' + (item.product.size || '');
      }
      
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        deduplicated.push(item);
      }
    }

    // Take top scoring products first (no diversification for highly relevant results)
    // If we have many products with similar high scores, then diversify
    const topScore = deduplicated[0]?.score || 0;
    const highScoreThreshold = topScore * 0.7; // Products with 70%+ of top score
    
    const highScoreProducts = deduplicated.filter(s => s.score >= highScoreThreshold);
    const lowerScoreProducts = deduplicated.filter(s => s.score < highScoreThreshold);
    
    // For high-score products: prioritize relevance, minimal diversification
    const results: Product[] = [];
    const usedCategories = new Set<string>();
    
    // Adaptive minimum score threshold
    // If top score is high, require meaningful relevance
    // If top score is low, be more lenient
    const minRelevanceScore = topScore > 30 ? 10 : 5;
    
    // Add high-scoring products (max 6)
    for (const item of highScoreProducts) {
      if (results.length >= 6) break;
      if (item.score < minRelevanceScore) continue; // Skip low-relevance products
      results.push(item.product);
      const category = item.product.productType || '';
      usedCategories.add(category);
    }
    
    // If we need more products, add diverse lower-scored ones (max 4 more)
    for (const item of lowerScoreProducts) {
      if (results.length >= 10) break;
      if (item.score < minRelevanceScore) continue; // Skip low-relevance products
      
      const category = item.product.productType || '';
      
      // Only add if different category for diversity
      if (!usedCategories.has(category)) {
        results.push(item.product);
        usedCategories.add(category);
      }
    }
    
    // Fallback: if no products found with score threshold, return top 4 products anyway
    if (results.length === 0 && deduplicated.length > 0) {
      return deduplicated.slice(0, 4).map(item => item.product);
    }

    return results;
  }

  private buildMessages(
    userMessage: string,
    history: ChatMessage[],
    products: Product[],
    siteId: string
  ): any[] {
    // Check if user is asking for more products
    const wantsMore = /^(evet|başka|farklı|daha|göster|var mı|olur)/i.test(userMessage.trim());
    const startIndex = wantsMore ? 4 : 0; // Skip first 4 if asking for more
    
    const topProducts = products.slice(startIndex, startIndex + 4); // Show exactly 4 products
    
    // Extract requested size from user message
    const sizeMatch = userMessage.match(/\b(\d{1,2}(?:\.\d)?)\s*(?:numara|beden|size)?\b/i);
    const requestedSize = sizeMatch ? sizeMatch[1] : null;
    
    // Extract price range from user message
    const priceMatch = userMessage.match(/(\d{3,5})\s*-?\s*(\d{3,5})?/);
    let priceNote = '';
    if (priceMatch) {
      const minPrice = priceMatch[1];
      const maxPrice = priceMatch[2] || minPrice;
      priceNote = `\n\nÖNEMLİ: Müşteri ${minPrice}-${maxPrice} TL fiyat aralığı istiyor. Bu aralıktaki ürünlere öncelik ver!`;
    }
    
    // Extract category keywords
    const categoryMatch = /sneker|sneaker|ayakkab[ıi]|bot|terlik|[çc]orap|[çc]anta/i.exec(userMessage);
    const requestedCategory = categoryMatch ? categoryMatch[0] : null;
    
    // Check if we have exact size match or nearby sizes
    let sizeNote = '';
    if (requestedSize) {
      const hasExactSize = topProducts.some(p => {
        const productSize = String(p.size || '').trim();
        const querySizeNum = parseFloat(requestedSize);
        const productSizeNum = parseFloat(productSize);
        return productSize === requestedSize || 
               (!isNaN(productSizeNum) && !isNaN(querySizeNum) && productSizeNum === querySizeNum);
      });
      
      if (hasExactSize) {
        sizeNote = `\n\nÖNEMLİ: Müşteri ${requestedSize} numara istiyor. Önce ${requestedSize} numaralı ürünleri öner!`;
      } else {
        // Nearby sizes available
        sizeNote = `\n\nÖNEMLİ: Müşteri ${requestedSize} numara istiyor ama tam bu bedende stok yok. Yakın bedenleri (${parseFloat(requestedSize) - 1}, ${parseFloat(requestedSize) + 1}) öner ve "istediğiniz beden stokta yok ama yakın bedenler mevcut" diye belirt.`;
      }
    }
    
    const categoryNote = requestedCategory
      ? `\nMüşteri "${requestedCategory}" arıyor. Sadece bu kategoriye uygun ürünleri öner. Örneğin sneaker isteyen müşteriye çorap önerme!`
      : '';
    
    const systemPrompt = `${siteId} alışveriş danışmanısın. 

ÖNEMLİ KURALLAR:
1. SADECE aşağıdaki 4 üründen bahset - başka ürün ekleme!
2. Her ürünü kısaca tanıt: Marka + Model + Fiyat + Öne çıkan özellik
3. İndirim varsa mutlaka belirt
4. Müşterinin kriterlerine uygunluğu vurgula
5. Cevabını bitirmeden önce sor: "Başka ürün önerileri görmek ister misiniz?"${sizeNote}${priceNote}${categoryNote}

ÖNERECEĞİN 4 ÜRÜN:
${topProducts.map((p, i) => {
      const discount = p.salePrice ? this.calculateDiscount(p.price, p.salePrice) : null;
      const price = discount?.hasDiscount 
        ? `${discount.newPrice} (%${discount.discountPercent} İNDİRİM, eski: ${discount.oldPrice})`
        : this.parsePrice(p.salePrice || p.price);
      
      const specs = [p.gender, p.color, p.size].filter(Boolean).join(', ');
      return `${i + 1}. ${p.brand || ''} ${p.title}\n   Fiyat: ${price}\n   Özellik: ${specs || 'Standart'}`;
    }).join('\n\n')}

ÖRNEK CEVAP:
"Size 45 numara erkek koşu ayakkabıları buldum:

1. HOKA Bondi 9 - 7.999 TL (Erkek, 45 numara)
2. ON Cloudmonster 2 - 8.500 TL (%20 İNDİRİM, Erkek, 45)
3. ASICS Gel-Nimbus - 6.800 TL (Erkek, Siyah, 45)
4. Saucony Guide 18 - 6.999 TL (%30 İNDİRİM, Erkek, 45)

Başka ürün önerileri görmek ister misiniz?"`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Reduced history from 5 to 3 for token efficiency
    const recentHistory = history.slice(-3);
    recentHistory.forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    messages.push({
      role: 'user',
      content: userMessage,
    });

    return messages;
  }

  private parsePrice(priceStr: string): string {
    const match = priceStr.match(/[\d.,]+/);
    if (match) {
      const price = parseFloat(match[0].replace(',', '.'));
      return `${price.toFixed(2)} TL`;
    }
    return priceStr;
  }

  private extractPrice(priceStr: string): number | null {
    const match = priceStr.match(/[\d.,]+/);
    if (match) {
      return parseFloat(match[0].replace(',', '.'));
    }
    return null;
  }

  private calculateDiscount(price: string, salePrice: string): { hasDiscount: boolean; discountPercent: number; oldPrice: string; newPrice: string } {
    const priceMatch = price.match(/[\d.,]+/);
    const salePriceMatch = salePrice.match(/[\d.,]+/);
    
    if (!priceMatch || !salePriceMatch) {
      return { hasDiscount: false, discountPercent: 0, oldPrice: price, newPrice: price };
    }
    
    const oldPrice = parseFloat(priceMatch[0].replace(',', '.'));
    const newPrice = parseFloat(salePriceMatch[0].replace(',', '.'));
    
    if (newPrice < oldPrice) {
      const discountPercent = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
      return {
        hasDiscount: true,
        discountPercent,
        oldPrice: `${oldPrice.toFixed(2)} TL`,
        newPrice: `${newPrice.toFixed(2)} TL`,
      };
    }
    
    return { hasDiscount: false, discountPercent: 0, oldPrice: this.parsePrice(price), newPrice: this.parsePrice(price) };
  }

  /**
   * Build search query with conversation context
   * Handles follow-up questions like "erkek için var mı" by including previous context
   */
  private buildSearchQuery(currentMessage: string, history: ChatMessage[]): string {
    const normalized = currentMessage.toLowerCase().trim()
      // Normalize Turkish characters for pattern matching
      .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
    
    // Check if current message is a simple continuation request
    const isContinuationRequest = 
      /^(evet|tamam|olur|goster|yes|ok)(\s+(lutfen|please))?$/i.test(normalized) ||
      /^(lutfen|please)$/i.test(normalized) ||
      /(baska|daha\s*(fazla|cok)|more|diger|other|farkli).*(urun|product|var|goster|show|oneri)/i.test(normalized) ||
      /(bunlar(dan)?\s*baska|bunun\s*disinda)/i.test(normalized);
    
    if (isContinuationRequest && history.length > 0) {
      // Find the most recent user message with product context
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'user') {
          const userMsg = history[i].content;
          // Check if it contains meaningful search criteria
          const hasSearchContext = 
            /\d{1,2}(?:\.\d)?\s*(numara|beden|size)/i.test(userMsg) ||
            /(ayakkab[ıi]|bot|sneaker|koşu|kosu|terlik|[çc]orap|[çc]anta|bag)/i.test(userMsg) ||
            /(erkek|kad[ıi]n|kadin|unisex|[çc]ocuk)/i.test(userMsg) ||
            /\d{3,5}\s*-?\s*\d{0,5}\s*(tl|₺)/i.test(userMsg); // Price range
          
          if (hasSearchContext) {
            console.log(`[AIService] ✓ Continuation request detected, reusing context: "${userMsg}"`);
            return userMsg; // Reuse the entire search query
          }
        }
      }
    }
    
    // Check if current message is context-dependent (short follow-up question)
    const isFollowUpQuestion = 
      // Questions about variations
      /^(erkek|kadin|kiz|unisex|beyaz|siyah|kirmizi|mavi).*(var\s*m[ıi]|olur\s*mu|bulunur\s*mu)/i.test(normalized) ||
      // Short modifications
      /^(erkek|kadin|kiz|unisex|beyaz|siyah|kirmizi|mavi).*(icin|olsun|istiyorum)/i.test(normalized) ||
      // Question words without product type
      (/(var\s*m[ıi]|olur\s*mu|bulunur\s*mu)/i.test(normalized) && normalized.split(/\s+/).length <= 5);
    
    if (!isFollowUpQuestion || history.length === 0) {
      // Standalone question or no history - use as is
      return currentMessage;
    }
    
    // Find last user message with product context
    let lastUserContext = '';
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        const userMsg = history[i].content.toLowerCase();
        // Check if it contains product context (size, category, features)
        const hasSize = /\d{1,2}(?:\.\d)?\s*(numara|beden|size)/i.test(userMsg);
        const hasCategory = /(ayakkab[ıi]|bot|sneaker|terlik|[çc]orap|[çc]anta|bag|backpack|yelek|vest|mont|jacket)/i.test(userMsg);
        const hasFeature = /(spor|ışıklı|su\s*ge[çc]irmez|hafif|rahat|outdoor|indoor|running)/i.test(userMsg);
        
        if (hasSize || hasCategory || hasFeature) {
          lastUserContext = history[i].content;
          break;
        }
      }
    }
    
    if (!lastUserContext) {
      return currentMessage;
    }
    
    // Extract key attributes from previous context
    const sizeMatch = lastUserContext.match(/(\d{1,2}(?:\.\d)?)\s*(?:numara|beden|size)?/i);
    const categoryMatch = lastUserContext.match(/(ayakkab[ıi]|bot|sneaker|terlik|[çc]orap|[çc]anta|bag|backpack|yelek|vest|mont|jacket)/i);
    const featureMatch = lastUserContext.match(/(spor|ışıklı|su\s*ge[çc]irmez|hafif|rahat|outdoor|indoor|running|koşu)/i);
    const childMatch = lastUserContext.match(/(bebek|[çc]ocuk)/i);
    
    // Build enhanced query
    const contextParts: string[] = [];
    
    if (sizeMatch) contextParts.push(`${sizeMatch[1]} numara`);
    if (childMatch) contextParts.push(childMatch[1]);
    if (categoryMatch) contextParts.push(categoryMatch[1]);
    if (featureMatch) contextParts.push(featureMatch[1]);
    
    // Combine with current message (which usually modifies gender/color)
    const enhancedQuery = `${contextParts.join(' ')} ${currentMessage}`;
    
    return enhancedQuery;
  }

  /**
   * Build cache key from query and conversation history
   * Only considers last 2 user messages for context (keeps cache keys simpler)
   */
  private buildCacheKey(message: string, history: ChatMessage[]): string {
    const normalized = message.toLowerCase().trim();
    
    // Include last 2 user messages for context
    const recentContext = history
      .filter(m => m.role === 'user')
      .slice(-2)
      .map(m => m.content.toLowerCase().trim())
      .join('|');
    
    return recentContext ? `${recentContext}::${normalized}` : normalized;
  }

  /**
   * Check if query is irrelevant to product search
   * Returns a friendly response if query is irrelevant, null otherwise
   */
  private checkIrrelevantQuery(message: string, siteId: string, conversationHistory: ChatMessage[]): ChatResponse | null {
    const normalized = message.toLowerCase().trim();
    
    // GUARD CLAUSE: Very simple check for weather queries
    if (normalized.includes('hava') || normalized.includes('weather') || 
        normalized.includes('derece') || normalized.includes('degree')) {
      console.log(`[AIService] GUARD: Weather query detected`);
      return this.generateIrrelevantResponse('hava', siteId, message, conversationHistory);
    }
    
    // GUARD CLAUSE: Store location queries
    if ((normalized.includes('mağaza') || normalized.includes('magaza') || normalized.includes('store') || 
         normalized.includes('şube') || normalized.includes('sube')) && 
        (normalized.includes('nerede') || normalized.includes('istanbul') || normalized.includes('ankara') || 
         normalized.includes('where') || normalized.includes('hangi'))) {
      console.log(`[AIService] GUARD: Store location query detected`);
      return this.generateIrrelevantResponse('magaza', siteId, message, conversationHistory);
    }
    
    // Normalize Turkish characters for better matching
    const normalizeText = (text: string) => 
      text.toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');
    
    const normalizedQuery = normalizeText(normalized);
    console.log(`[AIService] Checking irrelevant query: "${message}" -> normalized: "${normalizedQuery}"`);
    
    // Quick check for common irrelevant queries
    const quickChecks = [
      { pattern: /hava/, type: 'hava' },
      { pattern: /weather/, type: 'hava' },
      { pattern: /(magaza|store|sube).*(nerede|istanbulda|ankarada)/, type: 'magaza' },
      { pattern: /nerede.*(bulabilirim|magaza)/, type: 'magaza' },
    ];
    
    for (const check of quickChecks) {
      if (check.pattern.test(normalizedQuery)) {
        console.log(`[AIService] ✓ Quick check matched: ${check.pattern}`);
        return this.generateIrrelevantResponse(check.type, siteId, message, conversationHistory);
      }
    }
    
    // Patterns for irrelevant queries (using normalized text without Turkish chars)
    // Note: Avoid \b word boundaries as they don't work well with normalized text
    const irrelevantPatterns = [
      // Weather queries - expanded patterns
      /(hava|weather).*(nasil|ne|kac|how|what)/i,
      /(bugun|yarin|bu\s*hafta|tomorrow|today).*(hava|weather)/i,
      /(hava|weather).*(derece|sicaklik|temperature|yagmur|kar|rain|snow)/i,
      /(derece|degree|sicaklik|temperature)/i,
      
      // Store location queries
      /(magaza|store|shop|sube|branch).*(nerede|where|hangi|which|konum|location|adres|address)/i,
      /(hangi\s+)?\s*(magaza|sube|branch)\s+(var|mevcut|bulunur)/i,
      /(istanbul|ankara|izmir|bursa).*(magaza|sube|branch)/i,
      /nerede\s+(bulabilirim|bulunur|var)/i,
      
      // General questions unrelated to products
      /(saat\s+kac|what\s+time|zaman|when)/i,
      /(nasilsin|how\s+are\s+you|merhaba|hello|selam|hi)\s*[?!]*$/i,
      /(kimsin|kim\s+sin|who\s+are\s+you)/i,
      /(ne\s+yapiyorsun|what\s+are\s+you\s+doing)/i,
      
      // News and current events
      /(haber|news|olay|event|gundem|dunya|world)/i,
      
      // Sports scores
      /(mac|match|skor|score|takim|team|futbol|football|basketbol|basketball).*(sonuc|result|kazandi|kaybetti)/i,
      
      // Technical support unrelated to products
      /(sifre|password|hesap|account|giris|login|kayit|register).*(unuttum|forgot|nasil|how)/i,
      /(nasil\s+)?(kayit|uye|register|sign\s+up)/i,
    ];
    
    // Check if query matches any irrelevant pattern
    for (const pattern of irrelevantPatterns) {
      if (pattern.test(normalizedQuery)) {
        console.log(`[AIService] ✓ Irrelevant query matched pattern: ${pattern}`);
        // Determine query type for personalized response
        let queryType = 'genel';
        if (/hava|weather|derece|yagmur|kar|sicaklik/.test(normalizedQuery)) {
          queryType = 'hava';
        } else if (/magaza|store|nerede|konum|location|adres|sube/.test(normalizedQuery)) {
          queryType = 'magaza';
        } else if (/sifre|hesap|giris|kayit|login/.test(normalizedQuery)) {
          queryType = 'hesap';
        }
        
        return this.generateIrrelevantResponse(queryType, siteId, message, conversationHistory);
      }
    }
    
    console.log(`[AIService] ✗ Query not detected as irrelevant, proceeding with product search`);
    
    // Check for very short generic messages (likely greetings or off-topic)
    if (normalized.length < 15 && !/\b(ayakkabi|bot|terlik|corap|canta|sneaker|giyim|urun|beden|numara)\b/i.test(normalizedQuery)) {
      // Could be a greeting or off-topic
      if (/\b(merhaba|selam|hello|hi|hey|tamam|ok|tesekkur|thanks|sagol)\b/i.test(normalizedQuery)) {
        return this.generateIrrelevantResponse('greeting', siteId, message, conversationHistory);
      }
    }
    
    return null; // Query is relevant
  }

  /**
   * Deduplicate products by SKU - keep best variant (highest discount, in stock)
   */
  private deduplicateProductsBySku(products: Product[]): Product[] {
    const productMap = new Map<string, Product>();
    
    for (const product of products) {
      // Extract base SKU (remove size/color suffix)
      const baseSku = product.id.split(/[\s\-]/)[0];
      const existing = productMap.get(baseSku);
      
      if (!existing) {
        productMap.set(baseSku, product);
        continue;
      }
      
      // Keep the better variant
      // 1. Prefer in-stock
      const isInStock = product.availability?.toLowerCase().includes('in stock');
      const existingInStock = existing.availability?.toLowerCase().includes('in stock');
      
      if (isInStock && !existingInStock) {
        productMap.set(baseSku, product);
      } else if (!isInStock && existingInStock) {
        // Keep existing
      } else {
        // Both same stock status, prefer higher discount
        const discount = this.calculateDiscountPercentage(product);
        const existingDiscount = this.calculateDiscountPercentage(existing);
        
        if (discount > existingDiscount) {
          productMap.set(baseSku, product);
        }
      }
    }
    
    return Array.from(productMap.values());
  }

  /**
   * Find products with similar SKU (fuzzy match)
   */
  private findSimilarSkuProducts(products: Product[], skuQuery: string): Product[] {
    const queryParts = skuQuery.split(/[\s\-]/);
    const mainSku = queryParts[0]; // SK2520052
    
    const similarProducts = products.filter(p => {
      const productId = (p.id || '').toUpperCase();
      const productMpn = (p.mpn || '').toUpperCase();
      
      // Check if main SKU part matches
      return productId.includes(mainSku) || productMpn.includes(mainSku);
    });
    
    // Sort by availability and discount
    return similarProducts.sort((a, b) => {
      const aInStock = a.availability?.toLowerCase().includes('in stock') ? 1 : 0;
      const bInStock = b.availability?.toLowerCase().includes('in stock') ? 1 : 0;
      
      if (aInStock !== bInStock) return bInStock - aInStock;
      
      const aDiscount = this.calculateDiscountPercentage(a);
      const bDiscount = this.calculateDiscountPercentage(b);
      
      return bDiscount - aDiscount;
    });
  }

  /**
   * Calculate discount percentage for a product
   */
  private calculateDiscountPercentage(product: Product): number {
    if (!product.price || !product.salePrice) return 0;
    
    const originalPrice = this.extractPrice(product.price);
    const salePrice = this.extractPrice(product.salePrice);
    
    if (!originalPrice || !salePrice || salePrice >= originalPrice) return 0;
    
    return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
  }

  /**
   * Generate friendly response for irrelevant queries
   */
  private generateIrrelevantResponse(queryType: string, siteId: string, message: string, conversationHistory: ChatMessage[]): ChatResponse {
    const brandName = siteId.charAt(0).toUpperCase() + siteId.slice(1);
    
    let responseMessage = '';
    
    switch (queryType) {
      case 'hava':
        responseMessage = `Merhaba! 😊\n\nBen ${brandName} alışveriş danışmanıyım ve sadece ürünler, beden önerileri ve alışveriş konularında yardımcı olabiliyorum. Hava durumu hakkında bilgi veremiyorum.\n\nAncak bugünkü hava için doğru kıyafet seçimine yardımcı olabilirim! Mevsime uygun bir ayakkabı, bot veya başka bir ürün mü arıyorsunuz? Size nasıl yardımcı olabilirim?`;
        break;
      
      case 'magaza':
        responseMessage = `Merhaba! 😊\n\nBen ${brandName} ürün danışmanıyım. Mağaza konumları ve şube bilgileri için web sitemizin "Mağazalarımız" veya "İletişim" sayfasını ziyaret edebilirsiniz.\n\nAncak size online alışverişinizde yardımcı olabilirim! Hangi ürünü arıyorsunuz? Beden, renk veya model konusunda size yardımcı olabilirim.`;
        break;
      
      case 'hesap':
        responseMessage = `Merhaba! 😊\n\nHesap işlemleri ve giriş sorunları için müşteri hizmetlerimizle iletişime geçmenizi öneririm. Ben sadece ürün arama ve öneri konusunda yardımcı olabilirim.\n\nÜrün araması, beden önerisi veya model karşılaştırması gibi konularda size yardımcı olmaktan mutluluk duyarım!`;
        break;
      
      case 'greeting':
        responseMessage = `Merhaba! 😊\n\nBen ${brandName} alışveriş asistanıyım. Size ürün önerileri sunabilir, beden ve renk seçiminde yardımcı olabilirim.\n\nNe tür bir ürün arıyorsunuz? Ayakkabı, bot, terlik veya başka bir şey?`;
        break;
      
      default:
        responseMessage = `Merhaba! 😊\n\nBen ${brandName} alışveriş danışmanıyım ve size ürünlerimiz, beden önerileri ve alışveriş konularında yardımcı olabilirim.\n\nHangi ürünü arıyorsunuz? Size nasıl yardımcı olabilirim?`;
    }
    
    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: responseMessage, timestamp: new Date() },
    ];
    
    return {
      message: responseMessage,
      conversationHistory: updatedHistory,
      debug: {
        originalQuery: message,
        enhancedQuery: '',
        isFollowUp: false,
        queryType: 'irrelevant',
      },
    };
  }

  /**
   * Filter products by exact size match
   * Handles decimal variations (e.g., "42" matches "42.0")
   * Rejects size ranges (e.g., "43-46")
   */
  private filterByExactSize(products: Product[], requestedSize: string): Product[] {
    return products.filter(p => {
      if (!p.size) return false;
      
      const productSize = String(p.size).trim();
      
      // Reject size ranges
      if (productSize.includes('-') || productSize.includes('/')) {
        return false;
      }
      
      // String exact match
      if (productSize === requestedSize) {
        return true;
      }
      
      // Numeric match (handles "42" vs "42.0")
      const querySizeNum = parseFloat(requestedSize);
      const productSizeNum = parseFloat(productSize);
      
      if (isNaN(productSizeNum) || isNaN(querySizeNum)) {
        return false;
      }
      
      return Math.abs(productSizeNum - querySizeNum) < 0.001;
    });
  }

  /**
   * Filter products by nearby size (within tolerance)
   * @param tolerance - Size difference tolerance (e.g., 1.0 for ±1 size)
   */
  private filterByNearbySize(products: Product[], requestedSize: string, tolerance: number): Product[] {
    const querySizeNum = parseFloat(requestedSize);
    
    if (isNaN(querySizeNum)) {
      return [];
    }
    
    return products.filter(p => {
      if (!p.size) return false;
      
      const productSize = String(p.size).trim();
      
      // Reject size ranges
      if (productSize.includes('-') || productSize.includes('/')) {
        return false;
      }
      
      const productSizeNum = parseFloat(productSize);
      
      if (isNaN(productSizeNum)) {
        return false;
      }
      
      const sizeDiff = Math.abs(productSizeNum - querySizeNum);
      return sizeDiff <= tolerance;
    });
  }

  // ============================================================================
  // CART & CHECKOUT HANDLERS
  // ============================================================================

  /**
   * Generate session ID from conversation history
   */
  private getSessionId(conversationHistory: ChatMessage[]): string {
    if (conversationHistory.length > 0) {
      // Use first message timestamp as session identifier
      const firstMessage = conversationHistory[0];
      return `session_${firstMessage.timestamp.getTime()}`;
    }
    return `session_${Date.now()}`;
  }

  /**
   * Handle VIEW_CART intent
   */
  private async handleViewCart(
    sessionId: string,
    _siteId: string,
    message: string,
    conversationHistory: ChatMessage[]
  ): Promise<ChatResponse> {
    const cartSummary = this.cartService.getCartSummary(sessionId);

    let aiMessage: string;
    if (cartSummary.itemCount === 0) {
      aiMessage = 'Sepetiniz şu anda boş. Size hangi ürünleri önerebilirim?';
    } else {
      aiMessage = `Sepetinizde ${cartSummary.itemCount} ürün var:\n\n`;
      cartSummary.items.forEach((item, index) => {
        aiMessage += `${index + 1}. ${item.title}`;
        if (item.size) aiMessage += ` (${item.size})`;
        if (item.color) aiMessage += ` - ${item.color}`;
        aiMessage += ` - ${item.quantity} adet - ${item.price.toFixed(2)} TL\n`;
      });
      aiMessage += `\n**Toplam: ${cartSummary.totalPrice.toFixed(2)} TL**\n\n`;
      aiMessage += `Satın almak için "Satın al" diyebilir veya başka ürünlere göz atabilirsiniz.`;
    }

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: aiMessage, timestamp: new Date() },
    ];

    return {
      message: aiMessage,
      cart: cartSummary,
      conversationHistory: updatedHistory,
      debug: {
        originalQuery: message,
        enhancedQuery: 'View Cart',
        isFollowUp: false,
        intent: UserIntent.VIEW_CART,
      },
    };
  }

  /**
   * Handle ADD_TO_CART intent
   */
  private async handleAddToCart(
    sessionId: string,
    siteId: string,
    message: string,
    conversationHistory: ChatMessage[]
  ): Promise<ChatResponse> {
    // Extract product reference from message
    const productRef = this.intentService.extractProductReference(message);
    const quantity = this.intentService.extractQuantity(message);

    // Find the product to add
    let productToAdd: Product | null = null;

    // Check if message references a recent recommendation
    if (productRef.index !== undefined) {
      // Find last assistant message with recommended products
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        if (conversationHistory[i].role === 'assistant') {
          // This is a simplified approach - in real implementation,
          // you'd need to track recommended products per message
          // For now, get products from cache
          const products = this.cacheService.getProducts(siteId);
          if (products && products.length > productRef.index) {
            productToAdd = products[productRef.index];
            break;
          }
        }
      }
    }

    if (!productToAdd) {
      const aiMessage = 'Hangi ürünü sepete eklemek istersiniz? Ürün numarasını veya ismini belirtir misiniz?';
      const updatedHistory: ChatMessage[] = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: aiMessage, timestamp: new Date() },
      ];
      return {
        message: aiMessage,
        conversationHistory: updatedHistory,
        debug: {
          originalQuery: message,
          enhancedQuery: 'Add to Cart - Product Not Found',
          isFollowUp: false,
          intent: UserIntent.ADD_TO_CART,
        },
      };
    }

    // Add to cart
    this.cartService.addToCart(sessionId, siteId, productToAdd, quantity);
    const cartSummary = this.cartService.getCartSummary(sessionId);

    const aiMessage = `✅ ${productToAdd.title} sepetinize eklendi! (${quantity} adet)\n\n` +
      `Sepetinizde toplam ${cartSummary.itemCount} ürün var. Toplam: ${cartSummary.totalPrice.toFixed(2)} TL\n\n` +
      `Başka bir ürün eklemek ister misiniz yoksa satın almaya devam edelim mi?`;

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: aiMessage, timestamp: new Date() },
    ];

    return {
      message: aiMessage,
      cart: cartSummary,
      recommendedProducts: [productToAdd],
      conversationHistory: updatedHistory,
      debug: {
        originalQuery: message,
        enhancedQuery: `Add to Cart: ${productToAdd.title}`,
        isFollowUp: false,
        intent: UserIntent.ADD_TO_CART,
      },
    };
  }

  /**
   * Handle REMOVE_FROM_CART intent
   */
  private async handleRemoveFromCart(
    sessionId: string,
    siteId: string,
    message: string,
    conversationHistory: ChatMessage[]
  ): Promise<ChatResponse> {
    const productRef = this.intentService.extractProductReference(message);
    
    // Simple implementation - in production, you'd match products more intelligently
    const cart = this.cartService.getCart(sessionId, siteId);
    
    if (cart.items.length === 0) {
      const aiMessage = 'Sepetinizde zaten ürün yok.';
      const updatedHistory: ChatMessage[] = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: aiMessage, timestamp: new Date() },
      ];
      return {
        message: aiMessage,
        conversationHistory: updatedHistory,
      };
    }

    // Remove first item if no specific reference (simplified)
    const itemToRemove = cart.items[productRef.index || 0];
    this.cartService.removeFromCart(
      sessionId,
      itemToRemove.product.id,
      itemToRemove.selectedSize,
      itemToRemove.selectedColor
    );

    const cartSummary = this.cartService.getCartSummary(sessionId);
    const aiMessage = `${itemToRemove.product.title} sepetinizden çıkarıldı.\n\n` +
      (cartSummary.itemCount > 0
        ? `Sepetinizde ${cartSummary.itemCount} ürün kaldı. Toplam: ${cartSummary.totalPrice.toFixed(2)} TL`
        : 'Sepetiniz artık boş.');

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: aiMessage, timestamp: new Date() },
    ];

    return {
      message: aiMessage,
      cart: cartSummary,
      conversationHistory: updatedHistory,
      debug: {
        originalQuery: message,
        enhancedQuery: 'Remove from Cart',
        isFollowUp: false,
        intent: UserIntent.REMOVE_FROM_CART,
      },
    };
  }

  /**
   * Handle CHECKOUT_INIT intent
   */
  private async handleCheckoutInit(
    sessionId: string,
    _siteId: string,
    message: string,
    conversationHistory: ChatMessage[]
  ): Promise<ChatResponse> {
    const cartSummary = this.cartService.getCartSummary(sessionId);

    if (cartSummary.itemCount === 0) {
      const aiMessage = 'Sepetiniz boş. Önce ürün eklemeniz gerekiyor.';
      const updatedHistory: ChatMessage[] = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: aiMessage, timestamp: new Date() },
      ];
      return {
        message: aiMessage,
        conversationHistory: updatedHistory,
      };
    }

    // Start checkout flow
    const checkoutState = this.cartService.startCheckout(sessionId);

    const aiMessage = `Harika! Siparişinizi tamamlayalım. 🛍️\n\n` +
      `**Sepet Özeti:**\n` +
      cartSummary.items.map((item, i) => 
        `${i + 1}. ${item.title}${item.size ? ` (${item.size})` : ''} - ${item.quantity} adet - ${item.price.toFixed(2)} TL`
      ).join('\n') +
      `\n\n**Toplam: ${cartSummary.totalPrice.toFixed(2)} TL**\n\n` +
      `Teslimat adresinizi paylaşır mısınız? Şu bilgileri bekliyorum:\n` +
      `- Ad Soyad\n` +
      `- Telefon\n` +
      `- Adres (Mahalle, Sokak, No)\n` +
      `- İlçe / İl\n` +
      `- Posta Kodu`;

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: aiMessage, timestamp: new Date() },
    ];

    return {
      message: aiMessage,
      cart: cartSummary,
      checkoutState,
      conversationHistory: updatedHistory,
      debug: {
        originalQuery: message,
        enhancedQuery: 'Checkout Init',
        isFollowUp: false,
        intent: UserIntent.CHECKOUT_INIT,
      },
    };
  }

  /**
   * Handle PROVIDE_ADDRESS intent
   */
  private async handleProvideAddress(
    sessionId: string,
    _siteId: string,
    message: string,
    conversationHistory: ChatMessage[]
  ): Promise<ChatResponse> {
    // Parse address from message (simplified - in production, use NLP)
    // For now, just store the raw message as address
    const checkoutState = this.cartService.setShippingAddress(sessionId, {
      fullName: 'Extracted Name', // Would parse from message
      phone: '05XXXXXXXXX', // Would parse from message
      addressLine1: message,
      city: 'İstanbul',
      district: 'Kadıköy',
      postalCode: '34000',
      country: 'Türkiye',
    });

    const aiMessage = `Teşekkürler! Adresinizi kaydettik. ✅\n\n` +
      `Şimdi ödeme yöntemini seçelim:\n` +
      `1. 💳 Kredi Kartı\n` +
      `2. 💵 Kapıda Ödeme\n` +
      `3. 🏦 Havale/EFT\n\n` +
      `Hangi yöntemi tercih edersiniz?`;

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: aiMessage, timestamp: new Date() },
    ];

    return {
      message: aiMessage,
      checkoutState,
      conversationHistory: updatedHistory,
      debug: {
        originalQuery: message,
        enhancedQuery: 'Provide Address',
        isFollowUp: false,
        intent: UserIntent.PROVIDE_ADDRESS,
      },
    };
  }

  /**
   * Handle PROVIDE_PAYMENT intent
   */
  private async handleProvidePayment(
    sessionId: string,
    _siteId: string,
    message: string,
    conversationHistory: ChatMessage[]
  ): Promise<ChatResponse> {
    const normalized = message.toLowerCase();
    
    let paymentMethod;
    if (normalized.includes('kredi') || normalized.includes('kart')) {
      paymentMethod = 'CREDIT_CARD';
    } else if (normalized.includes('kapıda') || normalized.includes('nakit')) {
      paymentMethod = 'CASH_ON_DELIVERY';
    } else {
      paymentMethod = 'BANK_TRANSFER';
    }

    const checkoutState = this.cartService.setPaymentMethod(
      sessionId,
      paymentMethod as any
    );

    const cartSummary = this.cartService.getCartSummary(sessionId);

    const aiMessage = `Ödeme yönteminiz kaydedildi: ${
      paymentMethod === 'CREDIT_CARD' ? '💳 Kredi Kartı' :
      paymentMethod === 'CASH_ON_DELIVERY' ? '💵 Kapıda Ödeme' :
      '🏦 Havale/EFT'
    }\n\n` +
      `**Sipariş Özeti:**\n` +
      cartSummary.items.map((item, i) => 
        `${i + 1}. ${item.title} - ${item.quantity} adet - ${item.price.toFixed(2)} TL`
      ).join('\n') +
      `\n\n**Toplam: ${cartSummary.totalPrice.toFixed(2)} TL**\n\n` +
      `Siparişinizi onaylıyor musunuz? "Evet" derseniz siparişinizi oluşturalım.`;

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: aiMessage, timestamp: new Date() },
    ];

    return {
      message: aiMessage,
      cart: cartSummary,
      checkoutState,
      conversationHistory: updatedHistory,
      debug: {
        originalQuery: message,
        enhancedQuery: 'Provide Payment',
        isFollowUp: false,
        intent: UserIntent.PROVIDE_PAYMENT,
      },
    };
  }

  /**
   * Handle CONFIRM_ORDER intent
   */
  private async handleConfirmOrder(
    sessionId: string,
    siteId: string,
    message: string,
    conversationHistory: ChatMessage[]
  ): Promise<ChatResponse> {
    try {
      const order = this.cartService.createOrder(sessionId, siteId);

      if (!order) {
        throw new Error('Sipariş oluşturulamadı');
      }

      const aiMessage = `🎉 Tebrikler! Siparişiniz başarıyla oluşturuldu!\n\n` +
        `**Sipariş No:** ${order.orderId}\n` +
        `**Toplam Tutar:** ${order.totalAmount.toFixed(2)} TL\n` +
        `**Ödeme:** ${
          order.paymentMethod === 'CREDIT_CARD' ? '💳 Kredi Kartı' :
          order.paymentMethod === 'CASH_ON_DELIVERY' ? '💵 Kapıda Ödeme' :
          '🏦 Havale/EFT'
        }\n\n` +
        `Siparişiniz hazırlanıyor. Kargo takip numaranızı kısa süre içinde e-posta ile göndereceğiz.\n\n` +
        `Sipariş durumunuzu "Sipariş ${order.orderId}" yazarak takip edebilirsiniz.\n\n` +
        `Başka bir şey için yardımcı olabilir miyim?`;

      const updatedHistory: ChatMessage[] = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: aiMessage, timestamp: new Date() },
      ];

      const checkoutState = this.cartService.getCheckoutState(sessionId);

      return {
        message: aiMessage,
        checkoutState,
        conversationHistory: updatedHistory,
        debug: {
          originalQuery: message,
          enhancedQuery: `Order Confirmed: ${order.orderId}`,
          isFollowUp: false,
          intent: UserIntent.CONFIRM_ORDER,
        },
      };
    } catch (error: any) {
      const aiMessage = `Üzgünüm, sipariş oluşturulurken bir hata oluştu: ${error.message}`;
      const updatedHistory: ChatMessage[] = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: aiMessage, timestamp: new Date() },
      ];
      return {
        message: aiMessage,
        conversationHistory: updatedHistory,
      };
    }
  }

  /**
   * Handle TRACK_ORDER intent
   */
  private async handleTrackOrder(
    _sessionId: string,
    _siteId: string,
    message: string,
    conversationHistory: ChatMessage[]
  ): Promise<ChatResponse> {
    // Extract order ID from message
    const orderIdMatch = message.match(/ORD\d+/i);
    
    if (!orderIdMatch) {
      const aiMessage = 'Sipariş numaranızı paylaşır mısınız? (Örn: ORD123456789)';
      const updatedHistory: ChatMessage[] = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: aiMessage, timestamp: new Date() },
      ];
      return {
        message: aiMessage,
        conversationHistory: updatedHistory,
      };
    }

    const orderId = orderIdMatch[0];
    const order = this.cartService.getOrder(orderId);

    if (!order) {
      const aiMessage = `${orderId} numaralı siparişi bulamadım. Sipariş numarasını kontrol eder misiniz?`;
      const updatedHistory: ChatMessage[] = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: aiMessage, timestamp: new Date() },
      ];
      return {
        message: aiMessage,
        conversationHistory: updatedHistory,
      };
    }

    const statusText = {
      PENDING: '⏳ Onay Bekliyor',
      CONFIRMED: '✅ Onaylandı',
      PROCESSING: '📦 Hazırlanıyor',
      SHIPPED: '🚚 Kargoya Verildi',
      DELIVERED: '✅ Teslim Edildi',
      CANCELLED: '❌ İptal Edildi',
    };

    const aiMessage = `**Sipariş Durumu**\n\n` +
      `Sipariş No: ${order.orderId}\n` +
      `Durum: ${statusText[order.status]}\n` +
      `Sipariş Tarihi: ${order.createdAt.toLocaleDateString('tr-TR')}\n` +
      `Toplam: ${order.totalAmount.toFixed(2)} TL\n\n` +
      `Ürünler:\n` +
      order.items.map((item, i) => 
        `${i + 1}. ${item.product.title} - ${item.quantity} adet`
      ).join('\n') +
      `\n\nBaşka bir konuda yardımcı olabilir miyim?`;

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: aiMessage, timestamp: new Date() },
    ];

    return {
      message: aiMessage,
      conversationHistory: updatedHistory,
      debug: {
        originalQuery: message,
        enhancedQuery: `Track Order: ${orderId}`,
        isFollowUp: false,
        intent: UserIntent.TRACK_ORDER,
      },
    };
  }
}
