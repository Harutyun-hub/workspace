import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { ChatHeader } from './components/ChatHeader';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Documentation } from './components/Documentation';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
}

export default function App() {
  const [chats, setChats] = useState<Chat[]>([
    {
      id: '1',
      title: 'Welcome conversation',
      messages: [
        {
          id: '1',
          content: "Hello! I'm your AI assistant. How can I help you today?",
          role: 'assistant',
          timestamp: new Date(),
        },
      ],
      timestamp: new Date(),
    },
  ]);
  const [currentChatId, setCurrentChatId] = useState<string>('1');
  const [currentView, setCurrentView] = useState<'chat' | 'dashboard' | 'documentation'>('chat');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentChat = chats.find((chat) => chat.id === currentChatId);
  const messages = currentChat?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New chat',
      messages: [
        {
          id: Date.now().toString(),
          content: "Hello! I'm your AI assistant. How can I help you today?",
          role: 'assistant',
          timestamp: new Date(),
        },
      ],
      timestamp: new Date(),
    };
    setChats((prev) => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setCurrentView('chat');
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setCurrentView('chat');
  };

  const handleViewChange = (view: 'chat' | 'dashboard' | 'documentation') => {
    setCurrentView(view);
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: [...chat.messages, userMessage],
              title: chat.title === 'New chat' ? content.slice(0, 50) : chat.title,
            }
          : chat
      )
    );
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm a demo assistant. In a real application, I would process your message and provide a helpful response. This is just a UI demonstration with glassmorphism design!",
        role: 'assistant',
        timestamp: new Date(),
      };
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? { ...chat, messages: [...chat.messages, assistantMessage] }
            : chat
        )
      );
      setIsTyping(false);
    }, 1500);
  };

  const recentChats = chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    timestamp: chat.timestamp,
  }));

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Luxury light gray gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300" />
      
      {/* Subtle animated gradient orbs in gray tones */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gray-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gray-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
      <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-gray-200 rounded-full mix-blend-multiply filter blur-3xl opacity-35 animate-blob animation-delay-4000" />

      {/* Main layout */}
      <div className="relative h-full flex">
        {/* Sidebar */}
        <Sidebar
          recentChats={recentChats}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          currentChatId={currentChatId}
          currentView={currentView}
          onViewChange={handleViewChange}
        />

        {/* Main content area */}
        {currentView === 'chat' ? (
          <div className="flex-1 flex flex-col">
            <ChatHeader />
            
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              
              {isTyping && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/40 backdrop-blur-sm border border-white/60 flex items-center justify-center shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-gray-600" />
                  </div>
                  <div className="flex-1 backdrop-blur-xl bg-white/40 rounded-2xl rounded-tl-sm px-4 py-3 border border-white/60 shadow-lg">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-gray-600 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <ChatInput onSendMessage={handleSendMessage} isDisabled={isTyping} />
          </div>
        ) : currentView === 'dashboard' ? (
          <Dashboard />
        ) : (
          <Documentation />
        )}
      </div>
    </div>
  );
}