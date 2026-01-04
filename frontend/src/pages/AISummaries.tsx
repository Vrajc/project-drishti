import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Send, Mic, Volume2, MessageCircle, Clock, TrendingUp } from 'lucide-react';
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
      
      <div className="relative z-10 pt-24 pb-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <Brain className="w-16 h-16 mx-auto mb-4 text-ai-white" />
            <h1 className="text-heading text-4xl font-bold mb-4 text-ai-white">
              AI Safety Assistant
            </h1>
            <p className="text-ai-gray-400 text-lg max-w-2xl mx-auto">
              Get real-time insights and conversational analysis of your event's safety status
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Quick Stats */}
            <div className="lg:col-span-1 space-y-4">
              <div className="glass-light rounded-2xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Live Metrics</h3>
                
                <div className="space-y-4">
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
                <h3 className="text-lg font-semibold text-white mb-4">Quick Questions</h3>
                {quickQuestions.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-ai-gray-500 text-sm">Set up an event to see quick questions</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {quickQuestions.map((question, index) => (
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
            <div className="glass-light rounded-2xl lg:col-span-3 overflow-hidden">
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
              <div className="h-96 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                      message.type === 'user'
                        ? 'bg-ai-white text-ai-black ml-8'
                        : 'bg-ai-gray-700/50 text-gray-100 mr-8'
                    }`}>
                      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
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
                    <div className="bg-ai-gray-700/50 text-gray-100 px-4 py-3 rounded-2xl mr-8">
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
              <div className="p-4 border-t border-ai-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask about event safety, crowd levels, alerts..."
                      className="w-full px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                    />
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTyping}
                    className="p-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    <Send className="w-5 h-5" />
                  </motion.button>
                </div>
                
                <div className="mt-2 text-xs text-ai-gray-500 flex items-center gap-2">
                  <MessageCircle className="w-3 h-3" />
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