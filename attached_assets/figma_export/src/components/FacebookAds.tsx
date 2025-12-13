import { ChevronDown } from 'lucide-react';

const adsData = [
  { pageName: 'Debug Page', platform: '-', adText: '*test ad body ...', url: 'View', imageUrl: 'View', ctaType: '-', displayFormat: '-', startDate: '-', endDate: '-' },
  { pageName: 'Superbet', platform: '["FACEBOOK"...]', adText: '{"text":"🔥 Azi...', url: 'View', imageUrl: '-', ctaType: 'GET_OFFER', displayFormat: 'DCO', startDate: '2025-11-30T0...', endDate: '2025-12-01T0...' },
  { pageName: 'Superbet', platform: '["FACEBOOK"...]', adText: '{"text":"🔥 Azi...', url: 'View', imageUrl: '-', ctaType: 'LEARN_MORE', displayFormat: 'VIDEO', startDate: '2025-11-30T0...', endDate: '2025-12-01T0...' },
  { pageName: 'Superbet', platform: '["FACEBOOK"...]', adText: '{"text":"👊 🤑 S...', url: 'View', imageUrl: '-', ctaType: 'LEARN_MORE', displayFormat: 'DCO', startDate: '2025-11-28T0...', endDate: '2025-12-01T0...' },
  { pageName: 'Superbet', platform: '["FACEBOOK"...]', adText: '{"text":"🔥 No...', url: 'View', imageUrl: '-', ctaType: 'LEARN_MORE', displayFormat: 'DCO', startDate: '2025-11-28T0...', endDate: '-' },
  { pageName: 'TotoGaming R...', platform: '["FACEBOOK"]', adText: '{"text":"💸 Pre...', url: 'View', imageUrl: 'View', ctaType: '-', displayFormat: 'IMAGE', startDate: '2025-11-28T0...', endDate: '2025-11-28T0...' },
];

export function FacebookAds() {
  return (
    <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-gray-800">Facebook Ads</h2>
          <span className="px-2 py-1 rounded-md bg-white/50 text-gray-600 text-xs">
            129 ads
          </span>
        </div>
        <button className="p-1 hover:bg-white/50 rounded-lg transition-all">
          <ChevronDown className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      {/* Table */}
      <div className="backdrop-blur-xl bg-white/30 rounded-xl border border-white/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-blue-600">
                <th className="px-4 py-3 text-left text-white text-sm whitespace-nowrap">PAGE NAME</th>
                <th className="px-4 py-3 text-left text-white text-sm whitespace-nowrap">PLATFORM</th>
                <th className="px-4 py-3 text-left text-white text-sm whitespace-nowrap">AD TEXT</th>
                <th className="px-4 py-3 text-left text-white text-sm whitespace-nowrap">URL</th>
                <th className="px-4 py-3 text-left text-white text-sm whitespace-nowrap">IMAGE URL</th>
                <th className="px-4 py-3 text-left text-white text-sm whitespace-nowrap">CTA TYPE</th>
                <th className="px-4 py-3 text-left text-white text-sm whitespace-nowrap">DISPLAY FORMAT</th>
                <th className="px-4 py-3 text-left text-white text-sm whitespace-nowrap">START DATE</th>
                <th className="px-4 py-3 text-left text-white text-sm whitespace-nowrap">END DATE</th>
              </tr>
            </thead>
            <tbody className="bg-white/20">
              {adsData.map((row, index) => (
                <tr 
                  key={index}
                  className="border-b border-white/40 hover:bg-white/30 transition-all"
                >
                  <td className="px-4 py-3 text-gray-800 text-sm whitespace-nowrap">{row.pageName}</td>
                  <td className="px-4 py-3 text-gray-700 text-sm max-w-[150px] truncate">{row.platform}</td>
                  <td className="px-4 py-3 text-gray-700 text-sm max-w-[200px] truncate">{row.adText}</td>
                  <td className="px-4 py-3">
                    {row.url === 'View' ? (
                      <button className="text-blue-600 hover:text-blue-700 text-sm">
                        View
                      </button>
                    ) : (
                      <span className="text-gray-700 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.imageUrl === 'View' ? (
                      <button className="text-blue-600 hover:text-blue-700 text-sm">
                        View
                      </button>
                    ) : (
                      <span className="text-gray-700 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-sm whitespace-nowrap">{row.ctaType}</td>
                  <td className="px-4 py-3 text-gray-800 text-sm whitespace-nowrap">{row.displayFormat}</td>
                  <td className="px-4 py-3 text-gray-700 text-sm whitespace-nowrap">{row.startDate}</td>
                  <td className="px-4 py-3 text-gray-700 text-sm whitespace-nowrap">{row.endDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
