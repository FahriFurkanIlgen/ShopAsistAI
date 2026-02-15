// Merchandising Engine - Business Rules, Boosting Strategies & Result Optimization

import { Product } from '../../../shared/types';
import { ScoredProduct } from './types';

/**
 * Merchandising configuration for dynamic ranking control
 */
export interface MerchandisingConfig {
  // Signal weights (can be adjusted by merchandisers)
  signalWeights: {
    textRelevance: number;      // BM25 score
    attributeMatch: number;      // Attribute boosts
    popularity: number;          // View/click signals
    stockAvailability: number;   // In-stock boost
    recency: number;             // New products boost
    priceCompetitiveness: number; // Price-based boost
    brandStrategy: number;       // Strategic brand boost
  };

  // Business rules
  businessRules: {
    boostNewProducts: boolean;       // Boost products added in last 30 days
    newProductBoostDays: number;     // Days to consider product "new"
    boostInStock: boolean;           // Prioritize in-stock items
    outOfStockPenalty: number;       // Penalty multiplier for out-of-stock
    diversifyResults: boolean;       // Apply diversity to avoid monotony
    diversityFactor: number;         // How much diversity (0-1)
  };

  // Brand strategies (for merchandising campaigns)
  brandBoosts: Map<string, number>;  // brand -> boost multiplier
  
  // Category strategies
  categoryBoosts: Map<string, number>; // category -> boost multiplier

  // Pinned products (always show at specific positions)
  pinnedProducts: Map<number, string>; // position -> productId
}

/**
 * Product signals for merchandising
 */
export interface ProductSignals {
  productId: string;
  viewCount: number;
  clickCount: number;
  purchaseCount: number;
  addedDate: Date;
  stockQuantity: number;
  avgRating?: number;
}

/**
 * Merchandising Engine - Applies business logic and optimization to search results
 */
export class MerchandisingEngine {
  private config: MerchandisingConfig;
  private productSignals: Map<string, ProductSignals> = new Map();

  constructor(config?: Partial<MerchandisingConfig>) {
    this.config = this.getDefaultConfig();
    if (config) {
      this.updateConfig(config);
    }
  }

  /**
   * Get default merchandising configuration
   */
  private getDefaultConfig(): MerchandisingConfig {
    return {
      signalWeights: {
        textRelevance: 0.35,
        attributeMatch: 0.25,
        popularity: 0.15,
        stockAvailability: 0.10,
        recency: 0.05,
        priceCompetitiveness: 0.05,
        brandStrategy: 0.05,
      },
      businessRules: {
        boostNewProducts: true,
        newProductBoostDays: 30,
        boostInStock: true,
        outOfStockPenalty: 0.5,
        diversifyResults: true,
        diversityFactor: 0.3,
      },
      brandBoosts: new Map(),
      categoryBoosts: new Map(),
      pinnedProducts: new Map(),
    };
  }

  /**
   * Update merchandising configuration (for dynamic control)
   */
  updateConfig(partialConfig: Partial<MerchandisingConfig>): void {
    if (partialConfig.signalWeights) {
      this.config.signalWeights = { ...this.config.signalWeights, ...partialConfig.signalWeights };
    }
    if (partialConfig.businessRules) {
      this.config.businessRules = { ...this.config.businessRules, ...partialConfig.businessRules };
    }
    if (partialConfig.brandBoosts) {
      this.config.brandBoosts = partialConfig.brandBoosts;
    }
    if (partialConfig.categoryBoosts) {
      this.config.categoryBoosts = partialConfig.categoryBoosts;
    }
    if (partialConfig.pinnedProducts) {
      this.config.pinnedProducts = partialConfig.pinnedProducts;
    }
  }

  /**
   * Set product signals for merchandising
   */
  setProductSignals(signals: ProductSignals[]): void {
    this.productSignals.clear();
    signals.forEach(signal => {
      this.productSignals.set(signal.productId, signal);
    });
  }

  /**
   * Apply merchandising logic to scored products
   */
  applyMerchandising(scoredProducts: ScoredProduct[]): ScoredProduct[] {
    // Step 1: Calculate merchandising adjustments
    const merchandisedProducts: ScoredProduct[] = scoredProducts.map(sp => {
      const merchandisingScore = this.calculateMerchandisingScore(sp);
      return {
        ...sp,
        scores: {
          ...sp.scores,
          merchandising: merchandisingScore,
          final: sp.scores.final + merchandisingScore,
        },
      } as ScoredProduct;
    });

    // Step 2: Sort by final score
    merchandisedProducts.sort((a, b) => b.scores.final - a.scores.final);

    // Step 3: Apply diversity if enabled
    let results: ScoredProduct[] = merchandisedProducts;
    if (this.config.businessRules.diversifyResults) {
      results = this.applyDiversity(merchandisedProducts);
    }

    // Step 4: Apply pinned products
    results = this.applyPinnedProducts(results);

    return results;
  }

  /**
   * Calculate merchandising score for a product
   */
  private calculateMerchandisingScore(scoredProduct: ScoredProduct): number {
    const product = scoredProduct.product;
    let merchandisingScore = 0;

    // Popularity signal
    merchandisingScore += this.calculatePopularityScore(product.id);

    // Stock availability signal
    merchandisingScore += this.calculateStockScore(product);

    // Recency signal (new products)
    merchandisingScore += this.calculateRecencyScore(product);

    // Brand strategy signal
    merchandisingScore += this.calculateBrandStrategyScore(product);

    // Category strategy signal
    merchandisingScore += this.calculateCategoryStrategyScore(product);

    // Price competitiveness
    merchandisingScore += this.calculatePriceCompetitivenessScore(product);

    return merchandisingScore;
  }

