import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  // Whitelist allowed paths
  const allowedPaths = ['TripUpdates', 'VehiclePositions', 'ServiceAlerts'];
  const sanitizedPath = params.path
    .filter(segment => /^[a-zA-Z0-9_-]+$/.test(segment))
    .join('/');

  if (!allowedPaths.some(allowed => sanitizedPath.includes(allowed))) {
    return new Response('Invalid path', { status: 400 });
  }

  const url = `https://www.myridebarrie.ca/gtfs/GTFS_${sanitizedPath}.pb`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/x-protobuf',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GTFS data: ${response.statusText}`);
    }

    const data = await response.arrayBuffer();
    
    return new Response(data, {
      headers: {
        'Content-Type': 'application/x-protobuf',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error fetching GTFS data:', error);
    return new Response('Failed to fetch GTFS data', { status: 500 });
  }
} 