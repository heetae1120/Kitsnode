// Replacement deployment: always unavailable, no authentication or dependencies.
export function disabled(){return new Response(null,{status:410,headers:{'Cache-Control':'no-store'}})}
