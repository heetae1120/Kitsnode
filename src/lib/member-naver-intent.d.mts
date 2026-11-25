export function writeNaverIntent(storage:Storage|null,kind:'signin'|'signup',now?:number):boolean;
export function readNaverIntent(storage:Storage|null,now?:number):'signin'|'signup'|null;
export function clearNaverIntent(storage:Storage|null):void;
export function naverBoundaryEnabled(storage:Storage|null,flag:string|undefined,search?:string):boolean;
export function requiresNaverSignupIntent(enabled:boolean,naverLinked:boolean,intent:'signin'|'signup'|null):boolean;
