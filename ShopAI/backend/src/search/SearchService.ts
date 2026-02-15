// Search Service - Main orchestration layer for hybrid search

import { Product } from '../../../shared/types';
import { InvertedIndex } from './InvertedIndex';
import { BM25Scorer } from './BM25Scorer';
import { QueryParserService } from './QueryParserService';
import { AttributeBooster } from './AttributeBooster';
import { ProductIndexer } from './ProductIndexer';
import { MerchandisingEngine, ProductSignals } from './MerchandisingEngine';
import { SearchableProduct, ScoredProduct } from './types';
import type { QueryParserVersion } from '../../../shared/types/config';
import { SimpleCache } from '../services/simpleCache';

export class SearchService {
  private index: InvertedIndex;
  private scorer: BM25Scorer;
  private parser: QueryParserService;
  private booster: AttributeBooster;
  private indexer: ProductIndexer;
  private merchandising: MerchandisingEngine;
  private searchableProducts: Map<string, SearchableProduct> = new Map();
  private isIndexed: boolean = false;
  private searchCache: SimpleCache<Product[]>;

  constructor(parserVersion: QueryParserVersion = 'v1') {
    this.index = new InvertedIndex();
    this.scorer = new BM25Scorer(this.index);
    this.parser = new QueryParserService(parserVersion);
    this.booster = new AttributeBooster();
    this.indexer = new ProductIndexer();
    this.merchandising = new MerchandisingEngine();
    this.searchCache = new SimpleCache<Product[]>(1000, 600000); // Cache 1000 queries for 10 min
    
    console.log(`[SearchService] Initialized with Query Parser version: ${parserVersion}`);
  }

  /**
   * Build index from products (call once when products are loaded)
   */
  buildIndex(products: Product[]): void {
    console.log(`[SearchService] Building index for ${products.length} products...`);
    
    const startTime = Date.now();

    // Step 1: Convert to searchable products
    const searchableProducts = this.indexer.indexProducts(products);
    console.log(`[SearchService] Indexer returned ${searchableProducts.length} searchable products`);
    
    const size28BeforeMap = searchableProducts.filter(p => p.size === '28').length;
    console.log(`[SearchService] Size 28 products before adding to map: ${size28BeforeMap}`);
    
    this.searchableProducts.clear();
    searchableProducts.forEach(p => {
      // Use composite key: productId-size to handle same product in multiple sizes
      const key = p.size ? `${p.id}-${p.size}` : p.id;
      this.searchableProducts.set(key, p);
    });
    
    const size28AfterMap = Array.from(this.searchableProducts.values()).filter(p => p.size === '28').length;
    console.log(`[SearchService] Size 28 products after adding to map: ${size28AfterMap}`);
    console.log(`[SearchService] Total products in searchableProducts map: ${this.searchableProducts.size}`);

    // Step 2: Prepare documents for inverted index
    const documents = this.indexer.prepareForIndexing(products);

    // Step 3: Build inverted index
    this.index.buildIndex(documents);

    this.isIndexed = true;

    const duration = Date.now() - startTime;
    const stats = this.index.getStats();
    console.log(`[SearchService] Index built in ${duration}ms - ${stats.terms} terms, ${stats.documents} docs`);
  }

