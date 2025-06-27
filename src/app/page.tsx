'use client';

import { useState, useEffect } from 'react';
import TransitBoard from '@/components/TransitBoard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';

interface StopInfo {
  code: string;
  name: string;
}

interface StopNotification {
  type: 'error' | 'warning' | 'success';
  message: string;
  stopCode?: string;
}

export default function Home() {
  const [stopCodes, setStopCodes] = useState<string[]>([]);
  const [stopNames, setStopNames] = useState<Record<string, string>>({});
  const [newStopCode, setNewStopCode] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [isLoadingStops, setIsLoadingStops] = useState(false);
  const [stopLoadError, setStopLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [notifications, setNotifications] = useState<StopNotification[]>([]);

  // Fixed refresh interval at 15 seconds
  const refreshInterval = 15;

  // Handle client-side initialization
  useEffect(() => {
    setIsClient(true);
    
    // Load saved data from localStorage
    const savedStopCodes = localStorage.getItem('stopCodes');
    
    if (savedStopCodes) {
      setStopCodes(JSON.parse(savedStopCodes));
    }
  }, []);

  // Fetch stop names when component mounts
  useEffect(() => {
    async function loadStopNames() {
      setIsLoadingStops(true);
      setStopLoadError(null);
      
      try {
        console.log('Loading stop names from server API...');
        const response = await fetch('/api/gtfs-static');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch stop data: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to load stop data');
        }

        const staticData = result.data;
        const namesMap: Record<string, string> = {};
        
        console.log('Static data loaded:', {
          stopsCount: staticData.stops.length,
          cached: result.cached,
          stats: result.stats
        });
        
        // Create mapping of stop codes to stop names
        staticData.stops.forEach((stop: any) => {
          if (stop.stop_code) {
            namesMap[stop.stop_code] = stop.stop_name;
          }
        });
        
        console.log('Stop names map created:', Object.keys(namesMap).length, 'entries');
        
        setStopNames(namesMap);
        setRetryCount(0); // Reset retry count on success
      } catch (error) {
        console.error('Error loading stop names:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error loading stops';
        setStopLoadError(errorMessage);
      } finally {
        setIsLoadingStops(false);
      }
    }
    
    if (isClient) {
      loadStopNames();
    }
  }, [isClient, retryCount]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('stopCodes', JSON.stringify(stopCodes));
    }
  }, [stopCodes, isClient]);

  // Check for invalid stop codes and show notifications
  useEffect(() => {
    if (Object.keys(stopNames).length > 0 && stopCodes.length > 0) {
      const newNotifications: StopNotification[] = [];
      
      stopCodes.forEach(code => {
        if (!stopNames[code]) {
          newNotifications.push({
            type: 'error',
            message: `Stop code "${code}" not found in the system`,
            stopCode: code
          });
        }
      });
      
      setNotifications(newNotifications);
    } else {
      setNotifications([]);
    }
  }, [stopCodes, stopNames]);

  const addNotification = (notification: StopNotification) => {
    setNotifications(prev => [...prev, notification]);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== notification));
    }, 5000);
  };

  const removeNotification = (index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddStop = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate stop code format
    if (!/^[0-9]{1,6}$/.test(newStopCode.trim())) {
      addNotification({
        type: 'error',
        message: 'Stop code must be 1-6 digits only'
      });
      return;
    }
    const trimmedCode = newStopCode.trim();
    if (trimmedCode && !stopCodes.includes(trimmedCode) && stopCodes.length < 15) {
      setStopCodes([...stopCodes, trimmedCode]);
      setNewStopCode('');
    } else if (stopCodes.includes(trimmedCode)) {
      addNotification({
        type: 'warning',
        message: `Stop code "${trimmedCode}" is already added`
      });
    } else if (stopCodes.length >= 15) {
      addNotification({
        type: 'warning',
        message: 'Maximum of 15 stops allowed'
      });
    }
  };

  // Auto-add stop when user types and presses Enter or when valid code is entered
  const handleStopCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewStopCode(value);
    
    // Auto-add if it's a valid stop code (1-6 digits) and not already added
    if (/^[0-9]{1,6}$/.test(value.trim()) && !stopCodes.includes(value.trim()) && stopCodes.length < 15) {
      // Add a small delay to allow user to finish typing
      setTimeout(() => {
        if (value === newStopCode && /^[0-9]{1,6}$/.test(value.trim())) {
          setStopCodes([...stopCodes, value.trim()]);
          setNewStopCode('');
        }
      }, 1000);
    }
  };

  const handleRemoveStop = (stopCode: string) => {
    setStopCodes(stopCodes.filter((code) => code !== stopCode));
  };

  const handleRetryLoadStops = () => {
    setRetryCount(prev => prev + 1);
  };

  // Don't render until client-side initialization is complete
  if (!isClient) {
    return (
      <main className="min-h-screen p-4 md:p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-blue-700 mb-8">
            Barrie Transit Live Departures
          </h1>
          <div className="bg-white shadow-lg rounded-lg p-6">
            <LoadingSpinner message="Initializing..." />
          </div>
        </div>
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <main className="min-h-screen p-4 md:p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-blue-700 mb-8">
            Barrie Transit Live Departures
          </h1>

          {/* Notifications */}
          {notifications.length > 0 && (
            <div className="mb-6 space-y-2">
              {notifications.map((notification, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border flex items-center justify-between ${
                    notification.type === 'error'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : notification.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      : 'bg-green-50 border-green-200 text-green-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {notification.type === 'error' ? '❌' : notification.type === 'warning' ? '⚠️' : '✅'}
                    </span>
                    <span className="font-medium">{notification.message}</span>
                    {notification.stopCode && (
                      <button
                        onClick={() => handleRemoveStop(notification.stopCode!)}
                        className="ml-2 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                      >
                        Remove Stop
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => removeNotification(index)}
                    className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-8">
            <div className="bg-white shadow-lg rounded-lg p-6">
              <h2 className="text-2xl font-bold text-blue-700 mb-4">Add Stop Code (max 15)</h2>
              <form onSubmit={handleAddStop} className="space-y-4">
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="stopCode"
                      value={newStopCode}
                      onChange={handleStopCodeChange}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter stop code"
                      aria-label="Stop Code"
                      disabled={stopCodes.length >= 15}
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      disabled={!newStopCode || stopCodes.length >= 15}
                    >
                      Add Stop
                    </button>
                  </div>
                </div>
              </form>

              {stopCodes.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-gray-700 mb-2">Monitored Stops</h3>
                  <div className="flex flex-wrap gap-2">
                    {stopCodes.map((code) => (
                      <div
                        key={code}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                          stopNames[code] ? 'bg-gray-100' : 'bg-red-100 border border-red-300'
                        }`}
                      >
                        <span className={`font-medium ${stopNames[code] ? 'text-gray-700' : 'text-red-700'}`}>
                          {code}
                        </span>
                        {stopNames[code] ? (
                          <span className="text-gray-500 text-sm">- {stopNames[code]}</span>
                        ) : (
                          <span className="text-red-500 text-sm">- Not Found</span>
                        )}
                        <button
                          onClick={() => handleRemoveStop(code)}
                          className="text-red-500 hover:text-red-700 focus:outline-none"
                          aria-label={`Remove stop ${code}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error handling for stop loading */}
              {stopLoadError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm text-red-600 mb-2">
                    Error loading stops: {stopLoadError}
                  </p>
                  <button
                    onClick={handleRetryLoadStops}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {stopCodes.length > 0 ? (
              <ErrorBoundary fallback={
                <div className="bg-white shadow-lg rounded-lg p-6">
                  <div className="text-center text-red-600">
                    <p className="mb-2">⚠️ Error loading transit data</p>
                    <p className="text-sm">Please refresh the page or try again later.</p>
                  </div>
                </div>
              }>
                <TransitBoard stopCodes={stopCodes} stopNames={stopNames} refreshInterval={refreshInterval} />
              </ErrorBoundary>
            ) : (
              <div className="bg-white shadow-lg rounded-lg p-6">
                <p className="text-center text-gray-600">
                  Add stop codes above to see departure times
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </ErrorBoundary>
  );
} 