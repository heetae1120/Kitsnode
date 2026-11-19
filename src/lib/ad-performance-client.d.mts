export type PerformanceRequest={connectionId:string;kind:'product'|'keyword';campaignId:string;groupId:string;targetId:string;since:string;until:string};
export function createAdPerformanceClient(options?:{enabled?:boolean;fetcher?:typeof fetch}):{read(token:string,body:PerformanceRequest,signal:AbortSignal):Promise<unknown>}|undefined;
