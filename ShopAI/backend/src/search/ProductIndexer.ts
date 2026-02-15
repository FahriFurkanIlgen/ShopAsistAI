// Product Indexer - Build searchable index from products

import { Product } from '../../../shared/types';
import { SearchableProduct } from './types';

export class ProductIndexer {
  /**
   * Convert products to searchable format with combined text field
   */
  indexProducts(products: Product[]): SearchableProduct[] {
    return products.map(product => this.indexProduct(product));
  }

  /**
   * Index a single product
   */
  private indexProduct(product: Product): SearchableProduct {
    return {
      ...product,
      searchableText: this.buildSearchableText(product),
      normalizedBrand: this.normalize(product.brand || ''),
      normalizedColor: this.normalize(product.color || ''),
      normalizedCategory: this.normalize(product.productType || ''),
      normalizedSize: this.normalize(String(product.size || '')),
    };
  }

  /**
   * Build searchable text field from product attributes
   * Combined text: Title + Brand + Category + Color + Description
   */
  private buildSearchableText(product: Product): string {
    const parts: string[] = [];

    // Title (most important - add twice for boosting)
    if (product.title) {
      parts.push(product.title);
      parts.push(product.title); // Double weight
    }

    // Brand
    if (product.brand) {
      parts.push(product.brand);
    }

    // Category/Product Type
    if (product.productType) {
      parts.push(product.productType);
    }

    // Google Product Category
    if (product.googleProductCategory) {
      parts.push(product.googleProductCategory);
    }

    // Color
    if (product.color) {
      parts.push(product.color);
    }

    // Size
    if (product.size) {
      parts.push(String(product.size));
    }

    // Description (lower weight - add once)
    if (product.description) {
      // Clean HTML from description
      const cleanDescription = this.stripHtml(product.description);
      parts.push(cleanDescription);
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize text
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
   * Extract structured data for inverted index building
   */
  prepareForIndexing(products: Product[]): Array<{ id: string; text: string }> {
    const searchableProducts = this.indexProducts(products);

    return searchableProducts.map(product => ({
      // Use composite key: productId-size to handle same product in multiple sizes
      id: product.size ? `${product.id}-${product.size}` : product.id,
      text: product.searchableText,
    }));
  }
}
