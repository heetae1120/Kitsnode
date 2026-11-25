import {PDFDocument,rgb,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {diagnosisAnalysis} from './diagnosis-analysis';
import type {DiagnosisDocument} from './diagnosis-document';

/** Compose a selectable-text document from the calculated evidence, never a page image. */
export async function createDiagnosisPdf(r:DiagnosisDocument,fontBytes:Uint8Array){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const font=await doc.embedFont(fontBytes);
 doc.setTitle(`${r.name} · 판매 및 광고 운영 진단서`);doc.setAuthor('KITSNODE');
 const white=rgb(.96,.95,.92),muted=rgb(.74,.73,.7),orange=rgb(1,.353,.122),green=rgb(.28,.83,.58),red=rgb(1,.45,.48),black=rgb(.043,.043,.043),line=rgb(.21,.21,.21);
 const glyphWidths=new Map<string,number>();
 const width=595.28,height=841.89,margin=44;let page!:PDFPage,y=0;
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
 newPage('BUSINESS DIAGNOSIS / 01 · 먼저 보는 결과');
 const o=a.outcome,resultColor=o.status==='positive'?green:o.status==='negative'?red:orange;
 text('현재 네이버 기준으로',27);
 text(o.status==='positive'?'플러스에 가까워요.':o.status==='negative'?'마이너스에 가까워요.':'판단을 보류해요.',30,resultColor);y-=10;
 text(r.name.slice(0,120),14);text(new Date(r.createdAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),9,muted);y-=12;text(o.summary,11);
 if(o.afterProfit!==null){y-=10;text(`광고 후 전체 손익 · 계산상  ${money(o.afterProfit)}`,17,resultColor);text(`한 개당 남는 금액 · 계산상  ${money(o.perUnit!)}`,11,muted);}
 section('판매금액과 비용 비교 · 전량 판매 가정');
 const bars=[{label:'계획 판매금액',value:r.sales,color:white},{label:'입력한 판매 비용',value:r.costs,color:muted},...(o.adBudget!==null?[{label:'가정한 검색광고비',value:o.adBudget,color:orange},{label:'광고 후 손익 · 계산상',value:o.afterProfit!,color:resultColor}]:[])];
 const maxBar=Math.max(1,...bars.map(v=>Math.abs(v.value))),barWidth=width-2*margin;
 for(const bar of bars){if(y<110)newPage('BUSINESS DIAGNOSIS / 비교 계속');const amount=money(bar.value);page.drawText(bar.label,{x:margin,y,size:10,font,color:white});page.drawText(amount,{x:width-margin-font.widthOfTextAtSize(amount,11),y,size:11,font,color:bar.color});y-=17;page.drawRectangle({x:margin,y,width:barWidth,height:8,color:line});if(bar.value!==0)page.drawRectangle({x:margin,y,width:barWidth*Math.abs(bar.value)/maxBar,height:8,color:bar.color});y-=25;}
 text('막대 길이는 금액의 크기이며, 손익의 +/−는 금액으로 구분합니다.',8,muted);
 if(o.scenarios.length){section('클릭 비용이 달라진다면?');text('구매 비율과 판매수량을 고정하고 CPC만 바꾼 참고 계산',9,muted);y-=8;const column=barWidth/3;
  o.scenarios.forEach((v,i)=>{const x=margin+column*i;page.drawText(v.label,{x,y,size:9,font,color:muted});page.drawText(money(v.profit),{x,y:y-23,size:15,font,color:v.profit>0?green:red});});y-=46;
 }
 newPage('BUSINESS DIAGNOSIS / 02 · 판단 근거와 다음 행동');
 text(o.status==='positive'?'플러스 여유를 확인하는 순서':o.status==='negative'?'마이너스 가능성을 줄이는 점검':'판단에 필요한 자료부터 확인',23,resultColor);y-=14;
 section('01 · 계산 조건과 출처');o.conditions.forEach(v=>{text(v,10,muted);y-=5;});
 text('미입력 비용과 실제 광고비를 반영하면 결과가 달라집니다. 매출·광고 성과를 보장하지 않습니다.',9,muted);
 if(r.examples)text('참고 비용이 포함되어 있습니다. 실제 계약 비용으로 재진단하세요.',9,muted);
 text(`${r.months>0?r.months+'개월':'기간 미설정'} · ${r.quantity.toLocaleString('ko-KR')}개 전량 판매 가정`,10,muted);
 text(`총 판매금액 ${money(r.sales)} / 판매 비용 ${money(r.costs)}`,12);
 text(`광고 전 이익 ${money(r.profit)} / 고정비 배분 개당 이익 ${money(r.profit/r.quantity)}`,12);
 text(`계산상 광고비 상한 ${money(r.marketing)} · 판매 후 이익 기준`,11,muted);
 section('02 · 판단 근거');a.findings.forEach((v,i)=>{text(`${i+1}. ${v}`,11);y-=7;});
 const k=r.analysis?.keyword;
 if(k){text(`CPC 출처: ${k.source}`,9,muted);text(`검색량: ${k.volume?(k.volume.min===k.volume.max?k.volume.min.toLocaleString('ko-KR'):`${k.volume.min.toLocaleString('ko-KR')}~${k.volume.max.toLocaleString('ko-KR')}`)+'회 / 월 · '+k.device:'미확인'}`,9,muted);}
 section('03 · 우선 실행안');a.actions.forEach((v,i)=>{text(`${i+1}. ${v}`,11);y-=6;});
 newPage('BUSINESS DIAGNOSIS / 03 · 경쟁 상품과 확인 과제');
 text('광고 시장 비교와 다음 행동',24);y-=10;
 a.market.forEach(v=>{text(v,11);y-=6;});
 const ads=r.analysis?.ads,snapshot=ads?.status==='ready'?ads.snapshot:undefined;
 section('04 · 확인된 광고 상품');
 if(snapshot){text(`검색어: ${snapshot.keyword} · PC 통합검색 · 조회 당시 노출 순서`,10,muted);text(`확인 시각: ${new Date(snapshot.observedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`,9,muted);y-=8;
  for(const item of snapshot.items){text(`광고 ${item.rank} · ${item.title.slice(0,160)}`,12);text(`리뷰 ${item.reviewCount||'확인 불가'} / 별점 ${item.rating??'확인 불가'}`,10,muted);text(`구매 ${item.purchaseCount||'확인 불가'} / 찜 ${item.wishCount||'확인 불가'}`,10,muted);text(item.dailySales!=null?`일간 판매 ${item.dailySales.toLocaleString('ko-KR')}개`:item.weeklySales!=null?`주간 판매 ${item.weeklySales.toLocaleString('ko-KR')}개`:'일간·주간 판매량 확인 안 됨',10,muted);y-=14;}
 }else{text(ads?.status==='loading'?'광고 상품 조회가 완료되지 않은 상태의 진단서입니다. 조회 완료 후 다시 다운로드하세요.':'광고 상품을 확보하지 못해 경쟁 비교를 보류했습니다.',11);if(ads?.error)text(ads.error.slice(0,200),10,muted);}
 section('05 · 추가로 확인할 사항');
 text('실제 CPC와 구매 비율, 광고 후 개당 이익을 같은 기간으로 측정해야 합니다. 가격만으로 경쟁력을 판단하지 말고 리뷰의 구매 근거와 상품 차별점도 함께 확인하세요.',11);
 if(snapshot&&!snapshot.items.some(v=>v.dailySales!=null||v.weeklySales!=null))text('기간별 판매량이 공개되지 않아 경쟁 상품의 판매 속도와 시장 점유율은 판단하지 않았습니다. 누적 구매 수를 일간·주간 수치로 환산하지 않습니다.',11);
 const pages=doc.getPages();pages.forEach((p,i)=>p.drawText(`KITSNODE · ${i+1} / ${pages.length}`,{x:margin,y:30,size:8,font,color:muted}));
 const bytes=await doc.save();return new Blob([new Uint8Array(bytes)],{type:'application/pdf'});
}
