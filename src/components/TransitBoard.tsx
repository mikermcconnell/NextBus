'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import LoadingSpinner from './LoadingSpinner';
import ConnectionStatus from './ConnectionStatus';
import ErrorBoundary from './ErrorBoundary';
import { GTFSFeedMessage } from '@/types/gtfs';
import { extractTimestamp, formatDataAge, calculateDataAge } from '@/utils/timestamp';
import { APP_CONFIG } from '@/config/app';
import type { GTFSStop, GTFSRoute, GTFSTrip, GTFSStopTime } from '@/types/gtfs';
import type { APIResponse } from '@/types/api';
import DepartureRow from './TransitBoard/DepartureRow';
import { RoutePairingService } from '@/services/gtfs/routePairing';

// Import GTFS realtime bindings for protobuf parsing
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

interface TripUpdate {
  trip: {
    tripId: string;
    routeId: string;
  };
  stopTimeUpdate: Array<{
    stopId: string;
    arrival?: {
      time: number;
    };
    departure?: {
      time: number;
    };
  }>;
}

interface TransitBoardProps {
  stopCodes: string[];
  stopNames: Record<string, string>;
  refreshInterval: number;
}

interface StopData {
  stopCode: string;
  arrivals: Array<{
    routeId: string;
    tripId: string;
    arrivalTime: number;
    delay: number;
    stopCode: string;
    stopName: string;
    platform?: string | number;
    isRealtime: boolean;
  }>;
  error?: string;
  lastUpdate?: Date;
}

interface CombinedArrival {
  routeId: string;
  tripId: string;
  arrivalTime: number;
  delay: number;
  stopCode: string;
  stopName: string;
  platform?: string | number;
  isRealtime: boolean;
  gtfsTripId?: string; // GTFS trip ID for matching real-time vs static data
  direction?: 'northbound' | 'southbound' | 'inbound' | 'outbound'; // Direction
  pairedEstimate?: boolean; // True if this is a paired-direction estimate
}

interface GTFSStaticData {
  stops: GTFSStop[];
  routes: GTFSRoute[];
  trips: GTFSTrip[];
  stopTimes: GTFSStopTime[];
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

// Helper: infer direction for 8A/8B from trip_headsign
function infer8Direction(routeId: string, headsign: string): 'northbound' | 'southbound' | undefined {
  // Logic for 8A/8B
  if (routeId === '8A' || routeId === '8B') {
    if (/to Georgian College/i.test(headsign)) return 'northbound';
    if (/to Park Place|to Downtown Barrie Terminal/i.test(headsign)) return 'southbound';
  }

  // Logic for Route 400 (north / south)
  if (routeId === '400') {
    if (/north|georgian mall/i.test(headsign)) return 'northbound';
    if (/south|park place|downtown barrie terminal/i.test(headsign)) return 'southbound';
  }
  return undefined;
}

export default function TransitBoard({ stopCodes, stopNames, refreshInterval }: TransitBoardProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastGlobalUpdate, setLastGlobalUpdate] = useState<Date | null>(null);
  const [parsedRealtimeData, setParsedRealtimeData] = useState<GTFSFeedMessage | null>(null);

