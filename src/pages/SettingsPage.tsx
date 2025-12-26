import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Key, Save, Eye, EyeOff, Loader2, ChevronLeft,
    Shield, CheckCircle, Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../utils/api';
import Navbar from '../components/Navbar';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface SavedAPIKey {
    id: string;
    label: string;
    masked_key: string;
    provider: string;
    is_default: boolean;
}

export default function SettingsPage() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [apiKey, setApiKey] = useState('');
    const [keyLabel, setKeyLabel] = useState('');
    const [savedKeys, setSavedKeys] = useState<SavedAPIKey[]>([]);
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingKey, setLoadingKey] = useState(true);

    // Fetch existing API keys (using multi-key API - same as workflow)
    useEffect(() => {
        const fetchKeys = async () => {
            if (!user?.id) return;

            try {
                const res = await apiFetch(`${API_BASE}/api/users/${user.id}/api-keys`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const keys = await res.json();
                    setSavedKeys(keys || []);
                }
            } catch (err) {
                console.error('Failed to fetch API keys:', err);
            } finally {
                setLoadingKey(false);
            }
        };

        if (!authLoading && user) {
            fetchKeys();
        }
    }, [user, authLoading]);

    const handleSaveKey = async () => {
        if (!apiKey.trim()) {
            Swal.fire({ icon: 'warning', title: 'API Key Required', text: 'Please enter your OpenAI API key.' });
            return;
        }

        if (!apiKey.startsWith('sk-')) {
            Swal.fire({ icon: 'warning', title: 'Invalid Key Format', text: 'OpenAI API keys typically start with "sk-".' });
            return;
        }

        setSaving(true);
        try {
            const res = await apiFetch(`${API_BASE}/api/users/${user?.id}/api-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    api_key: apiKey,
                    label: keyLabel.trim() || 'OpenAI Key',
                    provider: 'openai'
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to save API key');
            }

            const newKey = await res.json();
            setSavedKeys(prev => [newKey, ...prev]);
            setApiKey('');
            setKeyLabel('');

            Swal.fire({ icon: 'success', title: 'Saved!', text: 'Your API key has been securely stored.' });
        } catch (err) {
            console.error('Failed to save API key:', err);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save API key. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteKey = async (keyId: string) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Delete API Key?',
            text: 'This action cannot be undone.',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Delete',
        });

        if (!result.isConfirmed) return;

        try {
            const res = await apiFetch(`${API_BASE}/api/users/${user?.id}/api-keys/${keyId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (res.ok) {
                setSavedKeys(prev => prev.filter(k => k.id !== keyId));
                Swal.fire({ icon: 'success', title: 'Deleted!', text: 'API key has been removed.' });
            }
        } catch (err) {
            console.error('Failed to delete API key:', err);
        }
    };

    const handleSetDefault = async (keyId: string) => {
        try {
            const res = await apiFetch(`${API_BASE}/api/users/${user?.id}/api-keys/${keyId}/default`, {
                method: 'PUT',
                credentials: 'include',
            });

            if (res.ok) {
                setSavedKeys(prev => prev.map(k => ({ ...k, is_default: k.id === keyId })));
            }
        } catch (err) {
            console.error('Failed to set default key:', err);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
        );
    }

    if (!user) {
        navigate('/login');
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
            <Navbar />

            <div className="max-w-2xl mx-auto px-4 py-12">
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/projects')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back to Projects
                    </button>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <Key className="w-8 h-8 text-purple-400" />
                        <h1 className="text-2xl font-bold text-white">API Key Settings</h1>
                    </div>

                    <div className="mb-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                        <div className="flex items-start gap-3">
                            <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
                            <p className="text-sm text-blue-200">
                                Your API key is encrypted and stored securely. We never share or expose your key.
                            </p>
                        </div>
                    </div>

                    {loadingKey ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Saved Keys List */}
                            {savedKeys.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-sm font-medium text-gray-300 mb-3">Saved API Keys</h3>
                                    <div className="space-y-2">
                                        {savedKeys.map((key) => (
                                            <div
                                                key={key.id}
                                                className={`flex items-center justify-between p-3 rounded-lg border ${key.is_default
                                                    ? 'bg-green-500/10 border-green-500/30'
                                                    : 'bg-white/5 border-white/10'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <CheckCircle className={`w-4 h-4 ${key.is_default ? 'text-green-400' : 'text-gray-500'}`} />
                                                    <div>
                                                        <p className="text-white text-sm font-medium">{key.label}</p>
                                                        <p className="text-gray-400 text-xs">{key.masked_key}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!key.is_default && (
                                                        <button
                                                            onClick={() => handleSetDefault(key.id)}
                                                            className="text-xs text-purple-400 hover:text-purple-300"
                                                        >
                                                            Set Default
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteKey(key.id)}
                                                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Add New API Key
                                    </label>
                                    <input
                                        type="text"
                                        value={keyLabel}
                                        onChange={(e) => setKeyLabel(e.target.value)}
                                        placeholder="Label (e.g., Work Key, Personal)"
                                        className="w-full px-4 py-2 mb-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                    <div className="relative">
                                        <input
                                            type={showKey ? 'text' : 'password'}
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="sk-..."
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                        >
                                            {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Get your API key from{' '}
                                        <a
                                            href="https://platform.openai.com/api-keys"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-purple-400 hover:underline"
                                        >
                                            OpenAI Dashboard
                                        </a>
                                    </p>
                                </div>

                                <motion.button
                                    onClick={handleSaveKey}
                                    disabled={saving || !apiKey.trim()}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    whileHover={{ scale: saving ? 1 : 1.02 }}
                                    whileTap={{ scale: saving ? 1 : 0.98 }}
                                >
                                    {saving ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Save className="w-5 h-5" />
                                    )}
                                    {saving ? 'Saving...' : 'Add API Key'}
                                </motion.button>
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
