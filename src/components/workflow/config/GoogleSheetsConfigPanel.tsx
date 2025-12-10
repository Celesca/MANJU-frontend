import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Table, Link2, FileSpreadsheet } from 'lucide-react';
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
        {/* Info Box */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="text-sm text-green-700">
              <p className="font-medium">Google Sheets Context</p>
              <p className="mt-1 text-xs">
                This node reads data from a Google Sheet and provides it as context to AI models.
                Make sure the sheet is shared with the service account.
              </p>
            </div>
          </div>
        </div>

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
          {formData.spreadsheetId && (
            <p className="mt-1 text-xs text-green-600">
              ID: {formData.spreadsheetId}
            </p>
          )}
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
            placeholder="e.g., Sheet1, Sales Data"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            The name of the worksheet tab to read from
          </p>
        </div>

        {/* Connection Note */}
        <div className="pt-4 border-t border-gray-200">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              <span className="font-medium">Note:</span> The backend uses a service account 
              (client_secret.json) for authentication. Make sure your spreadsheet is shared 
              with the service account email.
            </p>
          </div>
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
          onClick={() => onSave(formData)}
          disabled={!formData.spreadsheetId || !formData.sheetName}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Changes
        </button>
      </div>
    </motion.div>
  );
}
