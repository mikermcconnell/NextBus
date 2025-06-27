import { parse } from 'csv-parse/sync';
import JSZip from 'jszip';

export interface GTFSStop {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
}

export interface GTFSRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: string;
}

export interface GTFSTrip {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign: string;
  direction_id: string;
}

export interface GTFSStopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
}

export async function fetchStaticGTFS(): Promise<{
  stops: GTFSStop[];
  routes: GTFSRoute[];
  trips: GTFSTrip[];
  stopTimes: GTFSStopTime[];
}> {
  const response = await fetch('https://www.myridebarrie.ca/gtfs/google_transit.zip');
  if (!response.ok) {
    throw new Error(`GTFS fetch failed: ${response.status}`);
  }
  // Check file size before processing
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB limit
    throw new Error('GTFS file too large');
  }
  const arrayBuffer = await response.arrayBuffer();
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(arrayBuffer);
  // Process files sequentially to avoid memory spikes
  const stops = await parseCSVFile(zip, 'stops.txt');
  const routes = await parseCSVFile(zip, 'routes.txt');
  const trips = await parseCSVFile(zip, 'trips.txt');
  const stopTimes = await parseCSVFile(zip, 'stop_times.txt');
  return { stops, routes, trips, stopTimes };
}

async function parseCSVFile(zip: JSZip, filename: string): Promise<any[]> {
  const fileContent = await zip.file(filename)?.async('string');
  if (!fileContent) return [];
  return parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });
}

export function findStopByCode(stops: GTFSStop[], stopCode: string): GTFSStop | undefined {
  return stops.find(stop => stop.stop_code === stopCode);
}

export function getRouteInfo(routes: GTFSRoute[], routeId: string): GTFSRoute | undefined {
  return routes.find(route => route.route_id === routeId);
}

export function getTripInfo(trips: GTFSTrip[], tripId: string): GTFSTrip | undefined {
  return trips.find(trip => trip.trip_id === tripId);
} 