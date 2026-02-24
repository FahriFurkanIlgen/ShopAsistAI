# GraphDB (Neo4j) Entegrasyonu

ShopAsistAI projesi artık Neo4j graf veritabanı desteği ile gelişmiş ürün önerileri sunuyor! 🎉

## 📊 GraphDB Nedir?

GraphDB (Graf Veritabanı), verileri **düğümler (nodes)** ve **ilişkiler (edges/relationships)** olarak saklar. İlişkisel veritabanlarından farklı olarak, veriler arasındaki bağlantılar birinci sınıf vatandaştır ve JOIN işlemlerine gerek kalmadan hızlıca sorgulanabilir.

### Projedeki Kullanım Senaryoları

1. **Ürün İlişkileri**: Benzer ürünler, aynı kategorideki ürünler
2. **Fiyat Benzerliği**: Benzer fiyat aralığındaki ürünler
3. **Marka İlişkileri**: Aynı markanın diğer ürünleri
4. **Multi-hop Öneriler**: 2 adım uzaklıktaki ürünler (arkadaşının arkadaşı mantığı)

## 🚀 Kurulum

### 1. Neo4j Kurulumu

#### Docker ile (Önerilen)

```bash
docker run \
    --name neo4j-shopassist \
    -p 7474:7474 -p 7687:7687 \
    -e NEO4J_AUTH=neo4j/shopassist123 \
    -v neo4j_data:/data \
    -d neo4j:latest
```

#### Manuel Kurulum

