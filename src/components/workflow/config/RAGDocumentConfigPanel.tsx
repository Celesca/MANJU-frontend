import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, FileText, Upload, Trash2, File, FileIcon, Loader2, CheckCircle, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import type { RAGDocumentData, UploadedDocument } from '../../../types/workflow';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface RAGDocumentConfigPanelProps {
  data: RAGDocumentData;
  projectId: string;
  onSave: (data: RAGDocumentData) => void;
  onClose: () => void;
}

const fileTypeIcons: Record<string, React.ReactNode> = {
  pdf: <FileIcon className="w-8 h-8 text-red-500" />,
  docx: <File className="w-8 h-8 text-blue-500" />,
  txt: <FileText className="w-8 h-8 text-gray-500" />,
};

const statusIcons: Record<string, React.ReactNode> = {
  uploading: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  processing: <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />,
  ready: <CheckCircle className="w-4 h-4 text-green-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
};

export default function RAGDocumentConfigPanel({ data, projectId, onSave, onClose }: RAGDocumentConfigPanelProps) {
  const [formData, setFormData] = useState<RAGDocumentData>(data);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [embedStatus, setEmbedStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [embedMessage, setEmbedMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const embedDocuments = useCallback(async () => {
    if (!projectId || formData.documents.length === 0) return;
    
    setEmbedding(true);
    setEmbedStatus('idle');
    setEmbedMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/documents/embed`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Embedding failed');
      }

      setEmbedStatus('success');
      setEmbedMessage(result.message || 'Documents embedded successfully!');
    } catch (error) {
      console.error('Embed error:', error);
      setEmbedStatus('error');
      setEmbedMessage(error instanceof Error ? error.message : 'Embedding failed');
    } finally {
      setEmbedding(false);
    }
  }, [projectId, formData.documents.length]);

  const uploadFile = useCallback(async (file: File): Promise<UploadedDocument | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() as 'pdf' | 'docx' | 'txt';
    const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create initial document entry with uploading status
    const newDoc: UploadedDocument = {
      id: docId,
      name: file.name,
      type: ext,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      status: 'uploading',
    };

    // Add to state immediately
    setFormData(prev => ({
      ...prev,
      documents: [...prev.documents, newDoc],
    }));

    try {
      // Create FormData for upload
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('documentId', docId);

      const res = await fetch(`${API_BASE}/api/projects/${projectId}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload,
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const result = await res.json();

      // Update document status to processing/ready
      setFormData(prev => ({
        ...prev,
        documents: prev.documents.map(d => 
          d.id === docId 
            ? { ...d, status: result.status || 'ready', id: result.id || docId }
            : d
        ),
      }));

      return { ...newDoc, status: 'ready', id: result.id || docId };
    } catch (error) {
      console.error('Upload error:', error);
      // Update status to error
      setFormData(prev => ({
        ...prev,
        documents: prev.documents.map(d => 
          d.id === docId ? { ...d, status: 'error' } : d
        ),
      }));
      return null;
    }
  }, [projectId]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    
    // Upload files one by one
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    
    setUploading(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleRemoveDocument = async (docId: string) => {
    try {
      // Call backend to delete
      await fetch(`${API_BASE}/api/projects/${projectId}/documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Delete error:', error);
    }

    // Remove from local state
    setFormData({
      ...formData,
      documents: formData.documents.filter((d) => d.id !== docId),
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="w-96 bg-white border-l border-gray-200 h-full overflow-y-auto shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-50">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">RAG Documents</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-blue-100 rounded">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-6">
        {/* File Upload Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Documents
          </label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop files here, or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:underline"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-gray-400">Supports PDF, DOCX, TXT</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        {/* Document List */}
        {formData.documents.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Uploaded Documents ({formData.documents.length})
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {formData.documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    doc.status === 'error' ? 'bg-red-50' : 'bg-gray-50'
                  }`}
                >
                  {fileTypeIcons[doc.type] || <FileText className="w-8 h-8 text-gray-500" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {doc.name}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      {formatFileSize(doc.size)} • 
                      <span className="flex items-center gap-1">
                        {statusIcons[doc.status]}
                        {doc.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveDocument(doc.id)}
                    className="p-1 hover:bg-red-100 rounded text-red-500"
                    disabled={doc.status === 'uploading' || doc.status === 'processing'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress Indicator */}
        {uploading && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-sm text-blue-700">Uploading documents...</span>
          </div>
        )}

        {/* Embed Documents Button */}
        {formData.documents.length > 0 && formData.documents.some(d => d.status === 'ready') && (
          <div className="space-y-2">
            <button
              onClick={embedDocuments}
              disabled={embedding}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                embedding 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
              }`}
            >
              {embedding ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Embedding documents...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span>Embed Documents with FAISS</span>
                </>
              )}
            </button>
            
            {embedStatus !== 'idle' && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                embedStatus === 'success' ? 'bg-green-50' : 'bg-red-50'
              }`}>
                {embedStatus === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={`text-sm ${
                  embedStatus === 'success' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {embedMessage}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Chunking Settings */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Chunking Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Chunk Size (tokens)
              </label>
              <input
                type="number"
                min="100"
                max="2000"
                value={formData.chunkSize}
                onChange={(e) => setFormData({ ...formData, chunkSize: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Chunk Overlap (tokens)
              </label>
              <input
                type="number"
                min="0"
                max="500"
                value={formData.chunkOverlap}
                onChange={(e) => setFormData({ ...formData, chunkOverlap: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Embedding Model
              </label>
              <select
                value={formData.embeddingModel}
                onChange={(e) => setFormData({ ...formData, embeddingModel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="text-embedding-3-small">text-embedding-3-small</option>
                <option value="text-embedding-3-large">text-embedding-3-large</option>
                <option value="text-embedding-ada-002">text-embedding-ada-002</option>
              </select>
            </div>
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
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </motion.div>
  );
}
