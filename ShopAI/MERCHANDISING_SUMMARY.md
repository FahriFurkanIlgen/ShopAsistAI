# 🎯 Search Merchandising İyileştirmesi - Özet

## 📊 Ne Yaptık?

Arama sisteminize **profesyonel seviyede merchandising özellikleri** ekledik. Artık sadece metin eşleştirme yerine, **iş hedeflerinize göre** arama sonuçlarını optimize edebiliyorsunuz.

---

## ✨ Yeni Özellikler

### 1. 🎛️ Dinamik Signal Weights (Ağırlık Yönetimi)

**ÖNCEKİ:** Sabit ağırlıklar (BM25: %35, Attribute: %25, vb.)  
**ŞİMDİ:** Dinamik olarak ayarlanabilir 7 farklı sinyal:

```typescript
{
  textRelevance: 0.35,        // BM25 text matching
  attributeMatch: 0.25,        // Brand, color, category, size
  popularity: 0.15,            // View, click, purchase counts
  stockAvailability: 0.10,     // Stok durumu
  recency: 0.05,               // Yeni ürün boost
  priceCompetitiveness: 0.05,  // İndirim/fiyat
  brandStrategy: 0.05,         // Kampanya boost
}
```

### 2. 📈 Popularity Signals (Popülerlik Bazlı Ranking)

**YENİ:** Ürünler için davranış metrikleri:
- `viewCount` - Görüntülenme sayısı
- `clickCount` - Tıklanma sayısı
- `purchaseCount` - Satın alma sayısı

**Formül:** `(purchaseCount × 3.0) + (clickCount × 1.5) + (viewCount × 0.5)`

### 3. 📦 Stok Yönetimi

**YENİ:** Stok durumuna göre otomatik boost/ceza:
- ✅ **Stokta var:** Boost (log10 bazlı, max 5 puan)
- ❌ **Stokta yok:** Ceza (ayarlanabilir, default -2.5 puan)

### 4. 🆕 Yeni Ürün Boost

**YENİ:** Son X gün içinde eklenen ürünleri öne çıkar:
- Varsayılan: 30 gün
- Linear decay: Yeni eklenenler daha yüksek boost
- Ayarlanabilir güçlülük

### 5. 🏷️ Marka/Kategori Kampanyaları

**YENİ:** Belirli marka veya kategorileri öne çıkarın:

```typescript
brandBoosts: Map([
  ['high5', 5.0],   // High5 kampanyası
  ['nike', 3.0],       // Nike kampanyası
])

categoryBoosts: Map([
  ['sandals', 4.0],         // Yaz sezonu sandalet
  ['running shoes', 3.0],   // Spor sezonu
])
```

### 6. 📍 Pinned Products (Ürün Sabitleme)

**YENİ:** İstediğiniz ürünü istediğiniz pozisyona sabitleyin:

```typescript
pinnedProducts: Map([
  [0, 'featured-prod-001'],  // İlk sırada bu ürün
  [2, 'featured-prod-002'],  // Üçüncü sırada bu ürün
])
```

### 7. 🎨 Result Diversification (Sonuç Çeşitlendirme)

**YENİ:** Monoton sonuçları önle:
- İlk 3 ürün her zaman en yüksek skorlu
- Sonrakiler için marka/kategori çeşitliliği sağla
- Ayarlanabilir çeşitlilik faktörü (0-1)

### 8. 💰 Price Competitiveness (Fiyat Rekabeti)

**YENİ:** İndirimli ürünleri otomatik boost:
- İndirim yüzdesi hesapla
- Yüksek indirim = yüksek boost (max 3 puan)

---

## 🗂️ Eklenen Dosyalar

### Core Files
1. **`backend/src/search/MerchandisingEngine.ts`**  
   → Ana merchandising motoru (394 satır)

2. **`backend/src/routes/merchandising.ts`**  
   → Merchandising API endpoint'leri

### Documentation
3. **`MERCHANDISING_GUIDE.md`**  
   → Detaylı kullanım kılavuzu (650+ satır)

4. **`backend/src/merchandisingExamples.ts`**  
   → 10 farklı kullanım senaryosu

5. **`backend/src/test-merchandising.ts`**  
   → Test script'i

