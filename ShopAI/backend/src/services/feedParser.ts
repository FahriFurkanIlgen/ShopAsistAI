import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { GoogleFeed, Product } from '../../../shared/types';
import { CacheService } from './cacheService';

export class FeedParserService {
  constructor(private cacheService: CacheService) {}

  async parseFeed(siteId: string, siteName: string, feedUrl: string): Promise<GoogleFeed> {
    try {
      console.log(`📡 Fetching feed for ${siteName} from ${feedUrl}`);
      
      // Fetch XML feed
      const response = await axios.get(feedUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'ShopAsistAI/1.0',
        },
      });

      // Parse XML
      const parsed = await parseStringPromise(response.data, {
        explicitArray: false,
        mergeAttrs: true,
      });

      // Extract products
      const products = this.extractProducts(parsed);
      
      const feed: GoogleFeed = {
        siteId,
        siteName,
        feedUrl,
        lastUpdated: new Date(),
        products,
      };

      // Cache the feed
      this.cacheService.setFeed(feed);
      
      console.log(`✅ Parsed ${products.length} products for ${siteName}`);
      return feed;
    } catch (error) {
      console.error(`❌ Error parsing feed for ${siteName}:`, error);
      throw error;
    }
  }

  private extractProducts(parsed: any): Product[] {
    try {
      // Google Shopping Feed uses RSS 2.0 or Atom format
      let items: any[] = [];

      // Try RSS 2.0 format
      if (parsed.rss?.channel?.item) {
        items = Array.isArray(parsed.rss.channel.item)
          ? parsed.rss.channel.item
          : [parsed.rss.channel.item];
      }
      // Try Atom format
      else if (parsed.feed?.entry) {
        items = Array.isArray(parsed.feed.entry)
          ? parsed.feed.entry
          : [parsed.feed.entry];
      }

      const allProducts = items.map((item) => this.parseProduct(item)).filter(p => p !== null);
      
      // Log before stock filtering
      const size28Products = allProducts.filter(p => p?.size === '28');
      console.log(`[FeedParser] Found ${size28Products.length} products with size 28 (before stock filter)`);
      if (size28Products.length > 0) {
        console.log(`[FeedParser] Size 28 samples:`, size28Products.slice(0, 3).map(p => ({
          id: p.id, 
          title: p.title.substring(0, 50), 
          size: p.size, 
          availability: p.availability,
          gender: p.gender
        })));
      }
      
      const inStockProducts = allProducts
        .filter((p) => {
          if (!p) return false;
          // Only include products that are in stock
          const availability = p.availability?.toLowerCase() || '';
          return availability.includes('in stock') || availability.includes('stokta');
        }) as Product[];
      
      // Log after stock filtering for size 28
      const size28InStock = inStockProducts.filter(p => p.size === '28');
      console.log(`[FeedParser] Size 28 products AFTER stock filter: ${size28InStock.length}`);
      if (size28InStock.length > 0) {
        console.log(`[FeedParser] Size 28 IN STOCK samples:`, size28InStock.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title.substring(0, 40),
          gender: p.gender,
          productType: p.productType?.substring(0, 30)
        })));
      }
      
      return inStockProducts;
    } catch (error) {
      console.error('Error extracting products:', error);
      return [];
    }
  }

  private parseProduct(item: any): Product | null {
    try {
      // Handle both RSS and Atom formats with Google Shopping namespace (g:)
      const getValue = (key: string, gKey?: string): string => {
        const gValue = gKey ? item[`g:${gKey}`] : item[`g:${key}`];
        return gValue || item[key] || '';
      };

      const id = getValue('id') || getValue('guid') || '';
      if (!id) return null;

      const productType = getValue('product_type');
      let gender = getValue('gender');
      
      // If gender is not provided, extract from productType
      if (!gender && productType) {
        const normalizedType = productType.toLowerCase();
        if (normalizedType.includes('kız') || normalizedType.includes('kiz')) {
          gender = 'Kız';
        } else if (normalizedType.includes('erkek çocuk')) {
          gender = 'Erkek Çocuk';
        } else if (normalizedType.includes('kadın') || normalizedType.includes('kadin')) {
          gender = 'Kadın';
        } else if (normalizedType.includes('erkek')) {
          gender = 'Erkek';
        }
      }
      
      const product: Product = {
        id,
        title: getValue('title'),
        description: getValue('description'),
        link: getValue('link'),
        imageLink: getValue('image_link', 'image_link') || getValue('image'),
        price: getValue('price'),
        salePrice: getValue('sale_price'),
        availability: getValue('availability') || 'in stock',
        brand: getValue('brand'),
        gtin: getValue('gtin'),
        mpn: getValue('mpn'),
        condition: getValue('condition') || 'new',
        googleProductCategory: getValue('google_product_category'),
        productType,
        color: getValue('color'),
        size: getValue('size'),
        gender, // Extracted from productType if not provided
      };

      // Handle additional images
      const additionalImages = getValue('additional_image_link');
      if (additionalImages) {
        product.additionalImageLinks = Array.isArray(additionalImages)
          ? additionalImages
          : [additionalImages];
      }

      return product;
    } catch (error) {
      console.error('Error parsing product:', error);
      return null;
    }
  }
}
