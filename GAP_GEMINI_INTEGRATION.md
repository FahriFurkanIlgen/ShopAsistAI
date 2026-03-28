# 🛍️ Gap-Gemini Modeli Entegrasyonu

## Proje Özeti

High5.com.tr için **tamamen AI-tabanlı alışveriş deneyimi** oluşturuldu. Gap'in Google Gemini üzerinden sunduğu "sohbet içinde satın alma" modelini ShopAsistAI projesine entegre ettik.

## ✨ Yeni Özellikler

### 1. **Sohbet İçi Sepet Yönetimi**
- Doğal dilde sepete ekleme: *"Bunu sepete ekle"*, *"39 numara siyah olanı al"*
- Sepeti görüntüleme: *"Sepetimi göster"*
- Sepetten çıkarma: *"Bunu çıkar"*
- Toplam gösterimi ve miktar değiştirme

### 2. **AI Intent Recognition (Niyet Algılama)**
Kullanıcının ne yapmak istediğini anlayan akıllı sistem:
- `PRODUCT_SEARCH` - Ürün araması
- `ADD_TO_CART` - Sepete ekleme
- `VIEW_CART` - Sepet görüntüleme
- `CHECKOUT_INIT` - Satın alma başlatma
- `PROVIDE_ADDRESS` - Adres verme
- `PROVIDE_PAYMENT` - Ödeme yöntemi seçme
- `CONFIRM_ORDER` - Sipariş onaylama
- `TRACK_ORDER` - Sipariş takibi

### 3. **In-Chat Checkout Akışı**
Gap-Gemini modeliyle aynı şekilde, tüm alışveriş sohbet içinde:

```
1️⃣ Ürün Keşfi
   AI: "Hangi ürünü arıyorsunuz?"
   Kullanıcı: "42 numara siyah koşu ayakkabısı"

2️⃣ Ürün Önerisi & Sepete Ekleme  
   AI: [3 ürün gösterir]
   Kullanıcı: "İlkini sepete ekle"
   AI: "✅ Sepetinize eklendi! Satın almak ister misiniz?"

3️⃣ Checkout Başlatma
   Kullanıcı: "Evet, satın almak istiyorum"
   AI: "Sepet özeti: 1 ürün - 2.450 TL. Teslimat adresiniz?"

4️⃣ Adres Toplama
   Kullanıcı: "Ahmet Yılmaz, 05XX, Kadıköy İstanbul..."
   AI: "Adresiniz kaydedildi. Ödeme yöntemi?"

5️⃣ Ödeme Seçimi
   Kullanıcı: "Kredi kartı"
   AI: "Toplam 2.450 TL. Onaylıyor musunuz?"

6️⃣ Sipariş Onayı
   Kullanıcı: "Evet"
   AI: "🎉 Sipariş oluşturuldu! Sipariş No: ORD1234567890"
```

### 4. **Visual Cart Sidebar**
- Header'da sepet ikonu ve badge
- Sağdan açılan modern cart sidebar
- Ürün görselleri, fiyatlar, miktarlar
- Toplam hesaplama
- "Satın Al" butonu ile checkout'a geçiş

## 📁 Oluşturulan Dosyalar

### Backend
```
backend/src/
├── services/
│   ├── cartService.ts          # Sepet yönetimi
│   └── intentService.ts        # Intent recognition
├── routes/
│   └── cart.ts                 # Cart API endpoints
└── Updated:
    ├── aiService.ts            # Cart & checkout entegrasyonu
    └── server.ts               # Cart routes eklendi
```

### Shared Types
```
shared/types/
└── index.ts                    # Cart, Order, Intent, Checkout types
```

### Frontend
```
frontend/src/
└── chat.html                   # Cart UI ve JS entegrasyonu
```

## 🔌 API Endpoints

### Cart Management
```
GET    /api/cart/:sessionId                 # Get cart
POST   /api/cart/:sessionId/add             # Add to cart
DELETE /api/cart/:sessionId/remove          # Remove from cart
PUT    /api/cart/:sessionId/update          # Update quantity
DELETE /api/cart/:sessionId/clear           # Clear cart
```

### Checkout Flow
```
POST   /api/cart/:sessionId/checkout        # Start checkout
POST   /api/cart/:sessionId/address         # Set address
POST   /api/cart/:sessionId/payment         # Set payment
POST   /api/cart/:sessionId/confirm         # Create order
```

### Order Management
```
GET    /api/cart/:sessionId/orders          # Get all orders
GET    /api/cart/order/:orderId             # Get specific order
```

## 🎯 Kullanım Örnekleri

### Örnek 1: Ürün Arama ve Sepete Ekleme
```
👤: "42 numara erkek koşu ayakkabısı"
🤖: [3 ürün gösterir]
👤: "İlkini sepete ekle"
🤖: "✅ ON Cloud 5 sepetinize eklendi! Toplam: 4.299 TL"
```

### Örnek 2: Sepeti Görüntüleme
```
👤: "Sepetimi göster"
🤖: "Sepetinizde 2 ürün var:
     1. ON Cloud 5 (42) - 1 adet - 4.299 TL
     2. Hoka Clifton 9 (42) - 1 adet - 4.899 TL
     
     Toplam: 9.198 TL"
```

