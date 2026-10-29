export type Competitor = {
  rank: number;
  name: string;
  url: string;
  price: string;
  shipping: string;
  source: string;
  checkedAt: string;
  context: string;
  strengths: string;
  weaknesses: string;
};

export type ManualReview = {
  id: string;
  target: string;
  text: string;
  source: string;
  checkedAt: string;
  strength: string;
  weakness: string;
};

export function safeProductUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function manualAmount(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount <= 1e9 ? amount : null;
}

export function validateCompetitor(row: Competitor): string | null {
  if (!row.name.trim()) return "경쟁사 상품명을 입력하세요.";
  if (!safeProductUrl(row.url))
    return "상품 링크는 http 또는 https 주소로 입력하세요.";
  if (manualAmount(row.price) === null || manualAmount(row.shipping) === null)
    return "판매가와 배송비는 0~10억 원의 정수로 입력하세요. 무료 배송은 0원입니다.";
  if (
    !row.source.trim() ||
    !row.context.trim() ||
    !row.checkedAt ||
    !Number.isFinite(Date.parse(row.checkedAt))
  )
    return "출처, 확인 시점, 검색어·매체·기기 등 확인 조건을 모두 입력하세요.";
  return null;
}

export function competitorTotal(row: Competitor): number | null {
  const price = manualAmount(row.price),
    shipping = manualAmount(row.shipping);
  return price === null || shipping === null ? null : price + shipping;
}

export function summarizeReviews(reviews: ManualReview[], target: string) {
  const rows = reviews.filter((review) => review.target === target);
  return {
    total: rows.length,
    strengths: rows.filter((row) => row.strength.trim()),
    weaknesses: rows.filter((row) => row.weakness.trim()),
    unclassified: rows.filter(
      (row) => !row.strength.trim() && !row.weakness.trim(),
    ).length,
  };
}
