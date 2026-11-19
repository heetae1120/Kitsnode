import {PDFDocument,rgb,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {diagnosisAnalysis} from './diagnosis-analysis';
import type {DiagnosisDocument} from './diagnosis-document';

/** Compose a selectable-text document from the calculated evidence, never a page image. */
export async function createDiagnosisPdf(r:DiagnosisDocument,fontBytes:Uint8Array){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const font=await doc.embedFont(fontBytes);
 doc.setTitle(`${r.name} · 판매 및 광고 운영 진단서`);doc.setAuthor('KITSNODE');
 const white=rgb(.96,.95,.92),muted=rgb(.74,.73,.7),orange=rgb(1,.353,.122),black=rgb(.043,.043,.043),line=rgb(.21,.21,.21);
 const glyphWidths=new Map<string,number>();
 const width=595.28,height=841.89,margin=44;let page:PDFPage,y=0;
 function newPage(label:string){page=doc.addPage([width,height]);page.drawRectangle({x:0,y:0,width,height,color:black});page.drawText('KITSNODE',{x:margin,y:height-46,size:17,font,color:white});page.drawText(label,{x:margin,y:height-70,size:9,font,color:muted});y=height-108;}
 function text(value:string,size=11,color=white){
  const maxWidth=width-margin*2;let current='',currentWidth=0;
  const output=()=>{if(y<65)newPage('ANALYSIS / CONTINUED');page.drawText(current,{x:margin,y,size,font,color});y-=size*1.65;current='';currentWidth=0;};
  const advance=(ch:string)=>{const key=size+':'+ch;let value=glyphWidths.get(key);if(value===undefined){value=font.widthOfTextAtSize(ch,size);glyphWidths.set(key,value);}return value;};
  for(const token of value.replace(/[\r\t]/g,' ').split(/(\n|[ ]+)/)){
   if(token==='\n'){output();continue;}if(!token)continue;
   const spaces=/^[ ]+$/.test(token),chunk=spaces?' ':token;
   if(spaces&&!current)continue;
   const measure=Array.from(chunk).reduce((sum,ch)=>sum+advance(ch),0);
   if(currentWidth+measure>maxWidth&&current){output();if(spaces)continue;}
   for(const ch of chunk){const w=advance(ch);if(currentWidth+w>maxWidth)output();current+=ch;currentWidth+=w;}
  }
  if(current)output();
 }
 function section(label:string){y-=14;if(y<110)newPage('ANALYSIS / CONTINUED');page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:.6,color:line});y-=25;text(label,12,orange);y-=4;}
 const money=(v:number)=>`${Math.round(v).toLocaleString('ko-KR')}원`,a=diagnosisAnalysis(r);
 newPage('BUSINESS DIAGNOSIS / 01 · 수익과 실행 판단');
 text('판매 및 광고 운영 진단서',25);y-=8;text(r.name.slice(0,120),15);text(new Date(r.createdAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),9,muted);
 section('01 · 종합 판단');text(a.verdict,17,orange);y-=6;
 text(`${r.months>0?r.months+'개월':'기간 미설정'} · ${r.quantity.toLocaleString('ko-KR')}개 전량 판매 가정`,10,muted);
 text(`총 판매금액 ${money(r.sales)} / 판매 비용 ${money(r.costs)}`,12);
 text(`광고 전 이익 ${money(r.profit)} / 고정비 배분 개당 이익 ${money(r.profit/r.quantity)}`,12);
 text(`계산상 광고비 상한 ${money(r.marketing)} · 판매 후 이익 기준`,11,muted);
 section('02 · 판단 근거');a.findings.forEach((v,i)=>{text(`${i+1}. ${v}`,11);y-=7;});
 const k=r.analysis?.keyword;
 if(k){text(`CPC 출처: ${k.source}`,9,muted);text(`검색량: ${k.volume?(k.volume.min===k.volume.max?k.volume.min.toLocaleString('ko-KR'):`${k.volume.min.toLocaleString('ko-KR')}~${k.volume.max.toLocaleString('ko-KR')}`)+'회 / 월 · '+k.device:'미확인'}`,9,muted);}
 section('03 · 우선 실행안');a.actions.forEach((v,i)=>{text(`${i+1}. ${v}`,11);y-=6;});
 newPage('BUSINESS DIAGNOSIS / 02 · 경쟁 상품과 확인 과제');
 text('광고 시장 비교와 다음 행동',24);y-=10;
 a.market.forEach(v=>{text(v,11);y-=6;});
 const ads=r.analysis?.ads,snapshot=ads?.status==='ready'?ads.snapshot:undefined;
 section('04 · 확인된 광고 상품');
 if(snapshot){text(`검색어: ${snapshot.keyword} · PC 통합검색 · 조회 당시 노출 순서`,10,muted);text(`확인 시각: ${new Date(snapshot.observedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`,9,muted);y-=8;
  for(const item of snapshot.items){text(`광고 ${item.rank} · ${item.title.slice(0,160)}`,12);text(`리뷰 ${item.reviewCount||'미공개'} / 별점 ${item.rating??'미공개'}`,10,muted);text(item.dailySales!=null?`일간 판매 ${item.dailySales.toLocaleString('ko-KR')}개`:item.weeklySales!=null?`주간 판매 ${item.weeklySales.toLocaleString('ko-KR')}개`:'일간·주간 판매량 미공개',10,muted);y-=14;}
 }else{text(ads?.status==='loading'?'광고 상품 조회가 완료되지 않은 상태의 진단서입니다. 조회 완료 후 다시 다운로드하세요.':'광고 상품을 확보하지 못해 경쟁 비교를 보류했습니다.',11);if(ads?.error)text(ads.error.slice(0,200),10,muted);}
 section('05 · 추가로 확인할 사항');
 text('실제 CPC와 구매 비율, 광고 후 개당 이익을 같은 기간으로 측정해야 합니다. 가격만으로 경쟁력을 판단하지 말고 리뷰의 구매 근거와 상품 차별점도 함께 확인하세요.',11);
 if(snapshot&&!snapshot.items.some(v=>v.dailySales!=null||v.weeklySales!=null))text('기간별 판매량이 공개되지 않아 경쟁 상품의 판매 속도와 시장 점유율은 판단하지 않았습니다. 누적 구매 수를 일간·주간 수치로 환산하지 않습니다.',11);
 section('계산 조건과 자료의 한계');
 text('입력 조건과 공개 자료를 바탕으로 작성한 1차 진단 가안입니다. 매출·광고 성과를 보장하지 않습니다. 미입력 비용과 실제 광고비를 반영하면 결과는 달라집니다.',9,muted);
 if(r.examples)text('참고 비용이 포함되어 있습니다. 실제 계약 비용으로 재진단하세요.',9,muted);
 const pages=doc.getPages();pages.forEach((p,i)=>p.drawText(`KITSNODE · ${i+1} / ${pages.length}`,{x:margin,y:30,size:8,font,color:muted}));
 const bytes=await doc.save();return new Blob([new Uint8Array(bytes)],{type:'application/pdf'});
}


