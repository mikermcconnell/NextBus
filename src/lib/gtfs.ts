import * as GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { getRouteInfo, getTripInfo } from './gtfs-static';

export interface ArrivalTime {
  stopId: string;
  routeId: string;
  tripId: string;
  arrivalTime: Date;
  routeShortName: string;
  tripHeadsign: string;
  stopName: string;
  stopCode?: string;
}

let staticDataPromise: Promise<any> | null = null;
let staticData: any = null;

// Fetch static data from our server-side API
async function fetchStaticDataFromAPI(): Promise<any> {
  const response = await fetch('/api/gtfs-static', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch static GTFS data: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to load GTFS static data');
  }

  console.log('Static GTFS data loaded from API:', {
    cached: result.cached,
    stats: result.stats
  });

  return result.data;
}

export async function fetchGTFSData(): Promise<ArrivalTime[]> {
  try {
    // Prevent multiple concurrent fetches
    if (!staticDataPromise) {
      staticDataPromise = fetchStaticDataFromAPI();
    }
    
    staticData = await staticDataPromise;
    
    if (!staticData || staticData.stops.length === 0) {
      throw new Error('No static GTFS data available');
    }

    console.log('Fetching real-time GTFS data...');
    const response = await fetch('/api/gtfs/TripUpdates', {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch GTFS real-time data');
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    console.log('Real-time feed entities:', feed.entity.length);

    const arrivals: ArrivalTime[] = [];

    feed.entity.forEach((entity) => {
      if (entity.tripUpdate) {
        const tripUpdate = entity.tripUpdate;
        const routeId = tripUpdate.trip?.routeId || '';
        const tripId = tripUpdate.trip?.tripId || '';
        
        // Get route information from static data
        const routeInfo = getRouteInfo(staticData.routes, routeId);
        const tripInfo = getTripInfo(staticData.trips, tripId);
        
        tripUpdate.stopTimeUpdate?.forEach((update) => {
          const time = update.arrival?.time;
          if (time) {
            const timestamp = typeof time === 'number' ? time : time.toNumber();
            const stopId = update.stopId || '';
            
            // Get stop information from static data
            const stopInfo = staticData.stops.find((stop: any) => stop.stop_id === stopId);
            
            if (stopInfo) {
              arrivals.push({
                stopId: stopId,
                routeId: routeId,
                tripId: tripId,
                arrivalTime: new Date(timestamp * 1000),
                routeShortName: routeInfo?.route_short_name || routeId.replace(/^BT/, ''),
                tripHeadsign: tripInfo?.trip_headsign || 'Unknown Destination',
                stopName: stopInfo.stop_name || 'Unknown Stop',
                stopCode: stopInfo.stop_code,
              });
            }
          }
        });
      }
    });

    console.log('Total arrivals found:', arrivals.length);
    return arrivals;
  } catch (error) {
    // Reset promise on error so we can retry
    staticDataPromise = null;
    console.error('Error fetching GTFS data:', error);
    return [];
  }
}

export function filterArrivalsByStop(arrivals: ArrivalTime[], stopCode: string): ArrivalTime[] {
  const now = new Date();
  if (!staticData) return [];
  
  console.log(`Filtering arrivals for stop code: ${stopCode}`);
  console.log('Available arrivals:', arrivals.length);
  
  const filtered = arrivals.filter((arrival) => {
    // Try to match by stop code first, then by stop ID
    const stopInfo = staticData.stops.find((stop: any) => 
      stop.stop_code === stopCode || stop.stop_id === stopCode
    );
    
    if (stopInfo) {
      console.log(`Found stop info for ${stopCode}:`, stopInfo);
      return arrival.stopId === stopInfo.stop_id;
    } else {
      console.log(`No stop info found for ${stopCode}`);
      return false;
    }
  });
  
  console.log(`Filtered arrivals for ${stopCode}:`, filtered.length);
  
  return filtered
    .filter((arrival) => {
      const arrivalTime = arrival.arrivalTime;
      const diffMinutes = (arrivalTime.getTime() - now.getTime()) / (1000 * 60);
      return diffMinutes >= 0 && diffMinutes <= 60;
    })
    .sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime());
}

export function formatArrivalTime(time: Date): string {
  return time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Export function to get static data for the main page
export async function getStaticDataForStopNames(): Promise<any> {
  if (!staticDataPromise) {
    staticDataPromise = fetchStaticDataFromAPI();
  }
  return await staticDataPromise;
} 