import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Mic, Globe, Zap } from 'lucide-react';
import type { VoiceInputData } from '../../../types/workflow';

interface VoiceInputConfigPanelProps {
  data: VoiceInputData;
  onSave: (data: VoiceInputData) => void;
  onClose: () => void;
}

const ASR_PROVIDERS = [
  {
    id: 'web-speech' as const,
    label: 'Web Speech API',
    desc: 'Browser-native speech recognition (free, real-time)',
    icon: Globe,
  },
  {
    id: 'typhoon' as const,
    label: 'Typhoon ASR',
    desc: 'Typhoon ASR API — optimized for Thai language',
    icon: Zap,
  },
];

const LANGUAGES = [
  { id: 'th-TH', label: 'Thai (ไทย)' },
  { id: 'en-US', label: 'English (US)' },
  { id: 'en-GB', label: 'English (UK)' },
  { id: 'ja-JP', label: 'Japanese (日本語)' },
  { id: 'zh-CN', label: 'Chinese (中文)' },
];

export default function VoiceInputConfigPanel({ data, onSave, onClose }: VoiceInputConfigPanelProps) {
  const [formData, setFormData] = useState<VoiceInputData>({
    language: data.language || 'th-TH',
    sampleRate: data.sampleRate || 16000,
    vadEnabled: data.vadEnabled !== undefined ? data.vadEnabled : true,
    asrProvider: data.asrProvider || 'web-speech',
  });

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-50 overflow-y-auto"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Mic className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Voice Input</h3>
              <p className="text-xs text-gray-500">Configure speech recognition</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* ASR Provider Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            ASR Provider
          </label>
          <div className="space-y-2">
            {ASR_PROVIDERS.map((provider) => {
              const Icon = provider.icon;
              const isSelected = formData.asrProvider === provider.id;
              return (
                <button
                  key={provider.id}
                  onClick={() => setFormData(prev => ({ ...prev, asrProvider: provider.id }))}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                      {provider.label}
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                      {provider.desc}
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-blue-500' : 'border-gray-300'
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language (shown for Web Speech; Typhoon is Thai-optimized but still configurable) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Language
          </label>
          <select
            value={formData.language}
            onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
          {formData.asrProvider === 'typhoon' && (
            <p className="mt-1 text-xs text-amber-600">
              Typhoon ASR is optimized for Thai. Other languages may have lower accuracy.
            </p>
          )}
        </div>

        {/* VAD Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Voice Activity Detection
              </label>
              <p className="text-xs text-gray-500">Auto-send when silence is detected</p>
            </div>
            <button
              onClick={() => setFormData(prev => ({ ...prev, vadEnabled: !prev.vadEnabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                formData.vadEnabled ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                formData.vadEnabled ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>
        </div>

        {/* Typhoon info */}
        {formData.asrProvider === 'typhoon' && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-700">
              Typhoon ASR uses the Typhoon API for transcription. Audio is recorded in-browser
              and sent to the backend for processing. The API key is configured on the server.
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </motion.div>
  );
}
