import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Send, 
  ChevronLeft, 
  Loader2, 
  Bot, 
  User, 
  Settings,
  Zap,
  AlertCircle
} from 'lucide-react';
import Navbar from '../components/Navbar';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model_used?: string;
  processing_time_ms?: number;
  nodes_executed?: string[];
}

interface Project {
  id: string;
  name: string;
  description: string;
}

interface ValidationResult {
  valid: boolean;
  issues: string[];
  node_count: number;
  connection_count: number;
  node_types: string[];
}

export default function DemoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load project and validate on mount
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        navigate('/projects');
        return;
      }

      try {
        setLoading(true);
        
        // Load project info
        const projectRes = await fetch(`${API_BASE}/api/projects/${projectId}`, {
          credentials: 'include',
        });
        
        if (!projectRes.ok) {
          if (projectRes.status === 401) {
            navigate('/login');
            return;
          }
          throw new Error('Failed to load project');
        }
        
        const projectData = await projectRes.json();
        setProject(projectData);

        // Validate workflow
        const validateRes = await fetch(`${API_BASE}/api/projects/${projectId}/validate`, {
          method: 'POST',
          credentials: 'include',
        });
        
        if (validateRes.ok) {
          const validationData = await validateRes.json();
          setValidation(validationData);
        }
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, navigate]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  const sendMessage = async () => {
    if (!inputValue.trim() || sending) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setSending(true);
    setError(null);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const res = await fetch(`${API_BASE}/api/projects/${projectId}/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          conversation_history: conversationHistory,
          session_id: projectId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await res.json();
      
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        model_used: data.model_used,
        processing_time_ms: data.processing_time_ms,
        nodes_executed: data.nodes_executed,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove the user message if we failed
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      setInputValue(userMessage.content); // Restore input
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading demo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 pt-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/model-config/${projectId}`)}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Back to Editor</span>
            </button>
            <div className="h-6 w-px bg-gray-200" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {project?.name || 'Demo'}
              </h1>
              <p className="text-xs text-gray-500">Test your workflow</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`p-2 rounded-lg transition-colors ${
                showDebug ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="Toggle debug info"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={clearChat}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear Chat
            </button>
          </div>
        </div>
      </header>

      {/* Validation Warning */}
      {validation && !validation.valid && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Workflow has issues</p>
              <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                {validation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Info */}
      {showDebug && validation && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-4">
          <div className="bg-gray-100 rounded-lg p-4 text-sm">
            <p className="font-medium text-gray-700 mb-2">Workflow Info</p>
            <div className="grid grid-cols-3 gap-4 text-gray-600">
              <div>
                <span className="font-medium">Nodes:</span> {validation.node_count}
              </div>
              <div>
                <span className="font-medium">Connections:</span> {validation.connection_count}
              </div>
              <div>
                <span className="font-medium">Types:</span> {validation.node_types.join(', ') || 'None'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 overflow-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-20">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Test Your Workflow
            </h2>
            <p className="text-gray-500 max-w-md">
              Send a message to test your AI workflow. The response will be generated
              based on your workflow configuration.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-purple-600" />
                  </div>
                )}
                
                <div className={`max-w-[75%] ${message.role === 'user' ? 'order-1' : ''}`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 ${
                      message.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  
                  {/* Debug info for assistant messages */}
                  {showDebug && message.role === 'assistant' && (
                    <div className="mt-1 text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                      {message.model_used && (
                        <span>Model: {message.model_used}</span>
                      )}
                      {message.processing_time_ms && (
                        <span>• {message.processing_time_ms.toFixed(0)}ms</span>
                      )}
                      {message.nodes_executed && message.nodes_executed.length > 0 && (
                        <span>• Nodes: {message.nodes_executed.join(' → ')}</span>
                      )}
                    </div>
                  )}
                </div>
                
                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 order-2">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                )}
              </motion.div>
            ))}
            
            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 justify-start"
              >
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-purple-600" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                    <span className="text-gray-500">Thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Error */}
      {error && (
        <div className="max-w-4xl mx-auto w-full px-4 pb-2">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-700 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <footer className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={sending}
              className="flex-1 px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
            />
            <motion.button
              onClick={sendMessage}
              disabled={!inputValue.trim() || sending}
              className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </motion.button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Press Enter to send • Your workflow runs on each message
          </p>
        </div>
      </footer>
    </div>
  );
}
