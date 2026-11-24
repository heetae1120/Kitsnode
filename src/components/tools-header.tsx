import Link from 'next/link';
import type {ToolId} from '@/lib/tool-navigation';
import {MemberMenu} from './agency/member-menu';
import {BrandWordmark} from './brand-wordmark';
import {PublicCategories} from './public-categories';

export function ToolsHeader({active}:{active:ToolId|'ads'}){
 return <header className="tool-topbar shared-tools-header">
  <Link className="tool-brand" href="/tools/start/" aria-label="KITSNODE 도구 메인으로">
   <BrandWordmark/>
  </Link>
  <span className="shared-tools-note">브랜드의 다음을<br/>함께 만듭니다.</span>
  <PublicCategories active={active==='survey'?'about':active}/>
  <MemberMenu/>
 </header>;
}
