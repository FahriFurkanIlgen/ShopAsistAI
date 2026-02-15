// Merchandising Configuration Examples
// Bu dosya merchandising özelliklerinin nasıl kullanılacağını gösterir

import { SearchService } from './search/SearchService';
import { MerchandisingConfig } from './search/MerchandisingEngine';

/**
 * Örnek 1: Temel Merchandising Kurulumu
 */
export function setupBasicMerchandising(searchService: SearchService) {
  // Ürün sinyallerini ayarla (normalde database'den gelir)
  const productSignals = [
    {
      productId: 'prod-001',
      viewCount: 1500,
      clickCount: 300,
      purchaseCount: 45,
      addedDate: new Date('2024-01-15'),
      stockQuantity: 25,
      avgRating: 4.5,
    },
    {
      productId: 'prod-002',
      viewCount: 800,
      clickCount: 150,
      purchaseCount: 20,
      addedDate: new Date('2024-02-01'),
      stockQuantity: 0, // Stokta yok
      avgRating: 4.2,
    },
    {
      productId: 'prod-003',
      viewCount: 2500,
      clickCount: 500,
      purchaseCount: 80,
      addedDate: new Date('2024-01-20'),
      stockQuantity: 100,
      avgRating: 4.8,
    },
  ];

  searchService.setProductSignals(productSignals);
  
  console.log('✅ Product signals configured');
}

/**
 * Örnek 2: Kampanya için Marka Boost
 */
export function boostCampaignBrands(searchService: SearchService) {
  const merchandisingEngine = searchService.getMerchandisingEngine();
  
  const config: Partial<MerchandisingConfig> = {
    brandBoosts: new Map([
      ['skechers', 5.0],    // Skechers'ı güçlü boost
      ['nike', 3.0],        // Nike'yı orta boost
      ['adidas', 2.0],      // Adidas'ı hafif boost
    ]),
  };

  merchandisingEngine.updateConfig(config);
  
  console.log('✅ Campaign brand boosts applied');
}

/**
 * Örnek 3: Sezon Kampanyası - Kategori Boost
 */
export function boostSeasonalCategories(searchService: SearchService) {
  const merchandisingEngine = searchService.getMerchandisingEngine();
  
  // Yaz sezonunda sandalet ve spor ayakkabı boost
  const config: Partial<MerchandisingConfig> = {
    categoryBoosts: new Map([
      ['sandals', 4.0],
      ['running shoes', 3.0],
      ['sneakers', 2.5],
    ]),
  };

  merchandisingEngine.updateConfig(config);
  
  console.log('✅ Seasonal category boosts applied');
}

/**
 * Örnek 4: Pinned Products (Belirli pozisyonlara ürün sabitle)
 */
export function pinFeaturedProducts(searchService: SearchService) {
  const merchandisingEngine = searchService.getMerchandisingEngine();
  
  const config: Partial<MerchandisingConfig> = {
    pinnedProducts: new Map([
      [0, 'featured-prod-001'], // İlk sırada her zaman bu ürün
      [2, 'featured-prod-002'], // Üçüncü sırada her zaman bu ürün
    ]),
  };

  merchandisingEngine.updateConfig(config);
  
  console.log('✅ Featured products pinned');
}

/**
 * Örnek 5: Özelleştirilmiş Ağırlıklar
 * (Farklı stratejiler için farklı ağırlıklar)
 */
export function setCustomWeights(searchService: SearchService) {
  const merchandisingEngine = searchService.getMerchandisingEngine();
  
  // Popülerlik odaklı strateji
  const popularityFocusedConfig: Partial<MerchandisingConfig> = {
    signalWeights: {
      textRelevance: 0.25,        // Text relevance azalt
      attributeMatch: 0.20,       // Attribute match azalt
      popularity: 0.30,           // Popülerliği artır
      stockAvailability: 0.10,
      recency: 0.05,
      priceCompetitiveness: 0.05,
      brandStrategy: 0.05,
    },
  };

  merchandisingEngine.updateConfig(popularityFocusedConfig);
  
  console.log('✅ Popularity-focused weights applied');
}

/**
 * Örnek 6: Stok Yönetimi Stratejisi
 */
export function configureStockStrategy(searchService: SearchService) {
  const merchandisingEngine = searchService.getMerchandisingEngine();
  
  const config: Partial<MerchandisingConfig> = {
    businessRules: {
      boostNewProducts: true,
      newProductBoostDays: 30,
      boostInStock: true,
      outOfStockPenalty: 0.8,      // Yüksek ceza (stokta olmayanları gizle)
      diversifyResults: true,
      diversityFactor: 0.4,         // Daha fazla çeşitlilik
    },
  };

  merchandisingEngine.updateConfig(config);
  
  console.log('✅ Stock management strategy configured');
}

