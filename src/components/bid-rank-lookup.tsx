"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownToLine, Loader2, Search } from 'lucide-react';
import { bidRankRequests, loadBidRanks, type BidRank, type BidRankQuery } from '@/lib/bid-ranks';
import { validateEndpoint } from '@/lib/naver-keywords';
import './bid-rank-lookup.css';

export function BidRankLookup({adType,onApply}:{adType:BidRankQuery['adType'];onApply:(bid:number,label:string)=>void}) {
  const [target,setTarget]=useState('');
  const [device,setDevice]=useState<BidRankQuery['device']>('PC');
  const [rows,setRows]=useState<BidRank[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  function invalidate(){controller.current?.abort();controller.current=null;setLoading(false);setRows([]);setError('');setNotice('');}
  async function lookup(event:FormEvent){
    event.preventDefault();
    invalidate();
    const query:BidRankQuery={adType,targetType:'id',target,device,count:3};
    let server:string;
    try{
      let saved='';try{saved=localStorage.getItem('kits.keyword-api-url')||'';}catch{}
      server=validateEndpoint(saved||process.env.NEXT_PUBLIC_KEYWORD_API_URL||'');
      bidRankRequests(server,query);
    }catch(e){setError(e instanceof Error?e.message:'입력값을 확인하세요.');return;}
    const current=new AbortController();controller.current=current;setLoading(true);
    const timer=setTimeout(()=>{if(controller.current===current){current.abort();setError('조회 시간이 초과되었습니다. 다시 조회해 주세요.');setLoading(false);}},18000);
    try{
      await loadBidRanks(server,query,current.signal,row=>{if(controller.current===current)setRows(previous=>[...previous.filter(r=>r.position!==row.position),row].sort((a,b)=>a.position-b.position));});
    }finally{clearTimeout(timer);if(controller.current===current){setLoading(false);controller.current=null;}}
  }
  const shopping=adType==='shopping-search';
  return <section className="bid-rank-lookup" aria-label="상단 광고 입찰가 조회">
    <div className="bid-rank-heading"><div><span>NAVER SEARCH AD</span><h2>{shopping?'광고 소재 ID로 1·2·3위 입찰가 확인':'키워드로 1·2·3위 입찰가 확인'}</h2></div><span className="bid-rank-badge">예상 입찰가</span></div>
    <form className="bid-rank-search" onSubmit={lookup}>
      <label className="bid-rank-target">{shopping?'광고 소재 ID':'조회 키워드'}<input aria-label={shopping?'광고 소재 ID':'입찰가 조회 키워드'} value={target} maxLength={shopping?100:50} placeholder={shopping?'nad-로 시작하는 소재 ID를 입력하세요':'키워드 한 개를 입력하세요'} autoComplete="off" spellCheck={false} onChange={e=>{invalidate();setTarget(e.target.value);}}/></label>
      <label>기기<select aria-label="입찰가 조회 기기" value={device} onChange={e=>{invalidate();setDevice(e.target.value as BidRankQuery['device']);}}><option value="PC">PC</option><option value="MOBILE">모바일</option></select></label>
      <button type="submit" className="bid-rank-submit" disabled={loading}>{loading?<Loader2 size={16} className="bid-rank-spinner"/>:<Search size={16}/>} {loading?'조회 중…':'입찰가 조회'}</button>
      {loading&&<button type="button" onClick={()=>{invalidate();setNotice('조회를 취소했습니다.');}}>취소</button>}
    </form>
    {error&&<p className="bid-rank-error" role="alert">{error}</p>}
    <div className="bid-rank-cards" aria-live="polite">{[1,2,3].map(position=>{
      const row=rows.find(r=>r.position===position);
      return <article key={position} aria-label={`${position}위 예상 입찰가`}><div><span>{position}위</span><small>{device==='PC'?'PC':'모바일'}</small></div><strong>{row?.error?'조회 실패':row?row.bid===null?'자료 없음':`${row.bid.toLocaleString('ko-KR')}원`:loading?'조회 중…':'조회 전'}</strong>{row?.error?<p className="bid-rank-error">{row.error}</p>:row?.fetchedAt?<small>{new Date(row.fetchedAt).toLocaleString('ko-KR')}{row.cached?' · 캐시':''}</small>:<small>목표 순위 기준 예상 입찰가</small>}<button type="button" aria-label={`${position}위 입찰가를 CPC 가정에 적용`} disabled={!row||row.bid===null||!!row.error} onClick={()=>{if(!row||row.bid===null||row.error)return;onApply(row.bid,`네이버 ${shopping?'쇼핑검색광고':'파워링크'} ${device==='PC'?'PC':'모바일'} ${position}위 추정 입찰가 · CPC 가정`);setNotice(`${position}위 ${row.bid.toLocaleString('ko-KR')}원을 CPC 가정값에 적용했습니다.`);}}><ArrowDownToLine size={13}/> CPC에 적용</button></article>;
    })}</div>
    <div aria-live="polite">{notice&&<p className="bid-rank-notice">{notice}</p>}</div>
    {!loading&&rows.some(row=>!row.error&&row.bid===null)&&<p className="bid-rank-hint">네이버가 해당 조건의 입찰가를 제공하지 않으면 ‘자료 없음’으로 표시합니다. {shopping&&<a href="https://github.com/naver/searchad-apidoc/issues/986" target="_blank" rel="noreferrer">소재 추정·노출 상태 확인 안내 ↗</a>}</p>}
    <p className="bid-rank-disclaimer">조회 시점의 예상 입찰가이며 실제 결제 CPC·현재 노출 순위와 다릅니다. CPC 적용은 수익성 계산만 변경합니다.</p>
  </section>;
}
