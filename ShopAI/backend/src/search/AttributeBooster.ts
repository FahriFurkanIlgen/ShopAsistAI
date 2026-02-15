// Attribute Booster - Apply field-level boosting to scores

import { Product } from '../../../shared/types';
import { ExtractedAttributes } from './types';

export class AttributeBooster {
  /**
   * Calculate attribute match scores and apply boosting
   * 
   * Returns individual scores for each attribute match
   */
  calculateBoosts(
    product: Product,
    attributes: ExtractedAttributes
  ): {
    brand: number;
    color: number;
    category: number;
    size: number;
    price: number;
    gender: number;
    specialFeatures: number;
  } {
    // CRITICAL: Child product filtering
    // If query is NOT for children, heavily penalize child products
    const childPenalty = this.childProductPenalty(product, attributes.isChildQuery);
    if (childPenalty < -50) {
      return {
        brand: 0,
        color: 0,
        category: childPenalty, // Use category to apply elimination
        size: 0,
        price: 0,
        gender: 0,
        specialFeatures: 0,
      };
    }

    return {
      brand: this.brandMatchScore(product, attributes.brand),
      color: this.colorMatchScore(product, attributes.color),
      category: this.categoryMatchScore(product, attributes.category),
      size: this.sizeMatchScore(product, attributes.size),
      price: this.priceMatchScore(product, attributes.priceRange),
      gender: this.genderMatchScore(product, attributes.gender),
      specialFeatures: this.specialFeaturesScore(product, attributes.specialFeatures),
    };
  }

  /**
   * Brand match scoring
   */
  private brandMatchScore(product: Product, extractedBrand?: string): number {
    if (!extractedBrand || !product.brand) {
      return 0;
    }

    const productBrand = this.normalize(product.brand);
    const queryBrand = this.normalize(extractedBrand);

    if (productBrand === queryBrand) {
      return 2.0; // Exact match
    }

    if (productBrand.includes(queryBrand) || queryBrand.includes(productBrand)) {
      return 1.0; // Partial match
    }

    return 0;
  }

  /**
   * Color match scoring
   */
  private colorMatchScore(product: Product, extractedColor?: string): number {
    if (!extractedColor || !product.color) {
      return 0;
    }

    const productColor = this.normalize(product.color);
    const queryColor = this.normalize(extractedColor);

    if (productColor.includes(queryColor) || queryColor.includes(productColor)) {
      return 5.0; // Strong positive signal for color match
    }

    return 0;
  }

  /**
   * Category match scoring with MANDATORY matching
   * Category mismatch is heavily penalized to ensure relevance
   */
  private categoryMatchScore(product: Product, extractedCategories?: string[]): number {
    if (!extractedCategories || extractedCategories.length === 0 || !product.productType) {
      return 0;
    }

    const productType = this.normalize(product.productType);
    let maxScore = 0;
    let hasMatch = false;

    // Check for category matches
    for (const category of extractedCategories) {
      const normCategory = this.normalize(category);
      
      if (productType.includes(normCategory)) {
        maxScore = Math.max(maxScore, 10.0); // Very strong signal for category match
        hasMatch = true;
      }
    }

    // If user specified category keywords but product doesn't match ANY of them,
    // apply VERY HEAVY penalty to ensure product is filtered out
    if (!hasMatch && extractedCategories.length > 0) {
      // Category mismatch = product MUST be filtered out
      return -100.0;
    }

    return maxScore;
  }

  /**
   * Size match scoring with tolerance for close sizes
   * SIZE IS CRITICAL - exact match gets very high score to dominate BM25
   */
  private sizeMatchScore(product: Product, extractedSize?: string): number {
    if (!extractedSize || !product.size) {
      return 0;
    }

    const productSize = String(product.size).trim();
    const querySize = extractedSize.trim();

    // Exact match - VERY HIGH SCORE to ensure it dominates BM25
    if (productSize === querySize) {
      return 50.0;
    }

    // Try numeric comparison with tolerance
    const productSizeNum = parseFloat(productSize);
    const querySizeNum = parseFloat(querySize);
    
    if (!isNaN(productSizeNum) && !isNaN(querySizeNum)) {
      const diff = Math.abs(productSizeNum - querySizeNum);
      
      // Exact match (handles "42" vs "42.0")
      if (diff === 0) {
        return 50.0;
      }
      
      // Close match: ±0.5 beden (örn: 43 için 42.5 veya 43.5)
      if (diff <= 0.5) {
        return 30.0;
      }
      
      // Acceptable match: ±1 beden (örn: 43 için 42 veya 44)
      if (diff <= 1.0) {
        return 15.0;
      }
      
      // Too far - penalize heavily
      return -5.0;
    }

    // String sizes (S, M, L, etc.) - must be exact
    return 0;
  }

