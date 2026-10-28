import { createKeywordHandler } from "../src/handler.mjs";
import { sendKeywordResponse } from "../src/node-adapter.mjs";
const handle = createKeywordHandler();
export default async function handler(req, res) {
  return sendKeywordResponse(req, res, handle);
}
