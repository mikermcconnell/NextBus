import { useCallback, useMemo } from 'react';
import { Direction, infer8Direction } from './usePairedRoutes';
import { RoutePairingService } from '@/services/gtfs/routePairing';
import { GTFSFeedMessage } from '@/types/gtfs';
import { APP_CONFIG } from '@/config/app';

export interface CombinedArrival {
  routeId: string;
  tripId: string;
  arrivalTime: number;
  delay: number;
  stopCode: string;
  stopName: string;
  platform?: string | number;
  isRealtime: boolean;
  gtfsTripId?: string;
  direction?: Direction;
  pairedEstimate?: boolean;
}

interface Params {
  stopCodes: string[];
  stopNames: Record<string, string>;
  staticData: any;
  realtimeFeed: GTFSFeedMessage | null;
  lastGlobalUpdate: Date | null;
}

export function useStopProcessing({ stopCodes, stopNames, staticData, realtimeFeed, lastGlobalUpdate }: Params) {
  /**
   * Process a single stopCode → arrivals
   */
  const processStop = useCallback(
    (stopCode: string): CombinedArrival[] => {
      if (!staticData) return [];
      const stopInfo = staticData.stops.find((s: any) => s.stop_code === stopCode);
      if (!stopInfo) return [];
      const stopId = stopInfo.stop_id;
      const stopName = stopNames[stopCode] || stopInfo.stop_name || 'Unknown Stop';
      const now = Date.now();

      const staticArr: CombinedArrival[] = [];
      const rtArr: CombinedArrival[] = [];

      // Build static arrivals (same as original logic)
      const stopTimes = staticData.stopTimes?.filter((st: any) => st.stop_id === stopId) || [];
      stopTimes.forEach((st: any) => {
        const tripInfo = staticData.trips.find((t: any) => t.trip_id === st.trip_id);
        if (!tripInfo) return;
        const routeInfo = staticData.routes.find((r: any) => r.route_id === tripInfo.route_id);
        const routeShort = routeInfo?.route_short_name || tripInfo.route_id;
        const headsign = tripInfo.trip_headsign || 'Unknown';
        const timeStr = st.arrival_time || st.departure_time;
        if (!timeStr) return;
        const [h, m, s] = timeStr.split(':').map(Number);
        const sched = new Date();
        sched.setHours(h, m, s, 0);
        if (h >= 24) {
          sched.setHours(h - 24, m, s, 0);
          sched.setDate(sched.getDate() + 1);
        }
        if (sched.getTime() < now) sched.setDate(sched.getDate() + 1);
        const diffMin = Math.floor((sched.getTime() - now) / 60000);
        if (diffMin < -1 || diffMin > APP_CONFIG.MAX_ARRIVALS_WINDOW) return;

        let direction: Direction | undefined;
        if (routeShort === '8A' || routeShort === '8B') {
          direction = infer8Direction(routeShort, headsign);
        } else if (routeShort === '400') {
          direction = infer8Direction(routeShort, headsign); // covers 400
        } else if (/A/i.test(routeShort)) {
          direction = 'northbound';
        } else if (/B/i.test(routeShort)) {
          direction = 'southbound';
        }

        staticArr.push({
          routeId: routeShort,
          tripId: headsign,
          arrivalTime: sched.getTime(),
          delay: 0,
          stopCode,
          stopName,
          platform: st.platform_code || undefined,
          isRealtime: false,
          gtfsTripId: tripInfo.trip_id,
          direction,
          pairedEstimate: false,
        });
      });

      // Real-time arrivals
      if (realtimeFeed?.entity) {
        realtimeFeed.entity.forEach((entity: any) => {
          if (!entity.tripUpdate?.stopTimeUpdate) return;
          entity.tripUpdate.stopTimeUpdate.forEach((stu: any) => {
            if (stu.stopId !== stopId) return;
            const arrT = stu.arrival?.time || stu.departure?.time;
            if (!arrT) return;
            const arrMs = arrT * 1000;
            const diff = Math.floor((arrMs - now) / 60000);
            if (diff < -1 || diff > APP_CONFIG.MAX_ARRIVALS_WINDOW) return;
            const gtfsRouteId = entity.tripUpdate.trip?.routeId || 'Unknown';
            const gtfsTripId = entity.tripUpdate.trip?.tripId || 'Unknown';
            const routeInfo = staticData.routes.find((r: any) => r.route_id === gtfsRouteId);
            const routeShort = routeInfo?.route_short_name || gtfsRouteId;
            const tripInfo = staticData.trips.find((t: any) => t.trip_id === gtfsTripId);
            const headsign = tripInfo?.trip_headsign || 'Unknown';
            let direction: Direction | undefined;
            if (routeShort === '8A' || routeShort === '8B') {
              direction = infer8Direction(routeShort, headsign);
            } else if (routeShort === '400') {
              direction = infer8Direction(routeShort, headsign);
            } else if (/A/i.test(routeShort)) {
              direction = 'northbound';
            } else if (/B/i.test(routeShort)) {
              direction = 'southbound';
            }
            const delay = stu.arrival?.delay || stu.departure?.delay || 0;
            rtArr.push({
              routeId: routeShort,
              tripId: headsign,
              arrivalTime: arrMs,
              delay,
              stopCode,
              stopName,
              platform: stu.arrival?.platform || undefined,
              isRealtime: true,
              gtfsTripId,
              direction,
              pairedEstimate: false,
            });
          });
        });
      }

      // Merge (prefer realtime) same logic as before
      type Key = string;
      const makeKey = (a: CombinedArrival): Key => `${a.routeId}|${a.tripId}|${a.stopCode}`;
      const grouped: Record<Key, CombinedArrival> = {};
      rtArr.forEach((rt) => {
        const k = makeKey(rt);
        if (!grouped[k] || rt.arrivalTime < grouped[k].arrivalTime) grouped[k] = rt;
      });
      staticArr.forEach((st) => {
        const k = makeKey(st);
        if (!grouped[k] || (!grouped[k].isRealtime && st.arrivalTime < grouped[k].arrivalTime)) {
          grouped[k] = st;
        }
      });

      // Pairing substitution
      staticArr.forEach((st) => {
        const k = makeKey(st);
        if (grouped[k] && grouped[k].isRealtime) return;
        const pairRoute = RoutePairingService.findPairedRoute(st.routeId);
        if (!pairRoute) return;
        let paired: CombinedArrival | undefined;
        if ((st.routeId === '8A' || st.routeId === '8B' || st.routeId === '400') && st.direction) {
          const opp = st.direction === 'northbound' ? 'southbound' : 'northbound';
          paired = rtArr.find((rt) => rt.routeId === pairRoute && rt.stopCode === st.stopCode && rt.direction === opp);
        }
        if (!paired) {
          paired = rtArr.find((rt) => {
            if (rt.routeId !== pairRoute || rt.stopCode !== st.stopCode) return false;
            // If we have direction info, ensure it matches to avoid using same RT for opposite direction
            if (st.direction) {
              return rt.direction === st.direction;
            }
            return true;
          });
        }
        if (paired) {
          grouped[k] = { ...st, arrivalTime: paired.arrivalTime, delay: paired.delay, isRealtime: true, pairedEstimate: true };
        }
      });

      return Object.values(grouped).sort((a, b) => a.arrivalTime - b.arrivalTime);
    },
    [staticData, realtimeFeed, stopNames]
  );

  const combinedArrivals = useMemo(() => {
    const all: CombinedArrival[] = [];
    stopCodes.forEach((sc) => {
      all.push(...processStop(sc));
    });

    // final sort: at platform first then soonest
    const nowMs = Date.now();
    return all.sort((a, b) => {
      const diffA = Math.floor((a.arrivalTime - nowMs) / 60000);
      const diffB = Math.floor((b.arrivalTime - nowMs) / 60000);
      const aPlat = a.isRealtime && diffA >= -2 && diffA <= 0;
      const bPlat = b.isRealtime && diffB >= -2 && diffB <= 0;
      if (aPlat && !bPlat) return -1;
      if (!aPlat && bPlat) return 1;
      return a.arrivalTime - b.arrivalTime;
    });
  }, [stopCodes, processStop]);

  return { combinedArrivals };
} 