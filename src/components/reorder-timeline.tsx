"use client";
import {useId,useState} from 'react';
import {reorderTimeline} from '@/lib/reorder-timeline';
export function ReorderTimeline({quantity,months}:{quantity:number;months:number}){
 const [lead,setLead]=useState('14');const id=useId();const plan=lead.trim()!==''?reorderTimeline(quantity,months,Number(lead)):null;
 const n=(value:number)=>value.toLocaleString('ko-KR',{maximumFractionDigits:1});
 const x=plan?64+plan.reorderDay/plan.durationDays*620:64;
 const y=plan?54+plan.reorderDay/plan.durationDays*172:54;
 return <section className="mp-reorder" aria-labelledby={`${id}-title`}>
  <div className="mp-reorder-heading"><div><span>재발주 계획</span><h2 id={`${id}-title`}>{months}개월 판매 목표에 맞춘 재발주 시점</h2></div><label htmlFor={`${id}-lead`}>발주 후 입고까지 <span><input id={`${id}-lead`} type="number" min="0" max="3650" step="1" value={lead} onChange={event=>setLead(event.target.value)}/>일</span></label></div>
  {plan?<><svg viewBox="0 0 760 286" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-desc`}><title id={`${id}-chart-title`}>목표 기간의 재고 소진과 재발주 시점</title><desc id={`${id}-chart-desc`}>{quantity}개를 {months}개월 동안 일정하게 판매하면 {plan.durationDays}일째 재고가 소진됩니다. {plan.reorderDay}일째, 재고 약 {plan.stockAtReorder}개일 때 재발주하는 계획입니다. 입고 소요일 {lead}일 가정입니다.</desc><path d="M64 54 H684 M64 140 H684 M64 226 H684" stroke="#e1e8f4" fill="none"/><path d="M64 54 L684 226 L64 226 Z" fill="#edf3ff"/><path d="M64 54 L684 226" fill="none" stroke="#2858f5" strokeWidth="4"/><text x="52" y="59" textAnchor="end">{n(quantity)}개</text><text x="52" y="145" textAnchor="end">{n(quantity/2)}</text><text x="52" y="231" textAnchor="end">0</text>{Array.from({length:Math.min(months,6)+1},(_,index)=>{const divisions=Math.min(months,6);return <text key={index} x={64+620*index/divisions} y="258" textAnchor="middle">{n(months*index/divisions)}개월</text>;})}<path d={`M${x} 36 V226`} stroke="#ef9b32" strokeWidth="2" strokeDasharray="5 5"/><circle cx={x} cy={y} r="6" fill="#ef9b32" stroke="#fff" strokeWidth="2"/><text x={Math.min(640,Math.max(110,x))} y="24" textAnchor="middle" className="mp-reorder-marker">재발주 {n(plan.reorderDay)}일째</text></svg><div className="mp-reorder-metrics" aria-live="polite"><div><span>월 판매 목표</span><b>{n(plan.monthlySales)}개</b></div><div><span>재발주 시점</span><b>{plan.reorderDay===0?'지금 발주':`시작 후 ${n(plan.reorderDay)}일째`}</b></div><div><span>재발주 시 남은 재고</span><b>약 {n(plan.stockAtReorder)}개</b></div></div>{plan.lateDays>0&&<p className="mp-reorder-warning" role="status">입고 소요일이 목표 기간보다 {n(plan.lateDays)}일 길어요. 지금 발주해도 재고 소진 전 입고가 어려워요.</p>}</>:<p role="status">입고 소요일을 0~3,650일의 정수로 입력하세요.</p>}
  <p className="mp-reorder-note">입고 {lead||'—'}일은 조정 가능한 가정이에요. 1개월=30일·균등 판매·안전재고 0개 기준이며, 실제 판매나 입고를 예측하지 않아요.</p>
 </section>;
}
