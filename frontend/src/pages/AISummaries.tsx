import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Send, MessageCircle } from 'lucide-react';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { chatWithAI, ChatMessage as AIChatMessage } from '../services/ai.service';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const AISummaries: React.FC = () => {
  const { event } = useEvent();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: "Hello! I'm your AI Safety Assistant. I can provide real-time insights about your event's safety status. Try asking me about crowd density, recent alerts, or zone-specific information.",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate event-specific quick questions based on actual event configuration
  const quickQuestions = React.useMemo(() => {
    if (!event) {
      return [];
    }

    const questions: string[] = [];
    
    // Event-specific status
    questions.push(`What's the current safety status for ${event.name}?`);
    
    // Zone-specific questions if zones are configured
    if (event.zones && event.zones.length > 0) {
      const primaryZone = event.zones[0];
      questions.push(`What's the crowd density in ${primaryZone}?`);
      if (event.zones.length > 1) {
        questions.push(`Compare crowd levels between ${event.zones[0]} and ${event.zones[1]}`);
      }
    }
    
    // Camera monitoring if cameras configured
    if (event.cameras && event.cameras.length > 0) {
      questions.push(`Any anomalies detected on ${event.cameras.length} camera feeds?`);
    }
    
    // Emergency response if dispatch units configured
    if (event.dispatchUnits && event.dispatchUnits.length > 0) {
      questions.push(`Status of ${event.dispatchUnits.length} emergency response units?`);
    }
    
    // Crowd size specific
    if (event.crowdSize) {
      questions.push(`How are ${event.crowdSize.toLocaleString()} expected attendees distributed?`);
    }
    
    // Predictive questions
    questions.push("Predict bottlenecks in next 30 minutes");
    
    return questions.slice(0, 6); // Keep only 6 questions
  }, [event]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Prepare messages for AI
      const aiMessages: AIChatMessage[] = messages
        .filter(m => m.type !== 'ai' || messages.indexOf(m) >= messages.length - 10) // Last 10 messages
        .map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.content
        }));
      
      // Add current user message
      aiMessages.push({
        role: 'user',
        content: inputMessage.trim()
      });

      // Get AI response
      const eventContext = event 
        ? `Current event: ${event.name}, Expected crowd: ${event.crowdSize}, Zones: ${event.zones.length}, Cameras: ${event.cameras?.length || 0}, Dispatch units: ${event.dispatchUnits?.length || 0}`
        : 'No active event configured';
      const response = await chatWithAI(aiMessages, eventContext);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('AI Chat Error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInputMessage(question);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />
      
      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6 sm:mb-8"
          >
            <Brain className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-ai-white" />
            <h1 className="text-heading text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-ai-white">
              AI Safety Assistant
            </h1>
            <p className="text-ai-gray-400 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto">
              Get real-time insights and conversational analysis of your event's safety status
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Quick Stats — below the chat on phones, beside it from lg up,
                so the conversation isn't pushed off the first screen */}
            <div className="lg:col-span-1 space-y-4 order-2 lg:order-1 min-w-0">
              <div className="glass-light rounded-2xl p-4">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4">Live Metrics</h3>
                
                {/* 2x2 on phones rather than a four-deep column */}
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ai-white">-</div>
                    <div className="text-sm text-ai-gray-400">Safety Score</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ai-white">-</div>
                    <div className="text-sm text-ai-gray-400">Avg Crowd</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ai-white">-</div>
                    <div className="text-sm text-ai-gray-400">Response Time</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-ai-white">0</div>
                    <div className="text-sm text-ai-gray-400">Active Alerts</div>
                  </div>
                </div>
              </div>

              <div className="glass-light rounded-2xl p-4">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4">Quick Questions</h3>
                {quickQuestions.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-ai-gray-500 text-sm">Set up an event to see quick questions</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {quickQuestions.map((question) => (
                      <motion.button
                        key={question}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleQuickQuestion(question)}
                        className="w-full text-left p-2 rounded-lg bg-ai-gray-800/30 hover:bg-ai-gray-700/50 text-sm text-ai-gray-300 hover:text-white transition-colors"
                      >
                        {question}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Interface */}
            <div className="glass-light rounded-2xl lg:col-span-3 overflow-hidden order-1 lg:order-2 min-w-0 flex flex-col">
              <div className="flex items-center gap-3 p-4 border-b border-ai-gray-700">
                <div className="w-10 h-10 bg-gradient-to-r from-ai-white to-ai-gray-300 rounded-full flex items-center justify-center">
                  <Brain className="w-5 h-5 text-ai-black" />
                </div>
                <div>
                  <div className="font-semibold text-white">Drishti AI</div>
                  <div className="text-sm text-ai-white">● Online</div>
                </div>
              </div>

              {/* Messages */}
              <div className="h-[55dvh] min-h-[18rem] lg:h-96 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-4">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl ${
                      message.type === 'user'
                        ? 'bg-ai-white text-ai-black ml-4 sm:ml-8'
                        : 'bg-ai-gray-700/50 text-gray-100 mr-4 sm:mr-8'
                    }`}>
                      <div className="whitespace-pre-wrap break-anywhere text-sm">{message.content}</div>
                      <div className={`text-xs mt-2 ${
                        message.type === 'user' ? 'text-ai-gray-600' : 'text-ai-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-ai-gray-700/50 text-gray-100 px-4 py-3 rounded-2xl mr-4 sm:mr-8">
                      <div className="flex items-center gap-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-ai-white rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-ai-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-ai-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-sm text-ai-gray-400">AI is analyzing...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 sm:p-4 border-t border-ai-gray-700">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0 relative">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask about safety, crowds, alerts..."
                      className="w-full px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                    />
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTyping}
                    aria-label="Send message"
                    className="icon-btn shrink-0 p-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    <Send className="w-5 h-5" />
                  </motion.button>
                </div>
                
                <div className="mt-2 text-xs text-ai-gray-500 hidden sm:flex items-center gap-2">
                  <MessageCircle className="w-3 h-3 shrink-0" />
                  Press Enter to send, Shift+Enter for new line
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISummaries;