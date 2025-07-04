const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testStop330InApp() {
  console.log('🧪 Testing Stop 330 in the web application...\n');
  
  try {
    // Test the API endpoint that the TransitBoard component uses
    console.log('📡 Testing GTFS static API endpoint...');
    const response = await fetch('http://localhost:3000/api/gtfs-static');
    const data = await response.json();
    
    if (!data.success) {
      console.error('❌ Failed to fetch static data:', data.error);
      return;
    }
    
    const staticData = data.data;
    console.log('✅ Static data loaded successfully');
    
    // Check if stopTimes property exists (this was the bug)
    if (!staticData.stopTimes) {
      console.error('❌ stopTimes property not found in static data');
      return;
    }
    console.log(`✅ stopTimes property found with ${staticData.stopTimes.length} entries`);
    
    // Find stop 330
    const stop330 = staticData.stops.find(stop => stop.stop_code === '330');
    if (!stop330) {
      console.error('❌ Stop 330 not found');
      return;
    }
    console.log('✅ Stop 330 found:', stop330.stop_name);
    
    // Find route 400
    const route400 = staticData.routes.find(route => route.route_short_name === '400');
    if (!route400) {
      console.error('❌ Route 400 not found');
      return;
    }
    console.log('✅ Route 400 found:', route400.route_long_name);
    
    // Check if route 400 serves stop 330
    const route400Trips = staticData.trips.filter(trip => trip.route_id === route400.route_id);
    const route400TripIds = new Set(route400Trips.map(trip => trip.trip_id));
    
    const stop330Times = staticData.stopTimes.filter(st => st.stop_id === stop330.stop_id);
    const route400AtStop330 = stop330Times.filter(st => route400TripIds.has(st.trip_id));
    
    console.log(`✅ Found ${route400AtStop330.length} Route 400 stop times at Stop 330`);
    
    if (route400AtStop330.length > 0) {
      console.log('\n📋 Sample Route 400 times at Stop 330:');
      route400AtStop330.slice(0, 5).forEach(st => {
        const trip = route400Trips.find(t => t.trip_id === st.trip_id);
        console.log(`  ${st.arrival_time || st.departure_time} - ${trip?.trip_headsign || 'Unknown'}`);
      });
      
      // Check current time and upcoming departures
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;
      
      const upcomingRoute400 = route400AtStop330.filter(st => {
        const timeStr = st.arrival_time || st.departure_time;
        if (!timeStr) return false;
        
        const [hours, minutes] = timeStr.split(':').map(Number);
        let scheduledMinutes = hours * 60 + minutes;
        
        if (scheduledMinutes < currentTimeMinutes) {
          scheduledMinutes += 24 * 60;
        }
        
        const minutesUntil = scheduledMinutes - currentTimeMinutes;
        return minutesUntil >= -1 && minutesUntil <= 60;
      });
      
      console.log(`\n🚀 Found ${upcomingRoute400.length} upcoming Route 400 departures within 60 minutes`);
      
      if (upcomingRoute400.length > 0) {
        console.log('This should now appear in the web application when stop 330 is added!');
      }
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('💡 The fix should now allow Route 400 to appear for Stop 330 in the web application.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testStop330InApp(); 