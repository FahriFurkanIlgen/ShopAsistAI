// Search Engine Type Definitions

import { Product } from '../../../shared/types';

export interface SearchableProduct extends Product {
  searchableText: string; // Combined text for BM25
  normalizedBrand: string;
  normalizedColor: string;
  normalizedCategory: string;
  normalizedSize: string;
}

export interface ExtractedAttributes {
  brand?: string;
  color?: string;
  category?: string[];
  size?: string;
  priceRange?: { min?: number; max?: number };
  keywords: string[];
  isChildQuery?: boolean; // Sorgu çocuk ürünü için mi?
  gender?: 'erkek' | 'kadin' | 'kiz' | 'unisex'; // Cinsiyet/hedef kitle
  specialFeatures?: string[]; // İşıklı, su geçirmez, vs
}

export interface ScoredProduct {
  product: Product;
  scores: {
    bm25: number;
    brand: number;
    color: number;
    category: number;
    size: number;
    gender: number;
    specialFeatures: number;
    merchandising?: number;
    final: number;
  };
}

export interface InvertedIndexEntry {
  term: string;
  documentFrequency: number; // Number of documents containing this term
  postings: Map<string, TermFrequency>; // productId -> term frequency
}

export interface TermFrequency {
  frequency: number; // How many times term appears in document
  positions?: number[]; // Optional: term positions for phrase queries
}

export interface BM25Parameters {
  k1: number; // Term frequency saturation parameter (1.2 - 2.0)
  b: number; // Length normalization parameter (0.75)
}
