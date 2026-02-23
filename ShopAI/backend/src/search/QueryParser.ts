// Query Parser - Extract Structured Attributes from Free Text

import { ExtractedAttributes } from './types';

export class QueryParser {
  private colorMap: Map<string, string[]> = new Map();
  private brandPatterns: string[] = [];
  private categoryKeywords: Map<string, string[]> = new Map();

  constructor() {
    this.initializeColorMap();
    this.initializeBrandPatterns();
    this.initializeCategoryKeywords();
  }

  /**
   * Parse user query and extract structured attributes
   */
  parse(query: string): ExtractedAttributes {
    const normalized = this.normalizeText(query);
    const tokens = this.tokenize(normalized);

    return {
      brand: this.extractBrand(normalized),
      color: this.extractColor(normalized, tokens),
      category: this.extractCategory(normalized, tokens),
      size: this.extractSize(query), // Use original query for number extraction
      priceRange: this.extractPriceRange(query),
      keywords: this.extractKeywords(tokens),
      isChildQuery: this.detectChildQuery(normalized, tokens),
      gender: this.extractGender(normalized, tokens),
      specialFeatures: this.extractSpecialFeatures(normalized, tokens),
    };
  }

  /**
   * Extract brand from query
   */
  private extractBrand(normalized: string): string | undefined {
    for (const brand of this.brandPatterns) {
      if (normalized.includes(brand.toLowerCase())) {
        return brand;
      }
    }
    return undefined;
  }

