// Limit actual response bytes while streaming, before decoding or parsing.
export async function readLimitedJson(response, limit = 2_000_000) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('missing_body');
  const chunks=[];let size=0;
  try {
    for (;;) {
      const {done,value}=await reader.read();
      if (done) break;
      size+=value.byteLength;
      if(size>limit) throw new Error('body_too_large');
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } finally { try {await reader.cancel();} catch {} reader.releaseLock(); }
}
