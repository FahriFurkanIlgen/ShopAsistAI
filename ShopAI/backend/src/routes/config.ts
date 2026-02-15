import { Router, Request, Response } from 'express';
import { WidgetConfig, DEFAULT_CONFIG, DEFAULT_CATEGORIES, QueryParserVersion } from '../../../shared/types/config';
import { CacheService } from '../services/cacheService';

const router = Router();
const cacheService = CacheService.getInstance();

// In-memory config storage (in production, this would be in a database)
const siteConfigs: Map<string, WidgetConfig> = new Map();

// Initialize default config for skechers
const defaultSkechersConfig: WidgetConfig = {
  siteId: 'skechers-tr',
  siteName: process.env.SITE_NAME || 'Skechers Turkey',
  primaryColor: '#000000',
  secondaryColor: '#e31e24',
  welcomeMessage: "Hello, let's quickly find what you are looking for in the Skechers collection.",
  welcomeSubtext: 'New season, combination suggestions and order support.',
  categories: [
    { id: 'shoes', name: 'Shoes', emoji: '👟', keywords: ['shoes', 'ayakkabı', 'sneakers', 'running'] },
    { id: 'sports', name: 'Sports', emoji: '⚽', keywords: ['sport', 'spor', 'athletic', 'running'] },
    { id: 'casual', name: 'Casual', emoji: '👞', keywords: ['casual', 'günlük', 'lifestyle'] },
    { id: 'kids', name: 'Kids', emoji: '👶', keywords: ['kids', 'çocuk', 'children'] },
    { id: 'accessories', name: 'Accessories', emoji: '🎒', keywords: ['accessories', 'aksesuar', 'bag', 'socks'] },
  ],
  privacyPolicyUrl: 'https://www.skechers.com.tr/privacy-policy',
  brandingText: 'Powered by ShopAsistAI',
  showBranding: true,
  queryParserVersion: 'v1', // Default to regex-only
};

siteConfigs.set('skechers-tr', defaultSkechersConfig);
cacheService.setSiteConfig(defaultSkechersConfig);

// GET /api/config/:siteId
router.get('/:siteId', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
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
