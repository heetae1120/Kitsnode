import {createShoppingAdsHandler} from '../src/shopping-ads-handler.mjs';
import {sendKeywordResponse} from '../src/node-adapter.mjs';
const handle=createShoppingAdsHandler();
export default async function handler(req,res){return sendKeywordResponse(req,res,handle);}
