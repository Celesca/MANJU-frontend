import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Send, User, Bot, Square,
  Settings, ChevronLeft,
  Volume2, Mic, AlertCircle,
  Loader2, VolumeX, Zap
} from 'lucide-react';
import { apiFetch } from '../utils/api';
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
  audioUrl?: string; // For voice output
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

interface WorkflowType {
  input_type: 'text' | 'voice';
  output_type: 'text' | 'voice';
  workflow_type: 'text-to-text' | 'text-to-voice' | 'voice-to-text' | 'voice-to-voice';
  has_rag: boolean;
  has_sheets: boolean;
  has_condition: boolean;
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
  const [workflowType, setWorkflowType] = useState<WorkflowType | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  // Web Speech API (real-time recognition) state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  // VAD (voice activity detection) refs/state
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadMediaStreamRef = useRef<MediaStream | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const vadSilenceTimerRef = useRef<number | null>(null);
  const vadSpeakingRef = useRef(false);
  const VAD_SILENCE_MS = 1100; // silence duration to auto-send
  const VAD_THRESHOLD = 0.01; // RMS threshold for detecting speech (tweakable)

  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        const projectRes = await apiFetch(`${API_BASE}/api/projects/${projectId}`, {
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

        // Validate workflow and get workflow type in parallel
        const [validateRes, workflowTypeRes] = await Promise.all([
          apiFetch(`${API_BASE}/api/projects/${projectId}/validate`, {
            method: 'POST',
            credentials: 'include',
          }),
          apiFetch(`${API_BASE}/api/projects/${projectId}/workflow-type`, {
            credentials: 'include',
          }),
        ]);

        if (validateRes.ok) {
          const validationData = await validateRes.json();
          setValidation(validationData);
        }

        if (workflowTypeRes.ok) {
          const workflowTypeData = await workflowTypeRes.json();
          setWorkflowType(workflowTypeData);
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

  // Voice recording functions
  const handleVoiceInput = useCallback(async (_audioBlob: Blob) => {
    // avoid unused param lint
    void _audioBlob;
    // For demo, we'll use a placeholder transcription
    // In production, this would call a speech-to-text API
    const mockTranscription = "[Voice message received]";

    // Create user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: mockTranscription,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setSending(true);
    setError(null);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // For voice workflows, we could send the audio blob
      // For now, we'll send the transcription
      const res = await apiFetch(`${API_BASE}/api/projects/${projectId}/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: mockTranscription,
          conversation_history: conversationHistory,
          session_id: projectId,
          is_voice_input: true,
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

      // If voice output, play the audio
      if (workflowType?.output_type === 'voice') {
        speakResponse(data.response);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setSending(false);
    }
  }, [messages, projectId, workflowType]);

  // VAD helpers
  const startVADMonitoring = useCallback(async (stream?: MediaStream) => {
    try {
      const micStream = stream ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      vadMediaStreamRef.current = micStream;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(micStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      vadAnalyserRef.current = analyser;
      vadSpeakingRef.current = false;

      const sample = () => {
        const analyserNode = vadAnalyserRef.current;
        if (!analyserNode) return;
        const buffer = new Float32Array(analyserNode.fftSize);
        analyserNode.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);

        if (rms > VAD_THRESHOLD) {
          // speaking
          vadSpeakingRef.current = true;
          if (vadSilenceTimerRef.current) {
            window.clearTimeout(vadSilenceTimerRef.current);
            vadSilenceTimerRef.current = null;
          }
        } else {
          // not loud
          if (vadSpeakingRef.current) {
            // start silence timer to finalize
            if (!vadSilenceTimerRef.current) {
              vadSilenceTimerRef.current = window.setTimeout(() => {
                // silence detected after speech -> auto send
                // append interim transcript then send
                if (interimTranscript.trim()) {
                  setInputValue(prev => (prev ? prev + ' ' + interimTranscript : interimTranscript));
                  setInterimTranscript('');
                }
                // only send if there's something to send
                if (inputRef.current && inputRef.current.value.trim()) {
                  sendMessage();
                } else if (inputValue.trim()) {
                  sendMessage();
                }
                vadSpeakingRef.current = false;
                vadSilenceTimerRef.current = null;
              }, VAD_SILENCE_MS);
            }
          }
        }

        vadRafRef.current = window.requestAnimationFrame(sample);
      };

      vadRafRef.current = window.requestAnimationFrame(sample);
    } catch (err) {
      console.warn('VAD start failed', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, interimTranscript, VAD_SILENCE_MS, VAD_THRESHOLD]);

  const stopVADMonitoring = useCallback(() => {
    if (vadRafRef.current) {
      window.cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (vadSilenceTimerRef.current) {
      window.clearTimeout(vadSilenceTimerRef.current);
      vadSilenceTimerRef.current = null;
    }
    if (vadAnalyserRef.current) {
      try { vadAnalyserRef.current.disconnect(); } catch (e) { console.warn(e); }
      vadAnalyserRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) { console.warn(e); }
      audioContextRef.current = null;
    }
    if (vadMediaStreamRef.current) {
      try { vadMediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) { console.warn(e); }
      vadMediaStreamRef.current = null;
    }
    vadSpeakingRef.current = false;
  }, []);

  // Initialize Web Speech API (SpeechRecognition) if available
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      // default language (use Thai per example). You can make this configurable later.
      recog.lang = 'th-TH';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recog.onresult = (ev: any) => {
        let interim = '';
        let finalTranscript = '';
        for (let i = ev.resultIndex; i < ev.results.length; ++i) {
          const res = ev.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        // Append final transcript to the input value and keep interim separately
        if (finalTranscript) {
          setInputValue(prev => (prev ? prev + ' ' + finalTranscript : finalTranscript));
        }
        setInterimTranscript(interim);
      };

      recog.onend = () => {
        // If we were still recognizing, restart to keep continuous recognition
        if (recognitionRef.current && recognitionRef.current._shouldRestart) {
          try { recognitionRef.current.start(); } catch (e) { console.warn(e); }
        } else {
          setIsRecognizing(false);
          setInterimTranscript('');
          // stop VAD monitoring when recognition naturally ends
          try { stopVADMonitoring(); } catch (err) { console.warn(err); }
        }
      };

      recognitionRef.current = recog;
    } catch (err) {
      console.warn('SpeechRecognition init failed', err);
      recognitionRef.current = null;
    }
  }, [stopVADMonitoring]);



  const startRecording = useCallback(async () => {
    // If Web Speech API is available, use it for real-time recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current._shouldRestart = true;
        recognitionRef.current.start();
        setIsRecognizing(true);
        // start VAD monitoring (separate mic stream) to detect silence
        try { await startVADMonitoring(); } catch (err) { console.warn('VAD start failed', err); }
        return;
      } catch (err) {
        console.warn('SpeechRecognition start failed', err);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      // start VAD monitoring based on the same stream (so we can auto-stop on silence)
      try { await startVADMonitoring(stream); } catch (err) { console.warn('VAD start failed', err); }
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });

        // Convert to text using Web Speech API or send to backend for transcription
        await handleVoiceInput(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to access microphone. Please allow microphone access.');
      console.error('Microphone error:', err);
    }
  }, [handleVoiceInput, startVADMonitoring]);

  const stopRecording = useCallback(() => {
    // Stop Web Speech API recognition if active
    if (recognitionRef.current && isRecognizing) {
      try {
        recognitionRef.current._shouldRestart = false;
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('SpeechRecognition stop failed', err);
      }
      setIsRecognizing(false);
      setInterimTranscript('');
      try { stopVADMonitoring(); } catch (err) { console.warn(err); }
      return;
    }

    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      try { stopVADMonitoring(); } catch (err) { console.warn(err); }
    }
  }, [mediaRecorder, isRecording, isRecognizing, stopVADMonitoring]);

  // Text-to-speech for voice output using backend OpenAI TTS
  const speakResponse = async (text: string) => {
    try {
      // Cancel any ongoing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const res = await apiFetch(`${API_BASE}/api/projects/${projectId}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: text,
          voice: 'alloy', // You can make this configurable
          model: 'tts-1'
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate speech');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingAudioId(null);
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setPlayingAudioId(null);
      // Fallback to browser TTS if desired, or just show error
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingAudioId(null);
  };

  const sendMessage = useCallback(async () => {
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

      const res = await apiFetch(`${API_BASE}/api/projects/${projectId}/demo`, {
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

      // If voice output workflow, automatically speak the response
      if (workflowType?.output_type === 'voice') {
        speakResponse(data.response);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove the user message if we failed
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      setInputValue(userMessage.content); // Restore input
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [inputValue, messages, projectId, workflowType, sending]);

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
              className={`p-2 rounded-lg transition-colors ${showDebug ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'
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
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
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
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-purple-600" />
                  </div>
                )}

                <div className={`max-w-[75%] ${message.role === 'user' ? 'order-1' : ''}`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 ${message.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                      }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* Voice output controls for assistant messages */}
                    {message.role === 'assistant' && workflowType?.output_type === 'voice' && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (playingAudioId === message.id) {
                              stopSpeaking();
                            } else {
                              setPlayingAudioId(message.id);
                              speakResponse(message.content);
                            }
                          }}
                          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors"
                        >
                          {playingAudioId === message.id ? (
                            <>
                              <VolumeX className="w-4 h-4" />
                              Stop
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-4 h-4" />
                              Play audio
                            </>
                          )}
                        </button>
                      </div>
                    )}
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
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0 order-2">
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
          {/* Workflow Type Indicator */}
          {workflowType && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className={`px-2 py-0.5 text-xs rounded-full ${workflowType.input_type === 'voice'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
                }`}>
                {workflowType.input_type === 'voice' ? '🎤 Voice Input' : '⌨️ Text Input'}
              </span>
              <span className="text-gray-400">→</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${workflowType.output_type === 'voice'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
                }`}>
                {workflowType.output_type === 'voice' ? '🔊 Voice Output' : '💬 Text Output'}
              </span>
            </div>
          )}

          {/* Voice Input Mode */}
          {workflowType?.input_type === 'voice' ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={(isRecognizing || isRecording) ? stopRecording : startRecording}
                  disabled={sending}
                  className={`p-6 rounded-full transition-all ${(isRecognizing || isRecording)
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : 'bg-purple-600 hover:bg-purple-700'
                    } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {sending ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (isRecognizing || isRecording) ? (
                    <Square className="w-8 h-8" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </motion.button>

                <button
                  onClick={() => { setInputValue(''); setInterimTranscript(''); }}
                  className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm"
                >
                  Clear
                </button>
              </div>

              <p className="text-sm text-gray-500">
                {(isRecognizing || isRecording) ? 'Recording... Click to stop' : 'Click to start recording'}
              </p>

              {/* Interim transcript (live) */}
              {interimTranscript && (
                <div className="text-sm text-gray-500 italic">{interimTranscript}</div>
              )}

              {/* Also allow text input as fallback */}
              <div className="w-full flex items-center gap-3 mt-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Or type your message..."
                  disabled={sending || isRecording}
                  className="flex-1 px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                />
                <motion.button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || sending || isRecording}
                  className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          ) : (
            /* Text Input Mode (default) */
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
          )}

          <p className="text-xs text-gray-400 mt-2 text-center">
            {workflowType?.input_type === 'voice'
              ? 'Speak or type your message • Your workflow runs on each message'
              : 'Press Enter to send • Your workflow runs on each message'
            }
          </p>
        </div>
      </footer>
    </div>
  );
}
