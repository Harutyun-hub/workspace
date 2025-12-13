import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChevronDown } from 'lucide-react';

const performanceData = [
  { name: 'universitatea...', likes: 945, comments: 15 },
  { name: 'fortegpl19...', likes: 872, comments: 8 },
  { name: 'superbetro...', likes: 654, comments: 142 },
  { name: 'superbetro...', likes: 567, comments: 5 },
  { name: 'superbetro...', likes: 345, comments: 2 },
  { name: 'taniajovita...', likes: 421, comments: 128 },
  { name: 'superbetro...', likes: 287, comments: 3 },
  { name: 'tofogaming...', likes: 198, comments: 1 },
  { name: 'superbetro...', likes: 156, comments: 2 },
  { name: 'tofogaming...', likes: 134, comments: 0 },
];

const tableData = [
  { username: 'superbetromantis', text: 'Al cinciul, așa că nu avea...', likes: 199, comments: 13 },
  { username: 'superbetromantis', text: '👑 Jucători străini de la ...', likes: 462, comments: 1 },
  { username: 'superbetromantis', text: '👑 Dinamoviștii și rapidis...', likes: 160, comments: 1 },
  { username: 'sport.ro.oficial', text: 'Ruptura la Liverpodl! Ar...', likes: 64, comments: 0 },
  { username: 'superbetromantis', text: '👍 Ce pariem azi? 🤑 Inco...', likes: 19, comments: 0 },
  { username: 'universitateacrai...', text: 'Universitatea Craiova lup...', likes: 967, comments: 3 },
];

export function InstagramPerformance() {
  return (
    <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-gray-800">Instagram Performance</h2>
          <span className="px-2 py-1 rounded-md bg-white/50 text-gray-600 text-xs">
            75 posts
          </span>
        </div>
        <button className="p-1 hover:bg-white/50 rounded-lg transition-all">
          <ChevronDown className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      {/* Chart */}
      <div className="backdrop-blur-xl bg-white/30 rounded-xl border border-white/60 p-6 mb-6 shadow-sm">
        <h3 className="text-gray-700 mb-4 text-center">Top 10 Instagram Posts Performance</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" opacity={0.3} />
            <XAxis 
              dataKey="name" 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.6)',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            <Bar dataKey="likes" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Likes" />
            <Bar dataKey="comments" fill="#10b981" radius={[8, 8, 0, 0]} name="Comments" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="backdrop-blur-xl bg-white/30 rounded-xl border border-white/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-blue-600">
                <th className="px-4 py-3 text-left text-white text-sm">USERNAME</th>
                <th className="px-4 py-3 text-left text-white text-sm">TEXT</th>
                <th className="px-4 py-3 text-left text-white text-sm">LIKES</th>
                <th className="px-4 py-3 text-left text-white text-sm">COMMENTS</th>
                <th className="px-4 py-3 text-left text-white text-sm">DISPLAY URL</th>
                <th className="px-4 py-3 text-left text-white text-sm">URL</th>
              </tr>
            </thead>
            <tbody className="bg-white/20">
              {tableData.map((row, index) => (
                <tr 
                  key={index}
                  className="border-b border-white/40 hover:bg-white/30 transition-all"
                >
                  <td className="px-4 py-3 text-gray-800 text-sm">{row.username}</td>
                  <td className="px-4 py-3 text-gray-700 text-sm max-w-xs truncate">{row.text}</td>
                  <td className="px-4 py-3 text-gray-800 text-sm">{row.likes}</td>
                  <td className="px-4 py-3 text-gray-800 text-sm">{row.comments}</td>
                  <td className="px-4 py-3 text-gray-700 text-sm">-</td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 hover:text-blue-700 text-sm">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
