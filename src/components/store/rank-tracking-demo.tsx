'use client';

import {useState} from 'react';
import {runRankTrackingDemo} from '@/lib/rank-tracking-demo.mjs';
import {StoreBadge,StoreButton,StoreCard} from './store-ui';

type DemoResult=ReturnType<typeof runRankTrackingDemo>;
const minutes=(value:number)=>Math.round(value/60000);
function targetText(result:DemoResult['pc']){
 const hit=result.firstObservedTarget;
 if(!hit)return '이 가상 관측에서는 목표 순위를 확인하지 못했습니다.';
 if(hit.lowerBoundMs===null)return `첫 목표 충족 관측: ${minutes(hit.upperBoundMs)}분 후. 그 이전은 확인되지 않았습니다.`;
 return `${minutes(hit.lowerBoundMs)}분 후 목표 미달, ${minutes(hit.upperBoundMs)}분 후 목표 충족이 관측됐습니다. 그 사이의 변화는 확인되지 않았습니다.`;
}
function valueText(point:DemoResult['pc']['checkpoints'][number]){
 if(point.status==='pending')return '대기';
 if(point.status==='unavailable'||!point.observation)return '관측 자료 없음';
 return `${point.observation.rank}위`;
}

export function RankTrackingDemo(){
 const [pcTarget,setPcTarget]=useState(2);
 const [mobileTarget,setMobileTarget]=useState(3);
 const [result,setResult]=useState<DemoResult|null>(null);
 return <StoreCard>
  <section aria-labelledby="rank-tracking-demo-title">
   <StoreBadge tone="warning">가상 데이터</StoreBadge>
   <h2 id="rank-tracking-demo-title">순위 변화 추적 체험</h2>
   <p>가상의 입찰가 변경 이후 PC와 모바일에서 10분·20분·30분에 관측한 것으로 가정한 순간 순위입니다. 표시되는 숫자는 실제 네이버 광고 데이터가 아닙니다.</p>
   <p>실제 노출 통계: 아직 연결되지 않았습니다. 네이버의 집계 평균 순위는 실시간 순간 순위가 아니며 데이터 반영이 지연될 수 있습니다.</p>
   <label htmlFor="demo-pc-target">PC 목표 순위</label>
   <select id="demo-pc-target" value={pcTarget} onChange={event=>{setPcTarget(Number(event.target.value));setResult(null);}}>{Array.from({length:10},(_,index)=><option key={index+1} value={index+1}>{index+1}위</option>)}</select>
   <label htmlFor="demo-mobile-target">모바일 목표 순위</label>
   <select id="demo-mobile-target" value={mobileTarget} onChange={event=>{setMobileTarget(Number(event.target.value));setResult(null);}}>{Array.from({length:10},(_,index)=><option key={index+1} value={index+1}>{index+1}위</option>)}</select>
   <StoreButton type="button" onClick={()=>setResult(runRankTrackingDemo({pcTarget,mobileTarget}))}>가상 결과 보기</StoreButton>
   {result&&<div role="status">
    <p>가상의 입찰가: 100원 · 목표 PC {result.pc.targetRank}위 / 모바일 {result.mobile.targetRank}위</p>
    <table><caption>입찰가 변경 이후의 가상 관측 결과</caption><thead><tr><th scope="col">경과 시간</th><th scope="col">PC</th><th scope="col">모바일</th></tr></thead><tbody>{result.pc.checkpoints.map((point,index)=><tr key={point.minutes}><th scope="row">{point.minutes}분 후</th><td>{valueText(point)}</td><td>{valueText(result.mobile.checkpoints[index])}</td></tr>)}</tbody></table>
    <p>PC: {targetText(result.pc)}</p><p>모바일: {targetText(result.mobile)}</p>
    <p>예시는 목표 충족이 관측된 범위만 보여 줍니다. 실제 도달 시각이나 입찰가 반영 지연을 증명하지 않습니다. 결과는 저장되거나 자동 수집되지 않습니다.</p>
   </div>}
  </section>
 </StoreCard>;
}
