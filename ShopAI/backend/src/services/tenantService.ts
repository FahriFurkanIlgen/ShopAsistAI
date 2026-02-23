/**
 * Tenant Service
 * Manages tenant (customer) data and API keys
 */

import { Tenant, CreateTenantRequest, UpdateTenantRequest } from '../models/Tenant';
import crypto from 'crypto';

export class TenantService {
  private static instance: TenantService;
  private tenants: Map<string, Tenant> = new Map();
  private apiKeyIndex: Map<string, string> = new Map(); // apiKey -> tenantId
  private siteIdIndex: Map<string, string> = new Map(); // siteId -> tenantId

  private constructor() {
    // Initialize with default tenants for development
    this.initializeDefaultTenants();
  }

  static getInstance(): TenantService {
    if (!TenantService.instance) {
      TenantService.instance = new TenantService();
    }
    return TenantService.instance;
  }

  /**
   * Initialize default tenants for testing
   */
  private initializeDefaultTenants(): void {
    const defaultTenant: Tenant = {
      id: 'tenant_high5_tr',
      apiKey: 'sk_test_high5_tr_12345',
      siteId: 'high5-tr',
      siteName: 'HIGH5 Türkiye',
      domain: 'high5.com.tr',
      feedUrl: process.env.HIGH5_FEED_URL || 'https://f-hfv-l.sm.mncdn.com/Integration/Xml/google.xml',
      brandLogo: '',
      primaryColor: '#022d56',
      secondaryColor: '#0ea5e9',
      welcomeMessage: 'Merhaba! {SITE_NAME} alışveriş asistanınız.',
      welcomeSubtext: 'Aradığınız ürünü bulmanıza yardımcı olabilirim.',
      privacyPolicyUrl: 'https://www.high5.com.tr/gizlilik-politikasi',
      categories: [
        { label: '👟 Koşu Ayakkabıları', keywords: ['running', 'koşu', 'run'] },
        { label: '🚶 Günlük Ayakkabılar', keywords: ['casual', 'lifestyle', 'günlük'] },
        { label: '⚽ Spor Ayakkabıları', keywords: ['sports', 'athletic', 'spor'] },
        { label: '👞 Erkek Ayakkabıları', keywords: ['men', 'erkek', 'male'] },
        { label: '👠 Kadın Ayakkabıları', keywords: ['women', 'kadın', 'female'] },
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      plan: 'pro',
      monthlyQuota: 100000,
      usedQuota: 0,
    };

    this.tenants.set(defaultTenant.id, defaultTenant);
    this.apiKeyIndex.set(defaultTenant.apiKey, defaultTenant.id);
    this.siteIdIndex.set(defaultTenant.siteId, defaultTenant.id);
  }

  /**
   * Generate a secure API key
   */
  private generateApiKey(siteId: string): string {
    const prefix = 'sk_live';
    const random = crypto.randomBytes(24).toString('hex');
    return `${prefix}_${siteId}_${random}`;
  }

  /**
   * Generate a unique site ID from site name
   */
  private generateSiteId(siteName: string): string {
    return siteName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Create a new tenant
   */
  async createTenant(request: CreateTenantRequest): Promise<Tenant> {
    const siteId = this.generateSiteId(request.siteName);
    const apiKey = this.generateApiKey(siteId);
    const tenantId = `tenant_${siteId}_${Date.now()}`;

    const tenant: Tenant = {
      id: tenantId,
      apiKey,
      siteId,
      siteName: request.siteName,
      domain: request.domain,
      feedUrl: request.feedUrl,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      plan: request.plan || 'free',
      monthlyQuota: this.getQuotaForPlan(request.plan || 'free'),
      usedQuota: 0,
    };

    this.tenants.set(tenantId, tenant);
    this.apiKeyIndex.set(apiKey, tenantId);
    this.siteIdIndex.set(siteId, tenantId);

    return tenant;
  }

  /**
   * Get quota limit based on plan
   */
  private getQuotaForPlan(plan: string): number {
    const quotas: Record<string, number> = {
      free: 1000,
      starter: 10000,
      pro: 100000,
      enterprise: -1, // unlimited
    };
    return quotas[plan] || 1000;
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) || null;
  }

  /**
   * Get tenant by API key
   */
  async getTenantByApiKey(apiKey: string): Promise<Tenant | null> {
    const tenantId = this.apiKeyIndex.get(apiKey);
    if (!tenantId) return null;
    return this.tenants.get(tenantId) || null;
  }

  /**
   * Get tenant by site ID
   */
  async getTenantBySiteId(siteId: string): Promise<Tenant | null> {
    const tenantId = this.siteIdIndex.get(siteId);
    if (!tenantId) return null;
    return this.tenants.get(tenantId) || null;
  }

  /**
   * Update tenant
   */
  async updateTenant(id: string, updates: UpdateTenantRequest): Promise<Tenant | null> {
    const tenant = this.tenants.get(id);
    if (!tenant) return null;

    const updatedTenant: Tenant = {
      ...tenant,
      ...updates,
      updatedAt: new Date(),
    };

    this.tenants.set(id, updatedTenant);
    return updatedTenant;
  }

  /**
   * Increment usage counter
   */
  async incrementUsage(id: string): Promise<void> {
    const tenant = this.tenants.get(id);
    if (tenant) {
      tenant.usedQuota = (tenant.usedQuota || 0) + 1;
      tenant.updatedAt = new Date();
    }
  }

  /**
   * Get all tenants
   */
  async getAllTenants(): Promise<Tenant[]> {
    return Array.from(this.tenants.values());
  }

  /**
   * Delete tenant
   */
  async deleteTenant(id: string): Promise<boolean> {
    const tenant = this.tenants.get(id);
    if (!tenant) return false;

    this.apiKeyIndex.delete(tenant.apiKey);
    this.siteIdIndex.delete(tenant.siteId);
    this.tenants.delete(id);
    
    return true;
  }

  /**
   * Regenerate API key for tenant
   */
  async regenerateApiKey(id: string): Promise<string | null> {
    const tenant = this.tenants.get(id);
    if (!tenant) return null;

    // Remove old API key from index
    this.apiKeyIndex.delete(tenant.apiKey);

    // Generate new API key
    const newApiKey = this.generateApiKey(tenant.siteId);
    tenant.apiKey = newApiKey;
    tenant.updatedAt = new Date();

    // Add new API key to index
    this.apiKeyIndex.set(newApiKey, id);

    return newApiKey;
  }

  /**
   * Reset monthly usage for all tenants (call this monthly via cron)
   */
  async resetMonthlyUsage(): Promise<void> {
    for (const tenant of this.tenants.values()) {
      tenant.usedQuota = 0;
      tenant.updatedAt = new Date();
    }
  }
}