  /**
   * Calculate popularity score based on user signals
   */
  private calculatePopularityScore(productId: string): number {
    const signals = this.productSignals.get(productId);
    if (!signals) {
      return 0;
    }

    // Weighted popularity: purchases > clicks > views
    const normalizedPopularity = 
      (signals.purchaseCount * 3.0) +
      (signals.clickCount * 1.5) +
      (signals.viewCount * 0.5);

    // Normalize to 0-10 range (assuming max popularity = 1000)
    const score = Math.min(normalizedPopularity / 100, 10);

    return score * this.config.signalWeights.popularity;
  }

  /**
   * Calculate stock availability score
   */
  private calculateStockScore(product: Product): number {
    if (!this.config.businessRules.boostInStock) {
      return 0;
    }

    const signals = this.productSignals.get(product.id);
    if (!signals) {
      return 0;
    }

    // In stock: boost, Out of stock: penalty
    if (signals.stockQuantity > 0) {
      // Higher stock = higher boost (up to 5 points)
      const stockBoost = Math.min(Math.log10(signals.stockQuantity + 1) * 2, 5);
      return stockBoost * this.config.signalWeights.stockAvailability;
    } else {
      // Out of stock penalty
      return -5 * this.config.businessRules.outOfStockPenalty;
    }
  }

  /**
   * Calculate recency score (boost new products)
   */
  private calculateRecencyScore(product: Product): number {
    if (!this.config.businessRules.boostNewProducts) {
      return 0;
    }

    const signals = this.productSignals.get(product.id);
    if (!signals) {
      return 0;
    }

    const daysSinceAdded = (Date.now() - signals.addedDate.getTime()) / (1000 * 60 * 60 * 24);
    const newProductDays = this.config.businessRules.newProductBoostDays;

    if (daysSinceAdded <= newProductDays) {
      // Linear decay: newer products get higher boost
      const recencyFactor = 1 - (daysSinceAdded / newProductDays);
      return recencyFactor * 3.0 * this.config.signalWeights.recency;
    }

    return 0;
  }

  /**
   * Calculate brand strategy score
   */
  private calculateBrandStrategyScore(product: Product): number {
    if (!product.brand) {
      return 0;
    }

    const brandBoost = this.config.brandBoosts.get(product.brand.toLowerCase());
    if (brandBoost) {
      return brandBoost * this.config.signalWeights.brandStrategy;
    }

    return 0;
  }

  /**
   * Calculate category strategy score
   */
  private calculateCategoryStrategyScore(product: Product): number {
    if (!product.productType) {
      return 0;
    }

    const categoryBoost = this.config.categoryBoosts.get(product.productType.toLowerCase());
    if (categoryBoost) {
      return categoryBoost * this.config.signalWeights.brandStrategy;
    }

    return 0;
  }

  /**
   * Calculate price competitiveness score
   */
  private calculatePriceCompetitivenessScore(product: Product): number {
    // Check if there's a sale
    const price = parseFloat((product.price || '0').replace(/[^0-9.]/g, ''));
    const salePrice = parseFloat((product.salePrice || product.price || '0').replace(/[^0-9.]/g, ''));

    if (salePrice < price) {
      const discount = ((price - salePrice) / price) * 100;
      // Boost products with higher discounts (up to 3 points for 50%+ discount)
      const score = Math.min((discount / 50) * 3, 3);
      return score * this.config.signalWeights.priceCompetitiveness;
    }

    return 0;
  }

  /**
   * Apply diversity to search results
   * Ensures variety in brand, category, price range
   */
  private applyDiversity(products: ScoredProduct[]): ScoredProduct[] {
    if (products.length <= 3) {
      return products; // Too few to diversify
    }

    const diversityFactor = this.config.businessRules.diversityFactor;
    const diversified: ScoredProduct[] = [];
    const seenBrands = new Set<string>();
    const seenCategories = new Set<string>();

    // Take top products but skip if too similar to already selected
    for (const product of products) {
      const brand = product.product.brand?.toLowerCase() || '';
      const category = product.product.productType?.toLowerCase() || '';

      // First 3 always included (highest relevance)
      if (diversified.length < 3) {
        diversified.push(product);
        seenBrands.add(brand);
        seenCategories.add(category);
        continue;
      }

      // For remaining positions, apply diversity
      const isDifferentBrand = !seenBrands.has(brand);
      const isDifferentCategory = !seenCategories.has(category);

      // Accept if sufficiently different OR has very high score
      const scoreThreshold = diversified[diversified.length - 1].scores.final * (1 - diversityFactor);
      if (isDifferentBrand || isDifferentCategory || product.scores.final > scoreThreshold) {
        diversified.push(product);
        seenBrands.add(brand);
        seenCategories.add(category);
      }

      // Stop if we have enough results
      if (diversified.length >= products.length) {
        break;
      }
    }

    // Add remaining products that weren't included
    for (const product of products) {
      if (!diversified.includes(product)) {
        diversified.push(product);
      }
    }

    return diversified;
  }

  /**
   * Apply pinned products at specific positions
   */
  private applyPinnedProducts(products: ScoredProduct[]): ScoredProduct[] {
    if (this.config.pinnedProducts.size === 0) {
      return products;
    }

    const result = [...products];

    // Apply each pinned product
    for (const [position, productId] of this.config.pinnedProducts.entries()) {
      // Find the product in results
      const pinnedIndex = result.findIndex(sp => sp.product.id === productId);
      
      if (pinnedIndex !== -1 && position < result.length) {
        // Move product to pinned position
        const [pinnedProduct] = result.splice(pinnedIndex, 1);
        result.splice(position, 0, pinnedProduct);
      }
    }

    return result;
  }

  /**
   * Get current configuration (for admin UI)
   */
  getConfig(): MerchandisingConfig {
    return { ...this.config };
  }
}
