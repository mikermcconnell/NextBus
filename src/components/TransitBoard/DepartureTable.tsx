import { CombinedArrival } from './hooks/useStopProcessing';
import DepartureRow from './DepartureRow';
import { FC } from 'react';

interface Props {
  arrivals: CombinedArrival[];
  formatTime: (ts: number, delay?: number, isRealtime?: boolean, treatPastAsNow?: boolean) => JSX.Element;
}

const DepartureTable: FC<Props> = ({ arrivals, formatTime }) => {
  return (
    <>
      {/* Table header */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div
          className="grid grid-cols-7 gap-2 px-4 py-3 text-sm font-semibold text-gray-700 text-center items-center"
          style={{ gridTemplateColumns: '1fr 1fr 2fr 2fr 0.8fr 1fr 1fr' }}
        >
          <div className="flex items-center justify-center">Service</div>
          <div className="flex items-center justify-center">Route #</div>
          <div className="flex items-center justify-center">Route</div>
          <div className="flex items-center justify-center">Stop</div>
          <div className="flex items-center justify-center">Platform</div>
          <div className="flex items-center justify-center">Arrives</div>
          <div className="flex items-center justify-center">Departs</div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto scrollbar-thin">
        {arrivals.map((arr, idx) => (
          <DepartureRow key={`${arr.routeId}-${arr.tripId}-${idx}`} arrival={arr} format={formatTime} />
        ))}
      </div>
    </>
  );
};

export default DepartureTable; 