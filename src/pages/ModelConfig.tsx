import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Play, Settings, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import NodeSidebar from '../components/workflow/NodeSidebar';
import WorkflowCanvas from '../components/workflow/WorkflowCanvas';
import {
  AIModelConfigPanel,
  RAGDocumentConfigPanel,
  GoogleSheetsConfigPanel,
} from '../components/workflow/config';
import type {
  WorkflowNode,
  Connection,
  NodeTemplate,
  Position,
  NodeData,
  AIModelData,
  RAGDocumentData,
  GoogleSheetsData,
} from '../types/workflow';

export default function ModelConfig() {
  // Workflow state
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configPanelNode, setConfigPanelNode] = useState<WorkflowNode | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');

  // Handle drag from sidebar
  const handleDragStart = (e: React.DragEvent, template: NodeTemplate) => {
    e.dataTransfer.setData('application/json', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drop on canvas
  const handleDrop = useCallback((template: NodeTemplate, position: Position) => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: template.type,
      position,
      data: template.defaultData,
      inputs: template.defaultInputs,
      outputs: template.defaultOutputs,
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  }, []);

  // Handle node movement
  const handleNodeMove = useCallback((nodeId: string, position: Position) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId ? { ...node, position } : node
      )
    );
  }, []);

  // Handle node selection
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  // Handle node configuration
  const handleNodeConfigure = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setConfigPanelNode(node);
    }
  }, [nodes]);

  // Handle node deletion
  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setConnections((prev) =>
      prev.filter((c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId)
    );
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    if (configPanelNode?.id === nodeId) {
      setConfigPanelNode(null);
    }
  }, [selectedNodeId, configPanelNode]);

  // Handle connection creation
  const handleConnectionCreate = useCallback(
    (connection: Omit<Connection, 'id'>) => {
      const newConnection: Connection = {
        ...connection,
        id: `conn-${Date.now()}`,
      };
      setConnections((prev) => [...prev, newConnection]);
    },
    []
  );

  // Handle config panel save
  const handleConfigSave = useCallback((nodeId: string, data: NodeData) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId ? { ...node, data } : node
      )
    );
    setConfigPanelNode(null);
  }, []);

  // Handle workflow save (mock)
  const handleSaveWorkflow = () => {
    const workflow = {
      id: `workflow-${Date.now()}`,
      name: workflowName,
      description: '',
      nodes,
      connections,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    console.log('Saving workflow:', workflow);
    // TODO: Call API to save workflow
    alert('Workflow saved! (Check console for data)');
  };

  // Handle workflow run (mock)
  const handleRunWorkflow = () => {
    console.log('Running workflow with nodes:', nodes);
    // TODO: Call API to run workflow
    alert('Workflow started! (Mock)');
  };

  // Render config panel based on node type
  const renderConfigPanel = () => {
    if (!configPanelNode) return null;

    switch (configPanelNode.type) {
      case 'ai-model':
        return (
          <AIModelConfigPanel
            data={configPanelNode.data as AIModelData}
            onSave={(data) => handleConfigSave(configPanelNode.id, data)}
            onClose={() => setConfigPanelNode(null)}
          />
        );
      case 'rag-documents':
        return (
          <RAGDocumentConfigPanel
            data={configPanelNode.data as RAGDocumentData}
            onSave={(data) => handleConfigSave(configPanelNode.id, data)}
            onClose={() => setConfigPanelNode(null)}
          />
        );
      case 'google-sheets':
        return (
          <GoogleSheetsConfigPanel
            data={configPanelNode.data as GoogleSheetsData}
            onSave={(data) => handleConfigSave(configPanelNode.id, data)}
            onClose={() => setConfigPanelNode(null)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="h-6 w-px bg-gray-200" />
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-purple-500 rounded px-2 py-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={handleSaveWorkflow}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Save className="w-4 h-4" />
            Save
          </motion.button>
          <motion.button
            onClick={handleRunWorkflow}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Play className="w-4 h-4" />
            Run
          </motion.button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <NodeSidebar onDragStart={handleDragStart} />

        {/* Canvas */}
        <WorkflowCanvas
          nodes={nodes}
          connections={connections}
          selectedNodeId={selectedNodeId}
          onNodeSelect={handleNodeSelect}
          onNodeMove={handleNodeMove}
          onNodeConfigure={handleNodeConfigure}
          onNodeDelete={handleNodeDelete}
          onDrop={handleDrop}
          onConnectionCreate={handleConnectionCreate}
        />

        {/* Config Panel */}
        <AnimatePresence>
          {renderConfigPanel()}
        </AnimatePresence>
      </div>

      {/* Footer Status Bar */}
      <footer className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span>{nodes.length} node(s)</span>
          <span>{connections.length} connection(s)</span>
        </div>
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          <span>Voice Call Center Workflow Builder</span>
        </div>
      </footer>
    </div>
  );
}
