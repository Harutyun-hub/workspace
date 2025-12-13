import { DashboardFilters } from './DashboardFilters';
import { InstagramPerformance } from './InstagramPerformance';
import { FacebookAds } from './FacebookAds';
import { RefreshCw } from 'lucide-react';

export function Dashboard() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Dashboard Header */}
      <div className="backdrop-blur-xl bg-white/30 border-b border-white/60 px-4 md:px-8 py-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-gray-800">Analytics Dashboard</h1>
            <p className="text-gray-500 text-sm">Campaign Performance Overview</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/50 hover:bg-white/70 border border-white/80 transition-all text-gray-700 shadow-sm">
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
        <DashboardFilters />
        <InstagramPerformance />
        <FacebookAds />
      </div>
    </div>
  );
}
