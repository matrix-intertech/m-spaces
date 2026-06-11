import type { NextApiRequest, NextApiResponse } from "next";

process.env.MATRIX_EMBEDDED_BACKEND = "1";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serverApp = require("../../../server/server");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const supertest = require("supertest");

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true
  }
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function copyHeadersToProxy(proxyRequest: { set: (key: string, value: string) => unknown }, req: NextApiRequest) {
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    if (["host", "connection", "content-length"].includes(key.toLowerCase())) continue;
    proxyRequest.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
}

function bodyPayloadForProxy(req: NextApiRequest, rawBody: Buffer): string | Buffer {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (
    contentType.includes("application/json") ||
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.startsWith("text/")
  ) {
    return rawBody.toString("utf8");
  }
  return rawBody;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rewrittenUrl = (req.url ?? "/").replace(/^\/api\/_internal/, "") || "/";
  const method = String(req.method || "GET").toLowerCase();
  const proxyRequest = supertest(serverApp)[method](rewrittenUrl);

  copyHeadersToProxy(proxyRequest, req);

  if (!["get", "head"].includes(method)) {
    const rawBody = await readRawBody(req);
    if (rawBody.length > 0) {
      proxyRequest.send(bodyPayloadForProxy(req, rawBody));
    }
  }

  const response = await proxyRequest.buffer(true);

  if (response.headers["set-cookie"]) {
    res.setHeader("Set-Cookie", response.headers["set-cookie"]);
  }

  if (response.headers.location) {
    res.setHeader("Location", response.headers.location);
  }

  if (response.headers["content-type"]) {
    res.setHeader("Content-Type", response.headers["content-type"]);
  }

  res.status(response.status);

  if (Buffer.isBuffer(response.body) && response.body.length > 0) {
    return res.send(response.body);
  }

  if (typeof response.text === "string" && response.text.length > 0) {
    return res.send(response.text);
  }

  if (response.body && Object.keys(response.body).length > 0) {
    return res.json(response.body);
  }

  return res.end();
}
