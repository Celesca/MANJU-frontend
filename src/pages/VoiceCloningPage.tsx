import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    Play,
    Pause,
    Download,
    Loader2,
    Volume2,
    Settings2,
    Mic,
    Sparkles,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../utils/api';
import Swal from 'sweetalert2';

interface Voice {
    id: string;
    voice_name: string;
    voice_url: string;
    ref_text?: string;
    gender?: string;
    age_range?: string;
    language?: string;
    created_at: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const languageLabels: Record<string, string> = {
    en: 'English',
    th: 'Thai',
    ja: 'Japanese',
    zh: 'Chinese',
    ko: 'Korean',
};

export default function VoiceCloningPage() {
    const { user } = useAuth();

    // Voice selection
    const [voices, setVoices] = useState<Voice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
    const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);
    const [loadingVoices, setLoadingVoices] = useState(true);

    // Text input
    const [genText, setGenText] = useState('');

    // Settings
    const [showSettings, setShowSettings] = useState(false);
    const [nfeStep, setNfeStep] = useState(16);
    const [speed, setSpeed] = useState(1.0);
    const [cfgStrength, setCfgStrength] = useState(2.0);
    const [removeSilence, setRemoveSilence] = useState(true);

    // Generation state
    const [generating, setGenerating] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Fetch user's voices on mount
    useEffect(() => {
        const loadVoices = async () => {
            if (!user?.id) return;
            try {
                setLoadingVoices(true);
                const res = await apiFetch(`${API_BASE}/api/voices/user/${user.id}`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    setVoices(data || []);
                }
            } catch (err) {
                console.error('Failed to load voices:', err);
            } finally {
                setLoadingVoices(false);
            }
        };
        loadVoices();
    }, [user?.id]);

