# 🎯 Search Merchandising - Kullanım Kılavuzu

## 📋 İçindekiler
1. [Nedir?](#nedir)
2. [Özellikler](#özellikler)
3. [Hızlı Başlangıç](#hızlı-başlangıç)
4. [API Kullanımı](#api-kullanımı)
5. [Yapılandırma Örnekleri](#yapılandırma-örnekleri)
6. [Sık Kullanılan Senaryolar](#sık-kullanılan-senaryolar)

---

## Nedir?

**Search Merchandising Engine**, arama sonuçlarınızı iş hedeflerinize göre optimize etmeyi sağlayan gelişmiş bir ranking sistemidir. 

### Önceki Sistem
- ✅ BM25 text matching
- ✅ Attribute boosting (brand, color, category, size)
- ❌ Sabit ağırlıklar
- ❌ İş kuralları yok
- ❌ Kampanya desteği yok

### Yeni Sistem
- ✅ **Tüm eski özellikler**
- ✅ **Dinamik ağırlık ayarlama**
- ✅ **Popülerlik bazlı ranking** (views, clicks, purchases)
- ✅ **Stok durumu yönetimi**
- ✅ **Yeni ürün boost'lama**
- ✅ **Marka/kategori kampanyaları**
- ✅ **Ürün pinleme** (istediğiniz pozisyona sabitleyin)
- ✅ **Sonuç çeşitlendirme** (diversity)
- ✅ **İndirim/fiyat rekabeti**
- ✅ **A/B test desteği**

---

## Özellikler

### 1. 📊 Signal Weights (Ağırlıklar)
Arama sonuçlarını etkileyen faktörlerin önem derecesini ayarlayın:

```typescript
{
  textRelevance: 0.35,        // BM25 text matching
  attributeMatch: 0.25,        // Brand, color, category, size match
  popularity: 0.15,            // View, click, purchase counts
  stockAvailability: 0.10,     // Stok durumu
  recency: 0.05,               // Yeni ürün boost
  priceCompetitiveness: 0.05,  // İndirim/fiyat
  brandStrategy: 0.05,         // Kampanya boost
}
```

**Toplam: 1.0 olmalı** ⚠️

### 2. 🎲 Business Rules (İş Kuralları)

```typescript
{
  boostNewProducts: true,        // Yeni ürünleri öne çıkar
  newProductBoostDays: 30,       // Kaç gün "yeni" sayılsın
  boostInStock: true,            // Stokta olanları öne çıkar
  outOfStockPenalty: 0.5,        // Stokta olmayan ceza katsayısı (0-1)
  diversifyResults: true,        // Çeşitlilik ekle
  diversityFactor: 0.3,          // Çeşitlilik derecesi (0-1)
}
```

### 3. 🏷️ Brand Boosts (Marka Kampanyaları)

Belirli markaları kampanyalar için öne çıkarın:

```typescript
{
  'high5': 5.0,   // Güçlü boost
  'nike': 3.0,       // Orta boost
  'adidas': 2.0,     // Hafif boost
}
```

### 4. 📦 Category Boosts (Kategori Kampanyaları)

Sezonluk veya özel kampanyalar için:

```typescript
{
  'sandals': 4.0,         // Yaz sezonunda sandalet
  'running shoes': 3.0,   // Spor sezonu
  'sneakers': 2.5,        // Günlük ayakkabı
}
```

### 5. 📍 Pinned Products (Sabit Ürünler)

Belirli pozisyonlara ürün sabitleyin:

```typescript
{
  0: 'featured-prod-001',   // İlk sıra
  2: 'featured-prod-002',   // Üçüncü sıra
}
```

### 6. 📈 Product Signals (Ürün Sinyalleri)

Her ürün için metrikler:

```typescript
{
  productId: 'prod-001',
  viewCount: 1500,          // Görüntülenme
  clickCount: 300,          // Tıklanma
  purchaseCount: 45,        // Satın alma
  addedDate: new Date(),    // Eklenme tarihi
  stockQuantity: 25,        // Stok miktarı
  avgRating: 4.5,          // Ortalama puan (opsiyonel)
}
```

---

## Hızlı Başlangıç

### Kod İçinde Kullanım

```typescript
import { SearchService } from './search/SearchService';

// 1. SearchService oluştur
const searchService = new SearchService();

// 2. Ürün verilerini index'le
searchService.buildIndex(products);

// 3. Ürün sinyallerini ayarla
const signals = [
  {
    productId: 'prod-001',
    viewCount: 1500,
    clickCount: 300,
    purchaseCount: 45,
    addedDate: new Date('2024-01-15'),
    stockQuantity: 25,
  },
  // ... diğer ürünler
];
searchService.setProductSignals(signals);

// 4. Merchandising ayarlarını yapılandır
const merchandising = searchService.getMerchandisingEngine();
merchandising.updateConfig({
  brandBoosts: new Map([
    ['high5', 5.0],
    ['nike', 3.0],
  ]),
});

// 5. Arama yap
const results = searchService.search('siyah spor ayakkabı', 10);
```

---

## API Kullanımı

### 1. Config Getir

```bash
GET /api/merchandising/config/:siteId
```

**Response:**
```json
{
  "siteId": "high5-tr",
  "config": {
    "signalWeights": { "textRelevance": 0.35, ... },
    "businessRules": { "boostNewProducts": true, ... },
    "brandBoosts": {},
    "categoryBoosts": {},
    "pinnedProducts": {}
  }
}
```

### 2. Tam Config Güncelle

```bash
POST /api/merchandising/config/:siteId
Content-Type: application/json

{
  "signalWeights": {
    "textRelevance": 0.30,
    "attributeMatch": 0.25,
    "popularity": 0.20,
    "stockAvailability": 0.10,
    "recency": 0.05,
    "priceCompetitiveness": 0.05,
    "brandStrategy": 0.05
  },
  "businessRules": {
    "boostNewProducts": true,
    "newProductBoostDays": 45,
    "boostInStock": true,
    "outOfStockPenalty": 0.7,
    "diversifyResults": true,
    "diversityFactor": 0.3
  }
}
```

### 3. Marka Boost Ayarla

```bash
POST /api/merchandising/brand-boost/:siteId
Content-Type: application/json

{
  "brandBoosts": {
    "high5": 5.0,
    "nike": 3.0,
    "adidas": 2.0
  }
}
```

### 4. Kategori Boost Ayarla

```bash
POST /api/merchandising/category-boost/:siteId
Content-Type: application/json

{
  "categoryBoosts": {
    "sandals": 4.0,
    "running shoes": 3.0,
    "sneakers": 2.5
  }
}
```

### 5. Ürün Pinle

```bash
POST /api/merchandising/pinned-products/:siteId
Content-Type: application/json

{
  "pinnedProducts": {
    "0": "featured-prod-001",
    "2": "featured-prod-002"
  }
}
```

### 6. Sadece Ağırlıkları Güncelle

```bash
POST /api/merchandising/weights/:siteId
Content-Type: application/json

{
  "weights": {
    "textRelevance": 0.25,
    "attributeMatch": 0.20,
    "popularity": 0.25,
    "stockAvailability": 0.12,
    "recency": 0.08,
    "priceCompetitiveness": 0.05,
    "brandStrategy": 0.05
  }
}
```

### 7. İş Kurallarını Güncelle

```bash
POST /api/merchandising/business-rules/:siteId
Content-Type: application/json

{
  "businessRules": {
    "boostNewProducts": true,
    "newProductBoostDays": 30,
    "boostInStock": true,
    "outOfStockPenalty": 0.8,
    "diversifyResults": true,
    "diversityFactor": 0.4
  }
}
```

### 8. Config'i Sıfırla

```bash
DELETE /api/merchandising/config/:siteId
```

---

## Yapılandırma Örnekleri

### 📊 Senaryo 1: Popülerlik Odaklı

```typescript
merchandising.updateConfig({
  signalWeights: {
    textRelevance: 0.25,
    attributeMatch: 0.20,
    popularity: 0.30,      // ⬆️ Popülerliği artır
    stockAvailability: 0.10,
    recency: 0.05,
    priceCompetitiveness: 0.05,
    brandStrategy: 0.05,
  },
});
```

**Ne zaman kullanılır:** Best-seller ürünleri öne çıkarmak istediğinizde.

---

### 🎯 Senaryo 2: Relevance Odaklı (Hassas Arama)

```typescript
merchandising.updateConfig({
  signalWeights: {
    textRelevance: 0.45,   // ⬆️ Text relevance artır
    attributeMatch: 0.30,  // ⬆️ Attribute match artır
    popularity: 0.10,
    stockAvailability: 0.05,
    recency: 0.05,
    priceCompetitiveness: 0.03,
    brandStrategy: 0.02,
  },
});
```

**Ne zaman kullanılır:** Kullanıcılar çok spesifik aramalar yaptığında.

---

### 🔥 Senaryo 3: Flash Sale Kampanya

```typescript
merchandising.updateConfig({
  signalWeights: {
    textRelevance: 0.25,
    attributeMatch: 0.20,
    popularity: 0.15,
    stockAvailability: 0.10,
    recency: 0.05,
    priceCompetitiveness: 0.20,  // ⬆️ İndirimleri artır
    brandStrategy: 0.05,
  },
  categoryBoosts: new Map([
    ['shoes', 3.0],
    ['sneakers', 3.0],
  ]),
});

// 2 saat sonra kampanyayı kapat
setTimeout(() => {
  merchandising.updateConfig({
    signalWeights: { /* varsayılan ayarlara dön */ },
    categoryBoosts: new Map(),
  });
}, 2 * 60 * 60 * 1000);
```

---

### 🆕 Senaryo 4: Yeni Ürün Lansmanı

```typescript
merchandising.updateConfig({
  signalWeights: {
    textRelevance: 0.30,
    attributeMatch: 0.25,
    popularity: 0.10,
    stockAvailability: 0.10,
    recency: 0.15,          // ⬆️ Yeni ürün boost artır
    priceCompetitiveness: 0.05,
    brandStrategy: 0.05,
  },
  businessRules: {
    boostNewProducts: true,
    newProductBoostDays: 60,  // ⬆️ 60 gün "yeni" sayılsın
    boostInStock: true,
    outOfStockPenalty: 0.5,
    diversifyResults: false,   // Yeni ürünleri art arda göster
    diversityFactor: 0.2,
  },
});
```

---

### 🏷️ Senaryo 5: Marka Kampanyası

```typescript
merchandising.updateConfig({
  brandBoosts: new Map([
    ['high5', 8.0],  // ⬆️ Çok güçlü boost
  ]),
  pinnedProducts: new Map([
    [0, 'high5-featured-001'],  // İlk sıraya sabitle
    [1, 'high5-featured-002'],  // İkinci sıraya sabitle
  ]),
  signalWeights: {
    textRelevance: 0.25,
    attributeMatch: 0.20,
    popularity: 0.15,
    stockAvailability: 0.10,
    recency: 0.05,
    priceCompetitiveness: 0.05,
    brandStrategy: 0.20,  // ⬆️ Marka stratejisini artır
  },
});
```

---

## Sık Kullanılan Senaryolar

### 🎄 Sezonluk Kampanya (Kış Sezonu)

```bash
POST /api/merchandising/category-boost/high5-tr
{
  "categoryBoosts": {
    "boots": 5.0,
    "winter shoes": 4.0,
    "sneakers": -1.0
  }
}
```

### 📦 Stok Temizleme

```typescript
merchandising.updateConfig({
  businessRules: {
    boostInStock: false,        // Stok boost'unu kapat
    outOfStockPenalty: 0.0,    // Stok cezasını kaldır
    diversifyResults: false,    // Çeşitliliği azalt
    diversityFactor: 0.1,
  },
  signalWeights: {
    textRelevance: 0.30,
    attributeMatch: 0.25,
    popularity: 0.05,
    stockAvailability: 0.05,
    recency: 0.25,              // Eski ürünleri öne çıkar
    priceCompetitiveness: 0.10,
    brandStrategy: 0.00,
  },
});
```

### 🎯 A/B Test

```typescript
// Kontrol Grubu (A): Varsayılan ayarlar
// Test Grubu (B): Popülerlik odaklı

const userGroup = Math.random() < 0.5 ? 'A' : 'B';

if (userGroup === 'B') {
  merchandising.updateConfig({
    signalWeights: {
      textRelevance: 0.25,
      attributeMatch: 0.20,
      popularity: 0.30,  // Test: Popülerliği artır
      stockAvailability: 0.10,
      recency: 0.05,
      priceCompetitiveness: 0.05,
      brandStrategy: 0.05,
    },
  });
}

// Analytics'e log at
console.log(`User assigned to group: ${userGroup}`);
```

---

## 🎛️ Admin Panel UI Önerisi

Merchandising ayarlarını dinamik olarak yönetmek için basit bir admin panel oluşturabilirsiniz:

### Özellikler:
1. **Weight Slider'ları** - Her signal için kaydırıcı
2. **Brand Boost Listesi** - Marka ekle/çıkar/düzenle
3. **Category Boost Listesi** - Kategori ekle/çıkar/düzenle
4. **Pinned Products** - Sürükle-bırak ile pozisyon ayarla
5. **Kampanya Şablonları** - Hazır senaryolar (flash sale, sezon kampanyası, vb.)
6. **A/B Test Yönetimi** - Test grupları oluştur ve karşılaştır
7. **Preview** - Değişikliklerin etkisini canlı görüntüle

---

## 📊 Metrikleri İzleme

Merchandising performansını ölçmek için şu metrikleri takip edin:

- **Click-Through Rate (CTR)** - Arama sonuçlarından tıklama oranı
- **Conversion Rate** - Aramadan satın alma oranına geçiş
- **Average Order Value (AOV)** - Ortalama sepet değeri
- **Zero Result Rate** - Sonuç bulunamayan aramalar
- **Position Click Rate** - Her pozisyondan tıklama oranı

---

## 🚀 Best Practices

1. **Küçük Değişikliklerle Başla** - Ağırlıkları yavaş yavaş değiştir
2. **A/B Test Yap** - Her değişikliği test et
3. **Metrikleri Takip Et** - CTR, conversion gibi metrikleri izle
4. **Sezona Göre Ayarla** - Yaz/kış farklı stratejiler gerektirir
5. **Feedback Topla** - Kullanıcı geri bildirimlerini dinle
6. **Düzenli Güncelle** - Kampanyalara göre dinamik ayarla
7. **Diversity Kullan** - Monoton sonuçlardan kaçın

---

## 🐛 Troubleshooting

### Sonuçlar Beklendiği Gibi Değil

1. **Ağırlıkları Kontrol Et** - Toplamı 1.0 mi?
2. **Product Signals** - Doğru ayarlandı mı?
3. **Brand/Category Names** - Lowercase ve normalize edilmiş mi?
4. **Pinned Products** - Yanlışlıkla sabitlenmiş ürün var mı?

### Çok Fazla Stokta Olmayan Ürün Gösteriliyor

```typescript
merchandising.updateConfig({
  businessRules: {
    boostInStock: true,
    outOfStockPenalty: 0.8,  // ⬆️ Cezayı artır
  },
});
```

### Yeni Ürünler Hiç Gösterilmiyor

```typescript
merchandising.updateConfig({
  signalWeights: {
    recency: 0.15,  // ⬆️ Recency weight artır
  },
  businessRules: {
    boostNewProducts: true,
    newProductBoostDays: 60,  // ⬆️ Süreyi artır
  },
});
```

---

## 📞 Destek

Sorularınız için:
- GitHub Issues: [ShopAsistAI/issues](https://github.com/...)
- Email: support@shopassistai.com

---

**🎉 Başarılar! Search merchandising ile satışlarınızı artırın!**
