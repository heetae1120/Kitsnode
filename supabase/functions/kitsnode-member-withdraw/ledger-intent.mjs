import {createLedgerClient} from './ledger/client.mjs';
// The independent ledger authenticates this server via a secret. A self
// withdrawal records the verified subject as the initiating actor.
export function createSelfIntent({origin,token,fetchImpl=fetch,randomUUID=()=>crypto.randomUUID()}){
 const ledger=createLedgerClient({origin,token,fetchImpl});
 return {
  async begin(subject){
   let row=await ledger.lookupIntent({userId:subject});
   if(!row){
    const requestId=randomUUID();
    try{await ledger.recordIntent({userId:subject,actorId:subject,requestId})}catch{}
    // Read after write also resolves concurrent first requests safely.
    row=await ledger.lookupIntent({userId:subject});
   }
   if(!row||row.userId!==subject)return null;
   return {subject,requestId:row.requestId,completed:row.completed,durable:true};
  },
  async complete({subject,requestId}){return ledger.completeIntent({userId:subject,requestId})},
  async pending(limit=25,after=null){return ledger.pending(limit,after)},
  async retryCursor(){return ledger.retryCursor()},
  async setRetryCursor(cursor){return ledger.setRetryCursor(cursor)}
 };
}
