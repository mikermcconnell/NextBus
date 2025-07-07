import Image from 'next/image';
import { CombinedArrival } from './hooks/useStopProcessing';
import React, { FC, memo } from 'react';
import { sanitizeText } from '@/utils/sanitize';

interface Props {
  arrival: CombinedArrival;
  format: (ts: number, delay?: number, isRealtime?: boolean, treatPastAsNow?: boolean) => JSX.Element;
}

const DepartureRowComponent: FC<Props> = ({ arrival, format }) => {
  const destination = arrival.tripId.includes('Red Express') ? 'Red' : arrival.tripId.split(' to')[0].trim();

  return (
    <div
      className="grid grid-cols-8 gap-2 px-4 py-3 border-b border-gray-200 hover:bg-gray-50"
      style={{ gridTemplateColumns: '1fr 1fr 1fr 2fr 2fr 0.8fr 1fr 1fr' }}
    >
      {/* Service Logo */}
      <div className="flex items-center justify-center">
        {arrival.routeId.includes('68') ? (
          <Image src="/go-transit-logo.svg" alt="GO Transit" width={40} height={20} className="object-contain" />
        ) : (
          <Image src="/barrie-transit-logo.png" alt="Barrie Transit" width={80} height={40} className="object-contain" />
        )}
      </div>

      {/* Route # */}
      <div className="font-bold text-lg text-barrie-blue flex items-center justify-center transit-route-cell">
        {arrival.routeId}
      </div>

      {/* Direction */}
      <div className="text-sm font-medium text-gray-700 flex items-center justify-center">
        {arrival.direction ? arrival.direction.replace(/^[a-z]/, c => c.toUpperCase()) : '-'}
      </div>

      {/* Destination */}
      <div className="font-medium text-gray-900 text-sm leading-tight flex items-center justify-center h-full">
        <div className="break-words whitespace-normal text-center max-h-10 overflow-hidden w-full">
          {sanitizeText(destination)}
        </div>
      </div>

      {/* Stop */}
      <div className="text-xs leading-tight flex items-center justify-center h-full">
        <div className="font-medium text-gray-900 break-words whitespace-normal text-center max-h-10 overflow-hidden w-full">
          {sanitizeText(`${arrival.stopCode} - ${arrival.stopName}`)}
        </div>
      </div>

      {/* Platform */}
      <div className="text-center font-medium flex items-center justify-center">
        {arrival.platform ?? '-'}
      </div>

      {/* Arrives */}
      <div className="font-bold flex items-center justify-center">
        <div className="flex flex-col items-center">
          {format(arrival.arrivalTime, arrival.delay, arrival.isRealtime)}
          {arrival.pairedEstimate && <span className="text-xs text-blue-600 mt-1">~paired</span>}
        </div>
      </div>

      {/* Departs = arrival +1min */}
      <div className="font-bold flex items-center justify-center">
        {format(arrival.arrivalTime + 60000, arrival.delay, arrival.isRealtime, true)}
      </div>
    </div>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders when props are unchanged
const DepartureRow = memo(DepartureRowComponent);

export default DepartureRow; 