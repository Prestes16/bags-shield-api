/**
 * Server-Side Request Forgery (SSRF) protection utilities
 * Implements strict URL validation to prevent internal network access
 */

/**
 * SSRF protection configuration
 */
export interface SSRFConfig {
  allowedSchemes: string[];
  blockedHosts: string[];
  allowPrivateIPs: boolean;
  allowIPAddresses: boolean;
  maxUrlLength: number;
  allowedPorts: number[] | null; // null = all ports allowed
}

/**
 * Default secure configuration
 */
export const DEFAULT_SSRF_CONFIG: SSRFConfig = {
  allowedSchemes: ['https'], // Only HTTPS
  blockedHosts: [
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    'metadata.google.internal',
    'instance-data',
    '169.254.169.254', // AWS/GCP metadata
  ],
  allowPrivateIPs: false,
  allowIPAddresses: false,
  maxUrlLength: 2048,
  allowedPorts: null, // Allow all ports for HTTPS (443 implied)
};

/**
 * SSRF validation result
 */
export interface SSRFValidationResult {
  allowed: boolean;
  reason?: string;
  normalizedUrl?: string;
  metadata?: {
    scheme: string;
    hostname: string;
    port: number | null;
    isPrivateIP: boolean;
    isIPAddress: boolean;
  };
}

/**
 * SSRF protection implementation
 */
export class SSRFProtection {
  private config: SSRFConfig;

  constructor(config: SSRFConfig = DEFAULT_SSRF_CONFIG) {
    this.config = { ...config };
  }

  /**
   * Check if hostname is a private IP address
   */
  private isPrivateIP(hostname: string): boolean {
    // IPv4 private ranges
    const ipv4Patterns = [
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^169\.254\./, // 169.254.0.0/16 (link-local)
      /^127\./, // 127.0.0.0/8 (loopback)
    ];

    // IPv6 private ranges
    const ipv6Patterns = [
      /^::1$/, // IPv6 loopback
      /^fe80:/i, // fe80::/10 (link-local)
      /^fc00:/i, // fc00::/7 (unique local)
      /^fd00:/i, // fd00::/8 (unique local)
    ];

    const lower = hostname.toLowerCase();
    
    return ipv4Patterns.some(pattern => pattern.test(lower)) ||
           ipv6Patterns.some(pattern => pattern.test(lower));
  }

  /**
   * Check if hostname is an IP address
   */
  private isIPAddress(hostname: string): boolean {
    // IPv4 pattern
    const ipv4Pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    
    // IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;
    
    return ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname);
  }

  /**
   * Validate URL against SSRF rules
   */
  validateUrl(input: string): SSRFValidationResult {
    // Basic input validation
    if (!input || typeof input !== 'string') {
      return { allowed: false, reason: 'Invalid URL input' };
    }

    if (input.length > this.config.maxUrlLength) {
      return { allowed: false, reason: `URL exceeds maximum length (${this.config.maxUrlLength})` };
    }

    // Parse URL
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return { allowed: false, reason: 'Malformed URL' };
    }

    const scheme = url.protocol.slice(0, -1); // Remove trailing colon
    const hostname = url.hostname.toLowerCase();
    const port = url.port ? parseInt(url.port, 10) : null;

    // Check allowed schemes
    if (!this.config.allowedSchemes.includes(scheme)) {
      return { 
        allowed: false, 
        reason: `Scheme '${scheme}' not allowed. Allowed: ${this.config.allowedSchemes.join(', ')}` 
      };
    }

    // Check blocked hosts
    if (this.config.blockedHosts.includes(hostname)) {
      return { allowed: false, reason: `Host '${hostname}' is blocked` };
    }

    // Check IP address restrictions
    const isIP = this.isIPAddress(hostname);
    if (isIP && !this.config.allowIPAddresses) {
      return { allowed: false, reason: 'IP addresses not allowed, use domain names' };
    }

    // Check private IP restrictions
    const isPrivate = this.isPrivateIP(hostname);
    if (isPrivate && !this.config.allowPrivateIPs) {
      return { allowed: false, reason: 'Private IP addresses not allowed' };
    }

    // Check port restrictions
    if (this.config.allowedPorts && port && !this.config.allowedPorts.includes(port)) {
      return { 
        allowed: false, 
        reason: `Port ${port} not allowed. Allowed: ${this.config.allowedPorts.join(', ')}` 
      };
    }

    // URL is allowed, normalize it
    try {
      // Remove fragment and normalize
      url.hash = '';
      const normalizedUrl = url.toString();

      return {
        allowed: true,
        normalizedUrl,
        metadata: {
          scheme,
          hostname,
          port,
          isPrivateIP: isPrivate,
          isIPAddress: isIP,
        }
      };
    } catch {
      return { allowed: false, reason: 'URL normalization failed' };
    }
  }

  /**
   * Create a fetch wrapper with SSRF protection
   */
  createSecureFetch() {
    return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      
      const validation = this.validateUrl(url);
      
      if (!validation.allowed) {
        throw new Error(`SSRF protection: ${validation.reason}`);
      }

      // Use normalized URL for the actual fetch
      return fetch(validation.normalizedUrl!, init);
    };
  }
}

/**
 * Default SSRF protection instance
 */
export const defaultSSRFProtection = new SSRFProtection();

/**
 * Convenience function for URL validation
 */
export function validateUrlSSRF(url: string, config?: Partial<SSRFConfig>): SSRFValidationResult {
  const protection = config ? new SSRFProtection({ ...DEFAULT_SSRF_CONFIG, ...config }) : defaultSSRFProtection;
  return protection.validateUrl(url);
}

/**
 * Secure fetch with default SSRF protection
 */
export function secureFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const secureFunc = defaultSSRFProtection.createSecureFetch();
  return secureFunc(input, init);
}