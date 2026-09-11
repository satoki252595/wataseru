const WAGE_LINE =
  /(?:時給|日給|月給|年収|賃金|給与)\s*[:：]?\s*[0-9０-９,，万億]+(?:円)?/g;
const MEDICAL =
  /(?:病歴|既往|診断名|服薬|障害年金|精神疾患|持病)\s*[:：]?\s*[^\n]{0,40}/g;
const REAL_NAME_HINT =
  /(?:氏名|本名|マイナンバー|個人番号)\s*[:：]\s*[^\n]{1,30}/g;

/** 成果物に残してはいけない個人の実名指定・病歴・賃金個別額を落とす。 */
export function scrubText(text: string): string {
  if (!text) return text;
  return text
    .replace(WAGE_LINE, "賃金個別額は記載しない（専門家確認）")
    .replace(MEDICAL, "病歴は記載しない")
    .replace(REAL_NAME_HINT, "個人の実名は記載しない");
}

export function scrubWorkDeep<T>(value: T): T {
  if (typeof value === "string") return scrubText(value) as T;
  if (Array.isArray(value)) return value.map((v) => scrubWorkDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubWorkDeep(v);
    }
    return out as T;
  }
  return value;
}

const TAX_LABOR_SAFETY = /税務|労務|安全|労災|源泉|許認可|法令/;

export function ensureExpertNote(text: string): string {
  if (!TAX_LABOR_SAFETY.test(text)) return text;
  if (text.includes("専門家確認")) return text;
  return `${text}\n\n（税務・労務・安全は断定しない。必要な箇所は専門家確認。）`;
}
