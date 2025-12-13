export function DashboardFilters() {
  return (
    <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-gray-800">Filters</h2>
        <button className="text-blue-600 hover:text-blue-700 text-sm">
          Clear all
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-gray-700 text-sm mb-2">Date From</label>
          <input
            type="date"
            className="w-full px-4 py-2 rounded-lg bg-white/50 border border-white/80 text-gray-700 focus:outline-none focus:border-blue-500 transition-all"
            placeholder="mm/dd/yyyy"
          />
        </div>
        
        <div>
          <label className="block text-gray-700 text-sm mb-2">Date To</label>
          <input
            type="date"
            className="w-full px-4 py-2 rounded-lg bg-white/50 border border-white/80 text-gray-700 focus:outline-none focus:border-blue-500 transition-all"
            placeholder="mm/dd/yyyy"
          />
        </div>
        
        <div>
          <label className="block text-gray-700 text-sm mb-2">Company</label>
          <select className="w-full px-4 py-2 rounded-lg bg-white/50 border border-white/80 text-gray-700 focus:outline-none focus:border-blue-500 transition-all">
            <option>All Companies</option>
            <option>Company A</option>
            <option>Company B</option>
          </select>
        </div>
        
        <div>
          <label className="block text-gray-700 text-sm mb-2">Source</label>
          <select className="w-full px-4 py-2 rounded-lg bg-white/50 border border-white/80 text-gray-700 focus:outline-none focus:border-blue-500 transition-all">
            <option>All Sources</option>
            <option>Instagram</option>
            <option>Facebook</option>
          </select>
        </div>
      </div>
    </div>
  );
}