1. [Neo4j Desktop](https://neo4j.com/download/) indirin
2. Yeni bir database oluşturun
3. Username: `neo4j`, Password: `shopassist123` kullanın

### 2. Proje Konfigürasyonu

`.env` dosyanızı oluşturun ve şu değişkenleri ekleyin:

```env
# Neo4j GraphDB Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=shopassist123
NEO4J_ENABLED=true
```

### 3. Bağımlılıkları Yükleyin

```bash
npm install
```

## 🔧 Kullanım

### Sunucuyu Başlatma

```bash
npm run dev
```

Sunucu başladığında otomatik olarak:
1. ✅ Neo4j'ye bağlanır
2. ✅ Schema'yı oluşturur (constraints & indexes)
3. ✅ Ürünleri GraphDB'ye import eder
4. ✅ İlişkileri oluşturur (kategori, marka, fiyat benzerliği)

### API Endpoints

#### 1. Ürün Önerileri Al
```http
GET /api/recommendations/:productId?limit=10
```

**Örnek:**
```bash
curl http://localhost:3000/api/recommendations/PROD123?limit=5
```

**Response:**
```json
{
  "success": true,
  "productId": "PROD123",
  "recommendations": [
    {
      "product": { 
        "id": "PROD456",
        "title": "Benzer Ürün",
        "price": 150
      },
      "score": 1.0,
      "reason": "Aynı kategoride"
    }
  ],
  "count": 5,
  "source": "graphdb"
}
```

#### 2. Benzer Ürünler (Multi-hop)
```http
GET /api/recommendations/:productId/similar?limit=10
```

**Örnek:**
```bash
curl http://localhost:3000/api/recommendations/PROD123/similar?limit=5
```

#### 3. Kategoriye Göre Ürünler
```http
GET /api/recommendations/category/:category?limit=20
```

**Örnek:**
```bash
curl http://localhost:3000/api/recommendations/category/Shoes?limit=10
```

#### 4. GraphDB İstatistikleri
```http
GET /api/recommendations/stats
```

**Response:**
```json
{
  "success": true,
  "connected": true,
  "stats": {
    "totalProducts": 150,
    "totalRelationships": 2500,
    "categories": 15,
    "brands": 30
  }
}
```

#### 5. Manuel Senkronizasyon
```http
POST /api/recommendations/sync
```

**Örnek:**
```bash
curl -X POST http://localhost:3000/api/recommendations/sync
```

### SearchService ile Kullanım

SearchService artık GraphDB entegrasyonu içeriyor:

```typescript
import { SearchService } from './search/SearchService';

const searchService = new SearchService();

// Normal arama
const results = await searchService.search('spor ayakkabı', 10);

// GraphDB ile zenginleştirilmiş arama
const enrichedResults = await searchService.hybridGraphSearch('spor ayakkabı', 10);

// Her ürünün graphRecommendations alanı var
enrichedResults.forEach(product => {
  console.log('Ürün:', product.title);
  console.log('Öneriler:', product.graphRecommendations);
});
```

## 🔍 Graf Yapısı

### Düğümler (Nodes)

```
Product {
  id: string
  title: string
  price: number
  category: string
  brand: string
  availability: string
  imageUrl: string
  description: string
  link: string
}
```

### İlişkiler (Relationships)

| İlişki Tipi | Açıklama | Ağırlık |
|------------|----------|---------|
| `IN_CATEGORY` | Aynı kategorideki ürünler | 1.0 |
| `SAME_BRAND` | Aynı markanın ürünleri | 0.8 |
| `SIMILAR_PRICE` | %20 fiyat farkı içindeki ürünler | 0.6 |

### Cypher Sorgu Örnekleri

Neo4j Browser'da (http://localhost:7474) çalıştırabilirsiniz:

```cypher
// Tüm ürünleri göster
MATCH (p:Product) RETURN p LIMIT 25

// Bir ürünle ilişkili tüm ürünleri bul
MATCH (p:Product {id: 'PROD123'})-[r]->(related:Product)
RETURN p, r, related

// En çok ilişkisi olan ürünleri bul
MATCH (p:Product)-[r]->()
RETURN p.title, count(r) as relationshipCount
ORDER BY relationshipCount DESC
LIMIT 10

// Kategori bazlı ürün dağılımı
MATCH (p:Product)
RETURN p.category as category, count(*) as productCount
ORDER BY productCount DESC

// 2 adım uzaklıktaki benzer ürünler
MATCH path = (p1:Product {id: 'PROD123'})-[*2]-(p2:Product)
WHERE p1.id <> p2.id
RETURN p1, p2, length(path) as distance
LIMIT 10
```

## 📈 Performans İpuçları

### 1. Batch Import
Ürünler 100'lük gruplar halinde import edilir (performans optimizasyonu).

### 2. İndeksler
Otomatik olarak şu indeksler oluşturulur:
- `product_id` (unique constraint)
- `product_category`
- `product_brand`
- `product_price`

### 3. Bağlantı Havuzu
```typescript
maxConnectionPoolSize: 50
connectionAcquisitionTimeout: 2 minutes
maxConnectionLifetime: 3 hours
```

## 🛠️ GraphService API

```typescript
import { graphService } from './services/graphService';

// Bağlan
await graphService.connect();

// Ürünleri import et
await graphService.importProducts(products);

// İlişkileri oluştur
await graphService.createCategoryRelationships();
await graphService.createBrandRelationships();
await graphService.createPriceSimilarityRelationships();

// Öneri al
const recommendations = await graphService.getRecommendations('PROD123', 10);

// Benzer ürünler
const similar = await graphService.getSimilarProducts('PROD123', 10);

// İstatistikler
const stats = await graphService.getStatistics();

// Veritabanını temizle (dikkatli kullanın!)
await graphService.clearDatabase();

// Bağlantıyı kes
await graphService.disconnect();
```

## 🐛 Hata Ayıklama

### GraphDB bağlantı hatası

```
❌ Failed to connect to Neo4j: ServiceUnavailable
```

**Çözüm:**
1. Neo4j servisinin çalıştığından emin olun
2. Bağlantı bilgilerini kontrol edin
3. Firewall ayarlarını kontrol edin

### Schema oluşturma hatası

```
❌ Failed to initialize schema
```

**Çözüm:**
1. Neo4j kullanıcısının yeterli izinlere sahip olduğundan emin olun
2. Neo4j versiyonunun 4.0+ olduğunu kontrol edin

## 📊 Monitoring

### Neo4j Browser

http://localhost:7474 adresinden Neo4j Browser'a erişebilirsiniz.

**Kullanışlı komutlar:**
```cypher
// Veritabanı istatistikleri
CALL db.stats.retrieve('GRAPH COUNTS')

// Aktif sorgular
CALL dbms.listQueries()

// İndeks listesi
CALL db.indexes()

// Constraint listesi
CALL db.constraints()
```

## 🎯 Gelecek Geliştirmeler

- [ ] **Kullanıcı İlişkileri**: Kullanıcı görüntüleme/satın alma geçmişi
- [ ] **Collaborative Filtering**: Benzer kullanıcıların beğendikleri
- [ ] **Temporal İlişkiler**: Zaman bazlı trend analizi
- [ ] **A/B Testing**: GraphDB vs Non-GraphDB performans karşılaştırması
- [ ] **Real-time Updates**: Ürün değişikliklerinde otomatik graph güncelleme

## 📚 Kaynaklar

- [Neo4j Documentation](https://neo4j.com/docs/)
- [Cypher Query Language](https://neo4j.com/developer/cypher/)
- [Graph Data Science](https://neo4j.com/product/graph-data-science/)
- [Neo4j Driver for Node.js](https://neo4j.com/developer/javascript/)

## 💡 İpuçları

1. **Geliştirme sırasında**: `NEO4J_ENABLED=false` yaparak GraphDB'yi devre dışı bırakabilirsiniz
2. **Büyük veri setleri için**: Batch size'ı artırın (varsayılan: 100)
3. **Öneri kalitesi**: Daha fazla ilişki tipi ekleyerek öneri kalitesini artırın
4. **Performans**: İlişki ağırlıklarını optimize edin

## 🤝 Katkıda Bulunma

GraphDB özelliklerine katkıda bulunmak için:
1. Yeni ilişki tipleri önerin
2. Öneri algoritmalarını geliştirin
3. Performans optimizasyonları yapın

---

**Geliştirici**: ShopAsistAI Team  
**Tarih**: Şubat 2026  
**Versiyon**: 2.0.0-graphdb
