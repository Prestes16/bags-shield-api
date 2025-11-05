import { BAGS_API_BASE, BAGS_API_KEY } from './constants';

// Classe de erro customizada para facilitar o tratamento de status HTTP não-2xx ou erros de rede
export class UpstreamError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

export async function bagsFetch<T>(path: string, options: RequestInit = {}): Promise<{ data: T, res: Response }> {
  // Constrói a URL completa
  const url = new URL(path.replace(/^\//,''), BAGS_API_BASE).toString();
  
  if (!BAGS_API_KEY) {
      throw new UpstreamError('BAGS_API_KEY is not configured in Vercel environment variables.', 500);
  }

  const defaultHeaders = {
    // A API Bags usa x-api-key
    'x-api-key': BAGS_API_KEY,
    // Garante que o tipo de conteúdo padrão seja JSON, se não for sobrescrito
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
  
    // Se a resposta for 4xx ou 5xx
    if (!response.ok) {
      let errorDetails: string = response.statusText;
      try {
          // Tenta ler o corpo do erro como JSON para pegar a mensagem detalhada
          const errorBody = await response.json();
          errorDetails = errorBody.error || errorBody.message || errorDetails;
      } catch (e) {
          // Se falhar, usa o statusText padrão
      }
      
      // Lança o UpstreamError com o status correto
      throw new UpstreamError(`Bags API Error: ${response.status} ${errorDetails}`, response.status); 
    }
  
    // Tenta ler o corpo da resposta como JSON
    const data: T = await response.json();
    return { data, res: response };

  } catch (e: any) {
    if (e instanceof UpstreamError) {
      throw e;
    }
    
    // Captura erros de rede (DNS, timeout, etc.)
    if (e.name === 'FetchError' || e.name === 'TypeError') {
         throw new UpstreamError(`Network Error: Failed to connect to Bags API. ${e.message}`, 0);
    }

    // Lança qualquer outro erro desconhecido como 500
    throw new UpstreamError(`Unexpected Error in bagsFetch: ${e.message}`, 500);
  }
}