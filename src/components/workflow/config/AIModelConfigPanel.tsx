import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Bot, Key, Thermometer, Hash, MessageSquare, FileOutput, Variable } from 'lucide-react';
import type { AIModelData } from '../../../types/workflow';

interface AIModelConfigPanelProps {
  data: AIModelData;
  onSave: (data: AIModelData) => void;
  onClose: () => void;
}

// Only OpenAI for now - can be extended later
const providers = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'] },
];

export default function AIModelConfigPanel({ data, onSave, onClose }: AIModelConfigPanelProps) {
  const [formData, setFormData] = useState<AIModelData>({
    ...data,
    provider: 'openai', // Force OpenAI for now
    expectedOutput: data.expectedOutput || '',
    outputVariable: data.outputVariable || 'ai_response',
  });

  const currentProvider = providers.find((p) => p.id === formData.provider);

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="w-96 bg-white border-l border-gray-200 h-full overflow-y-auto shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-purple-50">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-800">AI Model Configuration</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-purple-100 rounded">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-6">
        {/* Provider (OpenAI only for now) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Provider
          </label>
          <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
            OpenAI
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Currently only OpenAI is supported. More providers coming soon.
          </p>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Model
          </label>
          <select
            value={formData.modelName}
            onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {currentProvider?.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* System Prompt */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <MessageSquare className="w-4 h-4" />
            System Prompt
          </label>
          <textarea
            value={formData.systemPrompt}
            onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
            placeholder="Enter the system prompt for the AI model..."
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            Define how the AI should behave and respond to callers.
          </p>
        </div>

        {/* Expected Output Format */}
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <FileOutput className="w-4 h-4 text-purple-600" />
            Expected Output Format
          </label>
          <input
            type="text"
            value={formData.expectedOutput || ''}
            onChange={(e) => setFormData({ ...formData, expectedOutput: e.target.value })}
            placeholder="e.g., YES or NO, 1-10, positive/negative/neutral"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            Describe the expected output format. This helps guide the AI and enables if-condition matching.
          </p>
        </div>

        {/* Output Variable Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Variable className="w-4 h-4" />
            Output Variable Name
          </label>
          <input
            type="text"
            value={formData.outputVariable || 'ai_response'}
            onChange={(e) => setFormData({ ...formData, outputVariable: e.target.value })}
            placeholder="ai_response"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Use this variable in If-Condition nodes to check the AI's response.
          </p>
        </div>

        {/* Temperature */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Thermometer className="w-4 h-4" />
            Temperature: {formData.temperature}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={formData.temperature}
            onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Precise (0)</span>
            <span>Creative (2)</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Hash className="w-4 h-4" />
            Max Tokens
          </label>
          <input
            type="number"
            min="1"
            max="128000"
            value={formData.maxTokens}
            onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* API Key Status */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Key className="w-4 h-4" />
            API Key
          </label>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${formData.apiKeyConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {formData.apiKeyConfigured ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            API keys are managed in the Settings page.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </motion.div>
  );
}
