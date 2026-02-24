/**
 * Recommendations Router
 * GraphDB-powered product recommendations
 */

import { Router, Request, Response } from 'express';
import { graphService } from '../services/graphService';
import { CacheService } from '../services/cacheService';

const router = Router();
const cacheService = CacheService.getInstance();

/**
 * GET /api/recommendations/:productId
 * Get product recommendations based on graph relationships
 */
router.get('/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    // Check if GraphDB is available
    if (!graphService.isServiceConnected()) {
      return res.status(503).json({
        success: false,
        error: 'GraphDB service not available',
        message: 'Recommendations are currently unavailable. Using fallback search.'
      });
    }

    // Get recommendations from GraphDB
    const recommendations = await graphService.getRecommendations(productId, limit);

    res.json({
      success: true,
      productId,
      recommendations,
      count: recommendations.length,
      source: 'graphdb'
    });
  } catch (error) {
    console.error('[Recommendations] Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/recommendations/:productId/similar
 * Get similar products using multi-hop graph traversal
 */
router.get('/:productId/similar', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!graphService.isServiceConnected()) {
      return res.status(503).json({
        success: false,
        error: 'GraphDB service not available'
      });
    }

    const similarProducts = await graphService.getSimilarProducts(productId, limit);

    res.json({
      success: true,
      productId,
      similarProducts,
      count: similarProducts.length,
      source: 'graphdb'
    });
  } catch (error) {
    console.error('[Recommendations] Error getting similar products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get similar products',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/recommendations/category/:category
 * Get products by category from GraphDB
 */
router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!graphService.isServiceConnected()) {
      return res.status(503).json({
        success: false,
        error: 'GraphDB service not available'
      });
    }

    const products = await graphService.getProductsByCategory(category, limit);

    res.json({
      success: true,
      category,
      products,
      count: products.length,
      source: 'graphdb'
    });
  } catch (error) {
    console.error('[Recommendations] Error getting category products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get category products',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/recommendations/stats
 * Get GraphDB statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    if (!graphService.isServiceConnected()) {
      return res.status(503).json({
        success: false,
        error: 'GraphDB service not available',
        connected: false
      });
    }

    const stats = await graphService.getStatistics();

    res.json({
      success: true,
      connected: true,
      stats
    });
  } catch (error) {
    console.error('[Recommendations] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/recommendations/sync
 * Manually trigger sync of products to GraphDB
 */
router.post('/sync', async (_req: Request, res: Response) => {
  try {
    if (!graphService.isServiceConnected()) {
      return res.status(503).json({
        success: false,
        error: 'GraphDB service not available'
      });
    }

    const products = cacheService.getAllProducts();
    
    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No products available to sync'
      });
    }

    console.log(`[Recommendations] Manual sync triggered for ${products.length} products`);

    // Import products
    await graphService.importProducts(products);

    // Create relationships
    await Promise.all([
      graphService.createCategoryRelationships(),
      graphService.createBrandRelationships(),
      graphService.createPriceSimilarityRelationships()
    ]);

    const stats = await graphService.getStatistics();

    res.json({
      success: true,
      message: 'Products synced successfully',
      stats
    });
  } catch (error) {
    console.error('[Recommendations] Error syncing products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync products',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
