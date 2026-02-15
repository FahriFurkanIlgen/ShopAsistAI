// Test Script for Merchandising Engine

import { SearchService } from './search/SearchService';
import { Product } from '../../shared/types';

// Mock products for testing
const mockProducts: Product[] = [
  {
    id: 'ske-001',
    title: 'Skechers Go Walk 6 Siyah Erkek Spor Ayakkabı',
    brand: 'Skechers',
    price: '1299.99 TL',
    salePrice: '999.99 TL',
    imageLink: 'https://example.com/img1.jpg',
    link: 'https://example.com/prod1',
    color: 'Siyah',
    size: '43',
    productType: 'Spor Ayakkabı',
    description: 'Rahat günlük spor ayakkabı',
    availability: 'in stock',
  },
  {
    id: 'ske-002',
    title: 'Skechers D\'Lites Beyaz Kadın Sneakers',
    brand: 'Skechers',
    price: '1499.99 TL',
    imageLink: 'https://example.com/img2.jpg',
    link: 'https://example.com/prod2',
    color: 'Beyaz',
    size: '38',
    productType: 'Sneakers',
    description: 'Klasik chunky sneakers',
    availability: 'in stock',
  },
  {
    id: 'nike-001',
    title: 'Nike Air Max Siyah Erkek Spor Ayakkabı',
    brand: 'Nike',
    price: '2499.99 TL',
    salePrice: '1999.99 TL',
    imageLink: 'https://example.com/img3.jpg',
    link: 'https://example.com/prod3',
    color: 'Siyah',
    size: '43',
    productType: 'Spor Ayakkabı',
    description: 'Hava yastıklı koşu ayakkabısı',
    availability: 'out of stock',
  },
  {
    id: 'adidas-001',
    title: 'Adidas Ultraboost Mavi Erkek Koşu Ayakkabısı',
    brand: 'Adidas',
    price: '2799.99 TL',
    imageLink: 'https://example.com/img4.jpg',
    link: 'https://example.com/prod4',
    color: 'Mavi',
    size: '43',
    productType: 'Koşu Ayakkabısı',
    description: 'Boost teknolojili koşu ayakkabısı',
    availability: 'in stock',
  },
];

// Mock product signals
const mockSignals = [
  {
    productId: 'ske-001',
    viewCount: 2500,
    clickCount: 450,
    purchaseCount: 85,
    addedDate: new Date('2024-01-10'),
    stockQuantity: 100,
    avgRating: 4.7,
  },
  {
    productId: 'ske-002',
    viewCount: 1800,
    clickCount: 320,
    purchaseCount: 60,
    addedDate: new Date('2024-02-01'),
    stockQuantity: 5, // Düşük stok
    avgRating: 4.5,
  },
  {
    productId: 'nike-001',
    viewCount: 3200,
    clickCount: 580,
    purchaseCount: 120,
    addedDate: new Date('2023-11-15'),
    stockQuantity: 0, // Stokta yok
    avgRating: 4.9,
  },
  {
    productId: 'adidas-001',
    viewCount: 1200,
    clickCount: 200,
    purchaseCount: 35,
    addedDate: new Date('2024-02-10'), // Çok yeni
    stockQuantity: 50,
    avgRating: 4.6,
  },
];

