export function consultationEndpoint(){
  if(typeof window!=='undefined'){
    const query=new URLSearchParams(window.location.search);
    if(query.has('kits_editor')||query.has('kits_preview'))throw new Error('편집 미리보기에서는 상담을 접수하지 않습니다. 실제 페이지에서 신청해 주세요.');
  }
  const configured=process.env.NEXT_PUBLIC_CONSULTATION_API_URL;
  if(configured)return configured;
  const keywords=process.env.NEXT_PUBLIC_KEYWORD_API_URL||'https://kitsnode.vercel.app/api/keywords';
  return new URL('consultations',keywords).href;
}
