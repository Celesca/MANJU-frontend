import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Volume2, Upload, Mic, Trash2, Loader2, RefreshCw, Key } from 'lucide-react';
import type { VoiceOutputData } from '../../../types/workflow';
import { apiFetch } from '../../../utils/api';

interface VoiceOutputConfigPanelProps {
  data: VoiceOutputData;
  onSave: (data: VoiceOutputData) => void;
  onClose: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Qwen3-TTS preset voices
const QWEN_VOICES = [
  { id: 'serena', label: 'Serena', gender: 'Female' },
  { id: 'vivian', label: 'Vivian', gender: 'Female' },
  { id: 'ono_anna', label: 'Ono Anna', gender: 'Female' },
  { id: 'sohee', label: 'Sohee', gender: 'Female' },
  { id: 'aiden', label: 'Aiden', gender: 'Male' },
  { id: 'dylan', label: 'Dylan', gender: 'Male' },
  { id: 'eric', label: 'Eric', gender: 'Male' },
  { id: 'ryan', label: 'Ryan', gender: 'Male' },
  { id: 'uncle_fu', label: 'Uncle Fu', gender: 'Male' },
];

// OpenAI voices
const OPENAI_VOICES = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'nova', label: 'Nova' },
  { id: 'shimmer', label: 'Shimmer' },
];

// OpenAI TTS models
const OPENAI_TTS_MODELS = [
  { id: 'tts-1', label: 'TTS-1', desc: 'Optimized for speed' },
  { id: 'tts-1-hd', label: 'TTS-1 HD', desc: 'Higher quality' },
  { id: 'gpt-4o-audio-preview', label: 'GPT-4o Audio', desc: 'Latest audio model' },
  { id: 'gpt-4o-mini-audio-preview', label: 'GPT-4o Mini Audio', desc: 'Fast & affordable' },
];

interface VoiceReference {
  id: string;
  filename: string;
  ref_transcript: string | null;
  created_at: string;
}