  /**
   * Extract color from query
   */
  private extractColor(normalized: string, tokens: string[]): string | undefined {
    for (const [color, variants] of this.colorMap.entries()) {
      for (const variant of variants) {
        if (tokens.includes(variant) || normalized.includes(variant)) {
          return color;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract category from query
   */
  private extractCategory(normalized: string, tokens: string[]): string[] {
    const categories: string[] = [];

    for (const [category, keywords] of this.categoryKeywords.entries()) {
      for (const keyword of keywords) {
        if (tokens.includes(keyword) || normalized.includes(keyword)) {
          categories.push(category);
          break;
        }
      }
    }

    return categories;
  }

  /**
   * Extract size/beden from query
   */
  private extractSize(query: string): string | undefined {
    // Match patterns like: "43", "42.5", "43 numara", "XL", "L"
    const sizePatterns = [
      /\b(\d{1,2}(?:\.\d)?)\s*(?:numara|beden|size)?\b/i,
      /\b(XXS|XS|S|M|L|XL|XXL|XXXL)\b/i,
    ];

    for (const pattern of sizePatterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Extract price range from query
   */
  private extractPriceRange(query: string): { min?: number; max?: number } | undefined {
    const pricePatterns = [
      /(\d+)\s*(?:lira|tl)?\s*(?:dan|den|alt[ıi]|az|ucuz)/i,
      /(\d+)\s*(?:lira|tl)?\s*(?:[üu]st[üu]|[üu]zeri|fazla)/i,
      /(\d+)\s*(?:-|ile)\s*(\d+)\s*(?:lira|tl)?/i,
    ];

    for (const pattern of pricePatterns) {
      const match = query.match(pattern);
      if (match) {
        if (match[2]) {
          // Range pattern
          return {
            min: parseFloat(match[1]),
            max: parseFloat(match[2]),
          };
        } else {
          // Single value - determine if min or max based on keywords
          const value = parseFloat(match[1]);
          if (/alt[ıi]|az|ucuz|dan|den/.test(match[0])) {
            return { max: value };
          } else {
            return { min: value };
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Extract remaining keywords (non-attribute words)
   */
  private extractKeywords(tokens: string[]): string[] {
    const stopwords = new Set([
      'bir', 'bu', 'su', 've', 'veya', 'için', 'ile', 'mi', 'mu', 'de', 'da',
      'bana', 'bul', 'bulabilir', 'misin', 'var', 'yok', 'istiyorum'
    ]);

    return tokens.filter(token => {
      return token.length > 2 && !stopwords.has(token);
    });
  }

  /**
   * Detect if query is specifically for child products
   */
  private detectChildQuery(normalized: string, tokens: string[]): boolean {
    const childKeywords = [
      'cocuk', 'cocuklara', 'cocuguma', 'cocugum',
      'kiz cocuk', 'erkek cocuk',
      'bebek', 'bebeklere',
      'oglum', 'kizim', 'ogluma', 'kizima',
      'minik', 'ufak', 'kucuk',
    ];

    for (const keyword of childKeywords) {
      if (normalized.includes(keyword) || tokens.some(t => t.includes(keyword))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract gender/target audience from query
   */
  private extractGender(normalized: string, _tokens: string[]): 'erkek' | 'kadin' | 'kiz' | 'unisex' | undefined {
    // Check for specific gender keywords
    if (normalized.includes('kiz') || normalized.includes('kizim') || normalized.includes('kizima')) {
      return 'kiz';
    }
    if (normalized.includes('erkek') || normalized.includes('oglum') || normalized.includes('ogluma')) {
      return 'erkek';
    }
    if (normalized.includes('kadin') || normalized.includes('esim') || normalized.includes('esime') || normalized.includes('bayanlar')) {
      return 'kadin';
    }
    
    return undefined;
  }

  /**
   * Extract special features from query
   */
  private extractSpecialFeatures(normalized: string, tokens: string[]): string[] {
    const features: string[] = [];
    
    const featureMap = new Map([
      ['isikli', ['isikli', 'isik', 'light', 'lights']],
      ['su gecirmez', ['su gecirmez', 'waterproof', 'su gecirimez']],
      ['nefes alan', ['nefes alan', 'breathable', 'havali']],
      ['ortopedik', ['ortopedik', 'orthopedic']],
      ['memory foam', ['memory foam', 'hafizali']],
    ]);

    for (const [feature, keywords] of featureMap) {
      for (const keyword of keywords) {
        if (normalized.includes(keyword) || tokens.some(t => t.includes(keyword))) {
          features.push(feature);
          break;
        }
      }
    }

    return features;
  }

  /**
   * Tokenize text
   */
  private tokenize(text: string): string[] {
    return text
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  /**
   * Normalize text
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Initialize color mappings
   */
  private initializeColorMap(): void {
    this.colorMap = new Map([
      ['beyaz', ['beyaz', 'white', 'wht', 'wsl']],
      ['siyah', ['siyah', 'black', 'blk', 'bbk']],
      ['kirmizi', ['kirmizi', 'red']],
      ['mavi', ['mavi', 'blue', 'blu', 'nvy', 'navy']],
      ['yesil', ['yesil', 'green', 'grn']],
      ['gri', ['gri', 'gray', 'grey', 'gry']],
      ['sari', ['sari', 'yellow']],
      ['pembe', ['pembe', 'pink', 'pnk']],
      ['turuncu', ['turuncu', 'orange', 'org']],
      ['mor', ['mor', 'purple', 'prp']],
    ]);
  }

  /**
   * Initialize brand patterns
   */
  private initializeBrandPatterns(): void {
    this.brandPatterns = [
      // High5 Marketplace Ana Markalar
      'HOKA', 'ON', 'ASICS', 'Saucony', 'Salomon', 'Brooks',
      'Skechers', 'Nike', 'Adidas', 'Puma', 'Reebok', 
      'New Balance', 'Under Armour', 'Converse', 'Mizuno'
    ];
  }

  /**
   * Initialize category keywords
   */
  private initializeCategoryKeywords(): void {
    this.categoryKeywords = new Map([
      // Ayakkabı kategorileri
      ['sneaker', ['sneaker', 'sneker', 'spor ayakkabi']],
      ['ayakkabi', ['ayakkabi', 'ayakkabı', 'shoe', 'shoes']],
      ['terlik', ['terlik', 'sandal', 'sandalet', 'slipper', 'slippers', 'plaj', 'havuz']],
      ['bot', ['bot', 'boot', 'cizme', 'çizme']],
      
      // Giyim kategorileri (High5 Marketplace)
      ['ceket', ['ceket', 'jacket', 'mont', 'yelek', 'vest']],
      ['sort', ['şort', 'short', 'shorts', 'şorts']],
      ['tayt', ['tayt', 'tight', 'tights', 'legging', 'leggings']],
      ['elbise', ['elbise', 'dress', 'dresses']],
      ['tisort', ['tışört', 'tisort', 't-shirt', 'tshirt', 'tee']],
      ['esofman', ['eşofman', 'esofman', 'tracksuit', 'sweatpants']],
      ['hoodie', ['hoodie', 'sweatshirt', 'kapsonlu', 'kapşonlu']],
      
      // Aksesuar kategorileri
      ['canta', ['canta', 'çanta', 'bag', 'backpack', 'sirt cantasi', 'sırt çantası']],
      ['corap', ['corap', 'çorap', 'corab', 'sock', 'socks']],
      ['sapka', ['sapka', 'şapka', 'cap', 'hat', 'bere', 'bone', 'bandana']],
      ['eldiven', ['eldiven', 'glove', 'gloves']],
      ['kemer', ['kemer', 'belt']],
      
      // Spor kategorileri
      ['kosu', ['kosu', 'koşu', 'running', 'runner']],
      ['spor', ['spor', 'sport', 'athletic', 'training']],
      ['gunluk', ['gunluk', 'günlük', 'casual', 'lifestyle']],
      ['krampon', ['krampon', 'futbol', 'football', 'soccer']],
      ['basketbol', ['basketbol', 'basketball', 'basket']],
      
      // Giyim kategorileri
      ['sort', ['sort', 'şort', 'short', 'shorts', 'deniz']],
      ['mont', ['mont', 'ceket', 'jacket', 'coat']],
      ['tisort', ['tisort', 'tişört', 't-shirt', 'tshirt']],
      ['sweatshirt', ['sweatshirt', 'hoodie', 'kapüşonlu']],
    ]);
  }
}
