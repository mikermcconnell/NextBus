// Test script to check GTFS data for stop 330 and route 400

async function testGTFSData() {
  try {
    console.log('Testing GTFS static data...');
    
    // Add a timeout to the fetch (10 seconds)
    function fetchWithTimeout(url, options = {}, timeout = 10000) {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), timeout))
      ]);
    }

    console.log('Fetching GTFS static data...');
    let response;
    try {
      response = await fetchWithTimeout('http://localhost:3010/api/gtfs-static');
    } catch (e) {
      console.log('First fetch failed, trying port 3000...', e.message);
      response = await fetchWithTimeout('http://localhost:3000/api/gtfs-static');
    }
    console.log('Fetch complete');
    const data = await response.json();
    
    if (!data.success) {
      console.error('Failed to fetch GTFS data:', data.error);
      return;
    }
    
    const staticData = data.data;
    
    // Log all route_short_names to help infer A/B pairs
    const allRouteShortNames = staticData.routes.map(r => r.route_short_name);
    console.log('All route_short_names:', allRouteShortNames);
    
    // Check for stop 330
    const stop330 = staticData.stops.find(stop => stop.stop_code === '330');
    console.log('Stop 330:', stop330);
    
    // Check for route 400
    const route400 = staticData.routes.find(route => route.route_short_name === '400');
    console.log('Route 400:', route400);
    
    if (route400) {
      // Check if route 400 has trips
      const route400Trips = staticData.trips.filter(trip => trip.route_id === route400.route_id);
      console.log('Route 400 trips count:', route400Trips.length);
      
      if (stop330) {
        // Check if route 400 serves stop 330
        const route400StopTimes = staticData.stopTimes.filter(st => {
          const trip = staticData.trips.find(t => t.trip_id === st.trip_id);
          return trip && trip.route_id === route400.route_id && st.stop_id === stop330.stop_id;
        });
        console.log('Route 400 stop times for stop 330:', route400StopTimes.length);
        
        if (route400StopTimes.length > 0) {
          console.log('Sample stop times for route 400 at stop 330:');
          route400StopTimes.slice(0, 5).forEach(st => {
            console.log(`  Trip ${st.trip_id}: ${st.arrival_time} - ${st.departure_time}`);
          });
        }
      }
    }
    
    // Check all routes that serve stop 330
    if (stop330) {
      const allStopTimesFor330 = staticData.stopTimes.filter(st => st.stop_id === stop330.stop_id);
      console.log('All stop times for stop 330:', allStopTimesFor330.length);
      
      const routesServing330 = new Set();
      allStopTimesFor330.forEach(st => {
        const trip = staticData.trips.find(t => t.trip_id === st.trip_id);
        if (trip) {
          const route = staticData.routes.find(r => r.route_id === trip.route_id);
          if (route) {
            routesServing330.add(route.route_short_name);
          }
        }
      });
      
      console.log('Routes serving stop 330:', Array.from(routesServing330));
    }
    
    // Log all trip_headsigns for 8A and 8B to infer directions
    const route8A = staticData.routes.find(r => r.route_short_name === '8A');
    const route8B = staticData.routes.find(r => r.route_short_name === '8B');
    if (route8A) {
      const trips8A = staticData.trips.filter(t => t.route_id === route8A.route_id);
      console.log('8A trip_headsigns:', Array.from(new Set(trips8A.map(t => t.trip_headsign))));
    }
    if (route8B) {
      const trips8B = staticData.trips.filter(t => t.route_id === route8B.route_id);
      console.log('8B trip_headsigns:', Array.from(new Set(trips8B.map(t => t.trip_headsign))));
    }
    
  } catch (error) {
    console.error('Error testing GTFS data:', error);
  }
}

testGTFSData(); 