### Örnek 3: Satın Alma (Complete Flow)
```
👤: "Satın almak istiyorum"
🤖: "Harika! Teslimat adresinizi paylaşır mısınız?"
👤: "Ahmet Yılmaz, 05XXXXXXXXX, Bağdat Cad. No:123, Kadıköy/İstanbul, 34000"
🤖: "Adresiniz kaydedildi. Ödeme yöntemi?
     1. 💳 Kredi Kartı
     2. 💵 Kapıda Ödeme"
👤: "Kredi kartı"
🤖: "Sipariş Özeti: 9.198 TL. Onaylıyor musunuz?"
👤: "Evet"
🤖: "🎉 Sipariş oluşturuldu! Sipariş No: ORD1711883456789"
```

### Örnek 4: Sipariş Takibi
```
👤: "Sipariş ORD1711883456789"
🤖: "Sipariş Durumu: ✅ Onaylandı
     Sipariş Tarihi: 28.03.2026
     Toplam: 9.198 TL
     
     Ürünler:
     1. ON Cloud 5 - 1 adet
     2. Hoka Clifton 9 - 1 adet"
```

## 🚀 Başlatma

### 1. Backend Başlat
```bash
cd ShopAI
npm install
npm run dev:backend
```

### 2. Frontend Başlat
```bash
npm run dev:frontend
```

### 3. Test Et
- http://localhost:3001/chat.html adresine git
- Ürün ara: "42 numara koşu ayakkabısı"
- Sepete ekle: "İlkini sepete ekle"
- Cart ikonuna tıkla (header'da sağ üstte)
- Checkout başlat: "Satın almak istiyorum"

## 🎨 UI/UX Özellikleri

### Cart Badge
- Header'da sağ üstte 🛒 ikonu
- Sepetteki ürün sayısını gösteren kırmızı badge
- Tıklandığında cart sidebar açılır

### Cart Sidebar
- Sağdan animasyonlu açılış
- Ürün görselleri ve detaylar
- Miktar artır/azalt butonları
- Ürün kaldırma
- Toplam fiyat gösterimi
- "Satın Al" butonu

### Responsive Design
- Desktop: 400px genişlikte sidebar
- Mobile: Tam ekran cart

## 🔄 Veri Akışı

```
User Message
    ↓
Intent Recognition (intentService)
    ↓
Intent Handler (aiService)
    ↓
Cart/Checkout Operation (cartService)
    ↓
AI Response + Cart Update
    ↓
Frontend Cart UI Update
```

## 🛠️ Geliştirme Notları

### Session Management
- Her kullanıcı conversation history'den unique session ID alır
- Session ID ile cart ve checkout state ilişkilendirilir
- In-memory storage (production'da Redis/DB önerilir)

### Intent Detection
- Pattern matching ile Türkçe intent algılama
- Context-aware detection (conversation history)
- Fallback: PRODUCT_SEARCH

### Cart Logic
- Product ID + Size + Color kombinasyonu ile unique items
- Automatic quantity aggregation
- Price parsing (TL, virgül, nokta desteği)

### Checkout Flow State Machine
```
CART_REVIEW → ADDRESS_COLLECTION → PAYMENT_SELECTION → ORDER_CONFIRMATION → COMPLETED
```

## 📊 Teknoloji Stack

### Backend
- TypeScript
- Express.js
- OpenAI GPT-4
- In-memory cart storage

### Frontend
- Vanilla JavaScript
- Modern CSS (Flexbox, Grid)
- Cart animations
- Real-time updates

## 🔮 Gelecek İyileştirmeler

### 1. **Persistent Storage**
- [ ] Redis ile session storage
- [ ] MongoDB/PostgreSQL ile order storage
- [ ] User authentication

### 2. **Payment Gateway Entegrasyonu**
- [ ] İyzico entegrasyonu
- [ ] Kredi kartı form
- [ ] 3D Secure

### 3. **High5.com.tr API Entegrasyonu**
- [ ] Gerçek ürün stok kontrolü
- [ ] Sipariş iletimi
- [ ] Kargo takip entegrasyonu

### 4. **Enhanced NLP**
- [ ] Gelişmiş adres parsing
- [ ] Multi-product sepete ekleme ("hepsini ekle")
- [ ] Voice input desteği

### 5. **Analytics**
- [ ] Conversion tracking
- [ ] Cart abandonment analysis
- [ ] Popular products tracking

## 🎓 Gap-Gemini Modeli ile Karşılaştırma

### Benzerlikler ✅
- ✅ Sohbet içinde ürün keşfi
- ✅ Doğal dille sepete ekleme
- ✅ In-chat checkout akışı
- ✅ Adres/ödeme toplama
- ✅ Sipariş onayı
- ✅ Sipariş takibi

### Farklılıklar 🔄
- 🔄 Google Gemini yerine OpenAI GPT-4
- 🔄 Visual cart sidebar (Gap'te yok)
- 🔄 Turkish language focus
- 🔄 High5-specific product data (ON, Hoka, Asics, Saucony, etc.)

### Avantajlarımız 🚀
- 🚀 Visual cart feedback
- 🚀 Better product display
- 🚀 Real-time cart updates
- 🚀 Custom intent recognition

## 📝 Lisans

MIT License

---

**Hazırlayan**: ShopAsistAI Team  
**Tarih**: 28 Mart 2026  
**Versiyon**: 3.0.0-gap-gemini
