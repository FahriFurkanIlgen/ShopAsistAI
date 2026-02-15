import { Router, Request, Response } from 'express';
import { MerchandisingConfig } from '../search/MerchandisingEngine';

const router = Router();

// In-memory merchandising config storage (production'da database'de olmalı)
const merchandisingConfigs: Map<string, Partial<MerchandisingConfig>> = new Map();

// GET /api/merchandising/config/:siteId
// Merchandising konfigürasyonunu al
router.get('/config/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const config = merchandisingConfigs.get(siteId);

    if (!config) {
      return res.json({
        message: 'No custom merchandising config found, using defaults',
        config: getDefaultConfig(),
      });
    }

    res.json({
      siteId,
      config,
    });
  } catch (error: any) {
    console.error('Merchandising Config API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// POST /api/merchandising/config/:siteId
// Merchandising konfigürasyonunu güncelle
router.post('/config/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const config: Partial<MerchandisingConfig> = req.body;

    // Validate config
    if (config.signalWeights) {
      const sum = Object.values(config.signalWeights).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        return res.status(400).json({
          error: 'Signal weights must sum to 1.0',
          currentSum: sum,
        });
      }
    }

    merchandisingConfigs.set(siteId, config);

    res.json({
      success: true,
      siteId,
      config,
    });
  } catch (error: any) {
    console.error('Merchandising Config Update Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// POST /api/merchandising/brand-boost/:siteId
// Marka boost'larını ayarla (kampanyalar için)
router.post('/brand-boost/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { brandBoosts } = req.body;

    if (!brandBoosts || typeof brandBoosts !== 'object') {
      return res.status(400).json({
        error: 'brandBoosts object required',
      });
    }

    const currentConfig = merchandisingConfigs.get(siteId) || {};
    const updatedConfig: Partial<MerchandisingConfig> = {
      ...currentConfig,
      brandBoosts: new Map(Object.entries(brandBoosts).map(([k, v]) => [k, v as number])),
    };

    merchandisingConfigs.set(siteId, updatedConfig);

    res.json({
      success: true,
      siteId,
      brandBoosts,
    });
  } catch (error: any) {
    console.error('Brand Boost API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// POST /api/merchandising/category-boost/:siteId
// Kategori boost'larını ayarla (sezon kampanyaları için)
router.post('/category-boost/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { categoryBoosts } = req.body;

    if (!categoryBoosts || typeof categoryBoosts !== 'object') {
      return res.status(400).json({
        error: 'categoryBoosts object required',
      });
    }

    const currentConfig = merchandisingConfigs.get(siteId) || {};
    const updatedConfig: Partial<MerchandisingConfig> = {
      ...currentConfig,
      categoryBoosts: new Map(Object.entries(categoryBoosts).map(([k, v]) => [k, v as number])),
    };

    merchandisingConfigs.set(siteId, updatedConfig);

    res.json({
      success: true,
      siteId,
      categoryBoosts,
    });
  } catch (error: any) {
    console.error('Category Boost API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// POST /api/merchandising/pinned-products/:siteId
// Belirli pozisyonlara ürün sabitle
router.post('/pinned-products/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { pinnedProducts } = req.body;

    if (!pinnedProducts || typeof pinnedProducts !== 'object') {
      return res.status(400).json({
        error: 'pinnedProducts object required (position -> productId)',
      });
    }

    const currentConfig = merchandisingConfigs.get(siteId) || {};
    const updatedConfig = {
      ...currentConfig,
      pinnedProducts: new Map(Object.entries(pinnedProducts).map(([k, v]) => [parseInt(k), v as string])),
    };

    merchandisingConfigs.set(siteId, updatedConfig);

    res.json({
      success: true,
      siteId,
      pinnedProducts,
    });
  } catch (error: any) {
    console.error('Pinned Products API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// POST /api/merchandising/weights/:siteId
// Signal ağırlıklarını güncelle
router.post('/weights/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { weights } = req.body;

    if (!weights || typeof weights !== 'object') {
      return res.status(400).json({
        error: 'weights object required',
      });
    }

    // Validate that weights sum to 1.0
    const sum = Object.values(weights as Record<string, number>).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      return res.status(400).json({
        error: 'Weights must sum to 1.0',
        currentSum: sum,
      });
    }

    const currentConfig = merchandisingConfigs.get(siteId) || {};
    const updatedConfig = {
      ...currentConfig,
      signalWeights: weights,
    };

    merchandisingConfigs.set(siteId, updatedConfig);

    res.json({
      success: true,
      siteId,
      weights,
    });
  } catch (error: any) {
    console.error('Weights API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// POST /api/merchandising/business-rules/:siteId
// İş kurallarını güncelle
router.post('/business-rules/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { businessRules } = req.body;

    if (!businessRules || typeof businessRules !== 'object') {
      return res.status(400).json({
        error: 'businessRules object required',
      });
    }

    const currentConfig = merchandisingConfigs.get(siteId) || {};
    const updatedConfig = {
      ...currentConfig,
      businessRules,
    };

    merchandisingConfigs.set(siteId, updatedConfig);

    res.json({
      success: true,
      siteId,
      businessRules,
    });
  } catch (error: any) {
    console.error('Business Rules API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// DELETE /api/merchandising/config/:siteId
// Merchandising konfigürasyonunu sıfırla (varsayılana dön)
router.delete('/config/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    merchandisingConfigs.delete(siteId);

    res.json({
      success: true,
      message: 'Merchandising config reset to defaults',
      siteId,
    });
  } catch (error: any) {
    console.error('Merchandising Config Delete Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Helper: Get default config
function getDefaultConfig(): Partial<MerchandisingConfig> {
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

export default router;
