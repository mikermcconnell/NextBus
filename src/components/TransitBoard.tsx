'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import LoadingSpinner from './LoadingSpinner';
import ConnectionStatus from './ConnectionStatus';
import ErrorBoundary from './ErrorBoundary';

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
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

export default function TransitBoard({ stopCodes, stopNames, refreshInterval }: TransitBoardProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastGlobalUpdate, setLastGlobalUpdate] = useState<Date | null>(null);
  const [parsedRealtimeData, setParsedRealtimeData] = useState<any>(null);

  // Fetch GTFS static data for stop names
  const { data: staticData, error: staticError } = useSWR('/api/gtfs-static', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000, // 1 minute
  });

  // Fetch GTFS real-time data with auto-refresh
  const { data: realtimeData, error: realtimeError, isLoading, mutate } = useSWR(
    `/api/gtfs/TripUpdates`,
    fetcher,
    {
      refreshInterval: 15000, // Auto-refresh every 15 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
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
            
            // Debug: Log some sample stop IDs from the real-time data
            const sampleStopIds = new Set<string>();
            feed.entity?.slice(0, 5).forEach((entity: any) => {
              if (entity.tripUpdate?.stopTimeUpdate) {
                entity.tripUpdate.stopTimeUpdate.forEach((stopUpdate: any) => {
                  if (stopUpdate.stopId) {
                    sampleStopIds.add(stopUpdate.stopId);
                  }
                });
              }
            });
            
            console.log('GTFS real-time data parsed successfully:', {
              entityCount: feed.entity?.length || 0,
              timestamp: feed.header?.timestamp,
              sampleStopIds: Array.from(sampleStopIds).slice(0, 10),
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

  const processStopData = useCallback((stopCode: string): StopData => {
    const arrivals: Array<{
      routeId: string;
      tripId: string;
      arrivalTime: number;
      delay: number;
      stopCode: string;
      stopName: string;
    }> = [];

    if (staticData?.success) {
      try {
        // First, find the stop_id that corresponds to this stop_code
        const stopInfo = staticData.data.stops.find((stop: any) => stop.stop_code === stopCode);
        
        if (!stopInfo) {
          console.log(`No stop found for code: ${stopCode}`);
          return {
            stopCode,
            arrivals: [],
            error: `Stop code ${stopCode} not found`,
            lastUpdate: lastGlobalUpdate || undefined,
          };
        }

        const stopId = stopInfo.stop_id;
        const stopName = stopNames[stopCode] || stopInfo.stop_name || 'Unknown Stop';
        console.log(`Processing stop ${stopCode} (ID: ${stopId})`);

        const now = Date.now();
        const realtimeTripIds = new Set<string>();

        // First, process real-time data if available
        let realtimeCount = 0;
        if (parsedRealtimeData?.entity) {
          parsedRealtimeData.entity.forEach((entity: any) => {
            if (entity.tripUpdate?.stopTimeUpdate) {
              entity.tripUpdate.stopTimeUpdate.forEach((stopUpdate: any) => {
                // Now compare with the actual stop_id from GTFS
                if (stopUpdate.stopId === stopId) {
                  realtimeCount++;
                  const arrivalTime = stopUpdate.arrival?.time || stopUpdate.departure?.time;
                  if (arrivalTime) {
                    const arrivalTimeMs = arrivalTime * 1000;
                    const minutesUntilArrival = Math.floor((arrivalTimeMs - now) / (1000 * 60));
                    
                    // Only include trips that haven't departed yet (at least -1 minute buffer)
                    // and are within the next 60 minutes
                    console.log(`Real-time trip: ${entity.tripUpdate.trip?.tripId}, minutes until arrival: ${minutesUntilArrival}`);
                    if (minutesUntilArrival >= -1 && minutesUntilArrival <= 60) {
                      const gtfsRouteId = entity.tripUpdate.trip?.routeId || 'Unknown';
                      const gtfsTripId = entity.tripUpdate.trip?.tripId || 'Unknown';
                      
                      // Track which trips we have real-time data for
                      realtimeTripIds.add(gtfsTripId);
                      
                      // Find the readable route number from static data
                      const routeInfo = staticData.data.routes.find((route: any) => route.route_id === gtfsRouteId);
                      const readableRouteNumber = routeInfo?.route_short_name || gtfsRouteId;
                      
                      // Find trip information for headsign
                      const tripInfo = staticData.data.trips.find((trip: any) => trip.trip_id === gtfsTripId);
                      const headsign = tripInfo?.trip_headsign || 'Unknown Destination';
                      
                      const delay = stopUpdate.arrival?.delay || stopUpdate.departure?.delay || 0;
                      
                      arrivals.push({
                        routeId: readableRouteNumber,
                        tripId: headsign,
                        arrivalTime: arrivalTimeMs,
                        delay: delay,
                        stopCode: stopCode,
                        stopName: stopName
                      });
                    }
                  }
                }
              });
            }
          });
        }

        // Add scheduled trips from static data for routes not covered by real-time data
        const currentTime = new Date();
        const currentTimeStr = currentTime.toTimeString().substring(0, 8); // HH:MM:SS format
        const maxTimeStr = new Date(now + 60 * 60 * 1000).toTimeString().substring(0, 8); // +60 minutes

        // Find all stop times for this stop
        const stopTimes = staticData.data.stop_times?.filter((st: any) => st.stop_id === stopId) || [];
        
        // Group by trip_id and get the next few scheduled arrivals
        const scheduledTrips = new Map<string, any>();
        stopTimes.forEach((stopTime: any) => {
          const arrivalTime = stopTime.arrival_time || stopTime.departure_time;
          if (arrivalTime && arrivalTime >= currentTimeStr && arrivalTime <= maxTimeStr) {
            if (!realtimeTripIds.has(stopTime.trip_id)) {
              scheduledTrips.set(stopTime.trip_id, stopTime);
            }
          }
        });

        // Add scheduled trips to arrivals
        let scheduledCount = 0;
        scheduledTrips.forEach((stopTime) => {
          const tripInfo = staticData.data.trips.find((trip: any) => trip.trip_id === stopTime.trip_id);
          if (tripInfo) {
            const routeInfo = staticData.data.routes.find((route: any) => route.route_id === tripInfo.route_id);
            const readableRouteNumber = routeInfo?.route_short_name || tripInfo.route_id;
            const headsign = tripInfo.trip_headsign || 'Unknown Destination';
            
            // Convert scheduled time to timestamp (approximate)
            const timeStr = stopTime.arrival_time || stopTime.departure_time;
            const [hours, minutes, seconds] = timeStr.split(':').map(Number);
            const scheduledTime = new Date();
            scheduledTime.setHours(hours, minutes, seconds, 0);
            
            // If the scheduled time is in the past, assume it's tomorrow
            if (scheduledTime.getTime() < now) {
              scheduledTime.setDate(scheduledTime.getDate() + 1);
            }
            
            const minutesUntilArrival = Math.floor((scheduledTime.getTime() - now) / (1000 * 60));
            
            console.log(`Scheduled trip: ${stopTime.trip_id}, route: ${readableRouteNumber}, time: ${timeStr}, minutes until arrival: ${minutesUntilArrival}`);
            if (minutesUntilArrival >= -1 && minutesUntilArrival <= 60) {
              scheduledCount++;
              arrivals.push({
                routeId: readableRouteNumber,
                tripId: headsign,
                arrivalTime: scheduledTime.getTime(),
                delay: 0, // No delay info for scheduled trips
                stopCode: stopCode,
                stopName: stopName
              });
            }
          }
        });

        console.log(`Stop ${stopCode}: ${realtimeCount} real-time arrivals, ${scheduledCount} scheduled arrivals, ${arrivals.length} total within 60 minutes`);

        // Sort arrivals by time
        arrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);

        return {
          stopCode,
          arrivals: arrivals, // Show all arrivals within 60 minutes
          lastUpdate: lastGlobalUpdate || undefined,
        };
      } catch (error) {
        console.error(`Error processing stop ${stopCode}:`, error);
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

  // Combine all stop data and sort by arrival time
  const getCombinedArrivals = useCallback((): CombinedArrival[] => {
    const allArrivals: CombinedArrival[] = [];
    
    stopCodes.forEach(stopCode => {
      const stopData = processStopData(stopCode);
      allArrivals.push(...stopData.arrivals);
    });
    
    // Sort all arrivals by arrival time
    allArrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    return allArrivals; // Show all arrivals within 60 minutes
  }, [stopCodes, processStopData]);

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

  const formatArrivalTimeOfficial = (timestamp: number, delay: number = 0) => {
    const arrivalTime = new Date(timestamp + delay * 1000);
    const now = new Date();
    const diffMs = arrivalTime.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 0) {
      return (
        <div className="flex items-center gap-1">
          <span className="font-bold text-red-600">Departed</span>
        </div>
      );
    } else if (diffMinutes === 0) {
      return (
        <div className="flex items-center gap-1">
          <span className="font-bold text-blue-900">Now</span>
          <span className="inline-block w-4 h-3 bg-blue-500 rounded-sm"></span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1">
          <span className="font-bold text-blue-900">{diffMinutes} min</span>
          <span className="inline-block w-4 h-3 bg-blue-500 rounded-sm"></span>
        </div>
      );
    }
  };

  const handleRefresh = () => {
    mutate();
  };

  const getPlatformForRoute = (routeId: string): number => {
    // Map route numbers to platforms similar to the official site
    const routePlatformMap: Record<string, number> = {
      '2': 7, '7': 2, '8': 4, '10': 6, '11': 8, '12': 5,
      '100': 4, '101': 13, '68': 1
    };
    
    // Extract numeric part from route ID
    const numericRoute = routeId.replace(/[AB]/g, '');
    
    return routePlatformMap[numericRoute] || Math.floor(Math.random() * 13) + 1;
  };

  // Show loading state during initial load
  if (isLoading && !realtimeData) {
    return (
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-700">Live Departures</h2>
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
          <h2 className="text-2xl font-bold text-blue-700">Live Departures</h2>
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
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
      <div className="bg-blue-900 text-white px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Transit Departure Times</h1>
            <h2 className="text-lg">
              {stopCodes.length === 1 
                ? stopNames[stopCodes[0]] || `Stop ${stopCodes[0]}`
                : `${stopCodes.length} Stops Selected`
              }
            </h2>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">
              {lastGlobalUpdate ? lastGlobalUpdate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Auto-refresh every 15s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table header matching official site */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="grid grid-cols-7 gap-2 px-4 py-3 text-sm font-semibold text-gray-700" style={{gridTemplateColumns: "60px 80px 1fr 120px 60px 80px 80px"}}>
          <div>Route #</div>
          <div>Service</div>
          <div>Route</div>
          <div>Stop</div>
          <div>Platform</div>
          <div>Arrives</div>
          <div>Departs</div>
        </div>
      </div>

      {/* Combined departure data */}
      <div className="max-h-96 overflow-y-auto scrollbar-thin">
        {combinedArrivals.length > 0 ? (
          combinedArrivals.map((arrival, index) => (
            <div
              key={`${arrival.routeId}-${arrival.tripId}-${arrival.stopCode}-${index}`}
              className={`grid grid-cols-7 gap-2 px-4 py-3 border-b border-gray-200 hover:bg-gray-50 ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}
              style={{gridTemplateColumns: "60px 80px 1fr 120px 60px 80px 80px"}}
            >
              {/* Route # */}
              <div className="font-bold text-lg text-blue-900 flex items-center transit-route-cell">
                {arrival.routeId}
              </div>
              
              {/* Service - Logo based on route type */}
              <div className="flex items-center justify-center">
                {arrival.routeId.includes('68') ? (
                  <Image 
                    src="/go-transit-logo.svg" 
                    alt="GO Transit" 
                    width={40}
                    height={20}
                    className="object-contain"
                  />
                ) : (
                  <Image 
                    src="/barrie-transit-logo.svg" 
                    alt="Barrie Transit" 
                    width={40}
                    height={20}
                    className="object-contain"
                  />
                )}
              </div>
              
              {/* Route destination */}
              <div className="font-medium text-gray-900 text-sm leading-tight transit-destination-cell">
                <div className="break-words overflow-hidden">
                  {arrival.tripId.length > 30 ? 
                    `${arrival.tripId.substring(0, 30)}...` : 
                    arrival.tripId
                  }
                </div>
              </div>
              
              {/* Stop Name */}
              <div className="text-xs leading-tight transit-stop-cell">
                <div className="font-medium text-gray-900 break-words overflow-hidden">
                  {arrival.stopName.length > 20 ? 
                    `${arrival.stopName.substring(0, 20)}...` : 
                    arrival.stopName
                  }
                </div>
                <div className="text-gray-500 text-xs">#{arrival.stopCode}</div>
              </div>
              
              {/* Platform - generate platform number based on route */}
              <div className="text-center font-medium flex items-center justify-center transit-table-cell">
                {getPlatformForRoute(arrival.routeId)}
              </div>
              
              {/* Arrives */}
              <div className="font-bold flex items-center transit-table-cell">
                {formatArrivalTimeOfficial(arrival.arrivalTime, arrival.delay)}
              </div>
              
              {/* Departs */}
              <div className="font-bold flex items-center transit-table-cell">
                {formatArrivalTimeOfficial(arrival.arrivalTime + 60000, arrival.delay)} {/* +1 min for depart */}
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            {isLoading ? (
              <LoadingSpinner size="sm" message="Loading departures..." />
            ) : (
              <div>
                <div className="text-2xl mb-2">🚌</div>
                <p>No upcoming departures</p>
                <p className="text-xs mt-1">Data updates every 15 seconds</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="bg-gray-100 px-6 py-2 text-xs text-gray-600 border-t border-gray-300">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-blue-500 rounded-full"></span>
          <span>Real-time departure information - Showing {combinedArrivals.length} upcoming departures</span>
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