// Test scenarios
async function runTests() {
  console.log('🧪 Starting Merchandising Engine Tests\n');

  // Initialize search service
  const searchService = new SearchService();
  searchService.buildIndex(mockProducts);
  searchService.setProductSignals(mockSignals);

  // Test 1: Default configuration
  console.log('📊 Test 1: Default Configuration');
  console.log('Query: "siyah spor ayakkabı"');
  const results1 = await searchService.search('siyah spor ayakkabı', 10);
  console.log('Results:', results1.map(p => ({ id: p.id, title: p.title, brand: p.brand })));
  console.log('');

  // Test 2: Brand boost (Skechers campaign)
  console.log('📊 Test 2: Skechers Campaign (Brand Boost)');
  const merchandising = searchService.getMerchandisingEngine();
  merchandising.updateConfig({
    brandBoosts: new Map([
      ['skechers', 8.0],
    ]),
  });
  const results2 = await searchService.search('siyah spor ayakkabı', 10);
  console.log('Results:', results2.map(p => ({ id: p.id, title: p.title, brand: p.brand })));
  console.log('Expected: Skechers products should be ranked higher');
  console.log('');

  // Test 3: Popularity focused
  console.log('📊 Test 3: Popularity Focused Ranking');
  merchandising.updateConfig({
    brandBoosts: new Map(),
    signalWeights: {
      textRelevance: 0.20,
      attributeMatch: 0.15,
      popularity: 0.35, // ⬆️ Increased
      stockAvailability: 0.15,
      recency: 0.05,
      priceCompetitiveness: 0.05,
      brandStrategy: 0.05,
    },
  });
  const results3 = await searchService.search('spor ayakkabı', 10);
  console.log('Results:', results3.map(p => ({ 
    id: p.id, 
    brand: p.brand,
    signal: mockSignals.find(s => s.productId === p.id)?.purchaseCount || 0,
  })));
  console.log('Expected: Nike-001 (120 purchases) should rank high');
  console.log('');

  // Test 4: Stock management
  console.log('📊 Test 4: Stock Management (Penalize Out of Stock)');
  merchandising.updateConfig({
    signalWeights: {
      textRelevance: 0.30,
      attributeMatch: 0.25,
      popularity: 0.15,
      stockAvailability: 0.15, // ⬆️ Increased
      recency: 0.05,
      priceCompetitiveness: 0.05,
      brandStrategy: 0.05,
    },
    businessRules: {
      boostNewProducts: true,
      newProductBoostDays: 30,
      boostInStock: true,
      outOfStockPenalty: 0.9, // ⬆️ High penalty
      diversifyResults: true,
      diversityFactor: 0.3,
    },
  });
  const results4 = await searchService.search('spor ayakkabı', 10);
  console.log('Results:', results4.map(p => ({ 
    id: p.id, 
    brand: p.brand,
    stock: mockSignals.find(s => s.productId === p.id)?.stockQuantity || 0,
  })));
  console.log('Expected: Nike-001 (0 stock) should be penalized and ranked lower');
  console.log('');

  // Test 5: New product boost
  console.log('📊 Test 5: New Product Boost');
  merchandising.updateConfig({
    signalWeights: {
      textRelevance: 0.25,
      attributeMatch: 0.20,
      popularity: 0.15,
      stockAvailability: 0.10,
      recency: 0.20, // ⬆️ Increased
      priceCompetitiveness: 0.05,
      brandStrategy: 0.05,
    },
    businessRules: {
      boostNewProducts: true,
      newProductBoostDays: 60,
      boostInStock: true,
      outOfStockPenalty: 0.5,
      diversifyResults: true,
      diversityFactor: 0.3,
    },
  });
  const results5 = await searchService.search('ayakkabı', 10);
  console.log('Results:', results5.map(p => ({ 
    id: p.id, 
    brand: p.brand,
    addedDate: mockSignals.find(s => s.productId === p.id)?.addedDate.toISOString().split('T')[0],
  })));
  console.log('Expected: Adidas-001 (2024-02-10) should be boosted as new product');
  console.log('');

  // Test 6: Price competitiveness (discount focused)
  console.log('📊 Test 6: Price Competitiveness (Discount Focus)');
  merchandising.updateConfig({
    signalWeights: {
      textRelevance: 0.25,
      attributeMatch: 0.20,
      popularity: 0.15,
      stockAvailability: 0.10,
      recency: 0.05,
      priceCompetitiveness: 0.20, // ⬆️ Increased
      brandStrategy: 0.05,
    },
  });
  const results6 = await searchService.search('spor ayakkabı', 10);
  console.log('Results:', results6.map(p => ({ 
    id: p.id, 
    brand: p.brand,
    price: p.price,
    salePrice: p.salePrice || p.price,
    discount: p.salePrice ? ((parseFloat(p.price.replace(/[^0-9.]/g, '')) - parseFloat(p.salePrice.replace(/[^0-9.]/g, ''))) / parseFloat(p.price.replace(/[^0-9.]/g, '')) * 100).toFixed(0) + '%' : '0%',
  })));
  console.log('Expected: Products with higher discounts should rank higher');
  console.log('');

  // Test 7: Get detailed scores
  console.log('📊 Test 7: Detailed Scores');
  const detailedResults = await searchService.searchWithScores('siyah spor ayakkabı', 5);
  console.log('Detailed Results:');
  detailedResults.forEach(result => {
    console.log({
      id: result.product.id,
      brand: result.product.brand,
      scores: {
        bm25: result.scores.bm25.toFixed(2),
        brand: result.scores.brand.toFixed(2),
        category: result.scores.category.toFixed(2),
        merchandising: result.scores.merchandising?.toFixed(2) || '0.00',
        final: result.scores.final.toFixed(2),
      },
    });
  });
  console.log('');

  console.log('✅ All tests completed!\n');
}

// Run tests
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };
