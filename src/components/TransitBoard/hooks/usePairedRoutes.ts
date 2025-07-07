import { useMemo } from 'react';

/**
 * Map of route pairs (e.g., 2A ↔ 2B)
 */
export const ROUTE_PAIRS: Record<string, string> = {};

export type Direction = 'northbound' | 'southbound' | 'inbound' | 'outbound';

/**
 * Infer direction for supported routes (e.g., 8A/8B and 400).
 */
export function inferDirection(routeId: string, headsign: string): Direction | undefined {
  // 8A/8B specific patterns
  if (routeId === '8A' || routeId === '8B') {
    if (/to Georgian College/i.test(headsign)) return 'northbound';
    if (/to Park Place|to Downtown Barrie Terminal/i.test(headsign)) return 'southbound';
  }

  // Route 400 patterns – uses "north" / "south" semantics or common termini
  if (routeId === '400') {
    if (/north|georgian mall/i.test(headsign)) return 'northbound';
    if (/south|park place|downtown barrie terminal/i.test(headsign)) return 'southbound';
  }

  // Generic A/B rule (excluding 8A/8B handled above)
  if (/A$/i.test(routeId) || routeId.includes('A')) return 'northbound';
  if (/B$/i.test(routeId) || routeId.includes('B')) return 'southbound';
  return undefined;
}

// Backward compatibility: export old name alias
export const infer8Direction = inferDirection;

/**
 * Tiny hook that just exposes memoised helpers so consumers can `import { ROUTE_PAIRS }` directly
 */
export function usePairedRoutes() {
  return useMemo(() => ({ ROUTE_PAIRS, inferDirection }), []);
} 