type Session = {access_token?:string;provider_token?:string|null;user?:{id?:string;identities?:Array<{provider?:string}>}}|null;
export function createNaverAgreementBridge(options:{enabled?:boolean;url:string;key:string;fetchImpl?:typeof fetch}):{verify(session:Session):Promise<boolean>;dispose():void};
