// Search Service - Main orchestration layer for hybrid search

import { Product } from '../../../shared/types';
import { InvertedIndex } from './InvertedIndex';
import { BM25Scorer } from './BM25Scorer';
import { QueryParserService } from './QueryParserService';
import { AttributeBooster } from './AttributeBooster';
import { ProductIndexer } from './ProductIndexer';
import { MerchandisingEngine, ProductSignals } from './MerchandisingEngine';
import { SearchableProduct, ScoredProduct, StrategyResult } from './types';
import type { QueryParserVersion } from '../../../shared/types/config';
import { SimpleCache } from '../services/simpleCache';
import { QueryAnalyzer } from './QueryAnalyzer';
import { SKUMatcher } from './SKUMatcher';
import { graphService } from '../services/graphService';

export class SearchService {
  private index: InvertedIndex;
  private scorer: BM25Scorer;
  private parser: QueryParserService;
  private booster: AttributeBooster;
  private indexer: ProductIndexer;
  private merchandising: MerchandisingEngine;
  private queryAnalyzer: QueryAnalyzer;
  private skuMatcher: SKUMatcher;
  private searchableProducts: Map<string, SearchableProduct> = new Map();
  private allProducts: Product[] = [];
  private isIndexed: boolean = false;
  private searchCache: SimpleCache<Product[]>;

  constructor(parserVersion: QueryParserVersion = 'v1') {
    this.index = new InvertedIndex();
    this.scorer = new BM25Scorer(this.index);
    this.parser = new QueryParserService(parserVersion);
    this.booster = new AttributeBooster();
    this.indexer = new ProductIndexer();
    this.merchandising = new MerchandisingEngine();
    this.queryAnalyzer = new QueryAnalyzer();
    this.skuMatcher = new SKUMatcher([]);
    this.searchCache = new SimpleCache<Product[]>(1000, 600000); // Cache 1000 queries for 10 min
    
    console.log(`[SearchService] Initialized with Query Parser version: ${parserVersion}`);
  }

  /**
   * Build index from products (call once when products are loaded)
   */
  buildIndex(products: Product[]): void {
    console.log(`[SearchService] Building index for ${products.length} products...`);
    
    const startTime = Date.now();

    // Store all products for SKU matching
    this.allProducts = products;
    this.skuMatcher.updateProducts(products);

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
   * Multi-Strategy Search - tries different strategies based on query type
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

    // STEP 1: Analyze query to determine best strategy
    const analysis = this.queryAnalyzer.analyze(query);
    console.log(`[SearchService] Query Analysis:`, {
      query,
      primaryType: analysis.primaryType,
      secondaryTypes: analysis.secondaryTypes,
      confidence: analysis.confidence,
      patterns: analysis.detectedPatterns,
    });

    // STEP 2: Execute search strategies
    const strategyResults: StrategyResult[] = [];

    // Strategy 1: SKU/Product Code search (if detected)
    if (analysis.primaryType === 'sku-exact' || 
        analysis.primaryType === 'sku-partial' || 
        analysis.primaryType === 'product-code') {
      
      const skuResult = this.searchBySKU(query, analysis);
      if (skuResult.products.length > 0) {
        strategyResults.push(skuResult);
        console.log(`[SearchService] SKU Strategy found ${skuResult.products.length} products`);
      }
    }

    // Strategy 2: Semantic/BM25 search (always try as fallback or primary)
    if (analysis.shouldTryAllStrategies || 
        strategyResults.length === 0 ||
        analysis.primaryType === 'semantic' ||
        analysis.primaryType === 'attribute-combo' ||
        analysis.primaryType === 'category') {
      
      const semanticResult = await this.searchSemantic(query, topK * 2);
      if (semanticResult.products.length > 0) {
        strategyResults.push(semanticResult);
        console.log(`[SearchService] Semantic Strategy found ${semanticResult.products.length} products`);
      }
    }

    // STEP 3: Merge and rank results from all strategies
    const mergedResults = this.mergeStrategyResults(strategyResults, topK);

    const duration = Date.now() - startTime;
    console.log(`[SearchService] Multi-strategy search completed in ${duration}ms - ${mergedResults.length} results`);

    // Cache the results
    if (mergedResults.length > 0) {
      this.searchCache.set(cacheKey, mergedResults);
      console.log(`[SearchService] Cached ${mergedResults.length} results for query: "${query}"`);
    }

    return mergedResults;
  }

  /**
   * SKU/Product Code Search Strategy
   */
  private searchBySKU(query: string, analysis: any): StrategyResult {
    const skuQuery = analysis.detectedPatterns.sku || 
                     analysis.detectedPatterns.partialSku || 
                     analysis.detectedPatterns.productCode || 
                     query;

    const skuResults = this.skuMatcher.search(skuQuery);
    
    // Prioritize exact matches, then variants, then fuzzy
    const products = [
      ...skuResults.exactMatches,
      ...skuResults.variantMatches.slice(0, 10), // Limit variants
      ...skuResults.fuzzyMatches.slice(0, 5),    // Limit fuzzy matches
    ];

    return {
      strategy: 'sku-based',
      products,
      score: 1.0, // SKU searches have highest priority
      matchCount: products.length,
    };
  }

