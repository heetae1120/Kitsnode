import {RetiredTool} from '@/components/retired-tool';
import {AdReviewPanel} from '@/components/store/ad-review-panel';
export const metadata={title:'KITSNODE',robots:{index:false,follow:false}};
// Keep the previous retired page unless the independent review-page flag is set.
export default function AdReviewPage(){
  return process.env.NEXT_PUBLIC_AD_REVIEW_PAGE_ENABLED === 'true' ? <AdReviewPanel /> : <RetiredTool />;
}
