import { Plus, Menu, Settings, MessageSquare, ChevronLeft, ChevronRight, LayoutDashboard, Book } from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  recentChats: Array<{ id: string; title: string; timestamp: Date }>;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  currentChatId?: string;
  currentView: 'chat' | 'dashboard' | 'documentation';
  onViewChange: (view: 'chat' | 'dashboard' | 'documentation') => void;
}

export function Sidebar({ recentChats, onNewChat, onSelectChat, currentChatId, currentView, onViewChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      <div
        className={`relative h-full backdrop-blur-xl bg-white/30 border-r border-white/60 flex flex-col transition-all duration-300 shadow-lg ${
          isCollapsed ? 'w-0 md:w-16' : 'w-64'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/60">
          <div className="flex items-center justify-between mb-4">
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <Menu className="w-5 h-5 text-gray-700" />
                <h2 className="text-gray-800">MyChatbot</h2>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-700" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-gray-700" />
              )}
            </button>
          </div>
          
          {!isCollapsed && (
            <button
              onClick={onNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/50 hover:bg-white/70 border border-white/80 transition-all text-gray-800 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New chat</span>
            </button>
          )}
          
          {isCollapsed && (
            <button
              onClick={onNewChat}
              className="w-full p-2 rounded-lg bg-white/50 hover:bg-white/70 border border-white/80 transition-all flex items-center justify-center shadow-sm"
            >
              <Plus className="w-4 h-4 text-gray-800" />
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        {!isCollapsed && (
          <div className="p-3 border-b border-white/60">
            <button
              onClick={() => onViewChange('chat')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all mb-1 ${
                currentView === 'chat'
                  ? 'bg-white/60 text-gray-900 shadow-sm'
                  : 'text-gray-700 hover:bg-white/40 hover:text-gray-900'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => onViewChange('dashboard')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all mb-1 ${
                currentView === 'dashboard'
                  ? 'bg-white/60 text-gray-900 shadow-sm'
                  : 'text-gray-700 hover:bg-white/40 hover:text-gray-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => onViewChange('documentation')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                currentView === 'documentation'
                  ? 'bg-white/60 text-gray-900 shadow-sm'
                  : 'text-gray-700 hover:bg-white/40 hover:text-gray-900'
              }`}
            >
              <Book className="w-4 h-4" />
              <span>Documentation</span>
            </button>
          </div>
        )}

        {isCollapsed && (
          <div className="p-2 border-b border-white/60">
            <button
              onClick={() => onViewChange('chat')}
              className={`w-full p-2 rounded-lg transition-all mb-1 flex items-center justify-center ${
                currentView === 'chat'
                  ? 'bg-white/60 shadow-sm'
                  : 'hover:bg-white/40'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-gray-700" />
            </button>
            <button
              onClick={() => onViewChange('dashboard')}
              className={`w-full p-2 rounded-lg transition-all mb-1 flex items-center justify-center ${
                currentView === 'dashboard'
                  ? 'bg-white/60 shadow-sm'
                  : 'hover:bg-white/40'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-gray-700" />
            </button>
            <button
              onClick={() => onViewChange('documentation')}
              className={`w-full p-2 rounded-lg transition-all flex items-center justify-center ${
                currentView === 'documentation'
                  ? 'bg-white/60 shadow-sm'
                  : 'hover:bg-white/40'
              }`}
            >
              <Book className="w-4 h-4 text-gray-700" />
            </button>
          </div>
        )}

        {/* Recent Chats - only show in chat view */}
        {!isCollapsed && currentView === 'chat' && (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="mb-2">
              <p className="text-gray-500 text-xs px-2 mb-2">RECENT</p>
            </div>
            
            <div className="space-y-1">
              {recentChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all group ${
                    currentChatId === chat.id
                      ? 'bg-white/60 text-gray-900 shadow-sm'
                      : 'text-gray-700 hover:bg-white/40 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate text-sm">{chat.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {!isCollapsed && (
          <div className="p-4 border-t border-white/60">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/40 transition-colors text-gray-700 hover:text-gray-900">
              <Settings className="w-4 h-4" />
              <span>Settings & help</span>
            </button>
          </div>
        )}
        
        {isCollapsed && (
          <div className="p-2 border-t border-white/60">
            <button className="w-full p-2 rounded-lg hover:bg-white/40 transition-colors flex items-center justify-center">
              <Settings className="w-4 h-4 text-gray-700 hover:text-gray-900" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}