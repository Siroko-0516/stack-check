import { SupplementProduct } from '../types';

const VISION_PROMPT = `You analyze photos of multiple supplement or vitamin bottles arranged together.

Identify the photo:
1. Detect every separate supplement bottle/package you can see.
2. For each product read the label and extract product name, brand (if visible), and active ingredients with amounts when visible.
3. If the ingredient label is not visible, set labelVisible to false and ingredients to [].

Return ONLY valid JSON in this exact shape:
{
  "products": [
    {
      "name": "string",
      "brand": "string or null",
      "labelVisible": true,
      "ingredients": [
        { "name": "string", "amount": "string or null" }
      ],
      "notes": "string or null"
    }
  ],
  "warnings": ["string"]
}

Use Korean for product names when the label is Korean. Keep ingredient names as written on the label.`;

type VisionResponse = {
  products: Array<{
    name: string;
    brand?: string | null;
    labelVisible?: boolean;
    ingredients?: Array<{ name: string; amount?: string | null }>;
    notes?: string | null;
  }>;
  warnings?: string[];
};

function createProductId(index: number): string {
  return `product-${Date.now()}-${index}`;
}

export async function analyzeSupplementPhoto(base64Image: string, apiKey: string): Promise<{
  products: SupplementProduct[];
  warnings: string[];
}> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: VISION_PROMPT },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API 오류 (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('AI가 응답을 반환하지 않았어요. 사진을 다시 찍어 주세요.');
  }

  let parsed: VisionResponse;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('AI 응답을 해석하지 못했어요. 다시 시도해 주세요.');
  }

  const products: SupplementProduct[] = (parsed.products ?? []).map((product, index) => ({
    id: createProductId(index),
    name: product.name?.trim() || `제품 ${index + 1}`,
    brand: product.brand?.trim() || undefined,
    labelVisible: product.labelVisible !== false,
    ingredients: (product.ingredients ?? [])
      .filter((item) => item.name?.trim())
      .map((item) => ({
        name: item.name.trim(),
        amount: item.amount?.trim() || undefined,
      })),
    notes: product.notes?.trim() || undefined,
  }));

  return {
    products,
    warnings: parsed.warnings ?? [],
  };
}
