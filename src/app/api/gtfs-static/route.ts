import { NextRequest, NextResponse } from 'next/server';
import { fetchStaticGTFS } from '@/lib/gtfs-static';
import { APP_CONFIG } from '@/config/app';

// Server-side cache
let cachedStaticData: any = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = APP_CONFIG.CACHE_DURATION;

export async function GET(request: NextRequest) {
  try {
    // Check if we have valid cached data
    const now = Date.now();
    if (cachedStaticData && now < cacheExpiry) {
      console.log('Serving cached GTFS static data');
      return NextResponse.json({
        success: true,
        data: cachedStaticData,
        cached: true,
        cacheAge: Math.floor((now - (cacheExpiry - CACHE_DURATION)) / 1000)
      });
    }

    console.log('Fetching fresh GTFS static data...');
    const staticData = await fetchStaticGTFS();
    
    if (!staticData || staticData.stops.length === 0) {
      throw new Error('No stops found in GTFS static data');
    }

    // Cache the data
    cachedStaticData = staticData;
    cacheExpiry = now + CACHE_DURATION;

    console.log(`GTFS static data loaded: ${staticData.stops.length} stops, ${staticData.routes.length} routes`);

    return NextResponse.json({
      success: true,
      data: staticData,
      cached: false,
      stats: {
        stops: staticData.stops.length,
        routes: staticData.routes.length,
        trips: staticData.trips.length,
        stopTimes: staticData.stopTimes.length
      }
    });

  } catch (error) {
    console.error('Error in GTFS static API:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      cached: false
    }, { status: 500 });
  }
}

// Optional: Add cache invalidation endpoint
export async function DELETE() {
  cachedStaticData = null;
  cacheExpiry = 0;
  return NextResponse.json({ success: true, message: 'Cache cleared' });
} 