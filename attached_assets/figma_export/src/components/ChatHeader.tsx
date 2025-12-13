import { Sparkles, MoreVertical, User } from 'lucide-react';

export function ChatHeader() {
  return (
    <div className="backdrop-blur-xl bg-white/30 border-b border-white/60 px-4 md:px-8 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/60 to-white/40 backdrop-blur-sm border border-white/80 flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-gray-700" />
          </div>
          <div>
            <h1 className="text-gray-800">AI Assistant</h1>
            <p className="text-gray-500 text-sm">Online</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/60 to-white/40 backdrop-blur-sm border border-white/80 flex items-center justify-center shadow-sm">
            <User className="w-4 h-4 text-gray-700" />
          </div>
        </div>
      </div>
    </div>
  );
}