  /**
   * Price match scoring
   */
  private priceMatchScore(
    product: Product,
    priceRange?: { min?: number; max?: number }
  ): number {
    if (!priceRange) {
      return 0;
    }

    const price = this.extractPrice(product.salePrice || product.price);
    if (!price) {
      return 0;
    }

    const { min, max } = priceRange;

    // Check if price is within range
    if (min !== undefined && price < min) {
      return -0.5; // Penalty for being too cheap
    }

    if (max !== undefined && price > max) {
      return -1.0; // Penalty for being too expensive
    }

    // Bonus for being in range
    if ((min !== undefined || max !== undefined)) {
      return 0.5;
    }

    return 0;
  }

  /**
   * Calculate final weighted score
   * 
   * Category is MANDATORY - mismatch results in elimination
   * Gender is CRITICAL - mismatch heavily penalized
   * Other attributes (color, size, features) are balanced
   */
  calculateFinalScore(
    bm25Score: number,
    boosts: {
      brand: number;
      color: number;
      category: number;
      size: number;
      price: number;
      gender: number;
      specialFeatures: number;
    }
  ): number {
    // CRITICAL: Category mismatch = immediate elimination
    if (boosts.category < -10) {
      return -1000;
    }

    // CRITICAL: Gender mismatch = immediate elimination
    if (boosts.gender < -10) {
      return -1000;
    }

    // Balanced scoring where each attribute contributes fairly
    // SIZE is dominant when specified - CRITICAL for exact matches
    // BM25 has lower weight since stopwords can inflate it
    return (
      0.08 * bm25Score +            // Text relevance (reduced)
      0.05 * boosts.brand +         // Brand preference
      0.12 * boosts.color +         // Color match
      0.20 * boosts.category +      // Category match (mandatory)
      0.40 * boosts.size +          // Size match (DOMINANT when specified)
      0.10 * boosts.gender +        // Gender match (critical for child products)
      0.05 * boosts.specialFeatures // Special features (ışıklı, etc.)
      // price excluded - not primary sorting factor
    );
  }

  /**
   * Child product penalty
   * If query is NOT about children, penalize child products heavily
   */
  private childProductPenalty(product: Product, isChildQuery?: boolean): number {
    if (isChildQuery) {
      // Query is explicitly for children, no penalty
      return 0;
    }

    // Check if product is for children
    const productType = this.normalize(product.productType || '');
    const isChildProduct = 
      productType.includes('cocuk') || 
      productType.includes('kiz cocuk') || 
      productType.includes('erkek cocuk') ||
      productType.includes('bebek');

    if (isChildProduct) {
      // Query is NOT for children, but product IS for children
      // Apply heavy penalty to eliminate from results
      return -100.0;
    }

    return 0;
  }

  /**
   * Gender/target audience match scoring
   * CRITICAL for child products: kız vs erkek
   */
  private genderMatchScore(product: Product, extractedGender?: 'erkek' | 'kadin' | 'kiz' | 'unisex'): number {
    if (!extractedGender) {
      return 0; // No gender specified
    }

    const productType = this.normalize(product.productType || '');
    const productColor = this.normalize(product.color || '');
    
    // Check product gender from productType
    let productGender: string | null = null;
    
    if (productType.includes('kiz cocuk') || productType.includes('kiz')) {
      productGender = 'kiz';
    } else if (productType.includes('erkek cocuk') || productType.includes('erkek')) {
      productGender = 'erkek';
    } else if (productType.includes('kadin') || productType.includes('bayan')) {
      productGender = 'kadin';
    } else if (productType.includes('unisex')) {
      productGender = 'unisex';
    }

    // Gender match
    if (productGender === extractedGender) {
      return 8.0; // Strong positive signal
    }

    // Unisex matches everything
    if (productGender === 'unisex') {
      return 3.0; // Partial match
    }

    // Gender mismatch - VERY heavy penalty for child products
    if (productGender && productGender !== extractedGender) {
      // kız için erkek ürün önerilmemeli!
      return -50.0;
    }

    return 0; // Unknown product gender
  }

  /**
   * Special features match scoring (ışıklı, su geçirmez, etc.)
   */
  private specialFeaturesScore(product: Product, extractedFeatures?: string[]): number {
    if (!extractedFeatures || extractedFeatures.length === 0) {
      return 0; // No special features requested
    }

    const searchText = this.normalize(
      `${product.title} ${product.description} ${product.productType || ''}`
    );

    let score = 0;

    for (const feature of extractedFeatures) {
      const normalizedFeature = this.normalize(feature);
      
      // Check if product has this feature
      if (searchText.includes(normalizedFeature)) {
        score += 4.0; // Good bonus per feature
      } else {
        // Feature requested but not present - slight penalty
        score -= 1.0;
      }
    }

    return score;
  }

  /**
   * Normalize text for comparison
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .trim();
  }

  /**
   * Extract numeric price from price string
   */
  private extractPrice(priceStr: string): number | null {
    const match = priceStr.match(/[\d.,]+/);
    if (match) {
      return parseFloat(match[0].replace(',', '.'));
    }
    return null;
  }
}
