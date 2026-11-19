export type DiagnosisDocument={version:1;id:string;createdAt:string;name:string;months:number;quantity:number;sales:number;costs:number;profit:number;margin:number;marketing:number;breakEven:number|null;priority:string;action:string;examples:boolean};
export function readSavedDiagnoses(raw:unknown):DiagnosisDocument[]{
 if(!Array.isArray(raw))return [];
 return raw.filter((r):r is DiagnosisDocument=>!!r&&r.version===1&&typeof r.id==='string'&&typeof r.createdAt==='string'&&typeof r.name==='string'&&typeof r.priority==='string'&&typeof r.action==='string'&&['months','quantity','sales','costs','profit','margin','marketing'].every(k=>Number.isFinite(r[k]))&&(r.breakEven===null||Number.isFinite(r.breakEven))).slice(0,3);
}
/** One A4 page; Korean glyphs are rendered with the site's loaded font. */
export async function diagnosisPdf(report:DiagnosisDocument):Promise<Blob>{
 await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
 const c=canvas.getContext('2d');if(!c)throw Error('PDF를 만들 수 없습니다.');
 const white='#f5f2eb',muted='#bdbab3',orange='#ff5a1f';c.fillStyle='#0b0b0b';c.fillRect(0,0,1240,1754);
 const font=getComputedStyle(document.body).fontFamily;
 const text=(value:string,x:number,y:number,size=26,color=white,weight=500)=>{c.font=`${weight} ${size}px ${font}`;c.fillStyle=color;c.fillText(value,x,y);};
 const wrap=(value:string,y:number,size=27,color=white)=>{let line='';for(const ch of value){c.font=`500 ${size}px ${font}`;if(c.measureText(line+ch).width>1040){text(line,90,y,size,color);y+=size*1.6;line='';}line+=ch;}text(line,90,y,size,color);return y+size*1.6;};
 const money=(v:number)=>`${Math.round(v).toLocaleString('ko-KR')}원`;
 const rule=(y:number)=>{c.strokeStyle='#353535';c.beginPath();c.moveTo(90,y);c.lineTo(1150,y);c.stroke();};
 text('KITSNODE',90,110,36,white,900);text('BUSINESS DIAGNOSIS / 01',780,110,20,muted);
 text('판매·수익 진단서',90,235,66,white,900);
 wrap(report.name,300,32);text(new Date(report.createdAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}),90,395,22,muted);rule(435);
 text('01  판매 계획',90,495,22,orange,700);text(`${report.quantity.toLocaleString('ko-KR')}개 · ${report.months>0?report.months+'개월':'기간 미설정'} · 전량 판매 가정`,90,555,32);
 const metrics=[['총 판매금액',money(report.sales)],['판매 비용 합계',money(report.costs)],['광고 전 예상 이익',money(report.profit)],['개당 이익',money(report.margin)],['계산상 광고비 상한',money(report.marketing)],['본전 판매량',report.breakEven===null?'계산 불가':report.breakEven.toLocaleString('ko-KR')+'개']];
 metrics.forEach(([label,value],i)=>{const x=i%2?650:90,y=650+Math.floor(i/2)*145;text(label,x,y,23,muted);text(value,x,y+58,44,i===2||i===4?orange:white,800);});rule(1070);
 text('02  우선 실행할 일',90,1130,22,orange,700);const end=wrap(report.priority,1195,38);wrap(report.action,end+20,27,muted);rule(1430);
 wrap('입력한 조건에 따른 계산이며 매출·수익을 보장하지 않습니다. 광고비와 미입력 비용을 반영하면 실제 이익은 달라집니다.',1490,22,muted);
 if(report.examples)wrap('참고값이 포함되어 있습니다. 실제 비용으로 다시 확인하세요.',1600,22,orange);
 text('kitsnode · 브랜드의 다음을 함께 만듭니다.',90,1680,21,muted);
 const jpeg=Uint8Array.from(atob(canvas.toDataURL('image/jpeg',.94).split(',')[1]),ch=>ch.charCodeAt(0));
 const enc=new TextEncoder(),parts:Uint8Array[]=[];let length=0;const offsets=[0];const add=(v:string|Uint8Array)=>{const bytes=typeof v==='string'?enc.encode(v):v;parts.push(bytes);length+=bytes.length;};
 add('%PDF-1.4\n');const obj=(id:number,body:string)=>{offsets[id]=length;add(`${id} 0 obj\n${body}\nendobj\n`);};
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
 offsets[4]=length;add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);add(jpeg);add('\nendstream\nendobj\n');const commands='q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';obj(5,`<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`);const xref=length;add('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)add(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
 const bytes=new Uint8Array(length);let position=0;for(const part of parts){bytes.set(part,position);position+=part.length;}return new Blob([bytes],{type:'application/pdf'});
}
export async function downloadDiagnosis(report:DiagnosisDocument){const url=URL.createObjectURL(await diagnosisPdf(report));const a=document.createElement('a');a.href=url;a.download=`KITSNODE_진단서_${report.name.replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,40)}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