  /**
   * Search products using hybrid BM25 + attribute boosting
   * 
   * @param query - Free text search query
   * @param topK - Number of results to return (default: 10)
   * @returns Ranked list of products
   */
  async search(query: string, topK: number = 10): Promise<Product[]> {
    if (!this.isIndexed) {
      console.warn('[SearchService] Index not built. Call buildIndex() first.');
      return [];
    }

    // Check cache first
    const cacheKey = `${query}:${topK}`;
    const cachedResult = this.searchCache.get(cacheKey);
    if (cachedResult) {
      console.log(`[SearchService] Cache HIT for query: "${query}"`);
      return cachedResult;
    }

    const startTime = Date.now();

    // STEP 1: Parse query and extract attributes
    const attributes = await this.parser.parse(query);
    console.log('[SearchService] Extracted attributes:', attributes);

    // STEP 2: Get query tokens for BM25
    const queryTokens = this.scorer.tokenizeQuery(query);
    
    // STEP 3: Get candidate documents (all docs with at least one matching term)
    const candidates = this.scorer.getCandidateDocuments(queryTokens);
    console.log(`[SearchService] Found ${candidates.size} candidate documents`);

    // STEP 3.5: If size is specified, add ALL products with matching size to candidates
    // This ensures size-specific products are not missed by BM25 text matching
    if (attributes.size) {
      console.log(`[SearchService] Size attribute detected: ${attributes.size}, expanding candidates...`);
      
      // Debug: Count total products with size 28 in searchableProducts
      const allSize28 = Array.from(this.searchableProducts.values()).filter(p => {
        return p.size && String(p.size).trim() === '28';
      });
      console.log(`[SearchService] Total products with size=28 in searchableProducts: ${allSize28.length}`);
      if (allSize28.length > 0) {
        console.log(`[SearchService] Sample size=28 products:`, allSize28.slice(0, 3).map(p => ({
          id: p.id,
          size: p.size,
          gender: p.gender,
          type: p.productType?.substring(0, 30)
        })));
      }
      
      let sizeMatchCount = 0;
      const sizeMatches: Array<{id: string, size: string, gender: string, type: string}> = [];
      
      for (const [productId, product] of this.searchableProducts.entries()) {
        if (!product.size) continue;
        
        const productSize = String(product.size).trim();
        const querySize = attributes.size.trim();
        
        // NOTE: productId is the map key which is already "id-size" composite
        // Exact match or numeric match within ±1
        if (productSize === querySize) {
          if (!candidates.has(productId)) {
            candidates.add(productId);  // productId is already composite "id-size"
            sizeMatchCount++;
            sizeMatches.push({
              id: productId,
              size: productSize,
              gender: product.gender || 'N/A',
              type: product.productType || 'N/A'
            });
          }
        } else {
          const productSizeNum = parseFloat(productSize);
          const querySizeNum = parseFloat(querySize);
          
          if (!isNaN(productSizeNum) && !isNaN(querySizeNum)) {
            const diff = Math.abs(productSizeNum - querySizeNum);
            if (diff <= 1.0) {
              if (!candidates.has(productId)) {
                candidates.add(productId);  // productId is already composite "id-size"
                sizeMatchCount++;
                sizeMatches.push({
                  id: productId,
                  size: productSize,
                  gender: product.gender || 'N/A',
                  type: product.productType || 'N/A'
                });
              }
            }
          }
        }
      }
      
      console.log(`[SearchService] Added ${sizeMatchCount} size-matched products to candidates (total: ${candidates.size})`);
      if (sizeMatches.length > 0) {
        console.log(`[SearchService] Size matches:`, sizeMatches.slice(0, 10));
      }
    }

    if (candidates.size === 0) {
      console.log('[SearchService] No candidates found');
      return [];
    }

    // STEP 4: Calculate BM25 scores for candidates
    const bm25Scores = this.scorer.scoreDocuments(queryTokens, Array.from(candidates));

    // STEP 5: Score all canddates with attribute boosting
    const scoredProducts: ScoredProduct[] = [];

    for (const [productId, bm25Score] of bm25Scores.entries()) {
      // Try to get searchable product - handle composite keys (id-size)
      let searchableProduct = this.searchableProducts.get(productId);
      
      // If not found, try finding any variant of this product ID
      if (!searchableProduct) {
        const matchingKey = Array.from(this.searchableProducts.keys()).find(key => key.startsWith(productId + '-') || key === productId);
        if (matchingKey) {
          searchableProduct = this.searchableProducts.get(matchingKey);
        }
      }
      
      if (!searchableProduct) continue;

      // Calculate attribute boosts
      const boosts = this.booster.calculateBoosts(searchableProduct, attributes);

      // Calculate final score
      const finalScore = this.booster.calculateFinalScore(bm25Score, boosts);

      scoredProducts.push({
        product: searchableProduct,
        scores: {
          bm25: bm25Score,
          brand: boosts.brand,
          color: boosts.color,
          category: boosts.category,
          size: boosts.size,
          gender: boosts.gender,
          specialFeatures: boosts.specialFeatures,
          final: finalScore,
        },
      });
    }

    // STEP 6: Filter out products with negative scores (category mismatch)
    const validProducts = scoredProducts.filter(sp => sp.scores.final > 0);

    // STEP 7: Apply merchandising
    const merchandisedProducts = this.merchandising.applyMerchandising(validProducts);

    // STEP 8: Return top K results
    const results = merchandisedProducts.slice(0, topK).map(sp => sp.product);

    const duration = Date.now() - startTime;
    console.log(`[SearchService] Search completed in ${duration}ms - ${results.length} results`);

    // Cache the results ONLY if we found products (avoid caching empty results)
    if (results.length > 0) {
      this.searchCache.set(cacheKey, results);
      console.log(`[SearchService] Cached ${results.length} results for query: "${query}"`);
    } else {
      console.log(`[SearchService] Skipping cache for empty results: "${query}"`);
    }

    return results;
  }

