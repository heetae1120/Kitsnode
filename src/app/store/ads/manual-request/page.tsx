import {ManualAdConnection} from '@/components/store/manual-ad-connection';
import '@/components/store/advertiser-analysis.css';

export const metadata={title:'광고계정 연결 확인 요청 | KITSNODE',robots:{index:false,follow:false}};

export default function ManualRequestPage() {
  return <ManualAdConnection/>;
}
