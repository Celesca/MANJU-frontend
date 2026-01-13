import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ChevronLeft,
    Upload,
    FileAudio,
    X,
    Loader2,
} from 'lucide-react';
import VoiceAudioPlayer from '../components/VoiceAudioPlayer';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../utils/api';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const ageRanges = [
    { value: 'child', label: 'Child', range: '1-17' },
    { value: 'youth', label: 'Youth', range: '18-24' },
    { value: 'adult', label: 'Adult', range: '24-40' },
    { value: 'middle-aged', label: 'Middle-Aged', range: '41-60' },
    { value: 'older', label: 'Older', range: '61+' },
];

const languages = [
    { value: 'en', label: 'English' },
    { value: 'th', label: 'Thai' },
    { value: 'ja', label: 'Japanese' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ko', label: 'Korean' },
];

export default function CreateVoicePage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Step state
    const [step, setStep] = useState<1 | 2>(1);

    // File state
    const [file, setFile] = useState<File | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Form state
    const [voiceName, setVoiceName] = useState('');
    const [refText, setRefText] = useState('');
    const [gender, setGender] = useState<'male' | 'female'>('female');
    const [ageRange, setAgeRange] = useState('adult');
    const [language, setLanguage] = useState('en');

    // Loading state
    const [saving, setSaving] = useState(false);

    const handleFileSelect = useCallback((selectedFile: File) => {
        // Validate file type
        const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'];
        if (!validTypes.includes(selectedFile.type)) {
            Swal.fire({ icon: 'error', title: 'Invalid file type', text: 'Please upload an MP3 or WAV file.' });
            return;
        }

        // Validate file size (10MB max)
        if (selectedFile.size > 10 * 1024 * 1024) {
            Swal.fire({ icon: 'error', title: 'File too large', text: 'Maximum file size is 10MB.' });
            return;
        }

        setFile(selectedFile);
        setFileUrl(URL.createObjectURL(selectedFile));
        setVoiceName(selectedFile.name.replace(/\.[^/.]+$/, '')); // Use filename without extension as default name
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleFileSelect(selectedFile);
        }
    };

    const handleRemoveFile = () => {
        if (fileUrl) {
            URL.revokeObjectURL(fileUrl);
        }
        setFile(null);
        setFileUrl(null);
        setVoiceName('');
        setStep(1);
    };

    const handleNextStep = () => {
        if (!file) return;
        setStep(2);
    };

    const handlePreviousStep = () => {
        setStep(1);
    };

    const handleCreate = async () => {
        if (!file || !user?.id || !voiceName.trim()) return;

        setSaving(true);
        try {
            // For now, we'll use a placeholder URL since file upload would need a separate endpoint
            // In production, you'd upload the file first and get a URL back
            const voiceUrl = fileUrl || 'placeholder';

            const res = await apiFetch(`${API_BASE}/api/voices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    voice_name: voiceName,
                    voice_url: voiceUrl,
                    ref_text: refText,
                    gender: gender,
                    age_range: ageRange,
                    language: language,
                    user_id: user.id,
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to create voice');
            }

            await Swal.fire({
                icon: 'success',
                title: 'Voice Created!',
                text: 'Your voice model has been saved.',
                timer: 1500,
                showConfirmButton: false,
            });

            navigate('/console/voices');
        } catch (err) {
            console.error('Failed to create voice:', err);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create voice. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="min-h-full bg-white">
            {/* Header */}
            <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center">
                    <button
                        onClick={step === 2 ? handlePreviousStep : () => navigate('/console/voices')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors mr-4"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <h1 className="text-xl font-semibold text-gray-900">Create new voice</h1>
                </div>
            </header>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-6 py-8">
                {step === 1 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Upload Area */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload voice file</h2>

                            {!file ? (
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`
                    relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                    ${isDragging
                                            ? 'border-purple-500 bg-purple-50'
                                            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                                        }
                  `}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav"
                                        onChange={handleFileInputChange}
                                        className="hidden"
                                    />
                                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-700 font-medium">Click to upload or drag and drop</p>
                                    <p className="text-sm text-gray-500 mt-1">Audio or video file, up to 10 MB</p>
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-xl p-6">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                            <FileAudio className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate">{file.name}</p>
                                            <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                                        </div>
                                        <button
                                            onClick={handleRemoveFile}
                                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <X className="w-5 h-5 text-gray-400" />
                                        </button>
                                    </div>

                                    {fileUrl && (
                                        <VoiceAudioPlayer src={fileUrl} showControls={false} />
                                    )}

                                    <motion.button
                                        onClick={handleNextStep}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        className="w-full mt-4 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors"
                                    >
                                        Continue
                                    </motion.button>
                                </div>
                            )}
                        </div>

                        {/* Requirements */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Requirements</h2>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2 border-l-4 border-gray-300 pl-3">
                                        File
                                    </h3>
                                    <ul className="text-sm text-gray-600 space-y-1 ml-4">
                                        <li>• Upload .mp3, .wav audio files up to 10 MB</li>
                                        <li>• File length not exceeding 5-15 seconds</li>
                                        <li className="text-red-600 font-medium">***Shorter length will give better voice quality</li>
                                        <li>• Sampling rate must be higher than 16 kHz</li>
                                        <li>• Reference Voice must have no disturbance noise such as voiceover, sound from environment, microphone producing unwanted noise, etc.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2 border-l-4 border-gray-300 pl-3">
                                        Production
                                    </h3>
                                    <ul className="text-sm text-gray-600 space-y-1 ml-4">
                                        <li>• Reference voice must be paired with reference text</li>
                                        <li className="text-red-600 font-medium">***Reference text is to type how reference voice has been pronounced</li>
                                        <li>• In this progress you can activate either <strong>denoise</strong> or <strong>fix voice</strong></li>
                                        <li>• <strong>Denoise</strong> is to remove noise from 5-10 second length reference voice</li>
                                        <li>• <strong>Fix voice</strong> is to reverb some of your microphone issues such as cracked and echo voiced</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2 border-l-4 border-gray-300 pl-3">
                                        Output
                                    </h3>
                                    <p className="text-sm text-gray-600 ml-4">
                                        Output voice will follow the reference voice's accent. If you want output voice performs like American's accent, reference voice must be recorded by American's accent.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Details Form */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-6">Details</h2>

                            <div className="space-y-6">
                                {/* Voice Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Voice name
                                    </label>
                                    <input
                                        type="text"
                                        value={voiceName}
                                        onChange={(e) => setVoiceName(e.target.value)}
                                        placeholder="Enter voice name"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Reference Text */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Reference Text
                                    </label>
                                    <textarea
                                        value={refText}
                                        onChange={(e) => setRefText(e.target.value)}
                                        placeholder="Sawasdee krub yin dee thee dai roo jak"
                                        rows={3}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                    />
                                </div>

                                {/* Gender */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Voice Gender
                                    </label>
                                    <div className="flex items-center gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="gender"
                                                value="male"
                                                checked={gender === 'male'}
                                                onChange={() => setGender('male')}
                                                className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-gray-700">Male</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="gender"
                                                value="female"
                                                checked={gender === 'female'}
                                                onChange={() => setGender('female')}
                                                className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-gray-700">Female</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Age Range */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-4">
                                        Voice's Age range
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="range"
                                            min="0"
                                            max="4"
                                            value={ageRanges.findIndex((a) => a.value === ageRange)}
                                            onChange={(e) => setAgeRange(ageRanges[parseInt(e.target.value)].value)}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                                        />
                                        <div className="flex justify-between mt-2">
                                            {ageRanges.map((age) => (
                                                <div key={age.value} className="text-center">
                                                    <p className={`text-xs font-medium ${ageRange === age.value ? 'text-slate-900' : 'text-gray-400'}`}>
                                                        {age.label}
                                                    </p>
                                                    <p className="text-xs text-gray-400">{age.range}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Language */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Language (Monolingual)
                                    </label>
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                                    >
                                        <option value="">Select language</option>
                                        {languages.map((lang) => (
                                            <option key={lang.value} value={lang.value}>
                                                {lang.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Reference Voice Preview */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-6">Reference Voice</h2>

                            <div className="bg-gray-50 rounded-xl p-6">
                                {fileUrl && (
                                    <VoiceAudioPlayer
                                        src={fileUrl}
                                        fileName={file?.name}
                                        fileSize={file ? formatFileSize(file.size) : undefined}
                                    />
                                )}

                                <motion.button
                                    onClick={handleRemoveFile}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    className="w-full mt-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Upload className="w-4 h-4" />
                                    Change reference voice
                                </motion.button>

                                {/* Options */}
                                <div className="mt-6 space-y-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="processing"
                                            className="w-4 h-4 mt-0.5 text-purple-600 focus:ring-purple-500"
                                        />
                                        <div>
                                            <p className="font-medium text-gray-900">Denoise</p>
                                            <p className="text-sm text-gray-500">Remove noise from 5-10 second length reference voice</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="processing"
                                            className="w-4 h-4 mt-0.5 text-purple-600 focus:ring-purple-500"
                                        />
                                        <div>
                                            <p className="font-medium text-gray-900">Fixvoice</p>
                                            <p className="text-sm text-gray-500">Reverb some of your microphone issues such as cracked</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            {step === 2 && (
                <footer className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
                    <div className="max-w-5xl mx-auto flex items-center justify-between">
                        <button
                            onClick={handlePreviousStep}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Previous Step
                        </button>

                        <motion.button
                            onClick={handleCreate}
                            disabled={saving || !voiceName.trim()}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-8 py-2.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Create
                        </motion.button>
                    </div>
                </footer>
            )}
        </div>
    );
}
