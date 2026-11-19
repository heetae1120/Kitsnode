import {readSavedDiagnoses,type DiagnosisDocument} from './diagnosis-document';
/** Keep the three expanded analyses small in the existing private account metadata. */
export async function encodeDiagnoses(reports:DiagnosisDocument[]){
 const compact=readSavedDiagnoses(reports).map(report=>{const snapshot=report.analysis?.ads?.snapshot;if(!snapshot)return report;return {...report,analysis:{...report.analysis,ads:{...report.analysis!.ads!,snapshot:{...snapshot,items:snapshot.items.map(({url,capture,...item})=>({...item,image:null}))}}}};});
 const json=JSON.stringify(compact);
 if(new TextEncoder().encode(json).length>64000)throw Error('진단서 자료가 너무 큽니다.');
 const bytes=new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 return 'gz1:'+btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
}
export async function decodeDiagnoses(raw:unknown):Promise<DiagnosisDocument[]>{
 if(typeof raw!=='string')return readSavedDiagnoses(raw);
 if(!raw.startsWith('gz1:')||raw.length>24000)return [];
 try{const bytes=Uint8Array.from(atob(raw.slice(4)),c=>c.charCodeAt(0));const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>64000)throw Error();chunks.push(value);}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
  const text=new TextDecoder().decode(new Uint8Array(await new Blob(chunks as BlobPart[]).arrayBuffer()));return readSavedDiagnoses(JSON.parse(text));
 }catch{return [];}
}