### Updated Files
6. **`backend/src/search/SearchService.ts`** *(güncellendi)*  
   → Merchandising entegrasyonu

7. **`backend/src/search/types.ts`** *(güncellendi)*  
   → Yeni tip tanımları

8. **`backend/src/search/index.ts`** *(güncellendi)*  
   → Export'lar

9. **`backend/src/server.ts`** *(güncellendi)*  
   → Merchandising route eklendi

10. **`README.md`** *(güncellendi)*  
    → Yeni özellikler eklendi

---

## 📡 Yeni API Endpoint'leri

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/merchandising/config/:siteId` | Config getir |
| `POST` | `/api/merchandising/config/:siteId` | Config güncelle |
| `POST` | `/api/merchandising/brand-boost/:siteId` | Marka boost ayarla |
| `POST` | `/api/merchandising/category-boost/:siteId` | Kategori boost ayarla |
| `POST` | `/api/merchandising/pinned-products/:siteId` | Ürün sabitle |
| `POST` | `/api/merchandising/weights/:siteId` | Ağırlıkları güncelle |
| `POST` | `/api/merchandising/business-rules/:siteId` | İş kurallarını güncelle |
| `DELETE` | `/api/merchandising/config/:siteId` | Config sıfırla |

---

## 🎪 Kullanım Senaryoları

### 📊 Senaryo 1: Flash Sale Kampanya

```typescript
POST /api/merchandising/config/high5-tr
{
  "signalWeights": {
    "priceCompetitiveness": 0.20  // İndirimleri öne çıkar
  },
  "categoryBoosts": {
    "shoes": 3.0,
    "sneakers": 3.0
  }
}

// 2 saat sonra otomatik kapat
```

**Sonuç:** İndirimli ayakkabılar öne çıkar.

---

### 🏷️ Senaryo 2: Marka Kampanyası (High5)

```typescript
POST /api/merchandising/brand-boost/high5-tr
{
  "brandBoosts": {
    "high5": 8.0  // Çok güçlü boost
  }
}

POST /api/merchandising/pinned-products/high5-tr
{
  "pinnedProducts": {
    "0": "high5-featured-001",
    "1": "high5-featured-002"
  }
}
```

**Sonuç:** High5 ürünleri her zaman üstte.

---

### 📦 Senaryo 3: Stok Temizleme

```typescript
POST /api/merchandising/config/high5-tr
{
  "signalWeights": {
    "recency": 0.25,              // Eski ürünleri öne çıkar
    "stockAvailability": 0.05,    // Stok önemini azalt
    "priceCompetitiveness": 0.15  // İndirimleri boost et
  },
  "businessRules": {
    "boostInStock": false,         // Stok boost'unu kapat
    "outOfStockPenalty": 0.0       // Stok cezasını kaldır
  }
}
```

**Sonuç:** Eski, indirimli ürünler öne çıkar.

---

### 🔥 Senaryo 4: Popülerlik Odaklı

```typescript
POST /api/merchandising/weights/high5-tr
{
  "weights": {
    "textRelevance": 0.25,
    "attributeMatch": 0.20,
    "popularity": 0.30,        // ⬆️ Popülerliği artır
    "stockAvailability": 0.10,
    "recency": 0.05,
    "priceCompetitiveness": 0.05,
    "brandStrategy": 0.05
  }
}
```

**Sonuç:** En çok satılan ürünler öne çıkar.

---

### 🆕 Senaryo 5: Yeni Ürün Lansmanı

```typescript
POST /api/merchandising/config/high5-tr
{
  "signalWeights": {
    "recency": 0.20          // Yeni ürün boost artır
  },
  "businessRules": {
    "boostNewProducts": true,
    "newProductBoostDays": 60  // 60 gün "yeni" sayılsın
  }
}
```

**Sonuç:** Son 60 günde eklenen ürünler öne çıkar.

---

## 🎯 A/B Test Desteği

```typescript
const userGroup = Math.random() < 0.5 ? 'A' : 'B';

if (userGroup === 'B') {
  // Test Grubu: Popülerlik odaklı
  merchandising.updateConfig({
    signalWeights: {
      popularity: 0.30  // Test: Popülerliği artır
    }
  });
}

