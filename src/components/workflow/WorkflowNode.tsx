import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, FileText, Table, Mic, Volume2, GripVertical, Settings } from 'lucide-react';
import type { WorkflowNode, NodeType } from '../../types/workflow';

export interface WorkflowNodeProps {
  node: WorkflowNode;
  isSelected: boolean;
  onSelect: () => void;
  onDrag: (info: { x: number; y: number }) => void;
  onConfigure: () => void;
  onPortMouseDown?: (
    e: React.MouseEvent,
    nodeId: string,
    portId: string,
    portType: 'input' | 'output'
  ) => void;
}

const nodeIcons: Record<NodeType, React.ReactNode> = {
  'ai-model': <Bot className="w-5 h-5" />,
  'rag-documents': <FileText className="w-5 h-5" />,
  'google-sheets': <Table className="w-5 h-5" />,
  'voice-input': <Mic className="w-5 h-5" />,
  'voice-output': <Volume2 className="w-5 h-5" />,
};

const nodeColors: Record<NodeType, { bg: string; border: string; icon: string }> = {
  'ai-model': { bg: 'bg-purple-50', border: 'border-purple-300', icon: 'text-purple-600' },
  'rag-documents': { bg: 'bg-blue-50', border: 'border-blue-300', icon: 'text-blue-600' },
  'google-sheets': { bg: 'bg-green-50', border: 'border-green-300', icon: 'text-green-600' },
  'voice-input': { bg: 'bg-orange-50', border: 'border-orange-300', icon: 'text-orange-600' },
  'voice-output': { bg: 'bg-pink-50', border: 'border-pink-300', icon: 'text-pink-600' },
};

const nodeLabels: Record<NodeType, string> = {
  'ai-model': 'AI Model',
  'rag-documents': 'RAG Documents',
  'google-sheets': 'Google Sheets',
  'voice-input': 'Voice Input',
  'voice-output': 'Voice Output',
};

export default function WorkflowNodeComponent({
  node,
  isSelected,
  onSelect,
  onDrag,
  onConfigure,
  onPortMouseDown,
}: WorkflowNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const colors = nodeColors[node.type];

  return (
    <motion.div
      className={`absolute cursor-move select-none ${colors.bg} ${colors.border} border-2 rounded-lg shadow-md min-w-[180px] ${
        isSelected ? 'ring-2 ring-purple-500 ring-offset-2' : ''
      }`}
      style={{
        left: node.position.x,
        top: node.position.y,
        zIndex: isSelected ? 20 : 10,
      }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      drag
      dragMomentum={false}
      onDragEnd={(_, info) => onDrag({ x: info.offset.x, y: info.offset.y })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
        <GripVertical className="w-4 h-4 text-gray-400" />
        <span className={colors.icon}>{nodeIcons[node.type]}</span>
        <span className="text-sm font-medium text-gray-700">{nodeLabels[node.type]}</span>
        {isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
            className="ml-auto p-1 hover:bg-gray-200 rounded"
          >
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Content preview */}
      <div className="px-3 py-2">
        <NodePreview node={node} />
      </div>

      {/* Input ports */}
      {node.inputs.map((port, index) => (
        <div
          key={port.id}
          className="absolute w-4 h-4 bg-gray-400 rounded-full border-2 border-white -left-2 cursor-crosshair hover:bg-gray-600 hover:scale-125 transition-all z-50"
          style={{ top: 36 + index * 24 }}
          title={`${port.label} (Input)`}
          onMouseDown={(e) => {
            e.stopPropagation();
            onPortMouseDown?.(e, node.id, port.id, 'input');
          }}
          data-port-id={port.id}
          data-port-type="input"
          data-node-id={node.id}
        />
      ))}

      {/* Output ports */}
      {node.outputs.map((port, index) => (
        <div
          key={port.id}
          className="absolute w-4 h-4 bg-purple-500 rounded-full border-2 border-white -right-2 cursor-crosshair hover:bg-purple-700 hover:scale-125 transition-all z-50"
          style={{ top: 36 + index * 24 }}
          title={`${port.label} (Output)`}
          onMouseDown={(e) => {
            e.stopPropagation();
            onPortMouseDown?.(e, node.id, port.id, 'output');
          }}
          data-port-id={port.id}
          data-port-type="output"
          data-node-id={node.id}
        />
      ))}
    </motion.div>
  );
}

function NodePreview({ node }: { node: WorkflowNode }) {
  switch (node.type) {
    case 'ai-model': {
      const data = node.data as import('../../types/workflow').AIModelData;
      return (
        <div className="text-xs text-gray-600">
          <div className="truncate">Model: {data.modelName || 'Not configured'}</div>
          <div className="truncate">Provider: {data.provider}</div>
        </div>
      );
    }
    case 'rag-documents': {
      const data = node.data as import('../../types/workflow').RAGDocumentData;
      return (
        <div className="text-xs text-gray-600">
          <div>{data.documents.length} document(s)</div>
          <div>Chunk: {data.chunkSize}</div>
        </div>
      );
    }
    case 'google-sheets': {
      const data = node.data as import('../../types/workflow').GoogleSheetsData;
      return (
        <div className="text-xs text-gray-600">
          <div className="truncate">Sheet: {data.sheetName || 'Not configured'}</div>
          <div>Mode: {data.syncMode}</div>
        </div>
      );
    }
    case 'voice-input': {
      const data = node.data as import('../../types/workflow').VoiceInputData;
      return (
        <div className="text-xs text-gray-600">
          <div>Language: {data.language}</div>
          <div>VAD: {data.vadEnabled ? 'On' : 'Off'}</div>
        </div>
      );
    }
    case 'voice-output': {
      const data = node.data as import('../../types/workflow').VoiceOutputData;
      return (
        <div className="text-xs text-gray-600">
          <div>Voice: {data.voice}</div>
          <div>Speed: {data.speed}x</div>
        </div>
      );
    }
    default:
      return null;
  }
}
