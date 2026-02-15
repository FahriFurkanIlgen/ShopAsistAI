// BM25 Scoring Algorithm

import { InvertedIndex } from './InvertedIndex';
import { BM25Parameters } from './types';

export class BM25Scorer {
  private index: InvertedIndex;
  private params: BM25Parameters;

  constructor(index: InvertedIndex, params?: Partial<BM25Parameters>) {
    this.index = index;
    this.params = {
      k1: params?.k1 ?? 1.5, // Term frequency saturation
      b: params?.b ?? 0.75,  // Length normalization
    };
  }

  /**
   * Calculate BM25 score for a query against a document
   * 
   * BM25 Formula:
   * score(D,Q) = Σ IDF(qi) * (f(qi,D) * (k1 + 1)) / (f(qi,D) + k1 * (1 - b + b * |D| / avgdl))
   * 
   * Where:
   * - IDF(qi) = log((N - df(qi) + 0.5) / (df(qi) + 0.5) + 1)
   * - f(qi,D) = term frequency of qi in document D
   * - |D| = length of document D
   * - avgdl = average document length
   * - N = total number of documents
   */
  score(query: string[], documentId: string): number {
    const docLength = this.index.getDocumentLength(documentId);
    const avgDocLength = this.index.getAvgDocumentLength();
    const N = this.index.getDocumentCount();

    if (docLength === 0 || N === 0) {
      return 0;
    }

    let totalScore = 0;

    for (const term of query) {
      const postings = this.index.getPostings(term);
      if (!postings) {
        continue; // Term not in index
      }

      const termFreq = postings.get(documentId);
      if (!termFreq) {
        continue; // Term not in this document
      }

      const f = termFreq.frequency;
      const df = this.index.getDocumentFrequency(term);

      // Calculate IDF
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      // Calculate BM25 score component for this term
      const lengthNorm = 1 - this.params.b + this.params.b * (docLength / avgDocLength);
      const tfComponent = (f * (this.params.k1 + 1)) / (f + this.params.k1 * lengthNorm);
      
      totalScore += idf * tfComponent;
    }

    return totalScore;
  }

  /**
   * Score multiple documents for a query
   */
  scoreDocuments(query: string[], documentIds: string[]): Map<string, number> {
    const scores = new Map<string, number>();

    for (const docId of documentIds) {
      const score = this.score(query, docId);
      if (score > 0) {
        scores.set(docId, score);
      }
    }

    return scores;
  }

  /**
   * Get candidate documents for a query (all docs containing at least one query term)
   */
  getCandidateDocuments(query: string[]): Set<string> {
    const candidates = new Set<string>();

    for (const term of query) {
      const postings = this.index.getPostings(term);
      if (postings) {
        for (const docId of postings.keys()) {
          candidates.add(docId);
        }
      }
    }

    return candidates;
  }

  /**
   * Tokenize and normalize query text
   * Filters out stopwords that don't contribute to product matching
   */
  tokenizeQuery(text: string): string[] {
    // Context words that don't describe product features
    const stopwords = new Set([
      'bebek', 'cocuk', 'cocuklara', 'cocuguma', 'cocugum',
      'icin', 'olsun', 've', 'ile', 'bir', 'bu', 'su', 'o',
      'mi', 'mu', 'misin', 'musun', 'misiniz',
      'bana', 'bize', 'oneri', 'onerir', 'onerebilir',
      'bak', 'bakabilir', 'goster', 'gosterir',
      'var', 'varmi', 'yok', 'yokmu',
      'ister', 'istiyorum', 'istiyoruz',
      'lazim', 'gerek', 'gerekir',
      'yardimci', 'yardim', 'yardimci',
      'diye', 'gibi', 'kadar',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\sğüşıöç]/g, ' ')
      .split(/\s+/)
      .map(t => this.normalizeTerm(t))
      .filter(t => t.length > 1 && !stopwords.has(t)); // Filter stopwords
  }

  private normalizeTerm(term: string): string {
    return term
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .trim();
  }
}
