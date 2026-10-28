export async function sendKeywordResponse(req, res, handler) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(","));
  }
  const request = new Request(new URL(req.url || "/", "http://localhost"), {
    method: req.method || "GET",
    headers,
  });
  const clientId = (
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "anonymous"
  )
    .toString()
    .split(",")[0]
    .trim();
  const result = await handler(request, process.env, clientId);
  res.statusCode = result.status;
  result.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(await result.text());
}
