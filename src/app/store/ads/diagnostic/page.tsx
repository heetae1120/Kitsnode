import {RetiredTool} from '@/components/retired-tool';
import {AdReadDiagnosticPanel} from '@/components/store/ad-read-diagnostic-panel';
import {AdPerformancePanel} from '@/components/store/ad-performance-panel';
import {StoreCard} from '@/components/store/store-ui';
export const metadata={title:'KITSNODE',robots:{index:false,follow:false}};
export default function AdReadDiagnosticPage(){return process.env.NEXT_PUBLIC_AD_DIAGNOSTIC_PAGE_ENABLED==='true'?<><AdReadDiagnosticPanel/><StoreCard><h2>회원 성과 조회 시험</h2><p>로그인한 회원 본인에게 승인된 광고계정만 표시됩니다. 캠페인·광고그룹·대상을 선택하고 조회 기간을 입력하세요. 계정 전체 성과가 아닌 선택한 상품 또는 키워드의 통계입니다.</p></StoreCard><AdPerformancePanel/></>:<RetiredTool/>;}