/**
 * Örnek 7: A/B Test Senaryoları
 */
export function setupABTestScenarios(searchService: SearchService) {
  const merchandisingEngine = searchService.getMerchandisingEngine();
  
  // Senaryo A: Relevance odaklı (control grubu)
  const scenarioA: Partial<MerchandisingConfig> = {
    signalWeights: {
      textRelevance: 0.40,
      attributeMatch: 0.30,
      popularity: 0.10,
      stockAvailability: 0.10,
      recency: 0.05,
      priceCompetitiveness: 0.03,
      brandStrategy: 0.02,
    },
    businessRules: {
      boostNewProducts: false,
      newProductBoostDays: 30,
      boostInStock: true,
      outOfStockPenalty: 0.5,
      diversifyResults: false,
      diversityFactor: 0.2,
    },
  };

  // Senaryo B: Popülerlik + Merchandising (test grubu)
  const scenarioB: Partial<MerchandisingConfig> = {
    signalWeights: {
      textRelevance: 0.25,
      attributeMatch: 0.20,
      popularity: 0.25,
      stockAvailability: 0.12,
      recency: 0.08,
      priceCompetitiveness: 0.05,
      brandStrategy: 0.05,
    },
    businessRules: {
      boostNewProducts: true,
      newProductBoostDays: 45,
      boostInStock: true,
      outOfStockPenalty: 0.7,
      diversifyResults: true,
      diversityFactor: 0.3,
    },
  };

  // Kullanıcının test grubuna göre senaryo seç
  const userTestGroup = Math.random() < 0.5 ? 'A' : 'B';
  const config = userTestGroup === 'A' ? scenarioA : scenarioB;

  merchandisingEngine.updateConfig(config);
  
  console.log(`✅ A/B Test Scenario ${userTestGroup} applied`);
  
  return userTestGroup;
}

/**
 * Örnek 8: Gerçek Zamanlı Kampanya Yönetimi
 */
export function manageRealTimeCampaign(searchService: SearchService) {
  const merchandisingEngine = searchService.getMerchandisingEngine();
  
  // Flash sale: Belirli kategorilerde indirimli ürünleri öne çıkar
  const flashSaleConfig: Partial<MerchandisingConfig> = {
    signalWeights: {
      textRelevance: 0.25,
      attributeMatch: 0.20,
      popularity: 0.15,
      stockAvailability: 0.10,
      recency: 0.05,
      priceCompetitiveness: 0.20,  // İndirimli ürünleri öne çıkar
      brandStrategy: 0.05,
    },
    categoryBoosts: new Map([
      ['shoes', 3.0],
      ['sneakers', 3.0],
    ]),
  };

  merchandisingEngine.updateConfig(flashSaleConfig);
  
  console.log('🔥 Flash sale campaign activated');
  
  // 1 saat sonra kampanyayı kapat
  setTimeout(() => {
    // Varsayılan ayarlara dön
    const merchandisingEngine = searchService.getMerchandisingEngine();
    merchandisingEngine.updateConfig({
      signalWeights: {
        textRelevance: 0.35,
        attributeMatch: 0.25,
        popularity: 0.15,
        stockAvailability: 0.10,
        recency: 0.05,
        priceCompetitiveness: 0.05,
        brandStrategy: 0.05,
      },
      categoryBoosts: new Map(),
    });
    console.log('✅ Flash sale ended, reverted to default config');
  }, 60 * 60 * 1000); // 1 saat
}

/**
 * Örnek 9: Dinamik Konfigürasyon Yükleme (API'den)
 */
export async function loadMerchandisingConfigFromAPI(
  searchService: SearchService,
  siteId: string
): Promise<void> {
  try {
    // API'den merchandising config'i al
    const response = await fetch(`/api/merchandising/config/${siteId}`);
    const data: any = await response.json();

    const merchandisingEngine = searchService.getMerchandisingEngine();
    merchandisingEngine.updateConfig(data.config as Partial<MerchandisingConfig>);

    console.log('✅ Merchandising config loaded from API');
  } catch (error) {
    console.error('❌ Failed to load merchandising config:', error);
  }
}

/**
 * Örnek 10: Config'i Kaydetme (Admin Panel için)
 */
export function saveMerchandisingConfig(searchService: SearchService): MerchandisingConfig {
  const merchandisingEngine = searchService.getMerchandisingEngine();
  const config = merchandisingEngine.getConfig();
  
  // Config'i database'e kaydet (örnek)
  console.log('💾 Saving merchandising config:', config);
  
  return config;
}
