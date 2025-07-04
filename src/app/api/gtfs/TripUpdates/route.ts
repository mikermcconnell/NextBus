import { NextRequest, NextResponse } from 'next/server';

const GTFS_REALTIME_URL = 'http://www.myridebarrie.ca/gtfs/GTFS_TripUpdates.pb';

// Cache for real-time data (shorter cache than static data)
let realtimeCache: {
  data: any;
  timestamp: number;
  expiresAt: number;
} | null = null;

// Cache for 30 seconds (real-time data should be fresh)
const CACHE_DURATION = 30 * 1000; // 30 seconds

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check if we have valid cached data
    const now = Date.now();
    if (realtimeCache && now < realtimeCache.expiresAt) {
      console.log('Serving cached GTFS real-time data');
      return NextResponse.json({
        success: true,
        data: realtimeCache.data,
        cached: true,
        cacheAge: Math.floor((now - realtimeCache.timestamp) / 1000),
        processingTime: Date.now() - startTime
      });
    }

    console.log('Fetching fresh GTFS real-time data...');
    
    // Fetch real-time data with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(GTFS_REALTIME_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`GTFS real-time API returned ${response.status}: ${response.statusText}`);
    }

    // Get the protobuf data as array buffer
    const arrayBuffer = await response.arrayBuffer();
    
    // For now, we'll pass the raw data - the client will handle protobuf parsing
    // In a production app, you might want to parse it server-side
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64Data = Buffer.from(uint8Array).toString('base64');
    
    const realtimeData = {
      data: base64Data,
      format: 'protobuf-base64',
      timestamp: now,
      source: 'myridebarrie.ca'
    };

    // Update cache
    realtimeCache = {
      data: realtimeData,
      timestamp: now,
      expiresAt: now + CACHE_DURATION
    };

    console.log(`GTFS real-time data fetched successfully (${arrayBuffer.byteLength} bytes)`);
    
    return NextResponse.json({
      success: true,
      data: realtimeData,
      cached: false,
      size: arrayBuffer.byteLength,
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    console.error('Error fetching GTFS real-time data:', error);
    
    // If we have stale cached data, return it with a warning
    if (realtimeCache) {
      console.log('Returning stale cached data due to fetch error');
      return NextResponse.json({
        success: true,
        data: realtimeCache.data,
        cached: true,
        stale: true,
        error: error instanceof Error ? error.message : 'Unknown error',
        cacheAge: Math.floor((Date.now() - realtimeCache.timestamp) / 1000),
        processingTime: Date.now() - startTime
      });
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: Date.now(),
      processingTime: Date.now() - startTime
    }, { status: 500 });
  }
}

// Add cache invalidation endpoint
export async function DELETE() {
  realtimeCache = null;
  return NextResponse.json({ success: true, message: 'Real-time cache cleared' });
} 