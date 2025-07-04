/**
 * Extracts a Unix timestamp from GTFS protobuf timestamp objects
 * Handles both Long objects and regular numbers
 */
export const extractTimestamp = (timestamp: any): number => {
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  
  if (typeof timestamp === 'object' && timestamp?.low !== undefined) {
    const high = timestamp.high || 0;
    return timestamp.low + (high * 0x100000000);
  }
  
  throw new Error('Invalid timestamp format');
};

/**
 * Formats data age in minutes to human-readable string
 */
export const formatDataAge = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  if (minutes < 1440) { // Less than 24 hours
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  
  // More than 24 hours
  const days = Math.floor(minutes / 1440);
  const remainingHours = Math.floor((minutes % 1440) / 60);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
};

/**
 * Calculates age of data in minutes from timestamp
 */
export const calculateDataAge = (timestamp: any): number => {
  try {
    const timestampValue = extractTimestamp(timestamp);
    const feedDate = new Date(timestampValue * 1000);
    const now = new Date();
    return Math.floor((now.getTime() - feedDate.getTime()) / (1000 * 60));
  } catch (error) {
    console.warn('Failed to calculate data age:', error);
    return 0;
  }
}; 