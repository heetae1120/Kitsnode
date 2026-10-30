import { parseSeeds, validateEndpoint } from './naver-keywords';

export type BidRankQuery = {
  adType: 'shopping-search' | 'powerlink';
  targetType: 'id' | 'product';
  target: string;
  device: 'PC' | 'MOBILE';
  count: 5 | 10;
};
export type BidRank = { position: number; bid: number | null; fetchedAt?: string; cached?: boolean; error?: string };

export function bidRankRequests(endpoint: string, query: BidRankQuery) {
  const server = validateEndpoint(endpoint);
  if (!server) throw new Error('조회 서버를 연결해 주세요.');
  const target = query.target.trim();
  if (query.adType === 'shopping-search') {
    if (!(query.targetType === 'id' ? /^nad-[A-Za-z0-9-]{1,95}$/.test(target) : /^\d{1,30}$/.test(target)))
      throw new Error(query.targetType === 'id' ? 'nad-로 시작하는 광고 소재 ID를 입력하세요.' : '숫자로 된 네이버쇼핑 상품 ID를 입력하세요.');
  } else if (parseSeeds(target).length !== 1) throw new Error('키워드를 한 개만 입력하세요.');
  if (!['PC','MOBILE'].includes(query.device) || ![5,10].includes(query.count) || (query.device === 'MOBILE' && query.count !== 5))
    throw new Error('기기와 조회 순위를 확인하세요.');
  return Array.from({length:query.count}, (_,index) => {
    const url = new URL(server);
    url.searchParams.set('mode', query.adType === 'shopping-search' ? 'shopping-bid-estimate' : 'bid-estimate');
    if (query.adType === 'shopping-search') {
      url.searchParams.set('targetType', query.targetType);
      url.searchParams.set('targetId', target);
    } else url.searchParams.set('keywords', parseSeeds(target)[0]);
    url.searchParams.set('device',query.device);
    url.searchParams.set('position',String(index+1));
    return url;
  });
}

export function validateBidRank(value: unknown, query: BidRankQuery, position: number): BidRank {
  if (!value || typeof value !== 'object') throw new Error('조회 응답 형식이 올바르지 않습니다.');
  const data = value as Record<string,unknown>;
  if (data.device !== query.device || data.position !== position || typeof data.fetchedAt !== 'string' || !Number.isFinite(Date.parse(data.fetchedAt)))
    throw new Error('조회 조건이 다른 입찰가 응답입니다. 다시 조회하세요.');
  let bid: unknown;
  if (query.adType === 'shopping-search') {
    if (data.source !== 'naver-shopping-bid-estimate' || data.adType !== 'shopping-search' || data.targetType !== query.targetType || data.targetId !== query.target.trim())
      throw new Error('소재 또는 상품이 다른 입찰가 응답입니다.');
    bid = data.bid;
  } else {
    if (data.source !== 'naver-bid-estimate' || data.adType !== 'powerlink' || !Array.isArray(data.bids)) throw new Error('파워링크 입찰가 응답이 아닙니다.');
    bid = data.bids.find((row:unknown) => !!row && typeof row === 'object' && (row as Record<string,unknown>).keyword === parseSeeds(query.target)[0])?.bid;
  }
  if (bid !== null && (typeof bid !== 'number' || !Number.isSafeInteger(bid) || bid <= 0 || bid > 1e9)) throw new Error('입찰가를 확인할 수 없는 응답입니다.');
  return {position,bid:bid as number|null,fetchedAt:data.fetchedAt,cached:data.cached===true};
}

export async function loadBidRanks(endpoint: string, query: BidRankQuery, signal: AbortSignal, onRow:(row:BidRank)=>void, request:typeof fetch=fetch) {
  const urls=bidRankRequests(endpoint,query);
  await Promise.all(urls.map(async(url,index)=>{
    let row:BidRank;
    try {
      const response=await request(url,{signal,credentials:'omit',cache:'no-store'});
      const data=await response.json();
      if(!response.ok) throw new Error(typeof data?.error==='string'?data.error.slice(0,240):'입찰가 조회에 실패했습니다.');
      row=validateBidRank(data,query,index+1);
    } catch(error) {
      if(signal.aborted)return;
      row={position:index+1,bid:null,error:error instanceof Error?error.message:'조회 실패'};
    }
    if(!signal.aborted)onRow(row);
  }));
}
