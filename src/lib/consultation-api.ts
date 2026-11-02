export function consultationEndpoint(){
  const configured=process.env.NEXT_PUBLIC_CONSULTATION_API_URL;
  if(configured)return configured;
  const keywords=process.env.NEXT_PUBLIC_KEYWORD_API_URL||'https://kitsnode.vercel.app/api/keywords';
  return new URL('consultations',keywords).href;
}
