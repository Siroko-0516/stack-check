export type Ingredient = {
  name: string;
  amount?: string;
};

export type SupplementProduct = {
  id: string;
  name: string;
  brand?: string;
  ingredients: Ingredient[];
  labelVisible: boolean;
  notes?: string;
};

export type DuplicateOverlap = {
  normalizedName: string;
  displayName: string;
  products: string[];
  suggestion: string;
};

export type AnalysisResult = {
  products: SupplementProduct[];
  overlaps: DuplicateOverlap[];
  warnings: string[];
};
