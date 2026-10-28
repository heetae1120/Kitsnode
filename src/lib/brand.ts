export type SpectrumId = "heritage" | "present" | "next";
export const spectrum = [
  {
    id: "heritage",
    number: "01",
    era: "REINTERPRET THE PAST",
    title: "Heritage",
    korean: "시간이 남긴 가치를,\n오늘의 쓸모로.",
    description:
      "시간이 증명한 미학과 공간의 상징을 읽습니다. 전통의 선과 형태, 고유한 이야기를 오늘의 일상에 어울리는 오브제로 번역합니다.",
    tags: ["유산의 재해석", "공간의 상징", "시그니처 오브제"],
  },
  {
    id: "present",
    number: "02",
    era: "REFINE THE EVERYDAY",
    title: "Present",
    korean: "지금의 일상에,\n가장 필요한 감각.",
    description:
      "동시대의 라이프스타일과 그 안의 작은 불편을 발견합니다. 분명한 쓰임과 정제된 디자인으로, 매일 자연스럽게 손이 가는 도구를 만듭니다.",
    tags: ["모바일 라이프", "라이프스타일", "일상의 도구"],
  },
  {
    id: "next",
    number: "03",
    era: "SHAPE WHAT’S NEXT",
    title: "Next",
    korean: "내일의 가능성을,\n손에 잡히는 형태로.",
    description:
      "새로운 소재와 물성, 미니멀한 조형 언어를 실험합니다. 한발 앞선 감각으로 다음의 라이프스타일과 브랜드의 비전을 실물로 완성합니다.",
    tags: ["소재와 물성", "새로운 경험", "미래의 스탠다드"],
  },
] as const;
export const studies: {
  id: string;
  category: SpectrumId;
  title: string;
  subtitle: string;
  material: string;
  detail: string;
}[] = [
  {
    id: "01",
    category: "heritage",
    title: "Form of memory",
    subtitle: "시간의 형태를 다시 읽다",
    material: "ARCHITECTURAL FORM / OBJECT",
    detail:
      "전통적인 공간이 가진 아치와 비례에서 출발한 오브제 스터디. 익숙한 유산의 구조를 정제된 곡면과 조용한 질감으로 재해석합니다.",
  },
  {
    id: "02",
    category: "present",
    title: "Pocket rituals",
    subtitle: "일상의 작은 루틴을 위한 도구",
    material: "MOBILE LIFE / EVERYDAY KIT",
    detail:
      "손에 쥐고, 올려두고, 다시 가져가는 매일의 동작을 관찰합니다. 모바일 라이프의 작은 루틴을 간결한 형태와 편안한 컬러로 제안합니다.",
  },
  {
    id: "03",
    category: "next",
    title: "Matter of tomorrow",
    subtitle: "아직 오지 않은 감각의 실험",
    material: "MATERIAL EXPLORATION / CONCEPT",
    detail:
      "금속의 반사와 유기적인 컬러의 대비를 통해 새로운 물성을 탐구합니다. 다음 세대의 일상 도구가 가질 수 있는 감각을 상상하는 스터디입니다.",
  },
];
export const projectTypes = [
  "브랜드 시그니처 제품",
  "OEM / ODM 제품 기획",
  "브랜디드 굿즈",
  "컬렉션 / 크리에이티브 협업",
  "기타 프로젝트",
] as const;
export type ProjectBrief = {
  name: string;
  email: string;
  company: string;
  type: string;
  description: string;
};
export function validateBrief(brief: ProjectBrief): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!brief.name.trim() || brief.name.trim().length > 60)
    errors.name = "이름을 1~60자로 입력해 주세요.";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brief.email.trim()) ||
    brief.email.length > 254
  )
    errors.email = "연락받을 수 있는 이메일을 입력해 주세요.";
  if (brief.company.length > 100)
    errors.company = "브랜드 또는 회사명을 100자 이내로 입력해 주세요.";
  if (!projectTypes.includes(brief.type as (typeof projectTypes)[number]))
    errors.type = "프로젝트 유형을 선택해 주세요.";
  if (brief.description.trim().length < 10 || brief.description.length > 2000)
    errors.description = "프로젝트 이야기를 10~2,000자로 적어 주세요.";
  return errors;
}
export function formatBrief(brief: ProjectBrief): string {
  if (Object.keys(validateBrief(brief)).length)
    throw new Error("프로젝트 정보를 확인해 주세요.");
  return `[KITS] 프로젝트 제안\n\n담당자: ${brief.name.trim()}\n이메일: ${brief.email.trim()}\n브랜드 / 회사: ${brief.company.trim() || "미기재"}\n프로젝트 유형: ${brief.type}\n\n프로젝트 이야기\n${brief.description.trim()}`;
}
