// Search Engine Module Exports

export { SearchService } from './SearchService';
export { InvertedIndex } from './InvertedIndex';
export { BM25Scorer } from './BM25Scorer';
export { QueryParser } from './QueryParser';
export { AttributeBooster } from './AttributeBooster';
export { ProductIndexer } from './ProductIndexer';
export { MerchandisingEngine } from './MerchandisingEngine';

export type {
  SearchableProduct,
  ExtractedAttributes,
  ScoredProduct,
  InvertedIndexEntry,
  TermFrequency,
  BM25Parameters,
} from './types';

export type {
  MerchandisingConfig,
  ProductSignals,
} from './MerchandisingEngine';
