import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Mic, Filter, ChevronDown } from 'lucide-react';
import VoiceCard from '../components/VoiceCard';
import VoiceAudioPlayer from '../components/VoiceAudioPlayer';
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

export default function VoicesContent() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [voices, setVoices] = useState<Voice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'latest' | 'name'>('latest');
    const [activeVoice, setActiveVoice] = useState<Voice | null>(null);

    // Fetch voices on mount
    useEffect(() => {
        const loadVoices = async () => {
            if (!user?.id) return;
            try {
                setLoading(true);
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
                setLoading(false);
            }
        };
        loadVoices();
    }, [user?.id]);

    const handleDelete = async (voiceId: string) => {
        const result = await Swal.fire({
            title: 'Delete Voice?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Delete',
        });

        if (!result.isConfirmed) return;

        try {
            const res = await apiFetch(`${API_BASE}/api/voices/${voiceId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) {
                setVoices((prev) => prev.filter((v) => v.id !== voiceId));
                if (activeVoice?.id === voiceId) {
                    setActiveVoice(null);
                }
                Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false });
            }
        } catch (err) {
            console.error('Failed to delete voice:', err);
        }
    };

    const filteredVoices = voices
        .filter((v) => v.voice_name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'name') {
                return a.voice_name.localeCompare(b.voice_name);
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    return (
        <div className="min-h-full flex flex-col">
            <div className="flex-1 p-6 lg:p-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">My Voices</h1>
                        <p className="text-gray-600 mt-1">Manage your custom voice models</p>
                    </div>

                    <motion.button
                        onClick={() => navigate('/console/voices/create')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg font-semibold shadow-lg shadow-purple-200 hover:bg-purple-700 transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Plus className="w-5 h-5" />
                        Create new voice
                    </motion.button>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search Voice"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                            <Filter className="w-5 h-5 text-gray-600" />
                        </button>

                        <button className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors">
                            <Search className="w-5 h-5" />
                        </button>

                        <div className="relative">
                            <button className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors">
                                <span className="text-sm">
                                    {sortBy === 'latest' ? 'Latest added' : 'By name'}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
                    </div>
                )}

                {/* Empty State */}
                {!loading && filteredVoices.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Mic className="w-10 h-10 text-purple-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">
                            {searchQuery ? 'No voices found' : 'No voice models yet'}
                        </h3>
                        <p className="text-gray-500 mb-6 max-w-md mx-auto">
                            {searchQuery
                                ? 'Try a different search term'
                                : 'Upload your first voice model to start creating personalized speech'}
                        </p>
                        {!searchQuery && (
                            <motion.button
                                onClick={() => navigate('/console/voices/create')}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <Plus className="w-5 h-5" />
                                Add Voice
                            </motion.button>
                        )}
                    </div>
                )}

                {/* Voice List */}
                {!loading && filteredVoices.length > 0 && (
                    <div className="space-y-3">
                        {filteredVoices.map((voice) => (
                            <VoiceCard
                                key={voice.id}
                                voice={voice}
                                onPlay={() => setActiveVoice(voice)}
                                onUse={() => {
                                    Swal.fire({
                                        icon: 'info',
                                        title: 'Voice Selected',
                                        text: `${voice.voice_name} is ready to use in your projects.`,
                                    });
                                }}
                                onEdit={() => navigate(`/console/voices/${voice.id}/edit`)}
                                onDelete={() => handleDelete(voice.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Audio Player */}
            <AnimatePresence>
                {activeVoice && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="sticky bottom-0 bg-slate-900 text-white p-4 border-t border-slate-800"
                    >
                        <div className="max-w-4xl mx-auto flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                <span className="text-white font-bold">
                                    {activeVoice.voice_name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">{activeVoice.voice_name}</p>
                                <p className="text-xs text-slate-400 truncate">{activeVoice.ref_text || 'No reference text'}</p>
                            </div>
                            <div className="flex-1">
                                <VoiceAudioPlayer src={activeVoice.voice_url} compact />
                            </div>
                            <button
                                onClick={() => setActiveVoice(null)}
                                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <span className="text-slate-400 text-sm">✕</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
