import Link from 'next/link';
export function RetiredTool(){return <main style={{minHeight:'65vh',padding:'140px 8vw',background:'#0b0b0b',color:'#f5f2eb'}}><h1>이 도구는 운영을 종료했습니다.</h1><p>상품 진단에서 판매 조건과 수익 구조를 확인해 주세요.</p><Link href="/tools/" style={{color:'#ff5a1f'}}>상품 진단으로 이동 →</Link></main>;}
export default RetiredTool;
