import { motion } from 'framer-motion';
import { Bot, FileText, Table, Mic, Volume2, GitBranch } from 'lucide-react';
import type { NodeTemplate } from '../../types/workflow';
import { nodeTemplates } from '../../types/nodeTemplates';

const iconComponents: Record<string, React.ReactNode> = {
  mic: <Mic className="w-5 h-5" />,
  bot: <Bot className="w-5 h-5" />,
  'file-text': <FileText className="w-5 h-5" />,
  table: <Table className="w-5 h-5" />,
  volume: <Volume2 className="w-5 h-5" />,
  'git-branch': <GitBranch className="w-5 h-5" />,
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  input: { bg: 'bg-orange-100', text: 'text-orange-700' },
  processing: { bg: 'bg-purple-100', text: 'text-purple-700' },
  data: { bg: 'bg-blue-100', text: 'text-blue-700' },
  output: { bg: 'bg-pink-100', text: 'text-pink-700' },
};

interface NodeSidebarProps {
  onDragStart: (e: React.DragEvent, template: NodeTemplate) => void;
}

export default function NodeSidebar({ onDragStart }: NodeSidebarProps) {
  const categories = ['input', 'processing', 'data', 'output'];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Components</h2>
        <p className="text-sm text-gray-500 mt-1">Drag nodes to the canvas</p>
      </div>

      {categories.map((category) => (
        <div key={category} className="p-4 border-b border-gray-100">
          <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${categoryColors[category].text}`}>
            {category}
          </h3>
          <div className="space-y-2">
            {nodeTemplates
              .filter((t) => t.category === category)
              .map((template) => (
                <motion.div
                  key={template.type}
                  className={`${categoryColors[category].bg} rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow`}
                  draggable
                  onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, template)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-2">
                    <span className={categoryColors[category].text}>
                      {iconComponents[template.icon]}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{template.label}</div>
                      <div className="text-xs text-gray-500">{template.description}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
