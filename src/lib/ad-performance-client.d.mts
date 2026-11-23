export type PerformanceRequest={connectionId:string;kind:'product'|'keyword';campaignId:string;groupId:string;targetId:string;since:string;until:string};
export type HourlyRow={hour:number;impressions:number|null;clicks:number|null;cost:number|null;purchases:number|null;revenue:number|null;averageCpc:number|null};
export type HourlyResult={status:'observed';day:string;hours:HourlyRow[]}|{status:'no_data'}|{status:'unavailable'};
export function createAdPerformanceClient(options?:{enabled?:boolean;fetcher?:typeof fetch}):{read(token:string,body:PerformanceRequest,signal:AbortSignal):Promise<unknown>;readHourly(token:string,body:PerformanceRequest,signal:AbortSignal):Promise<HourlyResult>}|undefined;
