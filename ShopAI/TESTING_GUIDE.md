# 🧪 ShopAsist AI - Test Rehberi

Loops.so tarzı plugin yapısına dönüştürülen ShopAsist AI sisteminin kapsamlı test rehberi.

## 🚀 Hızlı Başlangıç

### 1. Backend'i Başlat
```bash
npm run dev:backend
```
Backend: http://localhost:3000

### 2. Frontend'i Başlat
```bash
npm run dev:frontend
```
Frontend: http://localhost:3001

---

## 📋 Test Senaryoları

### ✅ Test 1: Admin Dashboard
**URL**: http://localhost:3001/admin.html

**Test Adımları**:
1. Sayfanın yüklendiğini doğrula
2. Default High5 müşterisinin listelendiğini gör
3. Stats kartlarını kontrol et (Toplam Müşteri: 1, Aktif Müşteri: 1)
4. Yeni müşteri ekle:
   - Site Adı: `Test Shop`
   - Domain: `testshop.com`
   - Feed URL: `https://example.com/feed.xml`
   - Email: `test@test.com`
   - Plan: `Pro`
5. "Müşteri Oluştur" butonuna tıkla
6. API key modal'ının açıldığını gör
7. API key'i kopyala
8. Tabloda yeni müşterinin göründüğünü onayla
9. "Kod" butonuna tıklayarak entegrasyon kodunu gör

**Beklenen Sonuç**: ✅ Müşteri başarıyla oluşturuldu ve sistemde görünüyor

---

### ✅ Test 2: Widget Loader (Otomatik Entegrasyon)
**URL**: http://localhost:3001/embed-demo.html

**Test Adımları**:
1. Sayfanın gerçek bir High5 sitesini simüle ettiğini gör
2. Sağ alt köşede chat butonunun göründüğünü onayla
3. Chat butonuna tıkla
4. Widget'ın açıldığını gör
5. Hoş geldin mesajını kontrol et: "Merhaba, High5 koleksiyonunda aradığınızı hızlıca bulalım."
6. Kategori butonlarını test et (Erkek, Kadın, Çocuk, vb.)
7. Bir mesaj yaz: "42 numara erkek koşu ayakkabısı"
8. AI'nin cevap verdiğini ve ürünleri gösterdiğini onayla

**Beklenen Sonuç**: ✅ Widget tek script ile otomatik yüklendi ve çalışıyor

---

### ✅ Test 3: Shadow DOM Isolation
**URL**: http://localhost:3001/shadow-test.html

**Test Adımları**:
1. Sayfanın EXTREME CSS ile dolu olduğunu gör:
   - Her element sarı arkaplan
   - Kırmızı borderlar
   - 50px margin/padding
   - Her şey 5 derece döndürülmüş
2. Sağ alt köşedeki widget butonunu kontrol et
3. **Widget'ın tamamen normal göründüğünü onayla** (hiç etkilenmemeli!)
4. Widget'ı aç
5. İçeriğin mükemmel göründüğünü onayla
6. Sayfanın aggressive CSS'inin widget'ı etkilemediğini doğrula

**Beklenen Sonuç**: ✅ Shadow DOM sayesinde widget tamamen izole ve korumalı

---

### ✅ Test 4: Multi-Tenant API

**Test Adımları**:

#### 4a. Tenant Oluşturma
```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "siteName": "Nike Store",
    "domain": "nike-store.com",
    "feedUrl": "https://nike.com/feed.xml",
    "contactEmail": "info@nike.com",
    "plan": "enterprise"
  }'
```

**Beklenen Cevap**:
```json
{
  "success": true,
  "tenant": {
    "id": "tenant_nike-store_...",
    "apiKey": "sk_live_nike-store_...",
    "siteId": "nike-store",
    ...
  }
}
```

#### 4b. Tenant Listesi
```bash
curl http://localhost:3000/api/tenants
```

**Beklenen**: En az 2 tenant (High5 + yeni oluşturulan)

#### 4c. API Key ile Config Alma
```bash
curl "http://localhost:3000/api/config/nike-store?apiKey=YOUR_API_KEY"
```

**Beklenen**: Nike Store için özelleştirilmiş config

---

### ✅ Test 5: Manuel Widget Entegrasyonu
**URL**: http://localhost:3001/demo.html

