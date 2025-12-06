import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Play, Settings, ChevronLeft, Loader2, Edit2 } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import NodeSidebar from '../components/workflow/NodeSidebar';
import WorkflowCanvas from '../components/workflow/WorkflowCanvas';
import {
  AIModelConfigPanel,
  RAGDocumentConfigPanel,
  GoogleSheetsConfigPanel,
} from '../components/workflow/config';
import IfConditionConfigPanel from '../components/workflow/config/IfConditionConfigPanel';
import type {
  WorkflowNode,
  Connection,
  NodeTemplate,
  Position,
  NodeData,
  AIModelData,
  RAGDocumentData,
  GoogleSheetsData,
  IfConditionData,
} from '../types/workflow';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function ModelConfig() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  
  // Workflow state
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configPanelNode, setConfigPanelNode] = useState<WorkflowNode | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  
  // Loading / saving state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load project on mount if projectId is provided
  useEffect(() => {
    const loadProjectData = async (id: string) => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/projects/${id}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          if (res.status === 401) {
            navigate('/login');
            return;
          }
          if (res.status === 404) {
            navigate('/projects');
            return;
          }
          throw new Error('Failed to load project');
        }
        const project = await res.json();
        setWorkflowName(project.name || 'Untitled Workflow');
        setWorkflowDescription(project.description || '');
        setNodes(project.nodes || []);
        setConnections(project.connections || []);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error('Failed to load project:', err);
        navigate('/projects');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadProjectData(projectId);
    }
  }, [projectId, navigate]);

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
    setHasUnsavedChanges(true);
  }, []);

  // Handle node movement
  const handleNodeMove = useCallback((nodeId: string, position: Position) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId ? { ...node, position } : node
      )
    );
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
  }, [selectedNodeId, configPanelNode]);

  // Handle connection creation
  const handleConnectionCreate = useCallback(
    (connection: Omit<Connection, 'id'>) => {
      const newConnection: Connection = {
        ...connection,
        id: `conn-${Date.now()}`,
      };
      setConnections((prev) => [...prev, newConnection]);
      setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
  }, []);

  // Handle workflow save
  const handleSaveWorkflow = async () => {
    setSaving(true);
    try {
      if (projectId) {
        // Update existing project
        const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: workflowName,
            description: workflowDescription,
            nodes,
            connections,
          }),
        });
        if (!res.ok) throw new Error('Failed to save');
        setHasUnsavedChanges(false);
        await Swal.fire({ icon: 'success', title: 'Saved', text: 'Project saved.' });
      } else {
        // Create new project
        const res = await fetch(`${API_BASE}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: workflowName,
            description: workflowDescription,
            nodes,
            connections,
          }),
        });
        if (!res.ok) throw new Error('Failed to create');
        const newProject = await res.json();
        setHasUnsavedChanges(false);
        navigate(`/model-config/${newProject.id}`, { replace: true });
        await Swal.fire({ icon: 'success', title: 'Created', text: 'Project created.' });
      }
    } catch (err) {
      console.error('Save error:', err);
      await Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save project' });
    } finally {
      setSaving(false);
    }
  };

  // beforeunload - ask browser confirmation when there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // navigation guard for Back link
  const navigateWithGuard = async (to: string) => {
    if (!hasUnsavedChanges) {
      navigate(to);
      return;
    }

    const result = await Swal.fire({
      title: 'Unsaved changes',
      text: 'You have unsaved changes. What would you like to do?',
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Save changes',
      denyButtonText: `Leave without saving`,
      cancelButtonText: 'Cancel',
    });

    if (result.isConfirmed) {
      await handleSaveWorkflow();
      navigate(to);
    } else if (result.isDenied) {
      setHasUnsavedChanges(false);
      navigate(to);
    } else {
      // Cancel - do nothing
    }
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
      case 'if-condition':
        return (
          <IfConditionConfigPanel
            data={configPanelNode.data as IfConditionData}
            onSave={(data) => handleConfigSave(configPanelNode.id, data)}
            onClose={() => setConfigPanelNode(null)}
          />
        );
      default:
        return null;
    }
  };

  // Show loading spinner while loading project
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateWithGuard(projectId ? '/projects' : '/')}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">{projectId ? 'Projects' : 'Back'}</span>
          </button>
          <div className="h-6 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <input
              ref={nameInputRef}
              type="text"
              value={workflowName}
              onChange={(e) => {
                setWorkflowName(e.target.value);
                setHasUnsavedChanges(true);
              }}
              className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-purple-500 rounded px-2 py-1"
            />
            <button
              onClick={() => nameInputRef.current?.focus()}
              title="Edit workflow name"
              className="p-1 rounded-md hover:bg-gray-100"
            >
              <Edit2 className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          {hasUnsavedChanges && (
            <span className="text-xs text-orange-500 font-medium">Unsaved changes</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={handleSaveWorkflow}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save'}
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
