import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import chatRouter from './routes/chat';
import productsRouter from './routes/products';
import configRouter from './routes/config';
import searchRouter from './routes/search';
import merchandisingRouter from './routes/merchandising';
import tenantsRouter from './routes/tenants';
import { FeedParserService } from './services/feedParser';
import { CacheService } from './services/cacheService';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const cacheService = CacheService.getInstance();
const feedParserService = new FeedParserService(cacheService);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Always allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }
    
    // In production, check allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'];
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400, // 24 hours
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/chat', chatRouter);
app.use('/api/products', productsRouter);
app.use('/api/config', configRouter);
app.use('/api/search', searchRouter);
app.use('/api/merchandising', merchandisingRouter);
app.use('/api/tenants', tenantsRouter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cache: cacheService.getStats(),
    version: '2.0.0-multi-tenant',
  });
});

// Initialize feeds on startup
const initializeFeeds = async () => {
  console.log('🚀 Initializing product feeds...');
  try {
    const feedUrl = process.env.HIGH5_FEED_URL;
    const siteName = process.env.SITE_NAME || 'High5 Turkey';
    
    if (feedUrl) {
      await feedParserService.parseFeed('high5-tr', siteName, feedUrl);
      console.log('✅ Product feeds initialized successfully');
    } else {
      console.warn('⚠️  No feed URL configured. Set HIGH5_FEED_URL in .env');
    }
  } catch (error) {
    console.error('❌ Error initializing feeds:', error);
  }
};

// Schedule feed updates (every hour by default)
const cronExpression = process.env.FEED_UPDATE_CRON || '0 * * * *';
cron.schedule(cronExpression, async () => {
  console.log('⏰ Scheduled feed update started');
  await initializeFeeds();
});

// Start server
app.listen(PORT, async () => {
  console.log(`🛍️  ShopAsistAI server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize feeds on startup
  await initializeFeeds();
});

export default app;