  /**
   * Semantic/BM25 Search Strategy (original implementation)
   */
  private async searchSemantic(query: string, topK: number): Promise<StrategyResult> {
    // Parse query and extract attributes
    const attributes = await this.parser.parse(query);

    // Get query tokens for BM25
    const queryTokens = this.scorer.tokenizeQuery(query);
    
    // Get candidate documents
    const candidates = this.scorer.getCandidateDocuments(queryTokens);

    // Add size-matched products to candidates (if size specified)
    if (attributes.size) {
      for (const [productId, product] of this.searchableProducts.entries()) {
        if (!product.size) continue;
        
        const productSize = String(product.size).trim();
        const querySize = attributes.size.trim();
        
        if (productSize === querySize) {
          candidates.add(productId);
        } else {
          const productSizeNum = parseFloat(productSize);
          const querySizeNum = parseFloat(querySize);
          
          if (!isNaN(productSizeNum) && !isNaN(querySizeNum) && Math.abs(productSizeNum - querySizeNum) <= 1.0) {
            candidates.add(productId);
          }
        }
      }
    }

    if (candidates.size === 0) {
      return {
        strategy: 'semantic-bm25',
        products: [],
        score: 0.5,
        matchCount: 0,
      };
    }

    // Calculate BM25 scores
    const bm25Scores = this.scorer.scoreDocuments(queryTokens, Array.from(candidates));

    // Score with attribute boosting
    const scoredProducts: ScoredProduct[] = [];

    for (const [productId, bm25Score] of bm25Scores.entries()) {
      let searchableProduct = this.searchableProducts.get(productId);
      
      if (!searchableProduct) {
        const matchingKey = Array.from(this.searchableProducts.keys()).find(
          key => key.startsWith(productId + '-') || key === productId
        );
        if (matchingKey) {
          searchableProduct = this.searchableProducts.get(matchingKey);
        }
      }
      
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

    // Filter and merchandise
    const validProducts = scoredProducts.filter(sp => sp.scores.final > 0);
    const merchandisedProducts = this.merchandising.applyMerchandising(validProducts);
    const results = merchandisedProducts.slice(0, topK).map(sp => sp.product);

    return {
      strategy: 'semantic-bm25',
      products: results,
      score: 0.5,
      matchCount: results.length,
    };
  }

  /**
   * Merge results from multiple strategies
   */
  private mergeStrategyResults(strategyResults: StrategyResult[], topK: number): Product[] {
    if (strategyResults.length === 0) {
      return [];
    }

    // If only one strategy returned results, use it directly
    if (strategyResults.length === 1) {
      return strategyResults[0].products.slice(0, topK);
    }

    // Merge results: prioritize by strategy score, then deduplicate
    const seenIds = new Set<string>();
    const mergedProducts: Product[] = [];

    // Sort strategies by score (highest first)
    const sortedStrategies = [...strategyResults].sort((a, b) => b.score - a.score);

    for (const strategyResult of sortedStrategies) {
      for (const product of strategyResult.products) {
        const productKey = product.size ? `${product.id}-${product.size}` : product.id;
        
        if (!seenIds.has(productKey)) {
          seenIds.add(productKey);
          mergedProducts.push(product);
          
          if (mergedProducts.length >= topK) {
            return mergedProducts;
          }
        }
      }
    }

    return mergedProducts;
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

  /**
   * Get graph-based recommendations for a product
   * Enriches search results with related products from GraphDB
   */
  async getGraphRecommendations(productId: string, limit: number = 5): Promise<Product[]> {
    if (!graphService.isServiceConnected()) {
      return [];
    }

    try {
      const recommendations = await graphService.getRecommendations(productId, limit);
      return recommendations.map(r => r.product);
    } catch (error) {
      console.error('[SearchService] Error getting graph recommendations:', error);
      return [];
    }
  }

  /**
   * Enrich search results with graph-based similar products
   * Adds a 'recommendations' field to each product
   */
  async enrichWithGraphData(products: Product[], recommendationsPerProduct: number = 3): Promise<any[]> {
    if (!graphService.isServiceConnected() || products.length === 0) {
      return products;
    }

    try {
      const enrichedProducts = await Promise.all(
        products.map(async (product) => {
          const recommendations = await this.getGraphRecommendations(product.id, recommendationsPerProduct);
          return {
            ...product,
            graphRecommendations: recommendations,
            hasGraphData: recommendations.length > 0
          };
        })
      );

      return enrichedProducts;
    } catch (error) {
      console.error('[SearchService] Error enriching with graph data:', error);
      return products;
    }
  }

  /**
   * Hybrid search: Combine text search with graph traversal
   * Uses both BM25 and GraphDB relationships for better recommendations
   */
  async hybridGraphSearch(query: string, topK: number = 10): Promise<any[]> {
    // First, get regular search results
    const textResults = await this.search(query, topK);
    
    // If no GraphDB connection, return regular results
    if (!graphService.isServiceConnected()) {
      return textResults;
    }

    // Enrich with graph recommendations
    const enriched = await this.enrichWithGraphData(textResults, 3);
    
    return enriched;
  }
}

