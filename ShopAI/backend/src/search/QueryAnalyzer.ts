// Query Analyzer - Detect query type and patterns

import { QueryType, QueryAnalysisResult } from './types';

export class QueryAnalyzer {
  /**
   * Analyze query and detect search patterns
   */
  analyze(query: string): QueryAnalysisResult {
    const detectedTypes: QueryType[] = [];
    const patterns: QueryAnalysisResult['detectedPatterns'] = {};
    
    const cleanQuery = query.trim();
    
    // 1. Check for SKU patterns (exact)
    const skuExact = this.detectExactSKU(cleanQuery);
    if (skuExact) {
      detectedTypes.push('sku-exact');
      patterns.sku = skuExact;
    }
    
    // 2. Check for partial SKU (base code without variant)
    const skuPartial = this.detectPartialSKU(cleanQuery);
    if (skuPartial && !skuExact) {
      detectedTypes.push('sku-partial');
      patterns.partialSku = skuPartial;
    }
    
    // 3. Check for product codes (simple numeric/alphanumeric)
    const productCode = this.detectProductCode(cleanQuery);
    if (productCode && !skuExact && !skuPartial) {
      detectedTypes.push('product-code');
      patterns.productCode = productCode;
    }
    
    // 4. Check for size-only queries
    const sizeOnly = this.detectSizeOnly(cleanQuery);
    if (sizeOnly) {
      detectedTypes.push('size-only');
      patterns.size = sizeOnly;
    }
    
    // 5. Check for price range
    const priceRange = this.detectPriceRange(cleanQuery);
    if (priceRange) {
      detectedTypes.push('price-range');
      patterns.priceRange = priceRange;
    }
    
    // 6. Check for category keywords
    const categories = this.detectCategories(cleanQuery);
    if (categories.length > 0) {
      detectedTypes.push('category');
      patterns.category = categories;
    }
    
    // 7. Check for attribute combinations (color + size, etc.)
    if (this.hasMultipleAttributes(cleanQuery)) {
      detectedTypes.push('attribute-combo');
    }
    
    // 8. Default to semantic if nothing specific detected
    if (detectedTypes.length === 0) {
      detectedTypes.push('semantic');
    }
    
    // Determine primary type (most specific first)
    const primaryType = this.selectPrimaryType(detectedTypes);
    const secondaryTypes = detectedTypes.filter(t => t !== primaryType);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(primaryType, detectedTypes.length);
    
    // Should we try all strategies?
    const shouldTryAllStrategies = detectedTypes.length > 2 || confidence < 0.7;
    
    return {
      primaryType,
      secondaryTypes,
      confidence,
      detectedPatterns: patterns,
      shouldTryAllStrategies,
    };
  }
  
