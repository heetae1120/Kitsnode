"use client";
import {useId} from "react";

export default function InkOrbitFeatures({days,quantity,reorder,day,onDay}:{days:number;quantity:number;reorder:number;day:number;onDay:(day:number)=>void}) {
 const id=useId(), x=(d:number)=>56+580*d/days, y=(d:number)=>40+140*d/days;
 const tip=Math.max(115,Math.min(575,x(day)));
 return <svg className="kn-stock-chart" viewBox="0 0 680 218" role="img" aria-label={day+"일째 예상 재고 "+Math.round(quantity*(1-day/days))+"개"} onPointerMove={e=>{
 const svg=e.currentTarget,m=svg.getScreenCTM();if(!m)return;const px=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse()).x;
 onDay(Math.round(Math.min(1,Math.max(0,(px-56)/580))*days));
 }}>
 <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="#21ac80" stopOpacity=".28"/><stop offset="1" stopColor="#fff" stopOpacity=".2"/></linearGradient></defs>
 <rect x={x(reorder)} y="40" width={636-x(reorder)} height="140" fill="#fff3df"/>
 {[0,.5,1].map(f=><g key={f}><path d={'M56 '+y(days*f)+' H636'} stroke="#d2ddd7"/><text x="46" y={y(days*f)+4} textAnchor="end">{Math.round(quantity*(1-f))}</text><text x={x(days*f)} y="205" textAnchor="middle">{Math.round(days*f)}일</text></g>)}
 <path d="M56 40L636 180H56Z" fill={'url(#'+id+')'}/><path d="M56 40L636 180" stroke="#183d32" strokeWidth="2.5"/><path d="M56 180L636 40" stroke="#008664" strokeDasharray="5 5"/>
 <path d={'M'+x(reorder)+' 38V180'} stroke="#996112" strokeDasharray="3 3"/><circle cx={x(reorder)} cy={y(reorder)} r="4" fill="#996112"/>
 <path d={'M'+x(day)+' 31V180'} stroke="#324c41" strokeDasharray="2 4"/><circle cx={x(day)} cy={y(day)} r="5" fill="white" stroke="#075f48" strokeWidth="2"/>
 <rect x={tip-66} y="5" width="132" height="25" rx="4" fill="#183d32"/><text x={tip} y="22" textAnchor="middle" style={{fill:"white",fontSize:12}}>{day}일 · 재고 {Math.round(quantity*(1-day/days)).toLocaleString()}개</text>
 </svg>;
}
