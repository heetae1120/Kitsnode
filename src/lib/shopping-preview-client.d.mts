export type ShoppingItem = {id:string;name?:string;status?:string;bid?:number|null;useGroupBid?:boolean|null;accountId?:string};
export type ShoppingResult = {status:'unavailable'|'skipped'|'proposed'|'unchanged'|'illustrative';reason?:string;currentBid?:number;proposedBid?:number;affectedProductCount?:number|null;blockers?:string[];execution?:string};
export type ShoppingPreviewClient = {catalog(token:string,body:Record<string,unknown>,signal:AbortSignal):Promise<ShoppingItem[]>;preview(token:string,body:Record<string,unknown>,signal:AbortSignal):Promise<ShoppingResult>};
export function createShoppingPreviewClient(options?:{enabled?:boolean;fetcher?:typeof fetch}):ShoppingPreviewClient|undefined;