  /**
   * Get detailed search results with scores (for debugging)
   */
  async searchWithScores(query: string, topK: number = 10): Promise<ScoredProduct[]> {
    if (!this.isIndexed) {
      return [];
    }

    const attributes = await this.parser.parse(query);
    const queryTokens = this.scorer.tokenizeQuery(query);
    const candidates = this.scorer.getCandidateDocuments(queryTokens);

    if (candidates.size === 0) {
      return [];
    }

    const bm25Scores = this.scorer.scoreDocuments(queryTokens, Array.from(candidates));
    const scoredProducts: ScoredProduct[] = [];

    for (const [productId, bm25Score] of bm25Scores.entries()) {
      const searchableProduct = this.searchableProducts.get(productId);
      if (!searchableProduct) continue;

      const boosts = this.booster.calculateBoosts(searchableProduct, attributes);
      const finalScore = this.booster.calculateFinalScore(bm25Score, boosts);

      scoredProducts.push({
        product: searchableProduct,
        scores: {
          bm25: bm25Score,
          brand: boosts.brand,
          color: boosts.color,
          category: boosts.category,
          size: boosts.size,
          gender: boosts.gender,
          specialFeatures: boosts.specialFeatures,
          final: finalScore,
        },
      });
    }

    // Filter out products with negative scores
    const validProducts = scoredProducts.filter(sp => sp.scores.final > 0);

    // Apply merchandising
    const merchandisedProducts = this.merchandising.applyMerchandising(validProducts);

    return merchandisedProducts.slice(0, topK);
  }

  /**
   * Set product signals for merchandising
   */
  setProductSignals(signals: ProductSignals[]): void {
    this.merchandising.setProductSignals(signals);
  }

  /**
   * Get merchandising engine for configuration
   */
  getMerchandisingEngine(): MerchandisingEngine {
    return this.merchandising;
  }

  /**
   * Check if index is built
   */
  isReady(): boolean {
    return this.isIndexed;
  }

  /**
   * Clear index (call when products are updated)
   */
  clearIndex(): void {
    this.index.clear();
    this.searchableProducts.clear();
    this.isIndexed = false;
  }

  /**
   * Set query parser version (v1/v2/v3)
   */
  setParserVersion(version: QueryParserVersion): void {
    this.parser.setVersion(version);
    console.log(`[SearchService] Query parser version changed to: ${version}`);
  }

  /**
   * Get current parser version
   */
  getParserVersion(): QueryParserVersion {
    return this.parser.getVersion();
  }

  /**
   * Get parser version info
   */
  getParserVersionInfo() {
    return this.parser.getVersionInfo();
  }

  /**
   * Get search service stats including cache performance
   */
  getStats() {
    return {
      isIndexed: this.isIndexed,
      totalProducts: this.searchableProducts.size,
      indexStats: this.index.getStats(),
      cacheStats: this.searchCache.getStats(),
    };
  }
}
