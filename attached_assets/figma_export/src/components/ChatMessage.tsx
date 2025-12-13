import { Message } from '../App';
import { User, Sparkles } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full backdrop-blur-sm border flex items-center justify-center shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-white/60 to-white/40 border-white/80'
            : 'bg-white/40 border-white/60'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-gray-700" />
        ) : (
          <Sparkles className="w-4 h-4 text-gray-700" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`flex-1 max-w-[80%] backdrop-blur-xl rounded-2xl px-4 py-3 border shadow-lg ${
          isUser
            ? 'bg-white/50 border-white/80 rounded-tr-sm'
            : 'bg-white/40 border-white/60 rounded-tl-sm'
        }`}
      >
        <p className="text-gray-800 whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <p className="text-gray-500 text-xs mt-2">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}