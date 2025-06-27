import { useState, useEffect } from 'react';

interface ConnectionStatusProps {
  isConnected: boolean;
  lastUpdate?: Date;
  error?: string;
}

export default function ConnectionStatus({ isConnected, lastUpdate, error }: ConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusColor = () => {
    if (!isOnline) return 'bg-gray-100 text-gray-800';
    if (error) return 'bg-red-100 text-red-800';
    if (isConnected) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (error) return 'Connection Error';
    if (isConnected) return 'Connected';
    return 'Connecting...';
  };

  const getStatusIcon = () => {
    if (!isOnline) return '📱';
    if (error) return '⚠️';
    if (isConnected) return '🟢';
    return '🟡';
  };

  return (
    <div className="flex flex-col items-end">
      <div
        className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}
        role="status"
        aria-live="polite"
      >
        <span className="mr-1">{getStatusIcon()}</span>
        {getStatusText()}
      </div>
      {lastUpdate && isConnected && (
        <p className="text-xs text-gray-500 mt-1">
          Updated {lastUpdate.toLocaleTimeString()}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 mt-1 max-w-xs text-right">
          {error}
        </p>
      )}
    </div>
  );
} 