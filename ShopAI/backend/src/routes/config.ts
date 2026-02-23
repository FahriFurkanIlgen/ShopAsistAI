import { Router, Request, Response } from 'express';
import { WidgetConfig, DEFAULT_CONFIG, DEFAULT_CATEGORIES, QueryParserVersion } from '../../../shared/types/config';
import { CacheService } from '../services/cacheService';
import { TenantService } from '../services/tenantService';
import { optionalApiKey } from '../middleware/auth';

const router = Router();
const cacheService = CacheService.getInstance();
const tenantService = TenantService.getInstance();

// In-memory config storage (in production, this would be in a database)
const siteConfigs: Map<string, WidgetConfig> = new Map();

// Initialize default config for high5
const defaultHigh5Config: WidgetConfig = {
  siteId: 'high5-tr',
  siteName: process.env.SITE_NAME || 'High5 Türkiye',
  primaryColor: '#000000',
  secondaryColor: '#e31e24',
  welcomeMessage: "Merhaba, High5 koleksiyonunda aradığınızı hızlıca bulalım.",
  welcomeSubtext: 'Yeni sezon, kombinasyon önerileri ve sipariş desteği.',
  categories: [
    { id: 'men', name: 'Erkek', emoji: '👨', keywords: ['erkek', 'men', 'male'] },
    { id: 'women', name: 'Kadın', emoji: '👩', keywords: ['kadın', 'women', 'female'] },
    { id: 'kids', name: 'Çocuk', emoji: '👶', keywords: ['kids', 'çocuk', 'children'] },
    { id: 'sports', name: 'Spor', emoji: '⚽', keywords: ['sport', 'spor', 'athletic', 'running'] },
    { id: 'casual', name: 'Günlük', emoji: '👞', keywords: ['casual', 'günlük', 'lifestyle'] },
  ],
  privacyPolicyUrl: 'https://www.high5.com.tr/privacy-policy',
  brandingText: 'Powered by ShopAsistAI',
  showBranding: true,
  queryParserVersion: 'v1', // Default to regex-only
};

siteConfigs.set('high5-tr', defaultHigh5Config);
cacheService.setSiteConfig(defaultHigh5Config);

// GET /api/config/:siteId - Get widget configuration
// Optionally authenticated - uses tenant config if API key provided
router.get('/:siteId', optionalApiKey, async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    
    // If authenticated with tenant, use tenant config
    if (req.tenant) {
      const tenantConfig: WidgetConfig = {
        siteId: req.tenant.siteId,
        siteName: req.tenant.siteName,
        primaryColor: req.tenant.primaryColor || '#022d56',
        secondaryColor: req.tenant.secondaryColor || '#0ea5e9',
        brandLogo: req.tenant.brandLogo,
        welcomeMessage: req.tenant.welcomeMessage || `Merhaba! ${req.tenant.siteName} alışveriş asistanınız.`,
        welcomeSubtext: req.tenant.welcomeSubtext || 'Size nasıl yardımcı olabilirim?',
        categories: req.tenant.categories?.map(cat => ({
          id: cat.label.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name: cat.label,
          emoji: cat.label.split(' ')[0], // Extract emoji from label
          keywords: cat.keywords
        })) || DEFAULT_CATEGORIES,
        privacyPolicyUrl: req.tenant.privacyPolicyUrl,
        brandingText: 'Powered by ShopAsistAI',
        showBranding: true,
        queryParserVersion: 'v1',
      };
      
      return res.json(tenantConfig);
    }
    
    // Otherwise use legacy config
    const config = siteConfigs.get(siteId);

    if (!config) {
      // Return default config if site not found
      return res.json({
        siteId,
        siteName: siteId,
        ...DEFAULT_CONFIG,
        categories: DEFAULT_CATEGORIES,
      });
    }

    res.json(config);
  } catch (error: any) {
    console.error('Config API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// POST /api/config/:siteId (for updating config)
router.post('/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const config: WidgetConfig = req.body;

    if (!config.siteId || config.siteId !== siteId) {
      return res.status(400).json({
        error: 'Invalid config: siteId mismatch',
      });
    }

    siteConfigs.set(siteId, config);
    
    // Update cache service config (will rebuild search index with new parser version)
    cacheService.setSiteConfig(config);

    res.json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error('Config Update Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// GET /api/config/parser-version/:siteId
router.get('/parser-version/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const version = cacheService.getParserVersion(siteId);
    const searchService = cacheService.getSearchService(siteId);
    
    res.json({
      siteId,
      version,
      info: searchService?.getParserVersionInfo(),
    });
  } catch (error: any) {
    console.error('Parser Version Get Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// POST /api/config/parser-version/:siteId
router.post('/parser-version/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { version } = req.body as { version: QueryParserVersion };
    
    if (!version || !['v1', 'v2', 'v3'].includes(version)) {
      return res.status(400).json({
        error: 'Invalid parser version. Must be v1, v2, or v3',
      });
    }
    
    // Update cache service
    cacheService.setParserVersion(siteId, version);
    
    // Update in-memory config
    const config = siteConfigs.get(siteId);
    if (config) {
      config.queryParserVersion = version;
      siteConfigs.set(siteId, config);
    }
    
    const searchService = cacheService.getSearchService(siteId);
    
    res.json({
      success: true,
      siteId,
      version,
      info: searchService?.getParserVersionInfo(),
    });
  } catch (error: any) {
    console.error('Parser Version Set Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// GET /api/config/parser-info - Get all parser version details
router.get('/parser-info', (_req: Request, res: Response) => {
  try {
    res.json({
      versions: {
        v1: {
          name: 'Regex-only',
          description: 'Fast pattern-based parser using regular expressions',
          avgLatency: '5-10ms',
          accuracy: '85% (simple: 95%, complex: 60%)',
          cost: '$0 per query',
          bestFor: 'Simple queries like "beyaz 43 numara sneaker"',
        },
        v2: {
          name: 'Hybrid',
          description: 'Intelligent parser - uses regex for simple queries, AI for complex ones',
          avgLatency: '50ms avg (70% instant, 30% 200-500ms)',
          accuracy: '92% (simple: 95%, complex: 90%)',
          cost: '$0.0001 per complex query',
          bestFor: 'All query types - best balance',
        },
        v3: {
          name: 'AI-only',
          description: 'Always uses OpenAI GPT-3.5-Turbo for maximum intelligence',
          avgLatency: '300-500ms',
          accuracy: '90% (consistent across all types)',
          cost: '$0.0015 per query',
          bestFor: 'Complex queries with subjective attributes',
        },
      },
      recommendation: 'v2 (Hybrid) - Best balance of speed, accuracy, and cost',
    });
  } catch (error: any) {
    console.error('Parser Info Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
