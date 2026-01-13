import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, Play, Trash2, Edit2 } from 'lucide-react';

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

interface VoiceCardProps {
    voice: Voice;
    onPlay?: () => void;
    onUse?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}

const languageLabels: Record<string, string> = {
    en: 'English',
    th: 'Thai',
    ja: 'Japanese',
    zh: 'Chinese',
    ko: 'Korean',
};

const genderLabels: Record<string, string> = {
    male: 'Male',
    female: 'Female',
};

export default function VoiceCard({
    voice,
    onPlay,
    onUse,
    onEdit,
    onDelete,
}: VoiceCardProps) {
    const [menuOpen, setMenuOpen] = useState(false);

    // Generate avatar color based on voice name
    const getAvatarColor = (name: string) => {
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
        <motion.div
            className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {/* Avatar */}
            <button
                onClick={onPlay}
                className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${getAvatarColor(voice.voice_name)} flex items-center justify-center group cursor-pointer flex-shrink-0`}
            >
                <span className="text-white text-lg font-bold">
                    {voice.voice_name.charAt(0).toUpperCase()}
                </span>
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-5 h-5 text-white" />
                </div>
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{voice.voice_name}</h3>
                    <span className="px-2 py-0.5 bg-slate-900 text-white text-xs rounded-full">
                        Personal
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {voice.language && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">
                            {languageLabels[voice.language] || voice.language}
                        </span>
                    )}
                    {voice.gender && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">
                            {genderLabels[voice.gender] || voice.gender}
                        </span>
                    )}
                    {voice.age_range && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md capitalize">
                            {voice.age_range}
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <motion.button
                    onClick={onUse}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                >
                    Use
                </motion.button>

                <div className="relative">
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                    </button>

                    <AnimatePresence>
                        {menuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setMenuOpen(false)}
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1"
                                >
                                    <button
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onEdit?.();
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onDelete?.();
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </button>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}
