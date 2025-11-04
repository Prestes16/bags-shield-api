import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { runtime: 'nodejs' };

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "app.bagsshield",
        sha256_cert_fingerprints: ["97:D3:90:DE:36:9B:23:85:38:1E:2F:66:6D:0A:5D:46:B6:8D:94:CC:08:9F:E2:38:3B:CA:FB:84:19:7D:06:A5"]
      }
    }
  ];
  res.status(200).send(JSON.stringify(body));
}