/**
 * Enhanced feature flag system for Launchpad security
 * Provides granular control over feature availability
 */

import { isLaunchpadEnabled, getLaunchpadMode } from "@/lib/env";
import { SafeLogger } from "@/lib/security";

/**
 * Launchpad feature flags (granular control)
 */
export interface LaunchpadFeatures {
  /** Core launchpad functionality */
  enabled: boolean;
  
  /** Authentication features (PR1) */
  auth: {
    siws: boolean;           // Sign-in with Solana
    sessions: boolean;       // Session management
  };
  
  /** Verification features (PR2-3) */
  verification: {
    proofPack: boolean;      // ProofPack validation
    onChain: boolean;        // On-chain verification
    scoring: boolean;        // Score engine
  };
  
  /** Attestation features (PR4) */
  attestation: {
    signing: boolean;        // Signed attestations
    snapshots: boolean;      // Blockchain snapshots
  };
  
  /** Storage features (PR5) */
  storage: {
    persistence: boolean;    // KV storage
    rateLimit: boolean;      // Rate limiting
    idempotency: boolean;    // Idempotency keys
  };
  
  /** Monitoring features (PR6) */
  monitoring: {
    webhooks: boolean;       // Revocation webhooks
    alerts: boolean;         // Security alerts
  };
}

/**
 * Get current feature configuration based on environment
 */
export function getLaunchpadFeatures(): LaunchpadFeatures {
  const enabled = isLaunchpadEnabled();
  const mode = getLaunchpadMode();
  
  // PR0: Only basic structure, no actual features enabled
  const features: LaunchpadFeatures = {
    enabled,
    
    auth: {
      siws: false,      // PR1: Not implemented yet
      sessions: false,  // PR1: Not implemented yet  
    },
    
    verification: {
      proofPack: false,   // PR2: Not implemented yet
      onChain: false,     // PR3: Not implemented yet  
      scoring: false,     // PR3: Not implemented yet
    },
    
    attestation: {
      signing: false,     // PR4: Not implemented yet
      snapshots: false,   // PR4: Not implemented yet
    },
    
    storage: {
      persistence: false,  // PR5: Not implemented yet
      rateLimit: false,    // PR5: Not implemented yet (basic rate limit in PR0)
      idempotency: false,  // PR5: Not implemented yet
    },
    
    monitoring: {
      webhooks: false,    // PR6: Not implemented yet  
      alerts: false,      // PR6: Not implemented yet
    },
  };
  
  SafeLogger.debug("Launchpad features evaluated", {
    enabled,
    mode,
    availableFeatures: Object.keys(features).filter(key => 
      key !== 'enabled' && 
      Object.values(features[key as keyof Omit<LaunchpadFeatures, 'enabled'>]).some(Boolean)
    ),
  });
  
  return features;
}

/**
 * Check if specific feature is available
 */
export function isFeatureAvailable(
  category: keyof Omit<LaunchpadFeatures, 'enabled'>,
  feature: string
): boolean {
  const features = getLaunchpadFeatures();
  
  if (!features.enabled) return false;
  
  const categoryFeatures = features[category] as Record<string, boolean>;
  return categoryFeatures[feature] === true;
}

/**
 * Require feature or throw error (for endpoint guards)
 */
export function requireFeature(
  category: keyof Omit<LaunchpadFeatures, 'enabled'>,
  feature: string,
  requestId?: string
): void {
  if (!isFeatureAvailable(category, feature)) {
    SafeLogger.warn("Feature not available", { 
      category, 
      feature, 
      requestId 
    });
    
    throw new Error(`Feature ${category}.${feature} is not available`);
  }
}

/**
 * Get feature availability summary for API responses
 */
export function getFeatureSummary(): {
  enabled: boolean;
  availableFeatures: string[];
  upcomingFeatures: string[];
} {
  const features = getLaunchpadFeatures();
  
  const availableFeatures: string[] = [];
  const upcomingFeatures: string[] = [];
  
  // Check each category
  Object.entries(features).forEach(([category, categoryFeatures]) => {
    if (category === 'enabled') return;
    
    Object.entries(categoryFeatures as Record<string, boolean>).forEach(([feature, available]) => {
      const featureName = `${category}.${feature}`;
      
      if (available) {
        availableFeatures.push(featureName);
      } else {
        upcomingFeatures.push(featureName);
      }
    });
  });
  
  return {
    enabled: features.enabled,
    availableFeatures,
    upcomingFeatures,
  };
}