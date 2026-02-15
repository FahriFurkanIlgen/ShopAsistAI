// Search Debug Endpoint

import { Router, Request, Response } from 'express';
import { CacheService } from '../services/cacheService';

const router = Router();
const cacheService = CacheService.getInstance();

// GET /api/search/:siteId/debug - Debug search with detailed scores
router.get('/:siteId/debug', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        error: 'Missing query parameter: q',
      });
    }

    const searchService = cacheService.getSearchService(siteId);
    
    if (!searchService || !searchService.isReady()) {
      return res.status(503).json({
        error: 'Search index not ready for this site',
        siteId,
      });
    }

    // Get detailed search results with scores
    const results = await searchService.searchWithScores(q, 10);

    res.json({
      siteId,
      query: q,
      indexStats: searchService.getStats(),
      resultCount: results.length,
      results: results.map(r => ({
        id: r.product.id,
        title: r.product.title,
        brand: r.product.brand,
        color: r.product.color,
        size: r.product.size,
        productType: r.product.productType,
        scores: {
          bm25: r.scores.bm25.toFixed(4),
          brand: r.scores.brand.toFixed(4),
          color: r.scores.color.toFixed(4),
          category: r.scores.category.toFixed(4),
          size: r.scores.size.toFixed(4),
          final: r.scores.final.toFixed(4),
        },
      })),
    });
  } catch (error: any) {
    console.error('Search Debug API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// GET /api/search/:siteId/stats - Get search index statistics
router.get('/:siteId/stats', (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const searchService = cacheService.getSearchService(siteId);
    
    if (!searchService) {
      return res.status(404).json({
        error: 'Search service not found for this site',
        siteId,
      });
    }

    const stats = searchService.getStats();
    const isReady = searchService.isReady();

    res.json({
      siteId,
      ready: isReady,
      stats,
    });
  } catch (error: any) {
    console.error('Search Stats API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;
