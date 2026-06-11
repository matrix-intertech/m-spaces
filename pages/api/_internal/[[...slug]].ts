import type { NextApiRequest, NextApiResponse } from "next";

process.env.MATRIX_EMBEDDED_BACKEND = "1";

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

function bodyPayloadForProxy(req: NextApiRequest, rawBody: Buffer): string | Buffer | Record<string, unknown> {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  const text = rawBody.toString("utf8");

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return text;
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }

  if (contentType.startsWith("text/")) {
    return text;
  }

  return rawBody;
}

function requestPayloadPreview(req: NextApiRequest, rawBody?: Buffer) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!rawBody || rawBody.length === 0) return null;
  if (
    contentType.includes("application/json") ||
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.startsWith("text/")
  ) {
    return rawBody.toString("utf8").slice(0, 2000);
  }
  return `[binary:${rawBody.length}]`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rewrittenUrl = (req.url ?? "/").replace(/^\/api\/_internal/, "") || "/";
  const method = String(req.method || "GET").toLowerCase();
  let rawBody: Buffer | undefined;

  try {
    // Load the backend bridge lazily so module-resolution/runtime failures are
    // surfaced as JSON from this handler instead of collapsing the whole Next
    // API route into the generic Vercel 500 page.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serverApp = require("../../../server/server");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const supertest = require("supertest");
    const proxyRequest = supertest(serverApp)[method](rewrittenUrl);
    copyHeadersToProxy(proxyRequest, req);

    if (!["get", "head"].includes(method)) {
      rawBody = await readRawBody(req);
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
  } catch (error) {
    console.error("[Internal API Bridge] Request failed:", {
      method: req.method,
      originalUrl: req.url,
      rewrittenUrl,
      payloadPreview: requestPayloadPreview(req, rawBody),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return res.status(500).json({
      success: false,
      error: "Internal API bridge failure",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
