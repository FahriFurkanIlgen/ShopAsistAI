/**
 * GraphDB Service
 * Neo4j graph database integration for product relationships and recommendations
 */

import neo4j, { Driver, Session, Result } from 'neo4j-driver';
import { Product } from '../../../shared/types';

export interface ProductNode {
  id: string;
  title: string;
  price: number;
  productType?: string;
  brand?: string;
  availability: string;
}

export interface ProductRelationship {
  type: 'SIMILAR' | 'FREQUENTLY_BOUGHT_TOGETHER' | 'COMPLEMENTARY' | 'IN_CATEGORY';
  weight: number;
}

export interface RecommendationResult {
  product: Product;
  score: number;
  reason: string;
}

export class GraphService {
  private driver: Driver | null = null;
  private isConnected: boolean = false;

  constructor(
    private uri: string = process.env.NEO4J_URI || 'bolt://localhost:7687',
    private username: string = process.env.NEO4J_USERNAME || 'neo4j',
    private password: string = process.env.NEO4J_PASSWORD || 'password'
  ) {}

  /**
   * Connect to Neo4j database
   */
  async connect(): Promise<void> {
    try {
      this.driver = neo4j.driver(
        this.uri,
        neo4j.auth.basic(this.username, this.password),
        {
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
        }
      );

      // Test connection
      await this.driver.verifyConnectivity();
      this.isConnected = true;
      console.log('[GraphService] ✅ Successfully connected to Neo4j');
    } catch (error) {
      console.error('[GraphService] ❌ Failed to connect to Neo4j:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from Neo4j database
   */
  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.isConnected = false;
      console.log('[GraphService] Disconnected from Neo4j');
    }
  }

  /**
   * Get a new session
   */
  private getSession(): Session {
    if (!this.driver || !this.isConnected) {
      throw new Error('GraphService is not connected to Neo4j');
    }
    return this.driver.session();
  }

  /**
   * Initialize database schema and constraints
   */
  async initializeSchema(): Promise<void> {
    const session = this.getSession();
    try {
      console.log('[GraphService] Initializing database schema...');

      // Create constraints and indexes
      await session.run(`
        CREATE CONSTRAINT product_id IF NOT EXISTS
        FOR (p:Product) REQUIRE p.id IS UNIQUE
      `);

      await session.run(`
        CREATE INDEX product_category IF NOT EXISTS
        FOR (p:Product) ON (p.category)
      `);

      await session.run(`
        CREATE INDEX product_brand IF NOT EXISTS
        FOR (p:Product) ON (p.brand)
      `);

      await session.run(`
        CREATE INDEX product_price IF NOT EXISTS
        FOR (p:Product) ON (p.price)
      `);

      console.log('[GraphService] ✅ Schema initialized successfully');
    } catch (error) {
      console.error('[GraphService] ❌ Failed to initialize schema:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Clear all data from the database
   */
  async clearDatabase(): Promise<void> {
    const session = this.getSession();
    try {
      console.log('[GraphService] Clearing database...');
      await session.run('MATCH (n) DETACH DELETE n');
      console.log('[GraphService] ✅ Database cleared');
    } catch (error) {
      console.error('[GraphService] ❌ Failed to clear database:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Import products into the graph database
   */
  async importProducts(products: Product[]): Promise<void> {
    const session = this.getSession();
    try {
      console.log(`[GraphService] Importing ${products.length} products...`);

      // Import products in batches for performance
      const batchSize = 100;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        
        await session.run(
          `
          UNWIND $products AS productData
          MERGE (p:Product {id: productData.id})
          SET p.title = productData.title,
              p.price = productData.price,
              p.productType = productData.productType,
              p.brand = productData.brand,
              p.availability = productData.availability,
              p.imageLink = productData.imageLink,
              p.description = productData.description,
              p.link = productData.link
          `,
          { products: batch.map(p => this.productToNode(p)) }
        );
      }

      console.log(`[GraphService] ✅ Imported ${products.length} products`);
    } catch (error) {
      console.error('[GraphService] ❌ Failed to import products:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create category relationships
   */
  async createCategoryRelationships(): Promise<void> {
    const session = this.getSession();
    try {
      console.log('[GraphService] Creating category relationships...');

      await session.run(`
        MATCH (p1:Product), (p2:Product)
        WHERE p1.productType = p2.productType 
        AND p1.productType IS NOT NULL
        AND p1.id <> p2.id
        MERGE (p1)-[r:IN_CATEGORY]->(p2)
        SET r.weight = 1.0
      `);

      console.log('[GraphService] ✅ Category relationships created');
    } catch (error) {
      console.error('[GraphService] ❌ Failed to create category relationships:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create brand relationships
   */
  async createBrandRelationships(): Promise<void> {
    const session = this.getSession();
    try {
      console.log('[GraphService] Creating brand relationships...');

      await session.run(`
        MATCH (p1:Product), (p2:Product)
        WHERE p1.brand = p2.brand 
        AND p1.brand IS NOT NULL 
        AND p1.id <> p2.id
        MERGE (p1)-[r:SAME_BRAND]->(p2)
        SET r.weight = 0.8
      `);

      console.log('[GraphService] ✅ Brand relationships created');
    } catch (error) {
      console.error('[GraphService] ❌ Failed to create brand relationships:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create similar products based on price range
   */
  async createPriceSimilarityRelationships(): Promise<void> {
    const session = this.getSession();
    try {
      console.log('[GraphService] Creating price similarity relationships...');

      // Similar price range (±20%)
      await session.run(`
        MATCH (p1:Product), (p2:Product)
        WHERE p1.id <> p2.id
        AND p1.productType = p2.productType
        AND p1.productType IS NOT NULL
        AND abs(p1.price - p2.price) <= p1.price * 0.2
        MERGE (p1)-[r:SIMILAR_PRICE]->(p2)
        SET r.weight = 0.6
      `);

      console.log('[GraphService] ✅ Price similarity relationships created');
    } catch (error) {
      console.error('[GraphService] ❌ Failed to create price similarity:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get recommendations based on a product ID
   */
  async getRecommendations(
    productId: string,
    limit: number = 10
  ): Promise<RecommendationResult[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (p:Product {id: $productId})-[r]->(recommended:Product)
        WITH recommended, 
             type(r) as relType,
             r.weight as weight
        RETURN recommended, 
               relType,
               weight,
               weight as score
        ORDER BY score DESC
        LIMIT $limit
        `,
        { productId, limit: neo4j.int(limit) }
      );

      return result.records.map(record => {
        const node = record.get('recommended').properties;
        const relType = record.get('relType');
        const score = record.get('score');

        return {
          product: this.nodeToProduct(node),
          score: score,
          reason: this.getReasonText(relType)
        };
      });
    } catch (error) {
      console.error('[GraphService] ❌ Failed to get recommendations:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get similar products (multi-hop recommendation)
   */
  async getSimilarProducts(
    productId: string,
    limit: number = 10
  ): Promise<RecommendationResult[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH path = (p:Product {id: $productId})-[*1..2]-(similar:Product)
        WHERE p.id <> similar.id
        WITH similar, 
             length(path) as distance,
             reduce(s = 0, r in relationships(path) | s + r.weight) as totalWeight
        RETURN similar,
               totalWeight / distance as score
        ORDER BY score DESC
        LIMIT $limit
        `,
        { productId, limit: neo4j.int(limit) }
      );

      return result.records.map(record => {
        const node = record.get('similar').properties;
        const score = record.get('score');

        return {
          product: this.nodeToProduct(node),
          score: score,
          reason: 'Similar products'
        };
      });
    } catch (error) {
      console.error('[GraphService] ❌ Failed to get similar products:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get products in the same category
   */
  async getProductsByCategory(
    category: string,
    limit: number = 20
  ): Promise<Product[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (p:Product {productType: $category})
        RETURN p
        ORDER BY p.price ASC
        LIMIT $limit
        `,
        { category, limit: neo4j.int(limit) }
      );

      return result.records.map(record => {
        return this.nodeToProduct(record.get('p').properties);
      });
    } catch (error) {
      console.error('[GraphService] ❌ Failed to get products by category:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get statistics about the graph
   */
  async getStatistics(): Promise<{
    totalProducts: number;
    totalRelationships: number;
    categories: number;
    brands: number;
  }> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (p:Product)
        OPTIONAL MATCH ()-[r]->()
        RETURN count(DISTINCT p) as products,
               count(DISTINCT r) as relationships,
               count(DISTINCT p.productType) as categories,
               count(DISTINCT p.brand) as brands
      `);

      const record = result.records[0];
      return {
        totalProducts: record.get('products').toNumber(),
        totalRelationships: record.get('relationships').toNumber(),
        categories: record.get('categories').toNumber(),
        brands: record.get('brands').toNumber()
      };
    } catch (error) {
      console.error('[GraphService] ❌ Failed to get statistics:', error);
      return {
        totalProducts: 0,
        totalRelationships: 0,
        categories: 0,
        brands: 0
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Convert Product to ProductNode
   */
  private productToNode(product: Product): any {
    // Parse price from string to number
    const price = typeof product.price === 'string' 
      ? parseFloat(product.price.replace(/[^0-9.]/g, '')) 
      : product.price;

    return {
      id: product.id,
      title: product.title,
      price: price || 0,
      productType: product.productType || product.googleProductCategory || 'Uncategorized',
      brand: product.brand || null,
      availability: product.availability,
      imageLink: product.imageLink || null,
      description: product.description || null,
      link: product.link
    };
  }

  /**
   * Convert Node properties to Product
   */
  private nodeToProduct(node: any): Product {
    return {
      id: node.id,
      title: node.title,
      price: typeof node.price === 'number' ? node.price.toString() : node.price?.toString() || '0',
      productType: node.productType,
      brand: node.brand,
      availability: node.availability,
      imageLink: node.imageLink,
      description: node.description,
      link: node.link
    };
  }

  /**
   * Get human-readable reason text
   */
  private getReasonText(relType: string): string {
    const reasonMap: Record<string, string> = {
      'IN_CATEGORY': 'Aynı kategoride',
      'SAME_BRAND': 'Aynı marka',
      'SIMILAR_PRICE': 'Benzer fiyat aralığında',
      'FREQUENTLY_BOUGHT_TOGETHER': 'Sık birlikte alınan',
      'COMPLEMENTARY': 'Tamamlayıcı ürün'
    };

    return reasonMap[relType] || 'Önerilen ürün';
  }

  /**
   * Check if the service is connected
   */
  isServiceConnected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const graphService = new GraphService();
