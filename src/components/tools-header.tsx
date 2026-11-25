import type {ToolId} from '@/lib/tool-navigation';
import {MemberMenu} from './agency/member-menu';
import {BrandHomeLink} from './brand-wordmark';
import {PublicCategories} from './public-categories';

export function ToolsHeader({active}:{active:ToolId|'ads'}){
 return <header className="tool-topbar shared-tools-header">
  <BrandHomeLink className="tool-brand"/>
  <span className="shared-tools-note">브랜드의 다음을<br/>함께 만듭니다.</span>
  <PublicCategories active={active==='survey'?'about':active}/>
  <MemberMenu/>
 </header>;
}
