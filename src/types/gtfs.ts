/**
 * GTFS protobuf timestamp type (can be Long object or number)
 */
export type GTFSTimestamp = {
  low: number;
  high: number;
  unsigned?: boolean;
} | number;

/**
 * GTFS real-time feed message structure
 */
export interface GTFSFeedMessage {
  header?: {
    timestamp?: GTFSTimestamp;
    gtfsRealtimeVersion?: string;
    incrementality?: number;
  };
  entity?: Array<{
    id?: string;
    tripUpdate?: {
      trip?: {
        tripId?: string;
        routeId?: string;
        directionId?: number;
        startTime?: string;
        startDate?: string;
      };
      stopTimeUpdate?: Array<{
        stopSequence?: number;
        stopId?: string;
        arrival?: {
          time?: GTFSTimestamp;
          delay?: number;
          uncertainty?: number;
        };
        departure?: {
          time?: GTFSTimestamp;
          delay?: number;
          uncertainty?: number;
        };
        scheduleRelationship?: number;
      }>;
      vehicle?: {
        id?: string;
        label?: string;
        licensePlate?: string;
      };
      timestamp?: GTFSTimestamp;
      delay?: number;
    };
    vehicle?: {
      trip?: {
        tripId?: string;
        routeId?: string;
        directionId?: number;
        startTime?: string;
        startDate?: string;
      };
      position?: {
        latitude?: number;
        longitude?: number;
        bearing?: number;
        speed?: number;
      };
      currentStopSequence?: number;
      currentStatus?: number;
      timestamp?: GTFSTimestamp;
      congestionLevel?: number;
      stopId?: string;
      vehicle?: {
        id?: string;
        label?: string;
        licensePlate?: string;
      };
    };
    alert?: {
      activePeriod?: Array<{
        start?: GTFSTimestamp;
        end?: GTFSTimestamp;
      }>;
      informedEntity?: Array<{
        agencyId?: string;
        routeId?: string;
        routeType?: number;
        trip?: {
          tripId?: string;
          routeId?: string;
          directionId?: number;
          startTime?: string;
          startDate?: string;
        };
        stopId?: string;
      }>;
      cause?: number;
      effect?: number;
      url?: {
        translation?: Array<{
          text?: string;
          language?: string;
        }>;
      };
      headerText?: {
        translation?: Array<{
          text?: string;
          language?: string;
        }>;
      };
      descriptionText?: {
        translation?: Array<{
          text?: string;
          language?: string;
        }>;
      };
    };
  }>;
}

/**
 * GTFS static data types
 */
export interface GTFSStop {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  stop_desc?: string;
  stop_lat: string;
  stop_lon: string;
  zone_id?: string;
  stop_url?: string;
  location_type?: string;
  parent_station?: string;
  stop_timezone?: string;
  wheelchair_boarding?: string;
}

export interface GTFSRoute {
  route_id: string;
  agency_id?: string;
  route_short_name: string;
  route_long_name: string;
  route_desc?: string;
  route_type: string;
  route_url?: string;
  route_color?: string;
  route_text_color?: string;
}

export interface GTFSTrip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign?: string;
  trip_short_name?: string;
  direction_id?: string;
  block_id?: string;
  shape_id?: string;
  wheelchair_accessible?: string;
  bikes_allowed?: string;
}

export interface GTFSStopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
  stop_headsign?: string;
  pickup_type?: string;
  drop_off_type?: string;
  shape_dist_traveled?: string;
  timepoint?: string;
  platform_code?: string;
} 