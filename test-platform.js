// Script to check platform_code for stop #1
(async () => {
  const res = await fetch('http://localhost:3000/api/gtfs-static');
  const data = await res.json();
  if (!data.success) {
    console.error('Failed to load GTFS static data');
    return;
  }
  const stop1 = data.data.stops.find(s => s.stop_code === '1');
  if (!stop1) {
    console.log('Stop #1 not found');
    return;
  }
  const stopTimesArr = data.data.stop_times || data.data.stopTimes || [];
  const stopTimes = stopTimesArr.filter(st => st.stop_id === stop1.stop_id);
  const withPlatform = stopTimes.filter(st => st.platform_code && st.platform_code.trim() !== '');
  console.log(`Found ${withPlatform.length} stop_times with platform_code for stop #1`);
  withPlatform.slice(0, 10).forEach(st => {
    console.log(`Trip: ${st.trip_id}, Platform: ${st.platform_code}`);
  });
})(); 