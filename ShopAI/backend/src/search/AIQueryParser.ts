// AI-Powered Query Parser with Fallback to Regex

import OpenAI from 'openai';
import { QueryParser } from './QueryParser';
import { ExtractedAttributes } from './types';

export interface QueryComplexity {
  isComplex: boolean;
  reason?: string;
  confidence: number;
}

export class AIQueryParser {
  private openai: OpenAI | null = null;
  private regexParser: QueryParser;
  private useAI: boolean;

  constructor(useAI: boolean = true) {
    this.useAI = useAI && Boolean(process.env.OPENAI_API_KEY);
    
    if (this.useAI) {
      this.openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });
    }
    
    this.regexParser = new QueryParser();
  }

  /**
   * Main parse method - uses AI or regex based on query complexity
   */
  async parse(query: string): Promise<ExtractedAttributes> {
    const complexity = this.analyzeComplexity(query);

    console.log(`[AIQueryParser] Query: "${query}" | Complex: ${complexity.isComplex} | Confidence: ${complexity.confidence}`);

    // Use regex parser for simple queries
    if (!complexity.isComplex || !this.useAI) {
      console.log('[AIQueryParser] Using regex parser');
      return this.regexParser.parse(query);
    }

    // Use AI for complex queries
    console.log('[AIQueryParser] Using AI parser');
    try {
      const aiResult = await this.parseWithAI(query);
      
      // Validate AI result, fallback to regex if invalid
      if (this.isValidResult(aiResult)) {
        return aiResult;
      } else {
        console.warn('[AIQueryParser] AI result invalid, falling back to regex');
        return this.regexParser.parse(query);
      }
    } catch (error) {
      console.error('[AIQueryParser] AI parsing failed, falling back to regex:', error);
      return this.regexParser.parse(query);
    }
  }

  /**
   * Analyze query complexity to decide between AI and regex
   * 
   * Simple: "beyaz 43 numara sneaker" → Regex
   * Complex: "yaklaşık 2000 lira civarında, günlük kullanım için rahat spor ayakkabı" → AI
   */
  private analyzeComplexity(query: string): QueryComplexity {
    const lowerQuery = query.toLowerCase();
    
    // Indicators of SIMPLE queries (regex can handle)
    const simpleIndicators = [
      /^\s*\w+\s+\d+\s+numara\s*$/i,  // "siyah 43 numara"
      /^\s*\d+\s+numara\s+\w+\s*$/i,  // "43 numara beyaz"
      /^\s*\w+\s+sneaker\s*$/i,        // "beyaz sneaker"
      /^\w+\s+\d+\s+\w+$/i,            // "kırmızı 42 bot"
    ];

    for (const pattern of simpleIndicators) {
      if (pattern.test(query)) {
        return {
          isComplex: false,
          reason: 'Simple pattern match',
          confidence: 0.9,
        };
      }
    }

    // Indicators of COMPLEX queries (AI needed)
    const complexIndicators = [
      { pattern: /yaklaş[ıi]k|civar[ıi]|ortalama|az[ıi]na|azami/i, reason: 'Approximate values' },
      { pattern: /rahat|konforlu|stil|moda|[şs]ık|zarif|sportif/i, reason: 'Subjective attributes' },
      { pattern: /günlük|özel|davet|spor|outdoor|[ıi][çs]|d[ıi][şs]/i, reason: 'Usage context' },
      { pattern: /gibi|benzer|tarz[ıi]|stilde/i, reason: 'Similarity search' },
      { pattern: /en/i, reason: 'Superlatives (en ucuz, en iyi)' },
      { pattern: /\w+\s+(ama|ancak|fakat|veya|ya da|hem|de|da)\s+/i, reason: 'Multiple conditions' },
    ];

    for (const indicator of complexIndicators) {
      if (indicator.pattern.test(lowerQuery)) {
        return {
          isComplex: true,
          reason: indicator.reason,
          confidence: 0.8,
        };
      }
    }

    // Check query length (>10 words = likely complex)
    const wordCount = query.trim().split(/\s+/).length;
    if (wordCount > 10) {
      return {
        isComplex: true,
        reason: 'Long query (>10 words)',
        confidence: 0.7,
      };
    }

    // Default to simple (regex)
    return {
      isComplex: false,
      reason: 'No complexity indicators found',
      confidence: 0.6,
    };
  }

  /**
   * Parse with AI (GPT-3.5-turbo for cost efficiency)
   */
  private async parseWithAI(query: string): Promise<ExtractedAttributes> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const systemPrompt = `Sen bir e-ticaret arama query parser'ısın. Kullanıcının serbest metinden attribute'ları çıkar.

ÇIKARILACAK ATTRIBUTES:
- brand: Marka adı (örn: "skechers", "nike", "adidas")
- color: Renk (örn: "siyah", "beyaz", "mavi")
- category: ÜRÜN KATEGORİSİ listesi - Çok dikkatli ol! (örn: ["terlik", "sandal"], ["sneaker", "spor ayakkabı"], ["canta"])
- size: Beden/numara (örn: "43", "42.5", "L")
- priceRange: Fiyat aralığı {min, max} (örn: {min: 1000, max: 2000})
- keywords: Diğer anahtar kelimeler (array)
- isChildQuery: Sorgu çocuk ürünü için mi? (boolean) - "cocuk", "kiz cocuk", "erkek cocuk", "bebek", "oglum", "kizim" gibi kelimeler varsa true
- gender: Cinsiyet/hedef kitle ("erkek", "kadin", "kiz", "unisex") - "kiz"/"kizim" varsa "kiz", "erkek"/"oglum" varsa "erkek"
- specialFeatures: Özel özellikler (array) - "isikli", "su gecirmez", "nefes alan" gibi

KATEGORİ KURALLARI (ÇOK ÖNEMLİ):
1. Kategori ÜRÜN TİPİDİR: terlik, sandal, sneaker, bot, ayakkabı, çanta, çorap, şort, mayo
2. "Erkek", "kadın", "çocuk" KATEGORİ DEĞİLDİR - bunları YOKSAY veya keywords'e ekle
3. "Plaj", "havuz", "spor", "günlük" KULLANIM BİLGİSİDİR - ama terlik/sandal/mayo kategorilerini ima edebilir
4. Kullanıcı "terlik", "sandal" diyorsa MUTLAKA category'ye ekle
5. Kullanıcı "çanta" diyorsa MUTLAKA category'ye ["canta"] ekle
6. Kategoriyi daima normalize et (ş→s, ı→i, ü→u, ç→c)

GENEL KURALLAR:
1. Sadece JSON formatında yanıt ver
2. Bulunamayan attribute'lar null olsun
3. Yaklaşık değerleri aralığa çevir (örn: "2000 civarı" → {min: 1800, max: 2200})
4. Subjektif terimleri keyword'e ekle (örn: "rahat" → keywords: ["rahat"])
5. Türkçe karakterleri normalize et (ş→s, ı→i, ü→u, vb.)

ÖRNEKLER:
Query: "plajda giymek için erkek terliği"
Response: {
  "brand": null,
  "color": null,
  "category": ["terlik", "sandal"],
  "size": null,
  "priceRange": null,
  "keywords": ["plaj", "erkek"],
  "isChildQuery": false
}

Query: "38 numara sarı terlik"
Response: {
  "brand": null,
  "color": "sari",
  "category": ["terlik"],
  "size": "38",
  "priceRange": null,
  "keywords": [],
  "isChildQuery": false
}

Query: "spor çanta öner"
Response: {
  "brand": null,
  "color": null,
  "category": ["canta"],
  "size": null,
  "priceRange": null,
  "keywords": ["spor"],
  "isChildQuery": false
}

Query: "yaklaşık 2000 lira civarında rahat siyah spor ayakkabı"
Response: {
  "brand": null,
  "color": "siyah",
  "category": ["spor ayakkabi", "sneaker"],
  "size": null,
  "priceRange": {"min": 1800, "max": 2200},
  "keywords": ["rahat"],
  "isChildQuery": false
}

Query: "kızıma 35 numara beyaz sneaker"
Response: {
  "brand": null,
  "color": "beyaz",
  "category": ["sneaker"],
  "size": "35",
  "priceRange": null,
  "keywords": [],
  "isChildQuery": true,
  "gender": "kiz",
  "specialFeatures": []
}

Query: "28 numara bebek ayakkabısı kız için olsun ve ışıklı olsun"
Response: {
  "brand": null,
  "color": null,
  "category": ["ayakkabi"],
  "size": "28",
  "priceRange": null,
  "keywords": ["bebek"],
  "isChildQuery": true,
  "gender": "kiz",
  "specialFeatures": ["isikli"]
}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Cheap and fast for parsing
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.1, // Low temp for consistent parsing
      max_tokens: 200,  // Small response
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    
    try {
      const parsed = JSON.parse(responseText);
      
      // Convert to ExtractedAttributes format
      return {
        brand: parsed.brand || undefined,
        color: parsed.color || undefined,
        category: parsed.category || [],
        size: parsed.size || undefined,
        priceRange: parsed.priceRange || undefined,
        keywords: parsed.keywords || [],
        isChildQuery: parsed.isChildQuery || false,
        gender: parsed.gender || undefined,
        specialFeatures: parsed.specialFeatures || [],
      };
    } catch (error) {
      console.error('[AIQueryParser] Failed to parse AI response:', error);
      throw new Error('Invalid AI response format');
    }
  }

  /**
   * Validate AI parsing result
   */
  private isValidResult(result: ExtractedAttributes): boolean {
    // Must have at least one attribute
    return Boolean(
      result.brand ||
      result.color ||
      result.category?.length ||
      result.size ||
      result.priceRange ||
      result.keywords?.length
    );
  }

  /**
   * Get parsing statistics
   */
  getStats(): { aiCallsCount: number; regexCallsCount: number } {
    // In production, track these metrics
    return {
      aiCallsCount: 0,
      regexCallsCount: 0,
    };
  }
}
