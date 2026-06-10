import type { NextApiRequest, NextApiResponse } from "next";

process.env.MATRIX_EMBEDDED_BACKEND = "1";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serverApp = require("../../../server/server");

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true
  }
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const rewrittenUrl = (req.url ?? "/").replace(/^\/api\/_internal/, "") || "/";

  req.url = rewrittenUrl;
  (req as NextApiRequest & { originalUrl?: string; baseUrl?: string }).originalUrl = rewrittenUrl;
  (req as NextApiRequest & { originalUrl?: string; baseUrl?: string }).baseUrl = "";

  return serverApp(req, res);
}
