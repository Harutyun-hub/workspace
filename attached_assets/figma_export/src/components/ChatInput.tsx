import { useState, FormEvent, KeyboardEvent } from 'react';
import { Send, Plus } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isDisabled?: boolean;
}

export function ChatInput({ onSendMessage, isDisabled }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isDisabled) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="p-4 md:p-6 border-t border-white/60 bg-white/30 backdrop-blur-xl shadow-sm">
      <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
        <div className="backdrop-blur-xl bg-white/50 rounded-2xl border border-white/80 focus-within:border-white/90 transition-all shadow-lg">
          <div className="flex items-end gap-2 p-2">
            <button
              type="button"
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/50 backdrop-blur-sm border border-white/80 flex items-center justify-center transition-all hover:bg-white/70 shadow-sm"
            >
              <Plus className="w-4 h-4 text-gray-700" />
            </button>
            
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask MyChatbot..."
              disabled={isDisabled}
              rows={1}
              className="flex-1 bg-transparent text-gray-800 placeholder-gray-400 px-2 py-2 resize-none focus:outline-none disabled:opacity-50"
              style={{ minHeight: '36px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            
            <button
              type="submit"
              disabled={!input.trim() || isDisabled}
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:bg-white/40 shadow-md"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}