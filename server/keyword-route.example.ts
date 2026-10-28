import { NextRequest, NextResponse } from "next/server";
import { getKeywords } from "@/services/keywords";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("keyword")?.trim();
  if (!name || name.length > 80)
    return NextResponse.json(
      { error: "상품명을 1~80자로 입력해 주세요." },
      { status: 400 },
    );
  return NextResponse.json(await getKeywords(name));
}
