const validId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function createLedger(db, now=Date.now) {
 return {
  async retryCursor() {
   const row=await db.prepare('SELECT cursor FROM deletion_retry_cursor WHERE singleton=1').first();
   if(!row||(row.cursor!==null&&!validId(row.cursor)))throw Error('invalid_cursor');
   return row.cursor;
  },
  async setRetryCursor({cursor}) {
   if(cursor!==null&&!validId(cursor))throw Error('invalid_cursor');
   const result=await db.prepare('UPDATE deletion_retry_cursor SET cursor=? WHERE singleton=1').bind(cursor).run();
   if(Number(result?.meta?.changes)!==1)throw Error('cursor_unavailable');
   return cursor;
  },
  async listPending({limit,after}) {
   if(!Number.isInteger(limit)||limit<1||limit>100||(after!==null&&!validId(after)))throw Error('invalid_request');
   const result=await db.prepare('SELECT request_id,subject_id FROM deletion_intents WHERE completed_at IS NULL AND (? IS NULL OR request_id>?) ORDER BY request_id LIMIT ?').bind(after,after,limit).all();
   if(!Array.isArray(result?.results))throw Error('ledger_unavailable');
   return result.results;
  },
  async findBySubject({subjectId}) {
   if(!validId(subjectId)) throw Error('invalid_request');
   return await db.prepare('SELECT request_id,subject_id,actor_id,created_at,completed_at FROM deletion_intents WHERE subject_id=?').bind(subjectId).first();
  },
  async record({requestId,subjectId,actorId}) {
   if (![requestId,subjectId,actorId].every(validId)) throw Error('invalid_request');
   const t=now(); if(!Number.isSafeInteger(t)||t<0) throw Error('invalid_clock');
   await db.prepare('INSERT INTO deletion_intents(request_id,subject_id,actor_id,created_at) VALUES(?,?,?,?) ON CONFLICT(request_id) DO NOTHING').bind(requestId,subjectId,actorId,t).run();
   const row=await db.prepare('SELECT request_id,subject_id,actor_id,created_at,completed_at FROM deletion_intents WHERE request_id=?').bind(requestId).first();
   if(!row||row.subject_id!==subjectId||row.actor_id!==actorId) throw Error('intent_conflict');
   return row;
  },
  async complete({requestId,subjectId}) {
   if(![requestId,subjectId].every(validId)) throw Error('invalid_request');
   const t=now(); if(!Number.isSafeInteger(t)||t<0) throw Error('invalid_clock');
   await db.prepare('UPDATE deletion_intents SET completed_at=? WHERE request_id=? AND subject_id=? AND completed_at IS NULL AND created_at<=?').bind(t,requestId,subjectId,t).run();
   const row=await db.prepare('SELECT request_id,subject_id,actor_id,created_at,completed_at FROM deletion_intents WHERE request_id=?').bind(requestId).first();
   if(!row||row.subject_id!==subjectId||row.completed_at==null) throw Error('intent_not_completed');
   return row;
  }
 };
}
