export function readMemberAuthConfig(env:{enabled?:string;projectRef?:string;url?:string;key?:string;signup?:string;naver?:string;link?:string}):null|{url:string;key:string;signup:boolean;naver:boolean;link:boolean};
export function memberRedirect(origin:string,basePath?:string):string|null;
export const MEMBER_INTAKE_REVIEWED: boolean;
