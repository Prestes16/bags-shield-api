import { VercelRequest, VercelResponse } from '@vercel/node';

// Conteúdo simulado para o arquivo assetlinks.ts
// Nota: O runtime será herdado do package.json (nodejs22.x)
export default (request: VercelRequest, response: VercelResponse) => {
  // Configura os cabeçalhos para o JSON (necessário para assetlinks)
  response.setHeader('Content-Type', 'application/json');

  // Substitua este objeto pelo JSON assetlinks.json real do seu projeto
  const assetLinksJson = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.bags_shield.app",
        sha256_cert_fingerprints: ["SUA_CHAVE_SHA_256_AQUI"]
      }
    }
  ];

  response.status(200).send(JSON.stringify(assetLinksJson, null, 2));
};