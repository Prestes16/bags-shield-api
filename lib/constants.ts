// Define a URL base da API Bags, usando a variável de ambiente ou o default.
export const BAGS_API_BASE =
  (process.env.BAGS_API_BASE ?? 'https://public-api-v2.bags.fm/api/v1/').replace(/\/?$/, '/');

// Define a chave de API, crucial para autenticação.
export const BAGS_API_KEY = process.env.BAGS_API_KEY ?? '';

// Outras constantes podem ser adicionadas aqui
// export const GLOBAL_TIMEOUT = 15000;