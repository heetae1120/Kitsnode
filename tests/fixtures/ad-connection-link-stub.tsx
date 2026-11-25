import React from 'react';
export default function Link({href,children,className,onClick}:{href:string;children:React.ReactNode;className?:string;onClick?:React.MouseEventHandler<HTMLAnchorElement>}){return <a href={href} className={className} onClick={onClick}>{children}</a>;}
