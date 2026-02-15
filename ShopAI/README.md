# ShopAsistAI

E-ticaret siteleri için yapay zeka destekli alışveriş asistanı. Google Shopping Feed'lerinden ürün verilerini okuyarak, kullanıcılara akıllı ürün önerileri sunar ve doğal dil ile sohbet eder. LoopsAI gibi popup widget olarak çalışır.

## 🎯 Özellikler

- ✅ **Popup Chat Widget**: LoopsAI tarzında modern popup chatbot
- ✅ **Dışardan Yapılandırma**: Site ismi, logo, renkler, kategoriler config ile özelleştirilebilir
- ✅ **Kategorize Ürün Önerileri**: Kategori butonları ile hızlı ürün filtreleme (👟 Shoes, ⚽ Sports, vb.)
- ✅ **Hoş Geldin Mesajı**: Özelleştirilebilir karşılama ekranı
- ✅ **Privacy Policy & Branding**: Gizlilik politikası uyarısı ve markalama footer'ı
- ✅ **Google Shopping Feed Entegrasyonu**: XML/RSS formatında ürün feed'lerini otomatik olarak parse eder
- ✅ **Gelişmiş Arama Motoru**: BM25 + Hybrid search ile text ve attribute matching
- ✅ **Search Merchandising**: Popülerlik, stok, yeni ürün, kampanya bazlı dinamik ranking
- ✅ **Akıllı Önbellek Sistemi**: Ürün verilerini 1 saat boyunca cache'de tutar
- ✅ **Otomatik Güncelleme**: Her saat başında ürün verilerini otomatik olarak yeniler
- ✅ **AI Destekli Sohbet**: OpenAI GPT-4 ile doğal dil kullanarak ürün önerileri
- ✅ **Modüler Yapı**: Farklı e-ticaret siteleri için kolayca genişletilebilir
- ✅ **RESTful API**: Backend API ile frontend'i bağımsız kullanabilme

## 🎨 Görünüm

Widget, TUDORS örneğindeki gibi modern bir popup chatbot olarak tasarlanmıştır:
- Hoş geldin mesajı ve site branding
- Kategori butonları ile hızlı navigasyon
- Privacy policy uyarısı
- Powered by branding footer

## 🛠️ Teknolojiler

### Backend
- **Node.js** + **TypeScript**
- **Express.js** - Web framework
- **node-cache** - Bellek içi cache
- **node-cron** - Zamanlanmış görevler
- **xml2js** - XML/RSS feed parser
- **OpenAI API** - AI sohbet
- **Axios** - HTTP istekleri

### Frontend
- **HTML5** + **CSS3** + **JavaScript**
- Vanilla JS (framework bağımlılığı yok)
- Modern CSS ile responsive tasarım

## 📋 Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. Ortam Değişkenlerini Ayarla

`.env.example` dosyasını `.env` olarak kopyalayın ve gerekli değerleri girin:

```bash
cp .env.example .env
```

`.env` dosyasında şunları ayarlayın:

```env
# OpenAI API anahtarınızı buraya girin
OPENAI_API_KEY=your_openai_api_key_here

# Google Shopping Feed URL'sini girin
SKECHERS_FEED_URL=https://www.skechers.com.tr/feed/google-shopping

# Diğer ayarlar varsayılan olarak bırakılabilir
PORT=3000
CACHE_TTL_SECONDS=3600
```

### 3. Projeyi Derle

```bash
npm run build
```

## 🚀 Kullanım

### Development Mode

Backend ve frontend'i aynı anda çalıştır:

```bash
npm run dev
```

veya ayrı ayrı:

**Backend:**
```bash
npm run dev:backend
```

**Frontend:**
```bash
npm run dev:frontend
```

### Production Mode

```bash
npm start
```

## 📚 API Endpoints

### Health Check
```
GET /health
```
Sunucu durumunu ve cache istatistiklerini döner.

### Config
```
GET /api/config/:siteId
```
Site yapılandırmasını döner (logo, renkler, kategoriler, vb.)

```
POST /api/config/:siteId
```
Site yapılandırmasını günceller.

### Chat
```
POST /api/chat
Content-Type: application/json

{
  "siteId": "skechers-tr",
  "message": "Koşu ayakkabısı arıyorum",
  "conversationHistory": []
}
```

### Ürün Listesi
```
GET /api/products/:siteId
```

### Ürün Arama
```
GET /api/products/:siteId/search?q=koşu
```

### Kategori Filtreleme
```
GET /api/products/:siteId/category?keywords=shoes,sneakers,running
```

### Merchandising (Yeni!)
```
GET /api/merchandising/config/:siteId
```
Merchandising konfigürasyonunu getir.

```
POST /api/merchandising/config/:siteId
Content-Type: application/json

{
  "signalWeights": {
    "textRelevance": 0.35,
    "attributeMatch": 0.25,
    "popularity": 0.15,
    ...
  },
  "businessRules": {
    "boostNewProducts": true,
    "diversifyResults": true,
    ...
  }
}
```
Merchandising konfigürasyonunu güncelle.

