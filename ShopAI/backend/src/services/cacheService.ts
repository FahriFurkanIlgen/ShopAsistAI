import NodeCache from 'node-cache';
import { GoogleFeed, Product } from '../../../shared/types';
import { SearchService } from '../search';
import { WidgetConfig, QueryParserVersion } from '../../../shared/types/config';

export class CacheService {
  private static instance: CacheService;
  private cache: NodeCache;
  private readonly TTL: number;
  private searchServices: Map<string, SearchService> = new Map();
  private siteConfigs: Map<string, WidgetConfig> = new Map(); // Store site configs

  private constructor() {
    this.TTL = parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10);
    this.cache = new NodeCache({ 
      stdTTL: this.TTL,
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false, // Better performance
    });

    console.log(`💾 Cache initialized with TTL: ${this.TTL}s (${this.TTL / 60} minutes)`);
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  public set(key: string, value: any): boolean {
    try {
      return this.cache.set(key, value);
    } catch (error) {
      console.error(`Error setting cache key ${key}:`, error);
      return false;
    }
  }

  public get<T>(key: string): T | undefined {
    try {
      return this.cache.get<T>(key);
    } catch (error) {
      console.error(`Error getting cache key ${key}:`, error);
      return undefined;
    }
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public delete(key: string): number {
    return this.cache.del(key);
  }

  public flush(): void {
    this.cache.flushAll();
    console.log('🗑️  Cache flushed');
  }

  public getStats() {
    const searchCacheStats: Record<string, any> = {};
    
    // Collect stats from all SearchService instances
    for (const [siteId, searchService] of this.searchServices.entries()) {
      searchCacheStats[siteId] = searchService.getStats();
    }
    
    return {
      keys: this.cache.keys().length,
      stats: this.cache.getStats(),
      searchServices: searchCacheStats,
    };
  }

  // Specific methods for our use case
  public getFeed(siteId: string): GoogleFeed | undefined {
    return this.get<GoogleFeed>(`feed:${siteId}`);
  }

  public setFeed(feed: GoogleFeed): boolean {
    const success = this.set(`feed:${feed.siteId}`, feed);
    
    if (success && feed.products && feed.products.length > 0) {
      // Build search index when feed is updated
      this.buildSearchIndex(feed.siteId, feed.products);
    }
    
    return success;
  }

  /**
   * Build or rebuild search index for a site
   */
  private buildSearchIndex(siteId: string, products: Product[]): void {
    try {
      console.log(`[CacheService] buildSearchIndex called with ${products.length} products`);
      
      // Debug: Count size 28 products
      const size28Count = products.filter(p => p.size === '28').length;
      console.log(`[CacheService] Products with size=28: ${size28Count}`);
      
      let searchService = this.searchServices.get(siteId);
      
      // Get parser version from site config (default: v1)
      const config = this.siteConfigs.get(siteId);
      const parserVersion = (config?.queryParserVersion || 'v1') as QueryParserVersion;
      
      if (!searchService) {
        searchService = new SearchService(parserVersion);
        this.searchServices.set(siteId, searchService);
        console.log(`🔍 Search service created for ${siteId} with parser version: ${parserVersion}`);
      } else {
        // Update parser version if config changed
        searchService.setParserVersion(parserVersion);
      }
      
      searchService.buildIndex(products);
      console.log(`🔍 Search index built for ${siteId}`);
    } catch (error) {
      console.error(`Error building search index for ${siteId}:`, error);
    }
  }

  /**
   * Get search service for a site (production-grade BM25 search)
   */
  public getSearchService(siteId: string): SearchService | undefined {
    return this.searchServices.get(siteId);
  }

  /**
   * Use hybrid search engine (BM25 + attribute boosting)
   */
  public async hybridSearch(siteId: string, query: string, topK: number = 10): Promise<Product[]> {
    const searchService = this.getSearchService(siteId);
    
    if (searchService && searchService.isReady()) {
      // Use production-grade search engine
      return await searchService.search(query, topK);
    }
    
    // Fallback to simple search
    console.warn(`[CacheService] Hybrid search not available for ${siteId}, using fallback`);
    return this.searchProducts(siteId, query).slice(0, topK);
  }

  public getProducts(siteId: string): Product[] | undefined {
    const feed = this.getFeed(siteId);
    return feed?.products;
  }

  /**
   * Get all products from all sites (for GraphDB sync)
   */
  public getAllProducts(): Product[] {
    const allProducts: Product[] = [];
    const keys = this.cache.keys();
    
    // Get all feed keys
    const feedKeys = keys.filter(key => key.startsWith('feed:'));
    
    for (const key of feedKeys) {
      const feed = this.get<GoogleFeed>(key);
      if (feed && feed.products) {
        allProducts.push(...feed.products);
      }
    }
    
    console.log(`[CacheService] getAllProducts: Found ${allProducts.length} products from ${feedKeys.length} sites`);
    return allProducts;
  }

  public searchProducts(siteId: string, query: string): Product[] {
    const products = this.getProducts(siteId);
    if (!products || !query) return [];

    const lowerQuery = query.toLowerCase();
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.brand?.toLowerCase().includes(lowerQuery)
    );
  }

