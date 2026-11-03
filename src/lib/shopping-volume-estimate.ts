import {normalizeKeyword} from './keyword-budget';
import {rowVolume,type KeywordRow} from './naver-keywords';
export const shoppingVolumeReferences = [
 {keyword:'보조배터리',product:'QP1000C',device:'PC',observedAt:'2026-11-03',bids:[3470,2450,2140]},
 {keyword:'무선충전기',product:'ACONE',device:'PC',observedAt:'2026-11-03',bids:[1270,1260,1030]},
] as const;
export function exactPcVolume(row:KeywordRow|undefined){
 if(!row)return null;const volume=rowVolume(row,'pc');
 return volume&&volume.min===volume.max&&volume.min>0?volume.min:null;
}
export function calibrateShoppingVolume(rows:KeywordRow[]){
 const references=shoppingVolumeReferences.map(reference=>({...reference,volume:exactPcVolume(rows.find(row=>normalizeKeyword(row.keyword)===normalizeKeyword(reference.keyword)))}));
 if(references.some(reference=>reference.volume===null))return null;
 return {references:references.map(reference=>({...reference,volume:reference.volume!})),averageVolume:references.reduce((sum,row)=>sum+row.volume!,0)/references.length,
 averageBids:[0,1,2].map(position=>references.reduce((sum,row)=>sum+row.bids[position],0)/references.length)};
}
export function estimateShoppingVolume(row:KeywordRow,calibration:ReturnType<typeof calibrateShoppingVolume>){
 const volume=exactPcVolume(row);if(!volume||!calibration)return null;
 const ratio=volume/calibration.averageVolume;
 const bids=calibration.averageBids.map(bid=>bid*ratio);
 if(!bids.every(Number.isFinite))return null;
 return {volume,ratio,bids,ranges:[0,1,2].map(position=>{
  const values=calibration.references.map(reference=>reference.bids[position]*volume/reference.volume);
  return {min:Math.min(...values),max:Math.max(...values)};
 })};
}
