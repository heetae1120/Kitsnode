// Pure read-only proposal for shopping product creatives. No write, scheduling,
// account activation, or provider capability is exposed by this module.
const id=(v,p)=>typeof v==='string' && new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
const integer=v=>Number.isSafeInteger(v);
const customer=v=>(typeof v==='string'||Number.isSafeInteger(v))&&/^[1-9][0-9]{0,15}$/.test(String(v))?String(v):null;
const unavailable=reason=>({status:'unavailable',reason});
const skipped=reason=>({status:'skipped',reason});

// Illustrative arithmetic only. Unlike an execution-ready proposal it may show
// a hypothetical value for a paused group; blockers remain explicit and no
// claim is made that the value can be sent to Naver or will attain any rank.
export function illustrateShoppingGroupBid({connection,actorId,campaign,group,products,productsComplete,referenceBid,minBid,maxBid,maxChange,nowMs,fetchedAtMs,maxAgeMs=300000}={}) {
 if(!connection||connection.status!=='read_connected'||!actorId||connection.userId!==actorId||!customer(connection.customerId))return unavailable('connection_required');
 if(!campaign||!group||!id(campaign.nccCampaignId,'cmp')||!id(group.nccAdgroupId,'grp')||group.nccCampaignId!==campaign.nccCampaignId||[campaign.customerId,group.customerId].some(v=>customer(v)!==customer(connection.customerId)))return unavailable('target_mismatch');
 if(![nowMs,fetchedAtMs,maxAgeMs].every(integer)||maxAgeMs<=0||fetchedAtMs>nowMs||nowMs-fetchedAtMs>maxAgeMs)return unavailable('stale_data');
 if(campaign.campaignTp!=='SHOPPING'||group.adgroupType!=='SHOPPING')return skipped('unsupported_ad_type');
 const currentBid=group.bidAmt;
 if(![currentBid,referenceBid,minBid,maxBid,maxChange].every(integer)||minBid<50||maxBid>100000||minBid>maxBid||maxChange<10||referenceBid<1||referenceBid>100000||[currentBid,minBid,maxBid].some(v=>v%10!==0))return unavailable('invalid_input');
 if(currentBid<minBid||currentBid>maxBid)return skipped('current_outside_bounds');
 if(!Array.isArray(products)||products.length>10000||products.some(p=>!id(p?.nccAdId,'nad')||p.nccAdgroupId!==group.nccAdgroupId||customer(p.customerId)!==customer(connection.customerId)||p.type!=='SHOPPING_PRODUCT_AD'||typeof p.adAttr?.useGroupBidAmt!=='boolean')||new Set(products.map(p=>p.nccAdId)).size!==products.length)return unavailable('product_scope_unverified');
 const blockers=[];
 if(campaign.status!=='ELIGIBLE'||campaign.userLock!==false)blockers.push('campaign_inactive');
 if(group.status!=='ELIGIBLE'||group.userLock!==false)blockers.push('adgroup_inactive');
 if(group.autobidStrategy?.isAutobidActive!==false)blockers.push(group.autobidStrategy?.isAutobidActive===true?'naver_autobid_active':'naver_autobid_unverified');
 if(productsComplete!==true)blockers.push('product_scope_unverified');
 const target=Math.max(minBid,Math.min(maxBid,Math.ceil(referenceBid/10)*10)),limit=Math.floor(maxChange/10)*10;
 return {status:'illustrative',scope:'adgroup',currentBid,referenceBid,proposedBid:currentBid+Math.max(-limit,Math.min(limit,target-currentBid)),affectedProductCount:productsComplete===true?products.filter(p=>p.adAttr.useGroupBidAmt===true).length:null,blockers,referenceSource:'manual_scenario',execution:'disabled'};
}

/**
 * referenceBid is explicitly a caller-supplied scenario, not a Naver estimate,
 * target rank, or guarantee. campaign/group/ad must be freshly obtained by a
 * trusted server for the authenticated connection. A group-bid product is not
 * converted to an individual bid, since that would change a separate setting.
 */
