import { VercelRequest, VercelResponse } from '@vercel/node';

// Esta é a função que a Vercel irá executar
export default (request: VercelRequest, response: VercelResponse) => {
  const message = `API bags/ping em execução!`;
  
  // Confirma que a Vercel está processando o TypeScript
  response.status(200).json({ 
    success: true, 
    data: { message: message, method: request.method },
    meta: { ts: Date.now() }
  });
};