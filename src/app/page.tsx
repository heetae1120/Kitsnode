import type {Metadata} from 'next';
import {AgencyHome} from '@/components/agency/agency-home';

export const metadata:Metadata={title:'키츠노드 — 브랜드의 다음을 함께',description:'브랜드의 다음을 만드는 독립 크리에이티브 스튜디오. 브랜드 전략, 광고·퍼포먼스 마케팅, 크리에이티브와 디지털 경험을 연결합니다.',openGraph:{title:'키츠노드 — 브랜드의 다음을 함께',description:'브랜드 전략부터 광고와 디자인까지, 성장을 위한 다음 방향을 함께 찾습니다.'}};

// Preserve the original entry URL and campaign attribution; no redirect.
export default function Page() {
  return <AgencyHome />;
}
