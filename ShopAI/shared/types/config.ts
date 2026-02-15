// Widget configuration types

/**
 * Query Parser Versions
 * v1: Regex-only (fast, basic)
 * v2: Hybrid (regex for simple, AI for complex)
 * v3: AI-only (intelligent, slower)
 */
export type QueryParserVersion = 'v1' | 'v2' | 'v3';

export interface WidgetConfig {
  siteId: string;
  siteName: string;
  brandLogo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  welcomeMessage?: string;
  welcomeSubtext?: string;
  categories?: ProductCategory[];
  privacyPolicyUrl?: string;
  brandingText?: string;
  showBranding?: boolean;
  queryParserVersion?: QueryParserVersion; // Default: v1
}

export interface ProductCategory {
  id: string;
  name: string;
  emoji?: string;
  icon?: string;
  keywords?: string[];
}

export const DEFAULT_CONFIG: Partial<WidgetConfig> = {
  primaryColor: '#4f46e5',
  secondaryColor: '#10b981',
  welcomeMessage: "Hello, let's quickly find what you are looking for in the {SITE_NAME} collection.",
  welcomeSubtext: 'New season, combination suggestions and order support.',
  showBranding: true,
  brandingText: 'Powered by ShopAsistAI',
  queryParserVersion: 'v3',
};

export const DEFAULT_CATEGORIES: ProductCategory[] = [
  { id: 'shirt', name: 'Shirt', emoji: '👔', keywords: ['shirt', 'gömlek', 'dress shirt'] },
  { id: 'tshirt', name: 'T-Shirt', emoji: '👕', keywords: ['t-shirt', 'tişört', 'tee'] },
  { id: 'pants', name: 'Pants', emoji: '👖', keywords: ['pants', 'pantolon', 'trousers'] },
  { id: 'knitwear', name: 'Knitwear', emoji: '🧶', keywords: ['sweater', 'kazak', 'knitwear', 'cardigan'] },
  { id: 'accessories', name: 'Accessories', emoji: '👜', keywords: ['accessories', 'aksesuar', 'bag', 'wallet'] },
];