export default function VoiceOutputConfigPanel({ data, onSave, onClose }: VoiceOutputConfigPanelProps) {
  const [formData, setFormData] = useState<VoiceOutputData>({
    voice: data.voice || 'alloy',
    speed: data.speed || 1.0,
    pitch: data.pitch || 1.0,
    ttsProvider: data.ttsProvider || 'openai',
    ttsMode: data.ttsMode || 'custom',
    voiceName: data.voiceName || 'serena',
    instruction: data.instruction || '',
    voiceDescription: data.voiceDescription || '',
    referenceVoiceId: data.referenceVoiceId || '',
    referenceVoiceFilename: data.referenceVoiceFilename || '',
    refTranscript: data.refTranscript || '',
    useFastMode: data.useFastMode !== undefined ? data.useFastMode : true,
    openaiApiKey: data.openaiApiKey || '',
    openaiModel: data.openaiModel || 'tts-1',
  });
  const [showApiKey, setShowApiKey] = useState(false);

  const [voiceRefs, setVoiceRefs] = useState<VoiceReference[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [qwenHealthy, setQwenHealthy] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check Qwen TTS health
  useEffect(() => {
    if (formData.ttsProvider === 'qwen3') {
      apiFetch(`${API_BASE}/api/qwen-tts/health`, { credentials: 'include' })
        .then(res => setQwenHealthy(res.ok))
        .catch(() => setQwenHealthy(false));
    }
  }, [formData.ttsProvider]);

  // Fetch cached voice references
  useEffect(() => {
    if (formData.ttsProvider === 'qwen3' && formData.ttsMode === 'voice-clone') {
      fetchVoiceRefs();
    }
  }, [formData.ttsProvider, formData.ttsMode]);

  const fetchVoiceRefs = async () => {
    setLoadingRefs(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/qwen-tts/voice-references`, { credentials: 'include' });
      if (res.ok) {
        const refs = await res.json();
        setVoiceRefs(refs || []);
      }
    } catch (err) {
      console.error('Failed to fetch voice references:', err);
    } finally {
      setLoadingRefs(false);
    }
  };

  const handleUploadRef = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (formData.refTranscript) {
        fd.append('ref_transcript', formData.refTranscript);
      }

      const res = await apiFetch(`${API_BASE}/api/qwen-tts/voice-references/upload`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      if (res.ok) {
        const ref: VoiceReference = await res.json();
        setVoiceRefs(prev => [ref, ...prev]);
        setFormData(prev => ({
          ...prev,
          referenceVoiceId: ref.id,
          referenceVoiceFilename: ref.filename,
        }));
      }
    } catch (err) {
      console.error('Failed to upload voice reference:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteRef = async (refId: string) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/qwen-tts/voice-references/${refId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setVoiceRefs(prev => prev.filter(r => r.id !== refId));
        if (formData.referenceVoiceId === refId) {
          setFormData(prev => ({ ...prev, referenceVoiceId: '', referenceVoiceFilename: '' }));
        }
      }
    } catch (err) {
      console.error('Failed to delete voice reference:', err);
    }
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-pink-600" />
          <h2 className="text-lg font-semibold">Voice Output Settings</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* TTS Provider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">TTS Provider</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setFormData(prev => ({ ...prev, ttsProvider: 'openai' }))}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                formData.ttsProvider === 'openai'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              OpenAI TTS
            </button>
            <button
              onClick={() => setFormData(prev => ({ ...prev, ttsProvider: 'qwen3' }))}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                formData.ttsProvider === 'qwen3'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Qwen3 TTS
            </button>
          </div>
          {formData.ttsProvider === 'qwen3' && qwenHealthy !== null && (
            <div className={`mt-2 text-xs flex items-center gap-1 ${qwenHealthy ? 'text-green-600' : 'text-red-500'}`}>
              <span className={`w-2 h-2 rounded-full ${qwenHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
              {qwenHealthy ? 'Qwen3-TTS service connected' : 'Qwen3-TTS service unavailable'}
            </div>
          )}
        </div>

        {/* ======================== OpenAI Configuration ======================== */}
        {formData.ttsProvider === 'openai' && (
          <>
            {/* TTS Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">TTS Model</label>
              <div className="grid grid-cols-2 gap-2">
                {OPENAI_TTS_MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setFormData(prev => ({ ...prev, openaiModel: m.id }))}
                    className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                      formData.openaiModel === m.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-xs font-medium text-gray-800">{m.label}</div>
                    <div className="text-[10px] text-gray-400">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Voice</label>
              <div className="grid grid-cols-3 gap-2">
                {OPENAI_VOICES.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setFormData(prev => ({ ...prev, voice: v.id }))}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      formData.voice === v.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Speed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Speed: {formData.speed}x</label>
              <input
                type="range"
                min={0.25}
                max={4.0}
                step={0.25}
                value={formData.speed}
                onChange={(e) => setFormData(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                className="w-full accent-blue-600"
              />
            </div>

            {/* OpenAI API Key */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Key className="w-4 h-4 text-blue-600" />
                OpenAI API Key <span className="text-gray-400 font-normal">(optional override)</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.openaiApiKey || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                  placeholder="sk-... (uses server default if empty)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:text-blue-800"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Leave blank to use the server-configured key.</p>
            </div>
          </>
        )}

        {/* ======================== Qwen3 Configuration ======================== */}
        {formData.ttsProvider === 'qwen3' && (
          <>
            {/* TTS Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">TTS Mode</label>
              <div className="space-y-2">
                {[
                  { id: 'custom', label: 'Preset Voice', desc: 'Use built-in character voices' },
                  { id: 'voice-clone', label: 'Voice Clone', desc: 'Clone from reference audio' },
                  { id: 'voice-design', label: 'Voice Design', desc: 'Describe the voice you want' },
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setFormData(prev => ({ ...prev, ttsMode: mode.id as VoiceOutputData['ttsMode'] }))}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      formData.ttsMode === mode.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-800">{mode.label}</div>
                    <div className="text-xs text-gray-500">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Preset Voice */}
            {formData.ttsMode === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Character Voice</label>
                  <div className="grid grid-cols-3 gap-2">
                    {QWEN_VOICES.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setFormData(prev => ({ ...prev, voiceName: v.id }))}
                        className={`px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                          formData.voiceName === v.id
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <div>{v.label}</div>
                        <div className="text-[10px] text-gray-400">{v.gender}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Style Instruction <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.instruction || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, instruction: e.target.value }))}
                    placeholder="e.g. cheerful, speaking fast"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* Voice Clone */}
            {formData.ttsMode === 'voice-clone' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Reference Voices</label>
                    <button
                      onClick={fetchVoiceRefs}
                      className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>

                  {/* Upload new reference */}
                  <div className="mb-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".wav,.mp3,.m4a,.ogg,.flac"
                      onChange={handleUploadRef}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-purple-400 hover:text-purple-600 transition-colors"
                    >
                      {uploading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-4 h-4" /> Upload Reference Audio</>
                      )}
                    </button>
                  </div>

                  {/* Reference transcript */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Reference Transcript <span className="text-gray-400">(improves quality)</span>
                    </label>
                    <textarea
                      value={formData.refTranscript || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, refTranscript: e.target.value }))}
                      placeholder="What is being said in the reference audio..."
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* List cached references */}
                  {loadingRefs ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : voiceRefs.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400">
                      No reference voices cached. Upload one above.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {voiceRefs.map(ref => (
                        <div
                          key={ref.id}
                          onClick={() =>
                            setFormData(prev => ({
                              ...prev,
                              referenceVoiceId: ref.id,
                              referenceVoiceFilename: ref.filename,
                            }))
                          }
                          className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            formData.referenceVoiceId === ref.id
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Mic className="w-4 h-4 text-purple-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-gray-800 truncate">{ref.filename}</div>
                              {ref.ref_transcript && (
                                <div className="text-[10px] text-gray-400 truncate">{ref.ref_transcript}</div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRef(ref.id);
                            }}
                            className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="fast-mode"
                    checked={formData.useFastMode}
                    onChange={(e) => setFormData(prev => ({ ...prev, useFastMode: e.target.checked }))}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="fast-mode" className="text-sm text-gray-700">
                    Fast mode <span className="text-xs text-gray-400">(skip transcript processing)</span>
                  </label>
                </div>
              </>
            )}

            {/* Voice Design */}
            {formData.ttsMode === 'voice-design' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voice Description</label>
                <textarea
                  value={formData.voiceDescription || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, voiceDescription: e.target.value }))}
                  placeholder="e.g. A young female, cheerful and bubbly, speaking energetically"
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Tips: age (young/elderly), gender (male/female), emotion (cheerful/calm), style (clear/soft)
                </p>
              </div>
            )}
          </>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg"
        >
          Save Voice Settings
        </button>
      </div>
    </motion.div>
  );
}