// Analytics'e log at
analytics.track('search_ab_test', { group: userGroup });
```

---

## 📊 Metrikleri İzleyin

Track these KPIs:
- **CTR (Click-Through Rate)** - Arama → Tıklama
- **Conversion Rate** - Arama → Satın Alma
- **AOV (Average Order Value)** - Ortalama sepet değeri
- **Zero Result Rate** - Sonuç bulunamaması
- **Position Click Rate** - Her pozisyondan tıklama

---

## 🚀 Nasıl Kullanılır?

### 1. Product Signals Ayarla

```typescript
import { SearchService } from './search/SearchService';

const searchService = new SearchService();

// Ürün sinyallerini ayarla (database'den gelecek)
searchService.setProductSignals([
  {
    productId: 'prod-001',
    viewCount: 1500,
    clickCount: 300,
    purchaseCount: 45,
    addedDate: new Date('2024-01-15'),
    stockQuantity: 25,
  },
  // ... diğer ürünler
]);
```

### 2. Kampanya Başlat

```typescript
const merchandising = searchService.getMerchandisingEngine();

// Marka kampanyası
merchandising.updateConfig({
  brandBoosts: new Map([['high5', 5.0]]),
});
```

### 3. Arama Yap

```typescript
const results = searchService.search('siyah spor ayakkabı', 10);
// Merchandising otomatik uygulanır
```

### 4. API Üzerinden Dinamik Yönet

```bash
# Kampanya başlat
curl -X POST http://localhost:3000/api/merchandising/brand-boost/high5-tr \
  -H "Content-Type: application/json" \
  -d '{"brandBoosts": {"high5": 5.0}}'

# Sonuçları gör
curl http://localhost:3000/api/search/high5-tr?q=ayakkabı
```

---

## 🎓 Daha Fazla Bilgi

- **Detaylı Kılavuz:** [MERCHANDISING_GUIDE.md](./MERCHANDISING_GUIDE.md)
- **Kod Örnekleri:** [backend/src/merchandisingExamples.ts](./backend/src/merchandisingExamples.ts)
- **Test Script:** [backend/src/test-merchandising.ts](./backend/src/test-merchandising.ts)

---

## 🔧 Sonraki Adımlar

### Hemen Yapılacaklar:
1. ✅ Test script'ini çalıştırın: `npx ts-node backend/src/test-merchandising.ts`
2. ✅ Merchandising API'yi deneyin
3. ✅ Product signals'ı database'e bağlayın

### Orta Vadede:
1. 📊 Admin panel oluşturun (weight slider'ları, kampanya yönetimi)
2. 📈 Analytics entegrasyonu (CTR, conversion tracking)
3. 🧪 A/B test framework'ü

### Uzun Vadede:
1. 🤖 ML-based auto-optimization (hangi ağırlıklar en iyi?)
2. 👥 Personalized merchandising (kullanıcı bazlı)
3. 📊 Real-time dashboard (canlı metrik görüntüleme)

---

## ✅ Avantajlar

| Özellik | Önceki Sistem | Yeni Sistem |
|---------|---------------|-------------|
| **Ağırlıklar** | ❌ Sabit | ✅ Dinamik |
| **Popülerlik** | ❌ Yok | ✅ View/Click/Purchase |
| **Stok Yönetimi** | ❌ Yok | ✅ Boost/Penalty |
| **Kampanyalar** | ❌ Yok | ✅ Marka/Kategori |
| **Pinning** | ❌ Yok | ✅ Pozisyon sabitleme |
| **Diversity** | ❌ Yok | ✅ Çeşitlilik algoritması |
| **A/B Test** | ❌ Yok | ✅ Multi-variant test |
| **API Yönetimi** | ❌ Yok | ✅ RESTful API |

---

## 🎉 Sonuç

Artık **enterprise-level search merchandising** sisteminiz var! 

- ✅ Kampanyalar çalıştırabilirsiniz
- ✅ Sonuçları dinamik optimize edebilirsiniz
- ✅ A/B testler yapabilirsiniz
- ✅ Metrikleri takip edebilirsiniz
- ✅ İş hedeflerinize göre ranking ayarlayabilirsiniz

**Not:** Tüm değişiklikler geriye uyumlu, mevcut arama sisteminiz normale devam ediyor.

---

Başarılar! 🚀
