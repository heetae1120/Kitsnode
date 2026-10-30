"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Loader2, Search } from 'lucide-react';
import { bidRankRequests, loadBidRanks, type BidRank, type BidRankQuery } from '@/lib/bid-ranks';
import { validateEndpoint } from '@/lib/naver-keywords';
import './bid-rank-lookup.css';

export function BidRankLookup({adType,onApply}:{adType:BidRankQuery['adType'];onApply:(bid:number,label:string)=>void}) {
  const [target,setTarget]=useState('');
  const [targetType,setTargetType]=useState<BidRankQuery['targetType']>('id');
  const [device,setDevice]=useState<BidRankQuery['device']>('PC');
  const [count,setCount]=useState<4|5|10>(adType==='shopping-search'?4:5);
  const [endpoint,setEndpoint]=useState(process.env.NEXT_PUBLIC_KEYWORD_API_URL||'');
  const [rows,setRows]=useState<BidRank[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>{try{const saved=localStorage.getItem('kits.keyword-api-url');if(saved)setEndpoint(saved);}catch{}return()=>controller.current?.abort();},[]);
  function invalidate(){controller.current?.abort();controller.current=null;setLoading(false);setRows([]);setError('');setNotice('');}
  async function lookup(){
    invalidate();
    const query:BidRankQuery={adType,targetType,target,device,count};
    let server:string;
    try{server=validateEndpoint(endpoint);bidRankRequests(server,query);}catch(e){setError(e instanceof Error?e.message:'입력값을 확인하세요.');return;}
    const current=new AbortController();controller.current=current;
    setLoading(true);
    const timer=setTimeout(()=>{if(controller.current===current){current.abort();setError('조회 시간이 초과되었습니다. 완료된 순위만 표시합니다. 다시 조회해 주세요.');setLoading(false);}},18000);
    try{
      await loadBidRanks(server,query,current.signal,row=>{if(controller.current===current)setRows(previous=>[...previous.filter(r=>r.position!==row.position),row].sort((a,b)=>a.position-b.position));});
    }finally{clearTimeout(timer);if(controller.current===current){setLoading(false);controller.current=null;}}
  }
  const shopping=adType==='shopping-search';
  return <section className="bid-rank-lookup" aria-label="순위별 예상 입찰가 조회">
    <div className="bid-rank-heading"><div><span>NAVER SEARCH AD · 조회 전용</span><h4>{shopping?'소재 ID로 순위별 입찰가 확인':'키워드로 순위별 입찰가 확인'}</h4></div><Search size={19}/></div>
    <p>{shopping?'광고센터 소재 ID를 입력하고 PC·모바일 목표 순위별 예상 입찰가를 비교하세요.':'파워링크는 소재 ID 대신 키워드로 목표 순위별 예상 입찰가를 조회합니다.'}</p>
    <div className={shopping?'bid-rank-fields':'bid-rank-fields bid-rank-keyword'}>
      {shopping&&<label>ID 종류<select aria-label="입찰가 조회 ID 종류" value={targetType} onChange={e=>{invalidate();setTargetType(e.target.value as BidRankQuery['targetType']);setTarget('');}}><option value="id">광고 소재 ID</option><option value="product">네이버쇼핑 상품 ID</option></select></label>}
      <label className="bid-rank-target">{shopping?(targetType==='id'?'광고 소재 ID':'네이버쇼핑 상품 ID'):'조회 키워드'}<input aria-label={shopping?(targetType==='id'?'광고 소재 ID':'네이버쇼핑 상품 ID'):'입찰가 조회 키워드'} value={target} maxLength={shopping?100:50} placeholder={shopping?(targetType==='id'?'nad-로 시작하는 소재 ID':'네이버쇼핑 상품 ID (숫자)'):'키워드 한 개'} autoComplete="off" spellCheck={false} onChange={e=>{invalidate();setTarget(e.target.value);}}/></label>
      <label>조회 기기<select aria-label="입찰가 조회 기기" value={device} onChange={e=>{invalidate();setDevice(e.target.value as BidRankQuery['device']);setCount(shopping?4:5);}}><option value="PC">PC</option><option value="MOBILE">모바일</option></select></label>
      <label>비교 순위<select aria-label="입찰가 비교 순위" value={count} onChange={e=>{invalidate();setCount(Number(e.target.value) as 4|5|10);}}>{shopping?<option value="4">1~4위</option>:<><option value="5">1~5위</option>{device==='PC'&&<option value="10">1~10위</option>}</>}</select></label>
    </div>
    {shopping&&<small className="bid-rank-hint">광고센터의 소재 목록에서 소재 ID를 복사하세요. 네이버쇼핑 상품 ID는 스마트스토어 상품번호와 다를 수 있습니다.</small>}
    <div className="bid-rank-actions"><button type="button" className="bid-rank-submit" disabled={loading} onClick={lookup}>{loading?<Loader2 size={16} className="bid-rank-spinner"/>:<Search size={16}/>} {loading?'순위별 조회 중…':'순위별 예상 입찰가 조회'}</button>{loading&&<button type="button" onClick={()=>{invalidate();setNotice('조회를 취소했습니다.');}}>취소</button>}</div>
    <details className="bid-rank-connection"><summary>조회 서버 연결 설정</summary><label>조회 서버 주소<input type="url" aria-label="입찰가 조회 서버 주소" value={endpoint} placeholder="https://조회서버/api/keywords" onChange={e=>{invalidate();setEndpoint(e.target.value);}}/></label><p>기존 키워드 도구의 서버 설정을 함께 사용합니다. 인증 키는 서버에서 관리합니다.</p><button type="button" onClick={()=>{try{const value=validateEndpoint(endpoint);if(!value)throw new Error('서버 주소를 입력하세요.');localStorage.setItem('kits.keyword-api-url',value);setEndpoint(value);setError('');setNotice('조회 서버 주소를 저장했습니다.');}catch(e){setError(e instanceof Error?e.message:'주소를 저장하지 못했습니다.');}}}>서버 주소 저장</button></details>
    {error&&<p className="bid-rank-error" role="alert">{error}</p>}
    <div aria-live="polite">{notice&&<p className="bid-rank-notice">{notice}</p>}{loading&&<p className="bid-rank-hint">{rows.length} / {count}개 순위 응답 완료</p>}</div>
    {rows.length>0&&<div className="bid-rank-table"><table><caption>{device==='PC'?'PC':'모바일'} · {shopping?'쇼핑검색광고':'파워링크'} 순위별 예상 입찰가</caption><thead><tr><th scope="col">목표 순위</th><th scope="col">예상 입찰가</th><th scope="col">CPC 가정</th></tr></thead><tbody>{rows.map(row=><tr key={row.position}><th scope="row">{row.position}위</th><td>{row.error?<span className="bid-rank-error">조회 실패</span>:row.bid===null?'자료 없음':`${row.bid.toLocaleString('ko-KR')}원`}{row.error?<small>{row.error}</small>:row.fetchedAt&&<small>{new Date(row.fetchedAt).toLocaleString('ko-KR')}{row.cached?' · 캐시':''}</small>}</td><td><button type="button" aria-label={`${row.position}위 입찰가를 CPC 가정에 적용`} disabled={row.bid===null||!!row.error} onClick={()=>{if(row.bid===null||row.error)return;const label=`네이버 ${shopping?'쇼핑검색광고':'파워링크'} ${device==='PC'?'PC':'모바일'} ${row.position}위 추정 입찰가 · CPC 가정`;onApply(row.bid,label);setNotice(`${row.position}위 ${row.bid.toLocaleString('ko-KR')}원을 CPC 가정값에 적용했습니다. 실제 입찰은 변경되지 않습니다.`);}}><ArrowDownToLine size={13}/> 적용</button></td></tr>)}</tbody></table></div>}
    {!loading&&rows.some(row=>!row.error&&row.bid===null)&&<p className="bid-rank-hint">‘자료 없음’은 네이버가 해당 조건의 예상 입찰가를 제공하지 않은 상태입니다. 0원이 아닙니다. {shopping&&<>신규 소재의 키워드 추정 완료 여부와 광고 노출 가능 상태를 광고센터에서 확인하세요. <a href="https://github.com/naver/searchad-apidoc/issues/986" target="_blank" rel="noreferrer">네이버 공식 안내 ↗</a></>}</p>}
    <p className="bid-rank-disclaimer">예상 입찰가는 실제 결제 평균 CPC나 순위 보장 금액이 아닙니다. 적용 버튼은 수익성 계산의 CPC 가정만 바꿉니다. 광고센터의 입찰·예산은 변경하지 않습니다.</p>
  </section>;
}