  // Fetch GTFS static data for stop names
  const { data: staticData, error: staticError } = useSWR<APIResponse<GTFSStaticData>>('/api/gtfs-static', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000, // 1 minute
  });

  // Fetch GTFS real-time data with auto-refresh
  type TripUpdatesPayload = { data: string };

  const { data: realtimeData, error: realtimeError, isLoading, mutate } = useSWR<APIResponse<TripUpdatesPayload>>(
    `/api/gtfs/TripUpdates`,
    fetcher,
    {
      refreshInterval: APP_CONFIG.REFRESH_INTERVAL, // Configurable
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      shouldRetryOnError: true,
      onSuccess: (data) => {
        setLastGlobalUpdate(new Date());
        setConnectionError(null);
        
        // Parse the protobuf data
        if (data.success && data.data?.data) {
          try {
            const base64Data = data.data.data;
            const binaryData = Buffer.from(base64Data, 'base64');
            const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(binaryData);
            setParsedRealtimeData(feed);
            
            // Check for stale data
            const feedTimestamp = feed.header?.timestamp;
            let isStale = false;
            let dataAge = 0;
            
            if (feedTimestamp) {
              try {
                dataAge = calculateDataAge(feedTimestamp);
                isStale = dataAge > 30; // Consider data stale if older than 30 minutes
                
                if (isStale) {
                  const ageString = formatDataAge(dataAge);
                  setConnectionError(`Real-time data is ${ageString} old. Service information may not be current.`);
                }
              } catch (error) {
                console.warn('Failed to process feed timestamp:', error);
              }
            }
            
            console.log('GTFS real-time data parsed successfully:', {
              entityCount: feed.entity?.length || 0,
              timestamp: feedTimestamp,
              dataAge: `${dataAge} minutes`,
              isStale: isStale,
              autoRefresh: true
            });
          } catch (parseError) {
            console.error('Error parsing GTFS real-time data:', parseError);
            setConnectionError('Error parsing real-time data');
          }
        }
      },
      onError: (error) => {
        console.error('Real-time data fetch error:', error);
        setConnectionError(error.message || 'Failed to fetch real-time data');
      },
    }
  );

  // Cleanup: on component unmount, cancel any pending revalidations and clear local cache entry
  useEffect(() => {
    return () => {
      // Reset cached data and skip revalidation to ensure no dangling intervals
      mutate(undefined, false);
    };
  }, [mutate]);

  const processStopData = useCallback((stopCode: string): StopData => {
    let staticArrivals: Array<CombinedArrival> = [];
    let realtimeArrivals: Array<CombinedArrival> = [];

    if (staticData?.success && staticData.data) {
      try {
        // First, find the stop_id that corresponds to this stop_code
        const stopInfo = staticData.data!.stops.find((stop) => stop.stop_code === stopCode);
        if (!stopInfo) {
          return {
            stopCode,
            arrivals: [],
            error: `Stop code ${stopCode} not found`,
            lastUpdate: lastGlobalUpdate || undefined,
          };
        }
        const stopId = stopInfo.stop_id;
        const stopName = stopNames[stopCode] || stopInfo.stop_name || 'Unknown Stop';
        const now = Date.now();
        // 1. Build static arrivals
        const stopTimes = staticData.data!.stopTimes?.filter((st) => st.stop_id === stopId) || [];
        stopTimes.forEach((stopTime) => {
          const tripInfo = staticData.data!.trips.find((trip) => trip.trip_id === stopTime.trip_id);
          if (tripInfo) {
            const routeInfo = staticData.data!.routes.find((route) => route.route_id === tripInfo.route_id);
            const readableRouteNumber = routeInfo?.route_short_name || tripInfo.route_id;
            const headsign = tripInfo.trip_headsign || 'Unknown Destination';
            const timeStr = stopTime.arrival_time || stopTime.departure_time;
            if (timeStr) {
              const [hours, minutes, seconds] = timeStr.split(':').map(Number);
              const scheduledTime = new Date();
              scheduledTime.setHours(hours, minutes, seconds, 0);
              if (hours >= 24) {
                scheduledTime.setHours(hours - 24, minutes, seconds, 0);
                scheduledTime.setDate(scheduledTime.getDate() + 1);
              }
              if (scheduledTime.getTime() < now) {
                scheduledTime.setDate(scheduledTime.getDate() + 1);
              }
              const minutesUntilArrival = Math.floor((scheduledTime.getTime() - now) / (1000 * 60));
              if (minutesUntilArrival >= -1 && minutesUntilArrival <= APP_CONFIG.MAX_ARRIVALS_WINDOW) {
                // Infer direction for 8A/8B static arrivals
                let direction: 'northbound' | 'southbound' | 'inbound' | 'outbound' | undefined = undefined;
                if (readableRouteNumber === '8A' || readableRouteNumber === '8B') {
                  direction = infer8Direction(readableRouteNumber, headsign);
                } else if (readableRouteNumber === '400') {
                  direction = infer8Direction(readableRouteNumber, headsign);
                } else if (/A/i.test(readableRouteNumber)) {
                  direction = 'northbound';
                } else if (/B/i.test(readableRouteNumber)) {
                  direction = 'southbound';
                }
                
                staticArrivals.push({
                  routeId: readableRouteNumber,
                  tripId: headsign,
                  arrivalTime: scheduledTime.getTime(),
                  delay: 0,
                  stopCode: stopCode,
                  stopName: stopName,
                  platform: stopTime.platform_code || undefined,
                  isRealtime: false,
                  gtfsTripId: tripInfo.trip_id, // Store the actual GTFS trip ID for matching
                  direction: direction,
                  pairedEstimate: false,
                });
              }
            }
          }
        });
        // 2. Build real-time arrivals
        if (parsedRealtimeData?.entity) {
          parsedRealtimeData.entity.forEach((entity: any) => {
            if (entity.tripUpdate?.stopTimeUpdate) {
              entity.tripUpdate.stopTimeUpdate.forEach((stopUpdate: any) => {
                if (stopUpdate.stopId === stopId) {
                  const arrivalTime = stopUpdate.arrival?.time || stopUpdate.departure?.time;
                  if (arrivalTime) {
                    const arrivalTimeMs = arrivalTime * 1000;
                    const minutesUntilArrival = Math.floor((arrivalTimeMs - now) / (1000 * 60));
                    const gtfsRouteId = entity.tripUpdate.trip?.routeId || 'Unknown';
                    const gtfsTripId = entity.tripUpdate.trip?.tripId || 'Unknown';
                    const routeInfo = staticData.data!.routes.find((route) => route.route_id === gtfsRouteId);
                    const readableRouteNumber = routeInfo?.route_short_name || gtfsRouteId;
                    const tripInfo = staticData.data!.trips.find((trip) => trip.trip_id === gtfsTripId);
                    const headsign = tripInfo?.trip_headsign || 'Unknown Destination';
                    const delay = stopUpdate.arrival?.delay || stopUpdate.departure?.delay || 0;
                    let direction: 'northbound' | 'southbound' | 'inbound' | 'outbound' | undefined = undefined;
                    if (readableRouteNumber === '8A' || readableRouteNumber === '8B') {
                      direction = infer8Direction(readableRouteNumber, headsign) as 'northbound' | 'southbound' | undefined;
                    } else if (readableRouteNumber === '400') {
                      direction = infer8Direction(readableRouteNumber, headsign) as 'northbound' | 'southbound' | undefined;
                    } else if (/A/i.test(readableRouteNumber)) {
                      direction = 'northbound';
                    } else if (/B/i.test(readableRouteNumber)) {
                      direction = 'southbound';
                    }
                    if (minutesUntilArrival >= -1 && minutesUntilArrival <= APP_CONFIG.MAX_ARRIVALS_WINDOW) {
                      realtimeArrivals.push({
                        routeId: readableRouteNumber,
                        tripId: headsign,
                        arrivalTime: arrivalTimeMs,
                        delay: delay,
                        stopCode: stopCode,
                        stopName: stopName,
                        platform: stopUpdate.arrival?.platform || undefined,
                        isRealtime: true,
                        gtfsTripId: gtfsTripId,
                        direction: direction,
                        pairedEstimate: false,
                      });
                    }
                  }
                }
              });
            }
          });
        }
        // 3. Merge arrivals: prefer real-time, only show static if no real-time for that trip
        // Group by (routeId, tripId, stopCode) and keep only the soonest arrival (real-time preferred)
        type ArrivalKey = string;
        const makeKey = (a: CombinedArrival): ArrivalKey => `${a.routeId}|${a.tripId}|${a.stopCode}`;
        const grouped: Record<ArrivalKey, CombinedArrival> = {};
        // Add all real-time arrivals first
        for (const rt of realtimeArrivals) {
          const key = makeKey(rt);
          if (!grouped[key] || rt.arrivalTime < grouped[key].arrivalTime) {
            grouped[key] = rt;
          }
        }
        // Add static arrivals only if not already present or if earlier than existing
        for (const st of staticArrivals) {
          const key = makeKey(st);
          // If there's no entry yet, simply add the static arrival.
          if (!grouped[key]) {
            grouped[key] = st;
            continue;
          }

          // If the existing entry is **real-time**, keep it – never let static override it.
          if (grouped[key].isRealtime) {
            continue;
          }

          // Existing entry is static as well – keep the earliest one.
          if (st.arrivalTime < grouped[key].arrivalTime) {
            grouped[key] = st;
          }
        }

        // After merging static arrivals, attempt paired-route real-time estimation when a static arrival lacks real-time data
        for (const st of staticArrivals) {
          const key = makeKey(st);
          // Skip if we already have a real-time arrival for this key
          if (grouped[key] && grouped[key].isRealtime) {
            continue;
          }

          // Identify the paired route (e.g., 2A ↔ 2B)
          const pairRoute = RoutePairingService.findPairedRoute(st.routeId);
          if (!pairRoute) {
            continue;
          }

          let paired: CombinedArrival | undefined = undefined;

          // Special handling for 8A/8B and 400 – prefer the opposite direction first
          if ((st.routeId === '8A' || st.routeId === '8B' || st.routeId === '400') && st.direction) {
            const oppositeDirection = st.direction === 'northbound' ? 'southbound' : 'northbound';
            paired = realtimeArrivals.find((rt) => {
              if (rt.routeId !== pairRoute || rt.stopCode !== st.stopCode) return false;
              // when direction exists, ensure same direction to avoid duplicates
              if (st.direction) {
                return rt.direction === st.direction;
              }
              return true;
            });
          }

          // Fallback: look for any real-time arrival on the paired route at the same stop
          if (!paired) {
            paired = realtimeArrivals.find((rt) => {
              if (rt.routeId !== pairRoute || rt.stopCode !== st.stopCode) return false;
              // when direction exists, ensure same direction to avoid duplicates
              if (st.direction) {
                return rt.direction === st.direction;
              }
              return true;
            });
          }

          if (paired) {
            grouped[key] = {
              ...st,
              arrivalTime: paired.arrivalTime,
              delay: paired.delay,
              isRealtime: true,
              pairedEstimate: true,
            };
          }
        }
        const arrivals = Object.values(grouped);
        // Custom sort: 'At platform' (diffMinutes -2 to 0) first, then by soonest
        const nowMs = Date.now();
        arrivals.sort((a, b) => {
          const diffA = Math.floor((a.arrivalTime - nowMs) / (1000 * 60));
          const diffB = Math.floor((b.arrivalTime - nowMs) / (1000 * 60));
          // At platform = diffMinutes -2 to 0
          const aAtPlatform = a.isRealtime && diffA >= -2 && diffA <= 0;
          const bAtPlatform = b.isRealtime && diffB >= -2 && diffB <= 0;
          if (aAtPlatform && !bAtPlatform) return -1;
          if (!aAtPlatform && bAtPlatform) return 1;
          // Otherwise, soonest first
          return (a.arrivalTime - b.arrivalTime);
        });
        return {
          stopCode,
          arrivals,
          lastUpdate: lastGlobalUpdate || undefined,
        };
      } catch (error) {
        return {
          stopCode,
          arrivals: [],
          error: `Error processing stop ${stopCode}`,
          lastUpdate: lastGlobalUpdate || undefined,
        };
      }
    }
    return {
      stopCode,
      arrivals: [],
      lastUpdate: lastGlobalUpdate || undefined,
    };
  }, [parsedRealtimeData, staticData, lastGlobalUpdate, stopNames]);

  // Memoize expensive per-stop processing so we only recompute when its true
  // dependencies change (e.g. new realtime/static data or a different list of
  // stopCodes). This prevents re-executing the 200+ lines above on every
  // render triggered by the 15-second auto-refresh.
  const processedStops = useMemo(() => {
    return stopCodes.map((code) => processStopData(code));
  }, [stopCodes, processStopData]);

  // Combine all stop data and sort by arrival time
  const getCombinedArrivals = useCallback((): CombinedArrival[] => {
    const allArrivals: CombinedArrival[] = [];
    const now = Date.now();

    processedStops.forEach((stopData) => {
      // Double-check: filter out any arrivals beyond 60 minutes
      const filteredArrivals = stopData.arrivals.filter((arrival) => {
        const minutesUntilArrival = Math.floor((arrival.arrivalTime - now) / (1000 * 60));
        return minutesUntilArrival >= -1 && minutesUntilArrival <= APP_CONFIG.MAX_ARRIVALS_WINDOW;
      });
      allArrivals.push(...filteredArrivals);
    });

    // Custom sort: 'At platform' (diffMinutes -2 to 0) first, then by soonest
    const nowMs = Date.now();
    allArrivals.sort((a, b) => {
      const diffA = Math.floor((a.arrivalTime - nowMs) / (1000 * 60));
      const diffB = Math.floor((b.arrivalTime - nowMs) / (1000 * 60));
      const aAtPlatform = a.isRealtime && diffA >= -2 && diffA <= 0;
      const bAtPlatform = b.isRealtime && diffB >= -2 && diffB <= 0;
      if (aAtPlatform && !bAtPlatform) return -1;
      if (!aAtPlatform && bAtPlatform) return 1;
      return a.arrivalTime - b.arrivalTime;
    });

    return allArrivals; // Show all arrivals within 60 minutes
  }, [processedStops]);

  const formatArrivalTime = (timestamp: number, delay: number = 0) => {
    const arrivalTime = new Date(timestamp + delay * 1000);
    const now = new Date();
    const diffMs = arrivalTime.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 0) {
      return <span className="text-red-600 font-bold">Departed</span>;
    } else if (diffMinutes === 0) {
      return <span className="text-orange-600 font-bold">Now</span>;
    } else if (diffMinutes <= 5) {
      return <span className="text-orange-500 font-bold">{diffMinutes} min</span>;
    } else if (diffMinutes <= 15) {
      return <span className="text-yellow-600 font-bold">{diffMinutes} min</span>;
    } else {
      return <span className="text-green-600 font-bold">{diffMinutes} min</span>;
    }
  };

  const formatDelay = (delay: number) => {
    if (delay === 0) return null;
    const delayMinutes = Math.floor(delay / 60);
    if (delayMinutes > 0) {
      return <span className="text-red-500 text-xs ml-1">+{delayMinutes}m</span>;
    } else if (delayMinutes < 0) {
      return <span className="text-green-500 text-xs ml-1">{delayMinutes}m</span>;
    }
    return null;
  };

  const formatArrivalTimeOfficial = (
    timestamp: number,
    delay: number = 0,
    isRealtime: boolean = false,
    treatPastAsNow: boolean = false
  ) => {
    const arrivalTime = new Date(timestamp + delay * 1000);
    const now = new Date();
    const diffMs = arrivalTime.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 0) {
      // Show "At platform" only for arrival column (treatPastAsNow === false)
      if (!treatPastAsNow && isRealtime && diffMinutes >= -2) {
        return (
          <div className="flex items-center gap-1">
            <span className="font-bold text-green-700">At platform</span>
            <span className="inline-block w-4 h-3 bg-barrie-blue rounded-sm"></span>
          </div>
        );
      }
      // For departure column: if treatPastAsNow, show "Now" when bus should have departed but hasn't
      if (treatPastAsNow) {
        return (
          <div className="flex items-center gap-1">
            <span className="font-bold text-barrie-blue">Now</span>
            {isRealtime ? (
              <span className="inline-block w-4 h-3 bg-barrie-blue rounded-sm"></span>
            ) : (
              <span className="inline-block w-4 h-3 border-2 border-gray-400 rounded-sm"></span>
            )}
          </div>
        );
      }
      // Older than threshold – treat as departed / unknown
      return (
        <div className="flex items-center gap-1">
          <span className="font-bold text-gray-400">-</span>
        </div>
      );
    } else if (diffMinutes === 0) {
      return (
        <div className="flex items-center gap-1">
          <span className="font-bold text-barrie-blue">Now</span>
          {isRealtime ? (
            <span className="inline-block w-4 h-3 bg-barrie-blue rounded-sm"></span>
          ) : (
            <span className="inline-block w-4 h-3 border-2 border-gray-400 rounded-sm"></span>
          )}
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1">
          <span className="font-bold text-barrie-blue">{diffMinutes} min</span>
          {isRealtime ? (
            <span className="inline-block w-4 h-3 bg-barrie-blue rounded-sm"></span>
          ) : (
            <span className="inline-block w-4 h-3 border-2 border-gray-400 rounded-sm"></span>
          )}
        </div>
      );
    }
  };

  const handleRefresh = () => {
    mutate();
  };

  // Show loading state during initial load
  if (isLoading && !realtimeData) {
    return (
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-barrie-blue">Live Departures</h2>
          <ConnectionStatus isConnected={false} />
        </div>
        <LoadingSpinner message="Loading departure times..." />
      </div>
    );
  }

  // Show error state if both static and realtime data failed
  if (staticError && realtimeError) {
    return (
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-barrie-blue">Live Departures</h2>
          <ConnectionStatus isConnected={false} error="Connection failed" />
        </div>
        <div className="text-center py-8">
          <div className="text-red-600 mb-4">
            <div className="text-4xl mb-2">⚠️</div>
            <h3 className="text-lg font-semibold">Connection Error</h3>
            <p className="text-sm mt-2">Unable to load transit data</p>
          </div>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-barrie-blue text-white rounded hover:bg-barrie-blue"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const combinedArrivals = getCombinedArrivals();

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      {/* Header matching official site */}
      <div className="bg-barrie-blue text-white px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Transit Departure Times</h1>
            <h2 className="text-lg">
              {stopCodes.length === 1 
                ? `${stopCodes[0]} - ${stopNames[stopCodes[0]]}` || `Stop ${stopCodes[0]}`
                : `${stopCodes.length} Stops Selected`
              }
            </h2>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">
              {lastGlobalUpdate ? lastGlobalUpdate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {connectionError && connectionError.includes('old') ? (
                <>
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span>Data may be stale</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Auto-refresh every 15s</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table header matching official site */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="grid grid-cols-8 gap-2 px-4 py-3 text-sm font-semibold text-gray-700 text-center items-center" style={{gridTemplateColumns: "1fr 1fr 1fr 2fr 2fr 0.8fr 1fr 1fr"}}>
          <div className="flex items-center justify-center">Service</div>
          <div className="flex items-center justify-center">Route #</div>
          <div className="flex items-center justify-center">Direction</div>
          <div className="flex items-center justify-center">Route</div>
          <div className="flex items-center justify-center">Stop</div>
          <div className="flex items-center justify-center">Platform</div>
          <div className="flex items-center justify-center">Arrives</div>
          <div className="flex items-center justify-center">Departs</div>
        </div>
      </div>

      {/* Combined departure data */}
      <div className="max-h-96 overflow-y-auto scrollbar-thin">
        {combinedArrivals.length > 0 ? (
          combinedArrivals.map((arrival, index) => (
            <DepartureRow
              key={`${arrival.routeId}-${arrival.tripId}-${arrival.stopCode}-${index}`}
              arrival={arrival}
              format={formatArrivalTimeOfficial}
            />
          ))
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            {isLoading ? (
              <LoadingSpinner size="sm" message="Loading departures..." />
            ) : (
              <div>
                <div className="text-2xl mb-2">🚌</div>
                <p className="font-medium">No upcoming departures</p>
                {connectionError && connectionError.includes('old') ? (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                    <div className="text-yellow-800">
                      <div className="font-medium">⚠️ Data may be outdated</div>
                      <div className="mt-1">{connectionError}</div>
                      <div className="mt-2 text-xs">
                        This could mean: No current service, weekend schedule, or feed server issues.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs mt-2 text-gray-400">
                    <div>Possible reasons:</div>
                    <div>• No service at this time</div>
                    <div>• End of service day</div>
                    <div>• Weekend/holiday schedule</div>
                    <div className="mt-2">Data updates every 15 seconds</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="bg-gray-100 px-6 py-2 text-xs text-gray-600 border-t border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-3 bg-barrie-blue rounded-sm"></span>
              <span>Real-time</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-3 border-2 border-gray-400 rounded-sm"></span>
              <span>Static schedule</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-medium">~paired</span>
              <span>Paired direction estimate</span>
            </div>
            <span className="text-gray-500">
              {connectionError && connectionError.includes('old') 
                ? 'Data may be outdated'
                : `Showing ${combinedArrivals.length} upcoming departures`
              }
            </span>
          </div>
          {connectionError && connectionError.includes('old') && (
            <button
              onClick={handleRefresh}
              className="text-barrie-blue hover:text-barrie-blue font-medium"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {stopCodes.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <div className="text-4xl mb-4">🚏</div>
          <p className="text-lg font-medium mb-2">No stops selected</p>
          <p className="text-sm">Add stop codes above to see live departures</p>
        </div>
      )}
    </div>
  );
} 