  /**
   * Detect exact SKU pattern: SK2520052-1602, 253010 BBK, 100439 WHT
   */
  private detectExactSKU(query: string): string | null {
    const patterns = [
      /\b(SK\d{7}-\d{4})\b/i,           // SK2520052-1602
      /\b(\d{6}\s+[A-Z]{2,4})\b/i,      // 253010 BBK, 100439 WHT
      /\b(\d{6}[A-Z]\s+[A-Z]{2,4})\b/i, // 302036L BKMT
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }
  
  /**
   * Detect partial SKU (base code): SK2520052, 253010
   */
  private detectPartialSKU(query: string): string | null {
    const patterns = [
      /\b(SK\d{7})\b/i,      // SK2520052
      /\b(\d{6})\b/,         // 253010
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }
  
  /**
   * Detect simple product code patterns
   */
  private detectProductCode(query: string): string | null {
    // If query is just alphanumeric with dashes/spaces
    if (/^[A-Z0-9\s\-]{5,20}$/i.test(query.trim())) {
      return query.trim();
    }
    
    return null;
  }
  
  /**
   * Detect size-only queries: 42, 28, 5-6
   */
  private detectSizeOnly(query: string): string | null {
    const sizePatterns = [
      /^(\d{1,2})$/,           // 42, 28
      /^(\d{1,2}\.5)$/,        // 42.5
      /^(\d{1,2}-\d{1,2})$/,   // 5-6, 7-8
    ];
    
    for (const pattern of sizePatterns) {
      const match = query.trim().match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }
  
  /**
   * Detect price range: 2000-3000, 3000 liraya kadar, 2000 TL
   */
  private detectPriceRange(query: string): { min?: number; max?: number } | null {
    const lowerQuery = query.toLowerCase();
    
    // Pattern 1: 2000-3000, 2000-3000 TL
    const rangeMatch = lowerQuery.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch) {
      return {
        min: parseInt(rangeMatch[1], 10),
        max: parseInt(rangeMatch[2], 10),
      };
    }
    
    // Pattern 2: 3000 liraya kadar, 3000 TL'ye kadar
    const maxMatch = lowerQuery.match(/(\d+)\s*(?:tl|lira)?(?:ya|ye)?\s*kadar/i);
    if (maxMatch) {
      return {
        max: parseInt(maxMatch[1], 10),
      };
    }
    
    // Pattern 3: 2000 liradan fazla, 2000 TL üzeri
    const minMatch = lowerQuery.match(/(\d+)\s*(?:tl|lira)?(?:dan|den)?\s*(?:fazla|üzeri|yukarı)/i);
    if (minMatch) {
      return {
        min: parseInt(minMatch[1], 10),
      };
    }
    
    return null;
  }
  
  /**
   * Detect category keywords
   */
  private detectCategories(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const categories: string[] = [];
    
    const categoryKeywords = [
      // Ayakkabı kategorileri
      'ayakkabı', 'sneaker', 'bot', 'sandalet', 'terlik', 'spor ayakkabı',
      
      // Giyim kategorileri
      'mont', 'ceket', 'jacket', 'sweatshirt', 'hoodie', 'tişört', 't-shirt',
      'pantolon', 'şort', 'etek', 'elbise', 'kazak', 'hırka',
      
      // Aksesuar kategorileri
      'şapka', 'cap', 'hat', 'bere', 'bone', 'bandana',
      'çorap', 'sock', 'eldiven', 'glove',
      'çanta', 'bag', 'backpack', 'sırt çantası',
      'kemer', 'belt',
      
      // Spor kategorileri
      'spor', 'athletic', 'running', 'koşu', 'basketbol', 'basketball',
      'fitness', 'gym', 'training', 'antrenman',
      
      // Yaş grupları
      'çocuk', 'kids', 'children', 'bebek', 'baby',
      'kadın', 'erkek', 'unisex',
    ];
    
    for (const keyword of categoryKeywords) {
      if (lowerQuery.includes(keyword)) {
        categories.push(keyword);
      }
    }
    
    return categories;
  }
  
  /**
   * Check if query has multiple attributes (color + size, etc.)
   */
  private hasMultipleAttributes(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    const hasColor = /(?:beyaz|siyah|kırmızı|mavi|yeşil|sarı|pembe|mor|turuncu|gri|kahverengi)/i.test(lowerQuery);
    const hasSize = /(?:\d{1,2}(?:\.5)?|numara)/i.test(lowerQuery);
    const hasBrand = /(?:hoka|on|asics|saucony|salomon|brooks|skechers|nike|adidas|puma|reebok|new balance|under armour|mizuno)/i.test(lowerQuery);
    
    const attributeCount = [hasColor, hasSize, hasBrand].filter(Boolean).length;
    
    return attributeCount >= 2;
  }
  
  /**
   * Select primary type based on priority
   */
  private selectPrimaryType(types: QueryType[]): QueryType {
    const priority: QueryType[] = [
      'sku-exact',
      'sku-partial',
      'product-code',
      'size-only',
      'price-range',
      'attribute-combo',
      'category',
      'semantic',
    ];
    
    for (const type of priority) {
      if (types.includes(type)) {
        return type;
      }
    }
    
    return 'semantic';
  }
  
  /**
   * Calculate confidence score
   */
  private calculateConfidence(primaryType: QueryType, typeCount: number): number {
    // Higher confidence for specific patterns
    const baseConfidence: Record<QueryType, number> = {
      'sku-exact': 0.95,
      'sku-partial': 0.90,
      'product-code': 0.85,
      'size-only': 0.80,
      'price-range': 0.85,
      'attribute-combo': 0.75,
      'category': 0.70,
      'semantic': 0.60,
      'sku-fuzzy': 0.70,
      'multi-strategy': 0.50,
    };
    
    let confidence = baseConfidence[primaryType] || 0.60;
    
    // Reduce confidence if too many types detected (ambiguous)
    if (typeCount > 3) {
      confidence *= 0.8;
    }
    
    return confidence;
  }
}
