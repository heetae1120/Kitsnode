import type {ReportEvidence} from './diagnosis-analysis';
export type DiagnosisDocument={version:1;price?:number;productCost?:number;analysis?:ReportEvidence;id:string;createdAt:string;name:string;months:number;quantity:number;sales:number;costs:number;profit:number;margin:number;marketing:number;breakEven:number|null;priority:string;action:string;examples:boolean};
export function readSavedDiagnoses(raw:unknown):DiagnosisDocument[]{
 if(!Array.isArray(raw))return [];
 return raw.filter((r):r is DiagnosisDocument=>!!r&&r.version===1&&typeof r.id==='string'&&typeof r.createdAt==='string'&&typeof r.name==='string'&&typeof r.priority==='string'&&typeof r.action==='string'&&['months','quantity','sales','costs','profit','margin','marketing'].every(k=>Number.isFinite(r[k]))&&(r.breakEven===null||Number.isFinite(r.breakEven))).slice(0,3);
}
/** Compose real PDF text using the same brand family, with a fixed PDF font. */
export async function diagnosisPdf(report:DiagnosisDocument,fontBytes?:Uint8Array):Promise<Blob>{
 if(!fontBytes){const response=await fetch((process.env.NEXT_PUBLIC_BASE_PATH||'')+'/fonts/Pretendard-Regular.ttf.gz',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('진단서 글꼴을 불러오지 못했어요.');const data=new Uint8Array(await response.arrayBuffer());fontBytes=data[0]===31&&data[1]===139?new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()):data;}
 const {createDiagnosisPdf}=await import('./diagnosis-pdf');return createDiagnosisPdf(report,fontBytes);
}
export async function downloadDiagnosis(report:DiagnosisDocument){const url=URL.createObjectURL(await diagnosisPdf(report));const a=document.createElement('a');a.href=url;a.download=`KITSNODE_진단서_${report.name.replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,40)}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
