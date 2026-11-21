import {RetiredTool} from '@/components/retired-tool';
import {AdReadDiagnosticPanel} from '@/components/store/ad-read-diagnostic-panel';
export const metadata={title:'KITSNODE',robots:{index:false,follow:false}};
export default function AdReadDiagnosticPage(){return process.env.NEXT_PUBLIC_AD_DIAGNOSTIC_PAGE_ENABLED==='true'?<AdReadDiagnosticPanel/>:<RetiredTool/>;}
