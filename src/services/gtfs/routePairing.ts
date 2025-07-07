import type { CombinedArrival } from '@/components/TransitBoard/hooks/useStopProcessing';

// Pairing logic disabled – leave empty to prevent any mirroring across directions/routes
export const ROUTE_PAIRS: Record<string, string> = {};

export class RoutePairingService {
  static findPairedRoute(routeId: string): string | undefined {
    return ROUTE_PAIRS[routeId];
  }

  /**
   * Given a static arrival that lacks real-time data, attempt to substitute an
   * estimate from a paired direction/route.
   */
  static generatePairedEstimate(
    staticArrival: CombinedArrival,
    realtimeArrivals: CombinedArrival[],
  ): CombinedArrival | undefined {
    // Pairing disabled – always return undefined
    return undefined;
  }
} 