```
POST /api/merchandising/brand-boost/:siteId
Content-Type: application/json

{
  "brandBoosts": {
    "skechers": 5.0,
    "nike": 3.0
  }
}
```
Marka boost'larını ayarla (kampanyalar için).

Detaylı bilgi için [MERCHANDISING_GUIDE.md](./MERCHANDISING_GUIDE.md) dosyasına bakın.

## 🏗️ Proje Yapısı

```
ShopAsistAI/
├── backend/
│   ├── src/
│   │   ├── server.ts              # Ana sunucu
│   │   ├── routes/
│   │   │   ├── chat.ts            # Chat endpoint'leri
│   │   │   ├── products.ts        # Ürün endpoint'leri
│   │   │   ├── config.ts          # Config endpoint'leri
│   │   │   ├── search.ts          # Arama endpoint'leri
│   │   │   └── merchandising.ts   # Merchandising API (YENİ!)
│   │   ├── services/
│   │   │   ├── aiService.ts       # OpenAI entegrasyonu
│   │   │   ├── cacheService.ts    # Cache yönetimi
│   │   │   └── feedParser.ts      # Feed parser
│   │   └── search/
│   │       ├── SearchService.ts        # Ana arama servisi
│   │       ├── BM25Scorer.ts           # BM25 algoritması
│   │       ├── AttributeBooster.ts     # Attribute matching
│   │       ├── MerchandisingEngine.ts  # Merchandising (YENİ!)
│   │       ├── InvertedIndex.ts        # Index yapısı
│   │       ├── QueryParser.ts          # Query parsing
│   │       └── ProductIndexer.ts       # Ürün indexleme
│   └── tsconfig.json
├── frontend/
│   Widget Konfigürasyonu

Widget görünümünü ve davranışını özelleştirmek için config API'sini kullanın:

```javascript
// Örnek config
{
  "siteId": "mysite-tr",
  "siteName": "My Shop",
  "brandLogo": "https://example.com/logo.png",
  "primaryColor": "#000000",
  "secondaryColor": "#e31e24",
  "welcomeMessage": "Hello, let's quickly find what you are looking for in the {SITE_NAME} collection.",
  "welcomeSubtext": "New season, combination suggestions and order support.",
  "categories": [
    {
      "id": "category1",
      "name": "Category Name",
      "emoji": "🏷️",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "privacyPolicyUrl": "https://example.com/privacy",
  "brandingText": "Powered by ShopAsistAI",
  "showBranding": true
}
```

### └── src/
│       ├── index.html          # Ana sayfa
│       ├── styles/
│       │   └── main.css        # Stil dosyaları
│       └── scripts/
│           └── app.js          # Chat widget
├── shared/
│   └── types/
│       └── index.ts            # Ortak tip tanımları
├── package.json
├── tsconfig.json
└── .env.example
```

## 🔧 Yapılandırma

### Yeni Site Ekleme

1. `.env` dosyasına yeni feed URL'si ekleyin:
```env
NEWSITE_FEED_URL=https://example.com/feed.xml
```

2. `backend/src/server.ts` içinde feed'i initialize edin:
```typescript
await feedParserService.parseFeed('newsite-id', 'New Site Name', feedUrl);
```

3. Frontend'de `SITE_ID` değişkenini güncelleyin.

### Cache Süresini Değiştirme

`.env` dosyasında `CACHE_TTL_SECONDS` değerini saniye cinsinden ayarlayın:
```env
CACHE_TTL_SECONDS=3600  # 1 saat
```

### Güncelleme Sıklığını Değiştirme

`.env` dosyasında cron ifadesini düzenleyin:
```env
FEED_UPDATE_CRON=0 * * * *  # Her saat başında
FEED_UPDATE_CRON=*/30 * * * *  # Her 30 dakikada
FEED_UPDATE_CRON=0 0 * * *  # Günde bir kez (gece yarısı)
```

## 🧪 Test Etme

1. Backend'in çalıştığından emin olun:
```bash
curl http://localhost:3000/health
```

2. Ürünlerin yüklendiğini kontrol edin:
```bash
curl http://localhost:3000/api/products/skechers-tr
```

3. Chat'i test edin:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"siteId":"skechers-tr","message":"Spor ayakkabı öner"}'
```

## 🐛 Sorun Giderme

### "OPENAI_API_KEY is not configured" hatası
- `.env` dosyasında `OPENAI_API_KEY` değerini ayarlayın
- Geçerli bir OpenAI API anahtarı kullandığınızdan emin olun

### Feed yüklenemiyor
- Feed URL'sinin doğru olduğunu kontrol edin
- Internet bağlantınızı kontrol edin
- Feed formatının Google Shopping Feed standardına uygun olduğundan emin olun

### CORS hatası
- `.env` dosyasında `ALLOWED_ORIGINS` ayarını kontrol edin
- Frontend'in çalıştığı portu origins listesine ekleyin

## 📝 Lisans

ISC

## 👨‍💻 Geliştirici

ShopAsistAI - 2026

---

**Not**: Bu proje OpenAI API kullanır. API kullanımı için OpenAI hesabınızda yeterli kredi bulunması gerekir.