**Test Adımları**:
1. Sayfanın widget HTML'ini manuel olarak içerdiğini gör
2. Widget'ın çalıştığını doğrula
3. Bir önceki testlerle aynı fonksiyoneliteyi test et

**Beklenen Sonuç**: ✅ Manuel entegrasyon da çalışıyor

---

### ✅ Test 6: Standalone Widget
**URL**: http://localhost:3001/index.html

**Test Adımları**:
1. Sayfada sadece widget'ın olduğunu gör
2. Widget'ın kendini initialize ettiğini onayla
3. Temel fonksiyoneliteyi test et

**Beklenen Sonuç**: ✅ Widget standalone modda çalışıyor

---

### ✅ Test 7: Health Check & System Status
```bash
curl http://localhost:3000/health
```

**Beklenen Cevap**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-22T...",
  "cache": {
    "siteConfigs": 1,
    "searchServices": 1,
    "products": { "high5-tr": 13681 }
  },
  "version": "2.0.0-multi-tenant"
}
```

---

### ✅ Test 8: Quota & Rate Limiting

**Test Adımları**:
1. Admin dashboard'dan Free plan'da (1,000/ay limit) bir tenant oluştur
2. API key'i al
3. 1,001 adet istek gönder
4. Son isteğin 429 (Quota Exceeded) döndüğünü onayla

```bash
# Quota kontrolü
for i in {1..1005}; do
  curl "http://localhost:3000/api/config/test-shop?apiKey=YOUR_KEY" > /dev/null 2>&1
  echo "Request $i"
done
```

**Beklenen Sonuç**: ✅ 1,001. istekte quota limiti hatası

---

### ✅ Test 9: Invalid API Key
```bash
curl "http://localhost:3000/api/config/high5-tr?apiKey=invalid-key"
```

**Beklenen Cevap**: 401 Unauthorized

---

### ✅ Test 10: Widget Custom Config

**Test Adımları**:
1. Admin'den yeni tenant oluştur
2. Tenant'ı update et (PUT /api/tenants/:id):
```json
{
  "brandLogo": "https://example.com/logo.png",
  "primaryColor": "#FF0000",
  "secondaryColor": "#00FF00",
  "welcomeMessage": "Custom Welcome!",
  "categories": [
    { "label": "👟 Shoes", "keywords": ["shoes", "footwear"] }
  ]
}
```
3. Widget'ı custom config ile yükle
4. Renklerin ve mesajların değiştiğini onayla

**Beklenen Sonuç**: ✅ Widget custom branding ile çalışıyor

---

## 🎯 Başarı Kriterleri

Tüm testler başarılı olduysa:

✅ **Widget Sistem**
- [x] Shadow DOM izolasyonu çalışıyor
- [x] Tek script ile otomatik yükleme
- [x] Manuel entegrasyon desteği
- [x] CSS çakışması yok

✅ **Multi-Tenant Sistem**
- [x] Tenant oluşturma/yönetim
- [x] API key authentication
- [x] Quota & rate limiting
- [x] Tenant bazlı config

✅ **Admin Dashboard**
- [x] Müşteri listesi
- [x] Yeni müşteri ekleme
- [x] İstatistikler
- [x] Entegrasyon kod üretimi

✅ **API Endpoints**
- [x] /api/tenants (CRUD)
- [x] /api/config/:siteId (tenant aware)
- [x] /health (system status)

---

## 🐛 Sorun Giderme

### Widget görünmüyor
- Browser console'u kontrol et
- Network tab'de widget-loader.js'in yüklendiğini kontrol et
- ShopAsistConfig'in doğru tanımlandığını kontrol et

### API 401 hatası
- API key'in doğru olduğunu kontrol et
- Tenant'ın active olduğunu kontrol et

### Quota aşıldı
- Admin dashboard'dan kullanımı kontrol et
- Plan upgrade et veya yeni ay başını bekle

---

## 📊 Performans Metrikleri

**Beklenen Performans**:
- Widget yükleme: < 500ms
- Shadow DOM oluşturma: < 100ms
- API response time: < 200ms
- Cache hit rate: > 80%

---

## 🎉 Test Tamamlandı!

Tüm testler başarılı ise sistem production-ready! 🚀
