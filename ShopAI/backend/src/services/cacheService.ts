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

  public filterProductsByCategory(siteId: string, keywords: string[]): Product[] {
    const products = this.getProducts(siteId);
    if (!products || !keywords || keywords.length === 0) return [];

    return products.filter((p) => {
      const searchText = `${p.title} ${p.description} ${p.productType || ''} ${p.googleProductCategory || ''}`.toLowerCase();
      return keywords.some((keyword) => searchText.includes(keyword.toLowerCase()));
    });
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
