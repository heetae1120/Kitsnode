import {RetiredTool} from '@/components/retired-tool';
import {StoreConnection} from '@/components/store/store-pages';
export const metadata={title:'KITSNODE',robots:{index:false,follow:false}};
// Keep the retired page as the default; this flag only exposes the candidate page.
export default function AdConnectionPage(){
  return process.env.NEXT_PUBLIC_AD_CONNECTION_PAGE_ENABLED === 'true' ? <StoreConnection /> : <RetiredTool />;
}
