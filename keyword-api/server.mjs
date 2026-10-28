import { createServer } from "node:http";
import { createKeywordHandler } from "./src/handler.mjs";
import { sendKeywordResponse } from "./src/node-adapter.mjs";
const handle = createKeywordHandler();
const port = Number(process.env.KEYWORD_API_PORT || 8787);
createServer(async (req, res) => {
  try {
    if (
      new URL(req.url || "/", "http://localhost").pathname !== "/api/keywords"
    ) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    await sendKeywordResponse(req, res, handle);
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "요청을 처리하지 못했습니다." }));
  }
}).listen(port, process.env.KEYWORD_API_HOST || "127.0.0.1", () =>
  console.log(
    `KITS keyword API listening on port ${port}. Credential values are not logged.`,
  ),
);
