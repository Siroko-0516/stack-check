/** 같은 성분의 다른 표기를 하나로 묶기 위한 동의어表 */
export const INGREDIENT_ALIASES: Record<string, string[]> = {
  '비타민 d': ['vitamin d', 'vit d', 'vitamin d3', 'd3', '콜레칼시페롤', 'cholecalciferol'],
  '비타민 c': ['vitamin c', 'vit c', 'ascorbic acid', '아스코르빅산', 'l-ascorbic acid'],
  '비타민 b12': ['vitamin b12', 'b12', 'cobalamin', '코발아민', '메틸코발아민', 'methylcobalamin'],
  '비타민 b6': ['vitamin b6', 'b6', 'pyridoxine', '피리독신'],
  '비타민 a': ['vitamin a', 'vit a', 'retinol', '레티놀'],
  '비타민 e': ['vitamin e', 'vit e', 'tocopherol', '토코페롤', 'd-alpha tocopherol'],
  '비타민 k': ['vitamin k', 'vit k', 'phylloquinone', '피토키논'],
  '칼슘': ['calcium', 'ca', '칼슘'],
  '마그네슘': ['magnesium', 'mg', '마그네슘'],
  '아연': ['zinc', 'zn', '아연'],
  '철': ['iron', 'fe', '철분', 'ferrous'],
  '오메가3': ['omega 3', 'omega-3', 'omega3', 'dha', 'epa', 'fish oil', '피쉬오일', '등푸른생선'],
  '프로바이오틱스': ['probiotic', 'probiotics', '유산균', 'lactobacillus'],
  '멜라토닌': ['melatonin'],
  '글루타민': ['glutamine', 'l-glutamine'],
  '크레아틴': ['creatine', 'creatine monohydrate'],
};

export function normalizeIngredient(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9가-힣\s+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return raw.trim().toLowerCase();
  }

  for (const [canonical, aliases] of Object.entries(INGREDIENT_ALIASES)) {
    const allNames = [canonical, ...aliases];
    if (allNames.some((alias) => cleaned.includes(alias) || alias.includes(cleaned))) {
      return canonical;
    }
  }

  return cleaned;
}