    // Cleanup audio URL on unmount
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const handleGenerate = async () => {
        if (!selectedVoice) {
            Swal.fire({ icon: 'warning', title: 'Select a Voice', text: 'Please select a voice first.' });
            return;
        }
        if (!genText.trim()) {
            Swal.fire({ icon: 'warning', title: 'Enter Text', text: 'Please enter some text to generate.' });
            return;
        }

        // Check if voice has a valid audio URL
        if (!selectedVoice.voice_url || selectedVoice.voice_url === 'placeholder') {
            Swal.fire({
                icon: 'error',
                title: 'No Reference Audio',
                text: 'This voice does not have a valid reference audio file. Please re-create the voice.'
            });
            return;
        }

        setGenerating(true);
        setAudioUrl(null);

        try {
            // Call backend clone endpoint (backend will proxy to F5-TTS API)
            const res = await apiFetch(`${API_BASE}/api/voices/${selectedVoice.id}/clone`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gen_text: genText,
                    nfe_step: nfeStep,
                    speed: speed,
                    cfg_strength: cfgStrength,
                    remove_silence: removeSilence,
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to generate audio');
            }

            // Get audio blob
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);

            Swal.fire({
                icon: 'success',
                title: 'Audio Generated!',
                timer: 1500,
                showConfirmButton: false,
            });
        } catch (err) {
            console.error('Generation failed:', err);
            Swal.fire({
                icon: 'error',
                title: 'Generation Failed',
                text: err instanceof Error ? err.message : 'An error occurred',
            });
        } finally {
            setGenerating(false);
        }
    };

    const togglePlayPause = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleDownload = () => {
        if (!audioUrl) return;
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `cloned_${selectedVoice?.voice_name || 'voice'}_${Date.now()}.wav`;
        a.click();
    };

    const getVoiceColor = (name: string) => {
        const colors = [
            'from-blue-400 to-blue-600',
            'from-purple-400 to-purple-600',
            'from-pink-400 to-pink-600',
            'from-orange-400 to-orange-600',
            'from-teal-400 to-teal-600',
            'from-indigo-400 to-indigo-600',
        ];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    return (
        <div className="min-h-full p-6 lg:p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Sparkles className="w-8 h-8 text-purple-600" />
                    Voice Cloning
                </h1>
                <p className="text-gray-600 mt-1">
                    Generate speech using your custom voice models
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Voice Selection & Text */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Voice Selector */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Select Voice
                        </label>
                        <div className="relative">
                            <button
                                onClick={() => setVoiceDropdownOpen(!voiceDropdownOpen)}
                                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-purple-300 transition-colors text-left"
                            >
                                {selectedVoice ? (
                                    <>
                                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getVoiceColor(selectedVoice.voice_name)} flex items-center justify-center flex-shrink-0`}>
                                            <span className="text-white font-bold">
                                                {selectedVoice.voice_name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900">{selectedVoice.voice_name}</p>
                                            <p className="text-sm text-gray-500">
                                                {selectedVoice.language && languageLabels[selectedVoice.language]}
                                                {selectedVoice.gender && ` • ${selectedVoice.gender}`}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                            <Mic className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-gray-500">
                                                {loadingVoices ? 'Loading voices...' : 'Select a voice'}
                                            </p>
                                        </div>
                                    </>
                                )}
                                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${voiceDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {voiceDropdownOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setVoiceDropdownOpen(false)}
                                        />
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto"
                                        >
                                            {voices.length === 0 ? (
                                                <div className="p-4 text-center text-gray-500">
                                                    No voices available. Create one first.
                                                </div>
                                            ) : (
                                                voices.map((voice) => (
                                                    <button
                                                        key={voice.id}
                                                        onClick={() => {
                                                            setSelectedVoice(voice);
                                                            setVoiceDropdownOpen(false);
                                                        }}
                                                        className={`w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${selectedVoice?.id === voice.id ? 'bg-purple-50' : ''}`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getVoiceColor(voice.voice_name)} flex items-center justify-center flex-shrink-0`}>
                                                            <span className="text-white font-bold text-sm">
                                                                {voice.voice_name.charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 text-left min-w-0">
                                                            <p className="font-medium text-gray-900 truncate">{voice.voice_name}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {voice.language && languageLabels[voice.language]}
                                                                {voice.gender && ` • ${voice.gender}`}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Text Input */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Text to Generate
                        </label>
                        <textarea
                            value={genText}
                            onChange={(e) => setGenText(e.target.value)}
                            placeholder="Enter the text you want to convert to speech..."
                            rows={6}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-2">
                            {genText.length} characters
                        </p>
                    </div>

                    {/* Generate Button */}
                    <motion.button
                        onClick={handleGenerate}
                        disabled={generating || !selectedVoice || !genText.trim()}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold text-lg shadow-lg shadow-purple-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Generate Speech
                            </>
                        )}
                    </motion.button>

                    {/* Audio Player */}
                    <AnimatePresence>
                        {audioUrl && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white"
                            >
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={togglePlayPause}
                                        className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                    >
                                        {isPlaying ? (
                                            <Pause className="w-6 h-6" />
                                        ) : (
                                            <Play className="w-6 h-6 ml-1" />
                                        )}
                                    </button>

                                    <div className="flex-1">
                                        <p className="font-medium">Generated Audio</p>
                                        <p className="text-sm text-slate-400">
                                            Using {selectedVoice?.voice_name || 'voice'}
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleDownload}
                                        className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                        title="Download"
                                    >
                                        <Download className="w-5 h-5" />
                                    </button>
                                </div>

                                <audio
                                    ref={audioRef}
                                    src={audioUrl}
                                    onEnded={() => setIsPlaying(false)}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                    className="hidden"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right Column - Settings */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Settings2 className="w-5 h-5 text-gray-600" />
                                <span className="font-medium text-gray-900">Advanced Settings</span>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {showSettings && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 pt-0 space-y-5">
                                        {/* NFE Steps */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700">
                                                    NFE Steps
                                                </label>
                                                <span className="text-sm text-purple-600 font-medium">{nfeStep}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="4"
                                                max="64"
                                                step="4"
                                                value={nfeStep}
                                                onChange={(e) => setNfeStep(parseInt(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                            />
                                            <p className="text-xs text-gray-400 mt-1">
                                                More steps = higher quality, slower
                                            </p>
                                        </div>

                                        {/* Speed */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700">
                                                    Speed
                                                </label>
                                                <span className="text-sm text-purple-600 font-medium">{speed.toFixed(1)}x</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="2.0"
                                                step="0.1"
                                                value={speed}
                                                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                            />
                                        </div>

                                        {/* CFG Strength */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700">
                                                    CFG Strength
                                                </label>
                                                <span className="text-sm text-purple-600 font-medium">{cfgStrength.toFixed(1)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="5"
                                                step="0.5"
                                                value={cfgStrength}
                                                onChange={(e) => setCfgStrength(parseFloat(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                            />
                                            <p className="text-xs text-gray-400 mt-1">
                                                Higher = more guidance, may be faster
                                            </p>
                                        </div>

                                        {/* Remove Silence */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium text-gray-700">
                                                Remove Silence
                                            </label>
                                            <button
                                                onClick={() => setRemoveSilence(!removeSilence)}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${removeSilence ? 'bg-purple-600' : 'bg-gray-200'}`}
                                            >
                                                <span
                                                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${removeSilence ? 'translate-x-5' : ''}`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Quick Tips */}
                    <div className="bg-purple-50 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <Volume2 className="w-5 h-5 text-purple-600 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-purple-900 mb-1">Tips</h4>
                                <ul className="text-sm text-purple-700 space-y-1">
                                    <li>• Use 8-16 NFE steps for faster results</li>
                                    <li>• Lower speed (0.8-0.9) improves clarity</li>
                                    <li>• Add spaces between words for Thai text</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
