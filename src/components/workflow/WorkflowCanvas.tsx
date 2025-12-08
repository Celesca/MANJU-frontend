import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, Trash2 } from 'lucide-react';
import WorkflowNode from './WorkflowNode';
import type { WorkflowNode as WorkflowNodeType, Connection, NodeTemplate, Position } from '../../types/workflow';

interface WorkflowCanvasProps {
  nodes: WorkflowNodeType[];
  connections: Connection[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  onNodeMove: (nodeId: string, position: Position) => void;
  onNodeConfigure: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onDrop: (template: NodeTemplate, position: Position) => void;
  onConnectionCreate: (connection: Omit<Connection, 'id'>) => void;
  onConnectionDelete?: (connectionId: string) => void;
}

export default function WorkflowCanvas({
  nodes,
  connections,
  selectedNodeId,
  onNodeSelect,
  onNodeMove,
  onNodeConfigure,
  onNodeDelete,
  onDrop,
  onConnectionCreate,
  onConnectionDelete,
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Node dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragNodeStart, setDragNodeStart] = useState({ x: 0, y: 0 });
  
  // Connection drawing state
  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{
    nodeId: string;
    portId: string;
    portType: 'input' | 'output';
    x: number;
    y: number;
  } | null>(null);
  const [connectionEnd, setConnectionEnd] = useState<{ x: number; y: number } | null>(null);
  // Selected connection id when a connection path is clicked/focused
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // Handle zoom
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.1, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.5));
  const handleZoomReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Handle panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  // Handle drop from sidebar
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const templateData = e.dataTransfer.getData('application/json');
      if (!templateData || !canvasRef.current) return;

      const template: NodeTemplate = JSON.parse(templateData);
      const rect = canvasRef.current.getBoundingClientRect();
      
      // Calculate position accounting for node size (center the node under cursor)
      const nodeWidth = 180; // min-w-[180px]
      const nodeHeight = 80; // approximate height
      const position: Position = {
        x: (e.clientX - rect.left - offset.x) / zoom - nodeWidth / 2,
        y: (e.clientY - rect.top - offset.y) / zoom - nodeHeight / 2,
      };

      onDrop(template, position);
    },
    [onDrop, offset, zoom]
  );

  // Handle node drag start from WorkflowNode component
  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggingNodeId(nodeId);
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDragNodeStart({ x: node.position.x, y: node.position.y });
    handleSelectNode(nodeId);
  };

  // Handle port click for connection drawing
  const handlePortMouseDown = (
    e: React.MouseEvent,
    nodeId: string,
    portId: string,
    portType: 'input' | 'output'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Find the port to get its position
    const port = portType === 'output' 
      ? node.outputs.find(p => p.id === portId)
      : node.inputs.find(p => p.id === portId);
    
    const nodeWidth = 180;
    const nodeHeight = 80; // approximate
    let portX: number;
    let portY: number;

    if (port?.position === 'bottom') {
      // Bottom ports (context inputs)
      const bottomPorts = node.inputs.filter(p => p.position === 'bottom');
      const portIndex = bottomPorts.findIndex(p => p.id === portId);
      portX = node.position.x + 90 + portIndex * 40;
      portY = node.position.y + nodeHeight + 6;
    } else if (portType === 'output') {
      // Right side outputs
      const rightOutputs = node.outputs.filter(p => p.position !== 'bottom');
      const portIndex = rightOutputs.findIndex(p => p.id === portId);
      portX = node.position.x + nodeWidth + 6;
      portY = node.position.y + 32 + portIndex * 28;
    } else {
      // Left side inputs
      const leftInputs = node.inputs.filter(p => p.position !== 'bottom');
      const portIndex = leftInputs.findIndex(p => p.id === portId);
      portX = node.position.x - 6;
      portY = node.position.y + 32 + portIndex * 28;
    }

    setIsDrawingConnection(true);
    setConnectionStart({ nodeId, portId, portType, x: portX, y: portY });
    setConnectionEnd({ x: portX, y: portY });
  };

  // When a node is selected, clear any selected connection
  const handleSelectNode = (nodeId: string | null) => {
    setSelectedConnectionId(null);
    onNodeSelect(nodeId);
  };

  // Handle mouse move for node dragging and connection drawing
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
    
    // Handle node dragging
    if (draggingNodeId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      // Calculate new position based on drag delta
      const deltaX = (currentX - dragStart.x) / zoom;
      const deltaY = (currentY - dragStart.y) / zoom;
      
      onNodeMove(draggingNodeId, {
        x: dragNodeStart.x + deltaX,
        y: dragNodeStart.y + deltaY,
      });
    }
    
    if (isDrawingConnection && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setConnectionEnd({
        x: (e.clientX - rect.left - offset.x) / zoom,
        y: (e.clientY - rect.top - offset.y) / zoom,
      });
    }
  };

  // Handle mouse up for connection completion and node drag end
  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);
    setDraggingNodeId(null);
    
    if (isDrawingConnection && connectionStart) {
      // Check if we dropped on a valid port
      const target = e.target as HTMLElement;
      const targetNodeId = target.dataset?.nodeId;
      const targetPortId = target.dataset?.portId;
      const targetPortType = target.dataset?.portType as 'input' | 'output' | undefined;

      if (
        targetNodeId &&
        targetPortId &&
        targetPortType &&
        targetNodeId !== connectionStart.nodeId &&
        targetPortType !== connectionStart.portType
      ) {
        // Create connection (output -> input)
        const isSourceOutput = connectionStart.portType === 'output';
        onConnectionCreate({
          sourceNodeId: isSourceOutput ? connectionStart.nodeId : targetNodeId,
          sourcePortId: isSourceOutput ? connectionStart.portId : targetPortId,
          targetNodeId: isSourceOutput ? targetNodeId : connectionStart.nodeId,
          targetPortId: isSourceOutput ? targetPortId : connectionStart.portId,
        });
      }
    }
    
    setIsDrawingConnection(false);
    setConnectionStart(null);
    setConnectionEnd(null);
  };

  // Render connections as SVG paths
  const renderConnections = () => {
    const nodeWidth = 180;
    const nodeHeight = 80;
    
    return connections.map((conn) => {
      const sourceNode = nodes.find((n) => n.id === conn.sourceNodeId);
      const targetNode = nodes.find((n) => n.id === conn.targetNodeId);
      
      if (!sourceNode || !targetNode) return null;

      // Find source port index
      const rightOutputs = sourceNode.outputs.filter(p => p.position !== 'bottom');
      const sourcePortIndex = rightOutputs.findIndex(p => p.id === conn.sourcePortId);
      
      // Find target port
      const targetPort = targetNode.inputs.find(p => p.id === conn.targetPortId);
      const leftInputs = targetNode.inputs.filter(p => p.position !== 'bottom');
      const bottomInputs = targetNode.inputs.filter(p => p.position === 'bottom');
      const targetPortIndex = leftInputs.findIndex(p => p.id === conn.targetPortId);
      const targetBottomIndex = bottomInputs.findIndex(p => p.id === conn.targetPortId);
      
      // Calculate source position (always right side for outputs)
      const sourceX = sourceNode.position.x + nodeWidth + 6;
      const sourceY = sourceNode.position.y + 32 + Math.max(0, sourcePortIndex) * 28;
      
      // Calculate target position
      let targetX: number;
      let targetY: number;
      
      if (targetPort?.position === 'bottom') {
        // Bottom port
        targetX = targetNode.position.x + 90 + targetBottomIndex * 40;
        targetY = targetNode.position.y + nodeHeight + 6;
      } else {
        // Left side port
        targetX = targetNode.position.x - 6;
        targetY = targetNode.position.y + 32 + Math.max(0, targetPortIndex) * 28;
      }

      // Bezier curve - adjust control points based on direction
      let path: string;
      if (targetPort?.position === 'bottom') {
        // Curve from right to bottom
        const midY = Math.max(sourceY, targetY + 50);
        path = `M ${sourceX} ${sourceY} C ${sourceX + 50} ${sourceY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
      } else {
        // Normal horizontal curve
        const midX = (sourceX + targetX) / 2;
        path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
      }

      const isSelected = selectedConnectionId === conn.id;
      return (
        <path
          key={conn.id}
          d={path}
          fill="none"
          stroke={isSelected ? '#ef4444' : '#6366f1'}
          strokeWidth={isSelected ? 3 : 2}
          strokeLinecap="round"
          style={{ pointerEvents: 'stroke' }}
          onClick={(ev) => {
            // Prevent canvas background click handlers
            ev.stopPropagation();
            setSelectedConnectionId(conn.id);
            // Clear node selection when a connection is selected
            onNodeSelect(null);
          }}
        />
      );
    });
  };

  // Handle Backspace/Delete keyboard to remove selected node or connection
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      // Use Backspace or Delete
      if (ev.key === 'Backspace' || ev.key === 'Delete') {
        if (selectedNodeId) {
          onNodeDelete(selectedNodeId);
        } else if (selectedConnectionId && onConnectionDelete) {
          onConnectionDelete(selectedConnectionId);
          setSelectedConnectionId(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, selectedConnectionId, onNodeDelete, onConnectionDelete]);

  return (
    <div className="relative flex-1 bg-gray-50 overflow-hidden">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-md p-2">
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm text-gray-600 min-w-16 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-gray-600" />
        </button>
        <div className="w-px h-6 bg-gray-200" />
        <button
          onClick={handleZoomReset}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Delete button for selected node */}
      {selectedNodeId && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => onNodeDelete(selectedNodeId)}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-red-500 text-white rounded-lg shadow-md px-3 py-2 hover:bg-red-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">Delete Node</span>
        </motion.button>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`w-full h-full ${draggingNodeId ? 'cursor-grabbing' : isPanning ? 'cursor-grabbing' : isDrawingConnection ? 'cursor-crosshair' : 'cursor-default'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={() => {
          setIsPanning(false);
          setDraggingNodeId(null);
          setIsDrawingConnection(false);
          setConnectionStart(null);
          setConnectionEnd(null);
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
          onClick={(e) => {
            if (e.target === canvasRef.current) {
              // Clear node and connection selection when clicking background
              setSelectedConnectionId(null);
              onNodeSelect(null);
            }
          }}
        style={{
          backgroundImage: `
            radial-gradient(circle, #d1d5db 1px, transparent 1px)
          `,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
        }}
      >
        {/* Transformed content */}
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* SVG for connections */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: '5000px', height: '5000px', zIndex: 5 }}
          >
            {renderConnections()}
            {/* Temporary connection line while drawing */}
            {isDrawingConnection && connectionStart && connectionEnd && (
              <path
                d={`M ${connectionStart.x} ${connectionStart.y} C ${(connectionStart.x + connectionEnd.x) / 2} ${connectionStart.y}, ${(connectionStart.x + connectionEnd.x) / 2} ${connectionEnd.y}, ${connectionEnd.x} ${connectionEnd.y}`}
                fill="none"
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="5,5"
                strokeLinecap="round"
              />
            )}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => (
            <WorkflowNode
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isDragging={draggingNodeId === node.id}
              onSelect={() => handleSelectNode(node.id)}
              onDragStart={(e) => handleNodeDragStart(node.id, e)}
              onConfigure={() => onNodeConfigure(node.id)}
              onPortMouseDown={handlePortMouseDown}
            />
          ))}
        </div>
      </div>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-gray-400 text-lg mb-2">Drag components from the sidebar</div>
            <div className="text-gray-300 text-sm">to build your voice workflow</div>
          </div>
        </div>
      )}
    </div>
  );
}