  public async filterProductsByCategory(siteId: string, keywords: string[]): Promise<Product[]> {
    const products = this.getProducts(siteId);
    if (!products || !keywords || keywords.length === 0) return [];

    // Step 1: Filter products by category using exact matching on productType and gender
    const categoryFiltered = products.filter((p) => {
      const genderText = (p.gender || '').toLowerCase();
      const productTypeText = (p.productType || '').toLowerCase();
      const titleText = (p.title || '').toLowerCase();
      const descriptionText = (p.description || '').toLowerCase();
      
      return keywords.some((keyword) => {
        const lowerKeyword = keyword.toLowerCase();
        
        // For kids/children category, strictly check productType and gender
        if (lowerKeyword === 'kids' || lowerKeyword === 'çocuk' || lowerKeyword === 'children') {
          return productTypeText.includes('çocuk') || genderText.includes('çocuk');
        }
        
        // For gender-specific categories (erkek/kadın)
        if (lowerKeyword === 'erkek' || lowerKeyword === 'kadın') {
          return genderText.includes(lowerKeyword) || productTypeText.includes(lowerKeyword);
        }
        
        // For other categories (spor, athletic, running, etc.)
        return titleText.includes(lowerKeyword) || 
               productTypeText.includes(lowerKeyword) ||
               descriptionText.includes(lowerKeyword);
      });
    });

    console.log(`[CacheService] Category filter: ${keywords.join(', ')} -> ${categoryFiltered.length} products found`);

    // Step 2: Deduplicate the filtered products
    // Pick best variant based on discount and stock
    const deduplicated = this.deduplicateProducts(categoryFiltered);
    
    console.log(`[CacheService] After deduplication: ${deduplicated.length} unique products`);

    // Step 3: Sort by discount percentage (highest first)
    deduplicated.sort((a, b) => {
      const discountA = this.getDiscountPercentage(a);
      const discountB = this.getDiscountPercentage(b);
      
      if (discountA !== discountB) {
        return discountB - discountA; // Higher discount first
      }
      
      // If same discount, prefer in-stock
      const aInStock = a.availability === 'in stock' ? 1 : 0;
      const bInStock = b.availability === 'in stock' ? 1 : 0;
      
      return bInStock - aInStock;
    });

    return deduplicated;
  }

  /**
   * Deduplicate products by ID, keeping the best variant
   * Prioritize: 1) Discount percentage 2) Stock availability 3) Size preference
   */
  private deduplicateProducts(products: Product[]): Product[] {
    const productMap = new Map<string, Product>();
    
    for (const product of products) {
      const baseId = this.extractBaseProductId(product.id);
      const existing = productMap.get(baseId);
      
      if (!existing) {
        productMap.set(baseId, product);
        continue;
      }
      
      // Keep the better variant
      if (this.isBetterVariant(product, existing)) {
        productMap.set(baseId, product);
      }
    }
    
    return Array.from(productMap.values());
  }

  /**
   * Extract base product ID (remove size/color variants)
   */
  private extractBaseProductId(id: string): string {
    // Remove common separators and keep the main ID
    return id.split(/[\s-_]/)[0];
  }

  /**
   * Determine if product A is better than product B
   */
  private isBetterVariant(productA: Product, productB: Product): boolean {
    // 1. Prefer in-stock products
    const aInStock = productA.availability === 'in stock';
    const bInStock = productB.availability === 'in stock';
    if (aInStock && !bInStock) return true;
    if (!aInStock && bInStock) return false;
    
    // 2. Prefer higher discount percentage
    const aDiscount = this.getDiscountPercentage(productA);
    const bDiscount = this.getDiscountPercentage(productB);
    if (aDiscount > bDiscount) return true;
    if (aDiscount < bDiscount) return false;
    
    // 3. Prefer lower price (if both have same discount)
    const aPrice = this.extractPrice(productA.salePrice || productA.price);
    const bPrice = this.extractPrice(productB.salePrice || productB.price);
    if (aPrice !== null && bPrice !== null && aPrice < bPrice) return true;
    
    return false;
  }

  /**
   * Calculate discount percentage
   */
  private getDiscountPercentage(product: Product): number {
    if (!product.salePrice || !product.price) return 0;
    
    const originalPrice = this.extractPrice(product.price);
    const salePrice = this.extractPrice(product.salePrice);
    
    if (originalPrice === null || salePrice === null || originalPrice <= salePrice) return 0;
    
    return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
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

  /**
   * Set site configuration (including parser version)
   */
  public setSiteConfig(config: WidgetConfig): void {
    this.siteConfigs.set(config.siteId, config);
    console.log(`⚙️  Config set for ${config.siteId}, queryParserVersion: ${config.queryParserVersion || 'v1'}`);
    
    // Rebuild search index if feed exists (to apply new parser version)
    const feed = this.getFeed(config.siteId);
    if (feed?.products && feed.products.length > 0) {
      this.buildSearchIndex(config.siteId, feed.products);
    }
  }

  /**
   * Get site configuration
   */
  public getSiteConfig(siteId: string): WidgetConfig | undefined {
    return this.siteConfigs.get(siteId);
  }

  /**
   * Set query parser version for a site
   */
  public setParserVersion(siteId: string, version: QueryParserVersion): void {
    const config = this.siteConfigs.get(siteId) || { siteId, siteName: siteId };
    config.queryParserVersion = version;
    this.setSiteConfig(config);
  }

  /**
   * Get current parser version for a site
   */
  public getParserVersion(siteId: string): QueryParserVersion {
    return (this.siteConfigs.get(siteId)?.queryParserVersion || 'v1') as QueryParserVersion;
  }
}
