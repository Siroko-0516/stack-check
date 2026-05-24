import { SupplementProduct } from '../types';

const GEMINI_MODEL = 'gemini-2.0-flash-lite'

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

/**
 * base64 문자열 정규화
 * - Web에서 expo-image-picker가 "data:image/jpeg;base64,XXXX" 형태로 반환하는 경우 처리
 * - prefix를 제거하고 순수 base64 데이터와 MIME 타입을 분리
 */
function extractBase64(raw: string): { data: string; mimeType: string } {
  if (raw.startsWith('data:')) {
    const commaIdx = raw.indexOf(',');
    if (commaIdx !== -1) {
      const header = raw.slice(0, commaIdx); // "data:image/jpeg;base64"
      const data = raw.slice(commaIdx + 1);
      const mimeMatch = header.match(/data:([^;]+)/);
      const mimeType = mimeMatch?.[1] ?? 'image/jpeg';
      return { data, mimeType };
    }
  }
  return { data: raw, mimeType: 'image/jpeg' };
}

export async function analyzeSupplementPhoto(
  base64Image: string,
  apiKey: string,
): Promise<{ products: SupplementProduct[]; warnings: string[] }> {
  const { data, mimeType } = extractBase64(base64Image);

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
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
                    mime_type: mimeType,
                    data,
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
  } catch {
    throw new Error('네트워크 연결을 확인해 주세요. 인터넷이 연결되어 있나요?');
  }

  if (!response.ok) {
    // HTTP 상태 코드별 명확한 오류 메시지
    if (response.status === 400) {
      throw new Error('사진 형식이 올바르지 않아요. 다른 사진으로 다시 시도해 주세요.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('API 키가 올바르지 않아요. 설정에서 키를 다시 확인해 주세요.');
    }
    if (response.status === 429) {
      throw new Error('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
    }
    if (response.status >= 500) {
      throw new Error('Gemini 서버에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요.');
    }
    throw new Error(`분석 오류 (${response.status}). 잠시 후 다시 시도해 주세요.`);
  }

  const payload = await response.json();
  const text: string | undefined = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const finishReason: string | undefined = payload?.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
      throw new Error('이미지가 안전 필터에 걸렸어요. 다른 사진으로 시도해 주세요.');
    }
    throw new Error('AI가 응답을 반환하지 않았어요. 사진을 다시 찍어 주세요.');
  }

  // 혹시라도 마크다운 코드 블록으로 감싸진 경우 제거 (방어 처리)
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed: VisionResponse;
  try {
    parsed = JSON.parse(cleaned);
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