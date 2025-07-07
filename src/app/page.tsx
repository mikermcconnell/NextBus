'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';
import { APP_CONFIG } from '@/config/app';
import TransitBoard from '@/components/TransitBoard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useDebounce } from '@/hooks/useDebounce';

interface StopInfo {
  code: string;
  name: string;
}

interface StopNotification {
  type: 'error' | 'warning' | 'success';
  message: string;
  stopCode?: string;
  id?: string;
}

// Suggested configurations
const SUGGESTED_CONFIGS = [
  {
    name: 'Georgian College',
    stops: ['330', '331', '335', '329']
  },
  // Add more suggested configs here if needed
];

// ------------------------------
// Stop code validation
// ------------------------------
const StopCodeSchema = z
  .string()
  .regex(/^[0-9]{1,6}$/, { message: 'Stop code must be 1-6 digits' })
  .refine((code: string) => code !== '000000', { message: 'Invalid stop code' });

const validateStopCode = (code: string): string | null => {
  const trimmed = code.trim();
  const result = StopCodeSchema.safeParse(trimmed);
  return result.success ? trimmed : null;
};

export default function Home() {
  const [stopCodes, setStopCodes] = useState<string[]>([]);
  const [stopNames, setStopNames] = useState<Record<string, string>>({});
  const [newStopCode, setNewStopCode] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [isLoadingStops, setIsLoadingStops] = useState(false);
  const [stopLoadError, setStopLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [notifications, setNotifications] = useState<StopNotification[]>([]);
  const [suggestedStops, setSuggestedStops] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [savedConfigs, setSavedConfigs] = useState<{ name: string; stops: string[] }[]>([]);
  const [newConfigName, setNewConfigName] = useState('');
  
  // Track notification timeouts for cleanup
  const notificationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Debounce the stop code input for auto-add functionality
  const debouncedStopCode = useDebounce(newStopCode, APP_CONFIG.DEBOUNCE_DELAY);

  // Fixed refresh interval at 15 seconds
  const refreshInterval = 15;

  // Highlighted loading overlay condition – only while initial stop data is loading and nothing else is displayed yet
  const showInitialDataLoading = isLoadingStops && stopCodes.length === 0 && Object.keys(stopNames).length === 0;

  // Handle client-side initialization
  useEffect(() => {
    setIsClient(true);
    
    // Load saved data from localStorage
    const savedStopCodes = localStorage.getItem('stopCodes');
    
    if (savedStopCodes) {
      setStopCodes(JSON.parse(savedStopCodes));
    }
    const configs = localStorage.getItem('savedConfigs');
    if (configs) {
      setSavedConfigs(JSON.parse(configs));
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
        
        // DEBUG: Check for stop 330 specifically
        const stop330 = staticData.stops.find((stop: any) => stop.stop_code === '330');
        console.log('DEBUG: Stop 330 found in static data:', stop330);
        
        // DEBUG: Check for route 400 specifically
        const route400 = staticData.routes.find((route: any) => route.route_short_name === '400');
        console.log('DEBUG: Route 400 found in static data:', route400);
        
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
    } else if (Object.keys(stopNames).length > 0) {
      // Clear notifications when stops are loaded but no stop codes are present
      setNotifications([]);
    }
  }, [stopCodes, stopNames]);

  const addNotification = useCallback((notification: StopNotification) => {
    const id = `${Date.now()}-${Math.random()}`;
    const notificationWithId = { ...notification, id };
    
    setNotifications(prev => [...prev, notificationWithId]);
    
    // Set up auto-removal with cleanup tracking
    const timeoutId = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      notificationTimeouts.current.delete(id);
    }, 5000);
    
    // Track timeout for cleanup
    notificationTimeouts.current.set(id, timeoutId);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    // Clear timeout if exists
    const timeoutId = notificationTimeouts.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      notificationTimeouts.current.delete(id);
    }
  }, []);

  const handleAddStop = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if stop data is still loading
    if (isLoadingStops) {
      addNotification({
        type: 'warning',
        message: 'Please wait for stop data to load before adding stops'
      });
      return;
    }
    
    // Check if stop data failed to load
    if (stopLoadError) {
      addNotification({
        type: 'error',
        message: 'Stop data failed to load. Please retry loading stops first.'
      });
      return;
    }
    
    // Validate stop code format & content
    if (!validateStopCode(newStopCode)) {
      addNotification({
        type: 'error',
        message: 'Stop code must be 1-6 digits and not an invalid placeholder'
      });
      return;
    }
    
    const trimmedCode = validateStopCode(newStopCode)!;
    
    // Check if stop exists in the system
    if (!stopNames[trimmedCode]) {
      addNotification({
        type: 'error',
        message: `Stop code "${trimmedCode}" not found in the transit system`
      });
      return;
    }
    
    if (trimmedCode && !stopCodes.includes(trimmedCode) && stopCodes.length < APP_CONFIG.MAX_STOPS) {
      setStopCodes([...stopCodes, trimmedCode]);
      setNewStopCode('');
      addNotification({
        type: 'success',
        message: `Added stop "${trimmedCode}" - ${stopNames[trimmedCode]}`
      });
    } else if (stopCodes.includes(trimmedCode)) {
      addNotification({
        type: 'warning',
        message: `Stop code "${trimmedCode}" is already added`
      });
    } else if (stopCodes.length >= APP_CONFIG.MAX_STOPS) {
      addNotification({
        type: 'warning',
        message: 'Maximum of 15 stops allowed'
      });
    }
  };

  // Enhanced autocomplete handler
  const handleStopCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewStopCode(value);
    setSelectedSuggestionIndex(-1); // Reset selection when typing
    
    // Generate suggestions based on input
    if (value.trim()) {
      const searchTerm = value.toLowerCase();
      const suggestions = Object.keys(stopNames)
        .filter(code => 
          code.includes(value) || 
          stopNames[code].toLowerCase().includes(searchTerm)
        )
        .sort((a, b) => {
          // Prioritize exact matches first
          if (a === value) return -1;
          if (b === value) return 1;
          if (stopNames[a].toLowerCase().startsWith(searchTerm)) return -1;
          if (stopNames[b].toLowerCase().startsWith(searchTerm)) return 1;
          return 0;
        })
        .slice(0, 8); // Show more suggestions
      setSuggestedStops(suggestions);
    } else {
      setSuggestedStops([]);
    }
  }, [stopNames]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestedStops.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestedStops.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestedStops.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestedStops.length) {
          const selectedCode = suggestedStops[selectedSuggestionIndex];
          setNewStopCode(selectedCode);
          setSuggestedStops([]);
          setSelectedSuggestionIndex(-1);
        }
        break;
      case 'Escape':
        setSuggestedStops([]);
        setSelectedSuggestionIndex(-1);
        break;
    }
  }, [suggestedStops, selectedSuggestionIndex]);

  // Auto-add effect using debounced value
  useEffect(() => {
    const trimmedCode = debouncedStopCode.trim();
    
    // Auto-add if conditions are met
    if (trimmedCode &&
        validateStopCode(trimmedCode) && 
        !stopCodes.includes(trimmedCode) && 
        stopCodes.length < APP_CONFIG.MAX_STOPS &&
        !isLoadingStops &&
        !stopLoadError &&
        Object.keys(stopNames).length > 0 &&
        stopNames[trimmedCode]) {
      
      setStopCodes(prev => [...prev, trimmedCode]);
      setNewStopCode('');
      addNotification({
        type: 'success',
        message: `Added stop "${trimmedCode}" - ${stopNames[trimmedCode]}`
      });
    }
  }, [debouncedStopCode, stopCodes, isLoadingStops, stopLoadError, stopNames, addNotification]);

  const handleRemoveStop = (stopCode: string) => {
    setStopCodes(stopCodes.filter((code) => code !== stopCode));
  };

  const handleRetryLoadStops = () => {
    setRetryCount(prev => prev + 1);
  };

  // Auto-retry loading stops if they fail and user is trying to use the app
  useEffect(() => {
    if (stopLoadError && !isLoadingStops && stopCodes.length === 0) {
      const retryTimer = setTimeout(() => {
        console.log('Auto-retrying stop data load due to error...');
        handleRetryLoadStops();
      }, 5000); // Retry after 5 seconds
      
      return () => clearTimeout(retryTimer);
    }
  }, [stopLoadError, isLoadingStops, stopCodes.length]);

  // Cleanup all notification timers on unmount
  useEffect(() => {
    return () => {
      notificationTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      notificationTimeouts.current.clear();
    };
  }, []);

  // Save current stops as a new config
  const handleSaveConfig = () => {
    const trimmedName = newConfigName.trim();
    if (!trimmedName) return;
    if (stopCodes.length === 0) return;
    if (savedConfigs.some(cfg => cfg.name === trimmedName)) return;
    setSavedConfigs([...savedConfigs, { name: trimmedName, stops: stopCodes }]);
    setNewConfigName('');
  };

  // Load a config (replace current stops)
  const handleLoadConfig = (stops: string[]) => {
    setStopCodes(stops);
  };

  // Delete a saved config
  const handleDeleteConfig = (name: string) => {
    setSavedConfigs(savedConfigs.filter(cfg => cfg.name !== name));
  };

  // Early full-screen loading while waiting for hydration
  if (!isClient) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        {/* Full-screen overlay with extra-large spinner */}
        <LoadingSpinner size="xl" message="Loading transit data..." />
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <main className="min-h-screen p-4 md:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-blue-700 mb-8 relative">
            Barrie Transit Live Departures
          </h1>

          {/* Overlay during initial load if rendered within main (fallback) */}
          {showInitialDataLoading && (
            <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-50">
              <LoadingSpinner size="xl" message="Loading transit data..." />
            </div>
          )}

          {/* Notifications */}
          {notifications.length > 0 && (
            <div className="mb-6 space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id || `${notification.type}-${notification.message}`}
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
                    onClick={() => removeNotification(notification.id || '')}
                    className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Configurations UI */}
          <div className="mb-6 grid gap-2 md:grid-cols-2">
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="font-bold text-barrie-blue mb-2">Suggested Configurations</h3>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_CONFIGS.map(cfg => (
                  <button
                    key={cfg.name}
                    className="px-3 py-1 bg-barrie-blue text-white rounded hover:bg-blue-800"
                    onClick={() => handleLoadConfig(cfg.stops)}
                  >
                    {cfg.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="font-bold text-barrie-blue mb-2">Your Saved Configurations</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {savedConfigs.length === 0 && <span className="text-gray-500">No saved configs yet</span>}
                {savedConfigs.map(cfg => (
                  <div key={cfg.name} className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1">
                    <button
                      className="font-medium text-barrie-blue hover:underline"
                      onClick={() => handleLoadConfig(cfg.stops)}
                    >
                      {cfg.name}
                    </button>
                    <button
                      className="text-red-500 hover:text-red-700 ml-1"
                      onClick={() => handleDeleteConfig(cfg.name)}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  className="border px-2 py-1 rounded flex-1"
                  placeholder="Save current as..."
                  value={newConfigName}
                  onChange={e => setNewConfigName(e.target.value)}
                  maxLength={32}
                />
                <button
                  className="px-3 py-1 bg-barrie-blue text-white rounded hover:bg-blue-800"
                  onClick={handleSaveConfig}
                  disabled={!newConfigName.trim() || stopCodes.length === 0 || savedConfigs.some(cfg => cfg.name === newConfigName.trim())}
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="bg-white shadow-lg rounded-lg p-2 mb-1">
              <h2 className="text-xl font-bold text-barrie-blue mb-2">
                Add Stop Code
                {isLoadingStops && <span className="text-sm font-normal text-gray-500 ml-2">- Loading stops...</span>}
              </h2>
              <form onSubmit={handleAddStop} className="space-y-2">
                <div className="relative">
                  <div className="flex gap-1 items-center">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        id="stopCode"
                        value={newStopCode}
                        onChange={handleStopCodeChange}
                        onKeyDown={handleKeyDown}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-barrie-blue focus:border-barrie-blue disabled:opacity-50"
                        placeholder={isLoadingStops ? "Loading stops..." : "Type stop code or name..."}
                        aria-label="Stop Code or Name"
                        disabled={stopCodes.length >= APP_CONFIG.MAX_STOPS || isLoadingStops}
                        autoComplete="off"
                      />
                      
                      {/* Autocomplete dropdown */}
                      {suggestedStops.length > 0 && newStopCode.trim() && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {suggestedStops.map((code, index) => (
                            <button
                              key={code}
                              type="button"
                              className={`w-full px-3 py-2 text-left text-sm focus:outline-none ${
                                index === selectedSuggestionIndex 
                                  ? 'bg-barrie-blue text-white' 
                                  : 'hover:bg-gray-100'
                              } ${
                                index === 0 ? 'rounded-t-md' : ''
                              } ${index === suggestedStops.length - 1 ? 'rounded-b-md' : ''}`}
                              onClick={() => {
                                setNewStopCode(code);
                                setSuggestedStops([]);
                                setSelectedSuggestionIndex(-1);
                              }}
                              onMouseEnter={() => setSelectedSuggestionIndex(index)}
                            >
                              <div className="flex justify-between items-center">
                                <span className={`font-medium ${
                                  index === selectedSuggestionIndex ? 'text-white' : 'text-gray-900'
                                }`}>{code}</span>
                                <span className={`text-xs ${
                                  index === selectedSuggestionIndex ? 'text-blue-100' : 'text-gray-500'
                                }`}>{stopNames[code]}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm bg-barrie-blue text-white rounded hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-barrie-blue disabled:opacity-50"
                      disabled={!newStopCode || stopCodes.length >= APP_CONFIG.MAX_STOPS || isLoadingStops || !!stopLoadError}
                    >
                      {isLoadingStops ? 'Loading...' : 'Add'}
                    </button>
                  </div>
                  
                  {/* Help text */}
                  <div className="mt-1 text-xs text-gray-500">
                    Type a stop code (e.g., "330") or stop name (e.g., "Georgian") to see suggestions
                  </div>
                </div>
              </form>

              {stopCodes.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-gray-700">Monitored Stops</h3>
                    <button
                      onClick={() => setStopCodes([])}
                      className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800"
                    >
                      Start Fresh
                    </button>
                  </div>
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
                <div className="mt-2" style={{ maxHeight: '700px', minHeight: '400px' }}>
                  <TransitBoard stopCodes={stopCodes} stopNames={stopNames} refreshInterval={refreshInterval} />
                </div>
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