import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Table, Link2, Key, RefreshCw } from 'lucide-react';
import type { GoogleSheetsData } from '../../../types/workflow';

interface GoogleSheetsConfigPanelProps {
  data: GoogleSheetsData;
  onSave: (data: GoogleSheetsData) => void;
  onClose: () => void;
}

export default function GoogleSheetsConfigPanel({ data, onSave, onClose }: GoogleSheetsConfigPanelProps) {
  const [formData, setFormData] = useState<GoogleSheetsData>(data);

  const extractSpreadsheetId = (url: string) => {
    // Extract ID from Google Sheets URL
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  };

  const handleSpreadsheetInput = (value: string) => {
    const id = extractSpreadsheetId(value);
    setFormData({ ...formData, spreadsheetId: id });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="w-96 bg-white border-l border-gray-200 h-full overflow-y-auto shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-green-50">
        <div className="flex items-center gap-2">
          <Table className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-800">Google Sheets</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-green-100 rounded">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-6">
        {/* Spreadsheet ID / URL */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Link2 className="w-4 h-4" />
            Spreadsheet URL or ID
          </label>
          <input
            type="text"
            value={formData.spreadsheetId}
            onChange={(e) => handleSpreadsheetInput(e.target.value)}
            placeholder="Paste Google Sheets URL or ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            You can paste the full URL or just the spreadsheet ID
          </p>
        </div>

        {/* Sheet Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sheet Name
          </label>
          <input
            type="text"
            value={formData.sheetName}
            onChange={(e) => setFormData({ ...formData, sheetName: e.target.value })}
            placeholder="e.g., Sheet1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cell Range
          </label>
          <input
            type="text"
            value={formData.range}
            onChange={(e) => setFormData({ ...formData, range: e.target.value })}
            placeholder="e.g., A1:Z100"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            Specify the range of cells to read/write
          </p>
        </div>

        {/* Sync Mode */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <RefreshCw className="w-4 h-4" />
            Sync Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['read', 'write', 'both'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFormData({ ...formData, syncMode: mode })}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  formData.syncMode === mode
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {formData.syncMode === 'read' && 'Read data from the spreadsheet to use in the workflow'}
            {formData.syncMode === 'write' && 'Write workflow data back to the spreadsheet'}
            {formData.syncMode === 'both' && 'Read from and write to the spreadsheet'}
          </p>
        </div>

        {/* Credentials Status */}
        <div className="pt-4 border-t border-gray-200">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Key className="w-4 h-4" />
            Google API Credentials
          </label>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${formData.credentials ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {formData.credentials ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <button
            onClick={() => setFormData({ ...formData, credentials: !formData.credentials })}
            className="w-full px-4 py-2 border border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm"
          >
            {formData.credentials ? 'Disconnect Google Account' : 'Connect Google Account'}
          </button>
          <p className="mt-2 text-xs text-gray-500">
            Connect your Google account to access spreadsheet data.
          </p>
        </div>

        {/* Last Synced */}
        {formData.lastSynced && (
          <div className="text-xs text-gray-500">
            Last synced: {new Date(formData.lastSynced).toLocaleString()}
          </div>
        )}
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
          onClick={() => onSave(formData)}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </motion.div>
  );
}
