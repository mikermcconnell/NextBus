import { useState } from 'react';
import useSWR from 'swr';
import { GTFSFeedMessage } from '@/types/gtfs';
import { calculateDataAge, formatDataAge } from '@/utils/timestamp';

const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

interface UseGTFSDataResult {
  staticData: any;
  parsedRealtimeData: GTFSFeedMessage | null;
  connectionError: string | null;
  lastGlobalUpdate: Date | null;
  isLoading: boolean;
  mutateRealtime: () => void;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export function useGTFSData(): UseGTFSDataResult {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastGlobalUpdate, setLastGlobalUpdate] = useState<Date | null>(null);
  const [parsedRealtimeData, setParsedRealtimeData] = useState<GTFSFeedMessage | null>(null);

  // Static data
  const { data: staticData } = useSWR('/api/gtfs-static', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000, // 1 min
  });

  // Real-time data
  const {
    data: realtimeData,
    error: realtimeError,
    isLoading,
    mutate: mutateRealtime,
  } = useSWR('/api/gtfs/TripUpdates', fetcher, {
    refreshInterval: 15_000,
    onSuccess: (data) => {
      setLastGlobalUpdate(new Date());
      setConnectionError(null);

      if (data.success && data.data?.data) {
        try {
          const binary = Buffer.from(data.data.data, 'base64');
          const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(binary);
          setParsedRealtimeData(feed);

          // Staleness check
          const ts = feed.header?.timestamp;
          if (ts) {
            const age = calculateDataAge(ts);
            if (age > 30) {
              setConnectionError(`Real-time data is ${formatDataAge(age)} old.`);
            }
          }
        } catch (e) {
          console.error('protobuf parse error', e);
          setConnectionError('Error parsing real-time feed');
        }
      }
    },
    onError: (err) => {
      console.error('RT fetch error', err);
      setConnectionError(err.message ?? 'Real-time fetch failed');
    },
  });

  return {
    staticData: staticData?.data,
    parsedRealtimeData,
    connectionError,
    lastGlobalUpdate,
    isLoading,
    mutateRealtime,
  };
} 