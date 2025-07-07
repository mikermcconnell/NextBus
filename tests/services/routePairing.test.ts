import { RoutePairingService } from '@/services/gtfs/routePairing';
import type { CombinedArrival } from '@/components/TransitBoard/hooks/useStopProcessing';

describe('RoutePairingService', () => {
  it('should find paired route for 2A', () => {
    expect(RoutePairingService.findPairedRoute('2A')).toBe('2B');
  });

  it('should return undefined for route without pair', () => {
    expect(RoutePairingService.findPairedRoute('99')).toBeUndefined();
  });

  it('should generate paired estimate for 8A/8B opposite direction', () => {
    const staticArrival: CombinedArrival = {
      routeId: '8A',
      tripId: 'Trip to Park Place',
      arrivalTime: Date.now() + 10 * 60 * 1000,
      delay: 0,
      stopCode: '100',
      stopName: 'Test Stop',
      platform: undefined,
      isRealtime: false,
      direction: 'northbound',
      pairedEstimate: false,
    } as CombinedArrival;

    const realtimeArrivals: CombinedArrival[] = [
      {
        routeId: '8A',
        tripId: 'Trip to Georgian College',
        arrivalTime: Date.now() + 5 * 60 * 1000,
        delay: 60,
        stopCode: '100',
        stopName: 'Test Stop',
        platform: undefined,
        isRealtime: true,
        direction: 'southbound',
        pairedEstimate: false,
      } as CombinedArrival,
    ];

    const estimate = RoutePairingService.generatePairedEstimate(
      staticArrival,
      realtimeArrivals,
    );

    expect(estimate).toBeDefined();
    expect(estimate?.pairedEstimate).toBe(true);
    expect(estimate?.isRealtime).toBe(true);
    expect(estimate?.arrivalTime).toBe(realtimeArrivals[0].arrivalTime);
  });
}); 