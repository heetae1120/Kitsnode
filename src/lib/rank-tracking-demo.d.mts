type DemoObservation = {kind:'instant';rank:number;observedAt:number;source:string}|{kind:'average';rank:number;windowStart:number;windowEnd:number;source:string};
type DemoPoint = {minutes:number;status:'pending'|'unavailable'|'observed';observation:DemoObservation|null;late:boolean|null};
type DemoTarget = {observedAt:number;lowerBoundMs:number|null;upperBoundMs:number;classification:'observed_interval_not_causal'};
type DemoSummary = {targetRank:number;firstObservedTarget:DemoTarget|null;checkpoints:DemoPoint[]};
export function runRankTrackingDemo(options?:{pcTarget?:number;mobileTarget?:number}):{pc:DemoSummary;mobile:DemoSummary};
