import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, GitBranch, Save, HelpCircle } from 'lucide-react';
import type { IfConditionData } from '../../../types/workflow';

interface IfConditionConfigPanelProps {
  data: IfConditionData;
  onSave: (data: IfConditionData) => void;
  onClose: () => void;
}

const conditionTypes = [
  { value: 'contains', label: 'Contains', description: 'Check if input contains a value' },
  { value: 'equals', label: 'Equals', description: 'Check if input exactly matches' },
  { value: 'startsWith', label: 'Starts With', description: 'Check if input starts with a value' },
  { value: 'endsWith', label: 'Ends With', description: 'Check if input ends with a value' },
  { value: 'regex', label: 'Regex', description: 'Match using regular expression' },
  { value: 'custom', label: 'Custom Expression', description: 'Write a custom JavaScript expression' },
] as const;

export default function IfConditionConfigPanel({
  data,
  onSave,
  onClose,
}: IfConditionConfigPanelProps) {
  const [formData, setFormData] = useState<IfConditionData>({
    conditionType: data.conditionType || 'contains',
    conditionValue: data.conditionValue || '',
    caseSensitive: data.caseSensitive || false,
    customExpression: data.customExpression || '',
  });

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-yellow-600" />
          <h2 className="text-lg font-semibold text-gray-800">If Condition</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-700">
              <p>
                The If Condition node routes data based on a condition. If the condition is true, 
                data flows to the "True" output. Otherwise, it flows to the "False" output.
              </p>
            </div>
          </div>
        </div>

        {/* Condition Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Condition Type
          </label>
          <select
            value={formData.conditionType}
            onChange={(e) => setFormData({ 
              ...formData, 
              conditionType: e.target.value as IfConditionData['conditionType'] 
            })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          >
            {conditionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {conditionTypes.find(t => t.value === formData.conditionType)?.description}
          </p>
        </div>

        {/* Condition Value */}
        {formData.conditionType !== 'custom' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Value to Match
            </label>
            <input
              type="text"
              value={formData.conditionValue}
              onChange={(e) => setFormData({ ...formData, conditionValue: e.target.value })}
              placeholder={formData.conditionType === 'regex' ? 'Enter regex pattern...' : 'Enter value to match...'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
            {formData.conditionType === 'regex' && (
              <p className="mt-1 text-xs text-gray-500">
                Example: ^hello|world$
              </p>
            )}
          </div>
        )}

        {/* Custom Expression */}
        {formData.conditionType === 'custom' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom JavaScript Expression
            </label>
            <textarea
              value={formData.customExpression}
              onChange={(e) => setFormData({ ...formData, customExpression: e.target.value })}
              placeholder="input.length > 10 && input.includes('hello')"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use <code className="bg-gray-100 px-1 rounded">input</code> to reference the incoming value.
              The expression should evaluate to true or false.
            </p>
          </div>
        )}

        {/* Case Sensitive */}
        {formData.conditionType !== 'custom' && formData.conditionType !== 'regex' && (
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Case Sensitive</label>
              <p className="text-xs text-gray-500">Match exact casing</p>
            </div>
            <button
              onClick={() => setFormData({ ...formData, caseSensitive: !formData.caseSensitive })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.caseSensitive ? 'bg-yellow-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.caseSensitive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}

        {/* Example Preview */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Preview</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">True path: Condition matches</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-600">False path: Condition doesn't match</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 bg-yellow-600 text-white rounded-lg px-4 py-2 hover:bg-yellow-700 transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Configuration
        </button>
      </div>
    </motion.div>
  );
}
