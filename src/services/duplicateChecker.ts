import { normalizeIngredient } from '../constants/ingredientAliases';
import { AnalysisResult, DuplicateOverlap, SupplementProduct } from '../types';

function buildSuggestion(productNames: string[]): string {
  if (productNames.length < 2) {
    return '';
  }

  const keep = productNames[0];
  const skip = productNames.slice(1).join(', ');
  return `${keep}에 이미 포함되어 있을 수 있어요. ${skip}는 생략해도 될 수 있습니다. (약사·의사 상담 권장)`;
}

export function findOverlaps(products: SupplementProduct[]): DuplicateOverlap[] {
  const ingredientMap = new Map<string, { displayName: string; products: Set<string> }>();

  for (const product of products) {
    for (const ingredient of product.ingredients) {
      const normalized = normalizeIngredient(ingredient.name);
      if (!normalized) {
        continue;
      }

      const existing = ingredientMap.get(normalized);
      if (existing) {
        existing.products.add(product.name);
      } else {
        ingredientMap.set(normalized, {
          displayName: ingredient.name,
          products: new Set([product.name]),
        });
      }
    }
  }

  const overlaps: DuplicateOverlap[] = [];

  for (const [normalizedName, { displayName, products: productSet }] of ingredientMap) {
    const productNames = [...productSet];
    if (productNames.length < 2) {
      continue;
    }

    overlaps.push({
      normalizedName,
      displayName,
      products: productNames,
      suggestion: buildSuggestion(productNames),
    });
  }

  return overlaps.sort((a, b) => b.products.length - a.products.length);
}

export function buildAnalysisResult(products: SupplementProduct[], warnings: string[] = []): AnalysisResult {
  const visibleProducts = products.filter((p) => p.labelVisible !== false);
  const hiddenLabelProducts = products.filter((p) => p.labelVisible === false);

  const extraWarnings = [...warnings];
  for (const product of hiddenLabelProducts) {
    extraWarnings.push(`"${product.name}"의 성분표가 잘 보이지 않아요. 라벨이 보이게 다시 촬영해 주세요.`);
  }

  return {
    products,
    overlaps: findOverlaps(visibleProducts.length > 0 ? visibleProducts : products),
    warnings: extraWarnings,
  };
}
