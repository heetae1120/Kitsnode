import {RetiredTool} from '@/components/retired-tool';
import {AdvertiserAnalysis} from '@/components/store/advertiser-analysis';
export const metadata={title:'광고 데이터 분석 | KITSNODE',robots:{index:false,follow:false}};
export default function AdAnalysisPage(){return process.env.NEXT_PUBLIC_AD_ANALYSIS_PAGE_ENABLED==='true'?<AdvertiserAnalysis/>:<RetiredTool/>;}
