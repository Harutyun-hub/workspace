import { Book, Sparkles, Palette, Layers, Code, Zap } from 'lucide-react';

export function Documentation() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Documentation Header */}
      <div className="backdrop-blur-xl bg-white/30 border-b border-white/60 px-4 md:px-8 py-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/60 to-white/40 backdrop-blur-sm border border-white/80 flex items-center justify-center shadow-sm">
            <Book className="w-6 h-6 text-gray-700" />
          </div>
          <div>
            <h1 className="text-gray-800">Documentation</h1>
            <p className="text-gray-500 text-sm">Design System & Architecture</p>
          </div>
        </div>
      </div>

      {/* Documentation Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Introduction */}
          <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg">
            <h2 className="text-gray-800 mb-4">MyChatbot - AI Chat Interface with Analytics Dashboard</h2>
            <p className="text-gray-700 mb-3">
              A modern, elegant chat interface and analytics dashboard built with React, TypeScript, and Tailwind CSS, 
              featuring Apple-inspired glassmorphism design.
            </p>
          </div>

          {/* Design Philosophy */}
          <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-blue-600" />
              <h2 className="text-gray-800">Design Philosophy</h2>
            </div>
            
            <h3 className="text-gray-800 mb-2">Visual Design</h3>
            <p className="text-gray-700 mb-4">
              The application follows Apple's signature <strong>glassmorphism</strong> design language with a luxury gray color palette, 
              creating a sophisticated and modern user experience.
            </p>

            <h3 className="text-gray-800 mb-2">Color Scheme</h3>
            <div className="space-y-2 text-gray-700">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 border border-white/60 flex-shrink-0 mt-1" />
                <div>
                  <strong>Background:</strong> Luxury light gray gradient (gray-100 → gray-200 → gray-300)
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded bg-white/40 backdrop-blur-sm border border-white/60 flex-shrink-0 mt-1" />
                <div>
                  <strong>Glass Effect:</strong> Semi-transparent white overlays with backdrop blur
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded bg-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <strong>Primary Accent:</strong> Blue (#3b82f6, #2563eb) for interactive elements
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded bg-gray-800 flex-shrink-0 mt-1" />
                <div>
                  <strong>Text:</strong> Gray-800 (primary), Gray-700 (secondary), Gray-500/400 (muted)
                </div>
              </div>
            </div>

            <h3 className="text-gray-800 mt-4 mb-2">Glassmorphism Properties</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li><code className="bg-white/30 px-2 py-0.5 rounded text-sm">backdrop-blur-xl</code> (24px blur) for strong glass effect</li>
              <li><code className="bg-white/30 px-2 py-0.5 rounded text-sm">bg-white/30</code> to <code className="bg-white/30 px-2 py-0.5 rounded text-sm">bg-white/50</code> for semi-transparent backgrounds</li>
              <li><code className="bg-white/30 px-2 py-0.5 rounded text-sm">border-white/60</code> to <code className="bg-white/30 px-2 py-0.5 rounded text-sm">border-white/80</code> for subtle borders</li>
              <li>Layered shadows for depth (shadow-sm, shadow-lg)</li>
            </ul>
          </div>

          {/* Architecture */}
          <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-blue-600" />
              <h2 className="text-gray-800">Architecture</h2>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-gray-800 mb-2">1. App.tsx</h3>
                <p className="text-gray-700 text-sm">
                  Main application container managing chat state, conversation history, view switching, 
                  and background with animated gradient orbs.
                </p>
              </div>

              <div>
                <h3 className="text-gray-800 mb-2">2. Sidebar Component</h3>
                <p className="text-gray-700 text-sm mb-2">Collapsible navigation sidebar featuring:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-4">
                  <li>MyChatbot branding</li>
                  <li>New chat button</li>
                  <li>Navigation menu (Chat / Dashboard / Documentation)</li>
                  <li>Recent chat history</li>
                  <li>Settings & help section</li>
                </ul>
              </div>

              <div>
                <h3 className="text-gray-800 mb-2">3. Chat Interface</h3>
                <p className="text-gray-700 text-sm mb-2">Components:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-4">
                  <li><strong>ChatHeader:</strong> AI Assistant branding with online status</li>
                  <li><strong>ChatMessage:</strong> Glass bubble design with avatars and timestamps</li>
                  <li><strong>ChatInput:</strong> Multi-line textarea with send button</li>
                </ul>
              </div>

              <div>
                <h3 className="text-gray-800 mb-2">4. Dashboard Interface</h3>
                <p className="text-gray-700 text-sm mb-2">Components:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm ml-4">
                  <li><strong>DashboardFilters:</strong> Date range and source filters</li>
                  <li><strong>InstagramPerformance:</strong> Bar chart and data table</li>
                  <li><strong>FacebookAds:</strong> Comprehensive ads data table</li>
                </ul>
              </div>
            </div>
          </div>

          {/* UI/UX Best Practices */}
          <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h2 className="text-gray-800">UI/UX Best Practices</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/30 rounded-xl p-4 border border-white/60">
                <h3 className="text-gray-800 mb-2 text-sm">Visual Hierarchy</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs">
                  <li>Clear element distinction</li>
                  <li>Consistent spacing system</li>
                  <li>Size differentiation</li>
                </ul>
              </div>

              <div className="bg-white/30 rounded-xl p-4 border border-white/60">
                <h3 className="text-gray-800 mb-2 text-sm">Interaction Design</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs">
                  <li>Smooth transitions</li>
                  <li>Hover & active states</li>
                  <li>Loading indicators</li>
                </ul>
              </div>

              <div className="bg-white/30 rounded-xl p-4 border border-white/60">
                <h3 className="text-gray-800 mb-2 text-sm">Accessibility</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs">
                  <li>Semantic HTML structure</li>
                  <li>Proper heading hierarchy</li>
                  <li>Color contrast ratios</li>
                </ul>
              </div>

              <div className="bg-white/30 rounded-xl p-4 border border-white/60">
                <h3 className="text-gray-800 mb-2 text-sm">Responsive Design</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs">
                  <li>Mobile-first approach</li>
                  <li>Flexible grid layouts</li>
                  <li>Touch-friendly buttons</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Technical Stack */}
          <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-5 h-5 text-blue-600" />
              <h2 className="text-gray-800">Technical Stack</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white/30 rounded-lg p-3 border border-white/60 text-center">
                <p className="text-gray-800 text-sm">React 18</p>
                <p className="text-gray-500 text-xs">UI Library</p>
              </div>
              <div className="bg-white/30 rounded-lg p-3 border border-white/60 text-center">
                <p className="text-gray-800 text-sm">TypeScript</p>
                <p className="text-gray-500 text-xs">Type Safety</p>
              </div>
              <div className="bg-white/30 rounded-lg p-3 border border-white/60 text-center">
                <p className="text-gray-800 text-sm">Tailwind CSS</p>
                <p className="text-gray-500 text-xs">Styling</p>
              </div>
              <div className="bg-white/30 rounded-lg p-3 border border-white/60 text-center">
                <p className="text-gray-800 text-sm">Recharts</p>
                <p className="text-gray-500 text-xs">Charts</p>
              </div>
              <div className="bg-white/30 rounded-lg p-3 border border-white/60 text-center">
                <p className="text-gray-800 text-sm">Lucide React</p>
                <p className="text-gray-500 text-xs">Icons</p>
              </div>
              <div className="bg-white/30 rounded-lg p-3 border border-white/60 text-center">
                <p className="text-gray-800 text-sm">Motion</p>
                <p className="text-gray-500 text-xs">Animations</p>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-blue-600" />
              <h2 className="text-gray-800">Key Features</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="text-gray-800 mb-2 text-sm">Chat Features</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs">
                  <li>Message streaming</li>
                  <li>Multiple conversations</li>
                  <li>Chat history</li>
                  <li>Typing indicators</li>
                  <li>Timestamps</li>
                </ul>
              </div>

              <div>
                <h3 className="text-gray-800 mb-2 text-sm">Dashboard Features</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs">
                  <li>Performance tracking</li>
                  <li>Instagram analytics</li>
                  <li>Facebook ads</li>
                  <li>Date filtering</li>
                  <li>Source filtering</li>
                </ul>
              </div>

              <div>
                <h3 className="text-gray-800 mb-2 text-sm">Design Features</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs">
                  <li>Animated backgrounds</li>
                  <li>Smooth transitions</li>
                  <li>Glass morphism</li>
                  <li>Consistent design</li>
                  <li>Micro-interactions</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Design Decisions */}
          <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg">
            <h2 className="text-gray-800 mb-4">Design Decisions</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-gray-800 mb-2">Why Glassmorphism?</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
                  <li>Modern, premium aesthetic</li>
                  <li>Creates visual depth without heavy shadows</li>
                  <li>Allows background elements to show through</li>
                  <li>Apple-inspired elegance</li>
                </ul>
              </div>

              <div>
                <h3 className="text-gray-800 mb-2">Why Gray Color Scheme?</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
                  <li>Professional and sophisticated</li>
                  <li>Excellent for business applications</li>
                  <li>Easy on the eyes for extended use</li>
                  <li>Neutral base for accent colors</li>
                </ul>
              </div>

              <div>
                <h3 className="text-gray-800 mb-2">Why Blue Accents?</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
                  <li>Associated with trust and technology</li>
                  <li>High visibility for CTAs</li>
                  <li>Complements gray beautifully</li>
                  <li>Matches common AI/tech branding</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Responsive Breakpoints */}
          <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg">
            <h2 className="text-gray-800 mb-4">Responsive Breakpoints</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-3 bg-white/30 rounded-lg p-3 border border-white/60">
                <div className="w-16 text-gray-800 text-sm">Mobile</div>
                <div className="text-gray-700 text-sm">&lt; 768px - 1 column layouts, collapsed sidebar</div>
              </div>
              <div className="flex items-center gap-3 bg-white/30 rounded-lg p-3 border border-white/60">
                <div className="w-16 text-gray-800 text-sm">Tablet</div>
                <div className="text-gray-700 text-sm">768px - 1024px - 2 column layouts</div>
              </div>
              <div className="flex items-center gap-3 bg-white/30 rounded-lg p-3 border border-white/60">
                <div className="w-16 text-gray-800 text-sm">Desktop</div>
                <div className="text-gray-700 text-sm">&gt; 1024px - 4 column layouts, expanded sidebar</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-white/60 p-6 shadow-lg text-center">
            <p className="text-gray-700">
              Built with ❤️ using modern web technologies and best UI/UX practices.
            </p>
            <p className="text-gray-500 text-sm mt-2">
              December 2025 - MyChatbot v1.0
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
