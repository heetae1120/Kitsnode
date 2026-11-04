import type {Metadata} from 'next';
import Link from 'next/link';
import {ToolsHeader} from '@/components/tools-header';
import {ConsultationForm} from '@/components/health-intake';
import '../health.css';
export const metadata:Metadata={title:'브랜드 상담 | KITSNODE',description:'브랜드 기획부터 판매 준비까지 상담할 내용을 남겨주세요.'};
export default function ConsultationPage(){return <div className="finance-dashboard hc-shell"><ToolsHeader active="survey"/><main><section className="hc-card"><ConsultationForm/></section><Link href="/tools/survey/">만들고 싶은 브랜드부터 정리하기 →</Link></main></div>;}
