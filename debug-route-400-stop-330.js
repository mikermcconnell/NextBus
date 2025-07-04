const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function debugRoute400Stop330() {
  console.log('🔍 Debugging Route 400 at Stop 330...\n');
  
  try {
    // Fetch static GTFS data
    console.log('📡 Fetching static GTFS data...');
    const response = await fetch('http://localhost:3000/api/gtfs-static');
    const data = await response.json();
    
    if (!data.success) {
      console.error('❌ Failed to fetch static data:', data.error);
      return;
    }
    
    const staticData = data.data;
    console.log('✅ Static data loaded successfully');
    
    // Debug: Check the structure of staticData
    console.log('\n🔍 Static data structure:');
    console.log('Available properties:', Object.keys(staticData));
    console.log('stops count:', staticData.stops?.length || 'undefined');
    console.log('routes count:', staticData.routes?.length || 'undefined');
    console.log('trips count:', staticData.trips?.length || 'undefined');
    console.log('stop_times count:', staticData.stop_times?.length || 'undefined');
    console.log('stopTimes count:', staticData.stopTimes?.length || 'undefined');
    
    // Find stop 330
    console.log('\n📍 Looking for Stop 330...');
    const stop330 = staticData.stops.find(stop => stop.stop_code === '330');
    if (!stop330) {
      console.error('❌ Stop 330 not found in stops data');
      return;
    }
    console.log('✅ Stop 330 found:', {
      stop_id: stop330.stop_id,
      stop_code: stop330.stop_code,
      stop_name: stop330.stop_name
    });
    
    // Find route 400
    console.log('\n🚌 Looking for Route 400...');
    const route400 = staticData.routes.find(route => route.route_short_name === '400');
    if (!route400) {
      console.error('❌ Route 400 not found in routes data');
      return;
    }
    console.log('✅ Route 400 found:', {
      route_id: route400.route_id,
      route_short_name: route400.route_short_name,
      route_long_name: route400.route_long_name
    });
    
    // Find trips for route 400
    console.log('\n🎫 Looking for trips on Route 400...');
    const route400Trips = staticData.trips.filter(trip => trip.route_id === route400.route_id);
    console.log(`✅ Found ${route400Trips.length} trips for Route 400`);
    
    if (route400Trips.length > 0) {
      console.log('Sample trips:', route400Trips.slice(0, 3).map(trip => ({
        trip_id: trip.trip_id,
        trip_headsign: trip.trip_headsign
      })));
    }
    
    // Find stop times for stop 330 - try both possible property names
    console.log('\n⏰ Looking for stop times at Stop 330...');
    const stopTimes = staticData.stop_times || staticData.stopTimes;
    if (!stopTimes) {
      console.error('❌ No stop_times or stopTimes property found in static data');
      return;
    }
    
    const stop330Times = stopTimes.filter(st => st.stop_id === stop330.stop_id);
    console.log(`✅ Found ${stop330Times.length} stop times for Stop 330`);
    
    // Check if any route 400 trips stop at stop 330
    console.log('\n🔗 Checking if Route 400 trips stop at Stop 330...');
    const route400TripIds = new Set(route400Trips.map(trip => trip.trip_id));
    const route400AtStop330 = stop330Times.filter(st => route400TripIds.has(st.trip_id));
    
    console.log(`✅ Found ${route400AtStop330.length} Route 400 stop times at Stop 330`);
    
    if (route400AtStop330.length > 0) {
      console.log('\n📋 Route 400 times at Stop 330:');
      route400AtStop330.slice(0, 10).forEach(st => {
        const trip = route400Trips.find(t => t.trip_id === st.trip_id);
        console.log(`  ${st.arrival_time || st.departure_time} - ${trip?.trip_headsign || 'Unknown'}`);
      });
      
      // Check current time and filter for upcoming departures
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;
      
      console.log(`\n🕐 Current time: ${now.toLocaleTimeString()} (${currentTimeMinutes} minutes)`);
      
      const upcomingRoute400 = route400AtStop330.filter(st => {
        const timeStr = st.arrival_time || st.departure_time;
        if (!timeStr) return false;
        
        const [hours, minutes] = timeStr.split(':').map(Number);
        let scheduledMinutes = hours * 60 + minutes;
        
        // Handle times after midnight
        if (scheduledMinutes < currentTimeMinutes) {
          scheduledMinutes += 24 * 60; // Add 24 hours
        }
        
        const minutesUntil = scheduledMinutes - currentTimeMinutes;
        return minutesUntil >= -1 && minutesUntil <= 60;
      });
      
      console.log(`✅ Found ${upcomingRoute400.length} upcoming Route 400 departures at Stop 330 (within 60 minutes)`);
      
      if (upcomingRoute400.length > 0) {
        console.log('\n🚀 Upcoming Route 400 departures:');
        upcomingRoute400.forEach(st => {
          const trip = route400Trips.find(t => t.trip_id === st.trip_id);
          const timeStr = st.arrival_time || st.departure_time;
          const [hours, minutes] = timeStr.split(':').map(Number);
          let scheduledMinutes = hours * 60 + minutes;
          
          if (scheduledMinutes < currentTimeMinutes) {
            scheduledMinutes += 24 * 60;
          }
          
          const minutesUntil = scheduledMinutes - currentTimeMinutes;
          console.log(`  ${timeStr} (${minutesUntil} min) - ${trip?.trip_headsign || 'Unknown'}`);
        });
      } else {
        console.log('❌ No upcoming Route 400 departures found within 60 minutes');
      }
    } else {
      console.log('❌ No Route 400 trips found that stop at Stop 330');
    }
    
    // Check real-time data for route 400
    console.log('\n📡 Checking real-time data for Route 400...');
    try {
      const rtResponse = await fetch('http://localhost:3000/api/gtfs/TripUpdates');
      const rtData = await rtResponse.json();
      
      if (rtData.success && rtData.data?.data) {
        console.log('✅ Real-time data available');
        
        // Parse protobuf data
        const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
        const base64Data = rtData.data.data;
        const binaryData = Buffer.from(base64Data, 'base64');
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(binaryData);
        
        console.log(`📊 Real-time feed has ${feed.entity?.length || 0} entities`);
        
        // Look for route 400 in real-time data
        const route400Realtime = feed.entity?.filter(entity => {
          const routeId = entity.tripUpdate?.trip?.routeId;
          return routeId && staticData.routes.find(r => r.route_id === routeId)?.route_short_name === '400';
        }) || [];
        
        console.log(`✅ Found ${route400Realtime.length} real-time updates for Route 400`);
        
        if (route400Realtime.length > 0) {
          console.log('Sample real-time Route 400 updates:');
          route400Realtime.slice(0, 3).forEach(entity => {
            const stopUpdates = entity.tripUpdate?.stopTimeUpdate || [];
            const stop330Updates = stopUpdates.filter(su => su.stopId === stop330.stop_id);
            console.log(`  Trip ${entity.tripUpdate.trip.tripId}: ${stop330Updates.length} updates for Stop 330`);
          });
        }
      } else {
        console.log('❌ No real-time data available');
      }
    } catch (rtError) {
      console.log('❌ Error fetching real-time data:', rtError.message);
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

debugRoute400Stop330(); 