export function previewShoppingBid({connection,actorId,campaign,group,ad,referenceBid,minBid,maxBid,maxChange,nowMs,fetchedAtMs,maxAgeMs=300000}={}) {
 if(!connection||connection.status!=='read_connected'||!actorId||connection.userId!==actorId||!customer(connection.customerId))return unavailable('connection_required');
 if(!campaign||!group||!ad||!id(campaign.nccCampaignId,'cmp')||!id(group.nccAdgroupId,'grp')||!id(ad.nccAdId,'nad')||group.nccCampaignId!==campaign.nccCampaignId||ad.nccAdgroupId!==group.nccAdgroupId||[campaign.customerId,group.customerId,ad.customerId].some(v=>customer(v)!==customer(connection.customerId)))return unavailable('target_mismatch');
 if(![nowMs,fetchedAtMs,maxAgeMs].every(integer)||maxAgeMs<=0||fetchedAtMs>nowMs||nowMs-fetchedAtMs>maxAgeMs)return unavailable('stale_data');
 if(campaign.campaignTp!=='SHOPPING'||group.adgroupType!=='SHOPPING'||ad.type!=='SHOPPING_PRODUCT_AD')return skipped('unsupported_ad_type');
 if(campaign.status!=='ELIGIBLE'||campaign.userLock!==false)return skipped('campaign_inactive');
 if(group.status!=='ELIGIBLE'||group.userLock!==false)return skipped('adgroup_inactive');
 if(group.autobidStrategy?.isAutobidActive!==false)return skipped(group.autobidStrategy?.isAutobidActive===true?'naver_autobid_active':'naver_autobid_unverified');
 if(ad.status!=='ELIGIBLE'||ad.userLock!==false)return skipped('product_inactive');
 if(ad.adAttr?.useGroupBidAmt!==false)return skipped('group_bid');
 const currentBid=ad.adAttr?.bidAmt,increment=10;
 if(![currentBid,referenceBid,minBid,maxBid,maxChange].every(integer)||minBid<50||maxBid>100000||minBid>maxBid||maxChange<increment||referenceBid<1||referenceBid>100000||[currentBid,minBid,maxBid].some(v=>v%increment!==0))return unavailable('invalid_input');
 if(currentBid<minBid||currentBid>maxBid)return skipped('current_outside_bounds');
 const target=Math.max(minBid,Math.min(maxBid,Math.ceil(referenceBid/increment)*increment));
 const limit=Math.floor(maxChange/increment)*increment;
 const proposedBid=currentBid+Math.max(-limit,Math.min(limit,target-currentBid));
 return {status:proposedBid===currentBid?'unchanged':'proposed',currentBid,referenceBid,proposedBid,referenceSource:'manual_scenario',execution:'disabled'};
}

/** A group-bid scenario affects every product inheriting the group bid. The
 * product count must come from a complete, fresh server-side group listing. */
export function previewShoppingGroupBid({connection,actorId,campaign,group,products,productsComplete,referenceBid,minBid,maxBid,maxChange,nowMs,fetchedAtMs,maxAgeMs=300000}={}) {
 if(!connection||connection.status!=='read_connected'||!actorId||connection.userId!==actorId||!customer(connection.customerId))return unavailable('connection_required');
 if(!campaign||!group||!id(campaign.nccCampaignId,'cmp')||!id(group.nccAdgroupId,'grp')||group.nccCampaignId!==campaign.nccCampaignId||[campaign.customerId,group.customerId].some(v=>customer(v)!==customer(connection.customerId)))return unavailable('target_mismatch');
 if(![nowMs,fetchedAtMs,maxAgeMs].every(integer)||maxAgeMs<=0||fetchedAtMs>nowMs||nowMs-fetchedAtMs>maxAgeMs)return unavailable('stale_data');
 if(campaign.campaignTp!=='SHOPPING'||group.adgroupType!=='SHOPPING')return skipped('unsupported_ad_type');
 if(campaign.status!=='ELIGIBLE'||campaign.userLock!==false)return skipped('campaign_inactive');
 if(group.status!=='ELIGIBLE'||group.userLock!==false)return skipped('adgroup_inactive');
 if(group.autobidStrategy?.isAutobidActive!==false)return skipped(group.autobidStrategy?.isAutobidActive===true?'naver_autobid_active':'naver_autobid_unverified');
 if(productsComplete!==true||!Array.isArray(products)||products.length===0||products.length>10000)return unavailable('product_scope_unverified');
 if(products.some(p=>!id(p?.nccAdId,'nad')||p.nccAdgroupId!==group.nccAdgroupId||customer(p.customerId)!==customer(connection.customerId)||p.type!=='SHOPPING_PRODUCT_AD'||typeof p.adAttr?.useGroupBidAmt!=='boolean'))return unavailable('product_scope_unverified');
 const ids=new Set(products.map(p=>p.nccAdId));if(ids.size!==products.length)return unavailable('product_scope_unverified');
 const affectedProductCount=products.filter(p=>p.adAttr.useGroupBidAmt===true).length;
 if(affectedProductCount===0)return skipped('no_inheriting_products');
 const currentBid=group.bidAmt,increment=10;
 if(![currentBid,referenceBid,minBid,maxBid,maxChange].every(integer)||minBid<50||maxBid>100000||minBid>maxBid||maxChange<increment||referenceBid<1||referenceBid>100000||[currentBid,minBid,maxBid].some(v=>v%increment!==0))return unavailable('invalid_input');
 if(currentBid<minBid||currentBid>maxBid)return skipped('current_outside_bounds');
 const target=Math.max(minBid,Math.min(maxBid,Math.ceil(referenceBid/increment)*increment)),limit=Math.floor(maxChange/increment)*increment;
 const proposedBid=currentBid+Math.max(-limit,Math.min(limit,target-currentBid));
 return {status:proposedBid===currentBid?'unchanged':'proposed',scope:'adgroup',affectedProductCount,currentBid,referenceBid,proposedBid,referenceSource:'manual_scenario',execution:'disabled'};
}
