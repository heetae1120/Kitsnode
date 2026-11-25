/** Shared live-text wordmark, matching the brand home. */
export function BrandWordmark(){
 return <>kitsnode<span className="kn-registered" aria-hidden="true">®</span></>;
}

export function BrandHomeLink({className}:{className:string}){
 return <a className={className} href={(process.env.NEXT_PUBLIC_BASE_PATH||'')+'/'} aria-label="키츠노드 홈"><BrandWordmark/></a>;
}
