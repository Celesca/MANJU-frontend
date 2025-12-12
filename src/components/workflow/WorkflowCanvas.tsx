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
  onUndo?: () => void;
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
  onUndo,
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Ref สำหรับกัน Click event ชนกับ Marquee selection
  const preventClickRef = useRef(false);
  
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
  
  // Multi-selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set());
  
  // Marquee selection state
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
  // Track selection before marquee so we can preview live selection (additive with Ctrl/Cmd)
  const marqueeBaseSelectionRef = useRef<Set<string>>(new Set());
  const marqueeBaseConnectionsRef = useRef<Set<string>>(new Set());
  const [marqueeAdditive, setMarqueeAdditive] = useState(false);

  // Handle zoom
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.1, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.5));
  const handleZoomReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Handle panning (middle-click or Alt+left-click or Shift+left-click on empty space)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Reset prevent click ref
    preventClickRef.current = false;

    const target = e.target as HTMLElement;
    const isCanvasBackground = target === canvasRef.current || target.classList.contains('canvas-transform-layer');
    
    // Middle-click or Alt+click always pans
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }
    
    // Left-click on empty canvas with Shift = pan
    if (e.button === 0 && e.shiftKey && isCanvasBackground) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }
    
    // Left-click on empty canvas = start marquee selection
    if (e.button === 0 && isCanvasBackground && !e.altKey && !e.shiftKey) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - offset.x) / zoom;
      const y = (e.clientY - rect.top - offset.y) / zoom;
      setIsMarqueeSelecting(true);
      setMarqueeStart({ x, y });
      setMarqueeEnd({ x, y });
      const additive = e.ctrlKey || e.metaKey;
      setMarqueeAdditive(additive);
      marqueeBaseSelectionRef.current = new Set(selectedNodeIds);
      marqueeBaseConnectionsRef.current = new Set(selectedConnectionIds);
      // If not additive, clear current selection immediately for live preview
      if (!additive) {
        setSelectedNodeIds(new Set());
        setSelectedConnectionIds(new Set());
        onNodeSelect(null);
      }
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

  // When a node is selected, handle multi-select with Ctrl/Cmd
  const handleSelectNode = (nodeId: string | null, e?: React.MouseEvent) => {
    const isMultiSelect = e?.ctrlKey || e?.metaKey;
    
    if (nodeId === null) {
      if (!isMultiSelect) {
        setSelectedNodeIds(new Set());
        setSelectedConnectionIds(new Set());
      }
      onNodeSelect(null);
      return;
    }
    
    // Clear connection selection when selecting nodes
    setSelectedConnectionIds(new Set());
    
    if (isMultiSelect) {
      // Toggle node in multi-selection
      setSelectedNodeIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(nodeId)) {
          newSet.delete(nodeId);
        } else {
          newSet.add(nodeId);
        }
        return newSet;
      });
    } else {
      // Single selection
      setSelectedNodeIds(new Set([nodeId]));
    }
    onNodeSelect(nodeId);
  };
  
  // Handle connection selection with multi-select
  const handleSelectConnection = (connectionId: string, e?: React.MouseEvent) => {
    const isMultiSelect = e?.ctrlKey || e?.metaKey;
    
    // Clear node selection when selecting connections
    setSelectedNodeIds(new Set());
    onNodeSelect(null);
    
    if (isMultiSelect) {
      setSelectedConnectionIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(connectionId)) {
          newSet.delete(connectionId);
        } else {
          newSet.add(connectionId);
        }
        return newSet;
      });
    } else {
      setSelectedConnectionIds(new Set([connectionId]));
    }
  };
  
  // Check if a node intersects with the marquee rectangle
  const nodeIntersectsMarquee = (node: WorkflowNodeType, marqStart: Position, marqEnd: Position): boolean => {
    const nodeWidth = 180;
    const nodeHeight = 80;
    
    const minX = Math.min(marqStart.x, marqEnd.x);
    const maxX = Math.max(marqStart.x, marqEnd.x);
    const minY = Math.min(marqStart.y, marqEnd.y);
    const maxY = Math.max(marqStart.y, marqEnd.y);
    
    return !(node.position.x + nodeWidth < minX || 
             node.position.x > maxX || 
             node.position.y + nodeHeight < minY || 
             node.position.y > maxY);
  };

  // Approximate connection intersection with marquee by sampling points along the cubic curve
  const connectionIntersectsMarquee = (
    conn: Connection,
    marqStart: Position,
    marqEnd: Position
  ): boolean => {
    const nodeWidth = 180;
    const nodeHeight = 80;

    const sourceNode = nodes.find((n) => n.id === conn.sourceNodeId);
    const targetNode = nodes.find((n) => n.id === conn.targetNodeId);
    if (!sourceNode || !targetNode) return false;

    const rightOutputs = sourceNode.outputs.filter((p) => p.position !== 'bottom');
    const sourcePortIndex = rightOutputs.findIndex((p) => p.id === conn.sourcePortId);

    const targetPort = targetNode.inputs.find((p) => p.id === conn.targetPortId);
    const leftInputs = targetNode.inputs.filter((p) => p.position !== 'bottom');
    const bottomInputs = targetNode.inputs.filter((p) => p.position === 'bottom');
    const targetPortIndex = leftInputs.findIndex((p) => p.id === conn.targetPortId);
    const targetBottomIndex = bottomInputs.findIndex((p) => p.id === conn.targetPortId);

    const sourceX = sourceNode.position.x + nodeWidth + 6;
    const sourceY = sourceNode.position.y + 32 + Math.max(0, sourcePortIndex) * 28;

    let targetX: number;
    let targetY: number;
    if (targetPort?.position === 'bottom') {
      targetX = targetNode.position.x + 90 + targetBottomIndex * 40;
      targetY = targetNode.position.y + nodeHeight + 6;
    } else {
      targetX = targetNode.position.x - 6;
      targetY = targetNode.position.y + 32 + Math.max(0, targetPortIndex) * 28;
    }

    let ctrl1: Position;
    let ctrl2: Position;
    if (targetPort?.position === 'bottom') {
      const midY = Math.max(sourceY, targetY + 50);
      ctrl1 = { x: sourceX + 50, y: sourceY };
      ctrl2 = { x: targetX, y: midY };
    } else {
      const midX = (sourceX + targetX) / 2;
      ctrl1 = { x: midX, y: sourceY };
      ctrl2 = { x: midX, y: targetY };
    }

    const minX = Math.min(marqStart.x, marqEnd.x);
    const maxX = Math.max(marqStart.x, marqEnd.x);
    const minY = Math.min(marqStart.y, marqEnd.y);
    const maxY = Math.max(marqStart.y, marqEnd.y);

    // Sample 20 points along the curve and see if any fall within marquee bounds (with small padding)
    const padding = 4;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const x =
        Math.pow(1 - t, 3) * sourceX +
        3 * Math.pow(1 - t, 2) * t * ctrl1.x +
        3 * (1 - t) * Math.pow(t, 2) * ctrl2.x +
        Math.pow(t, 3) * targetX;
      const y =
        Math.pow(1 - t, 3) * sourceY +
        3 * Math.pow(1 - t, 2) * t * ctrl1.y +
        3 * (1 - t) * Math.pow(t, 2) * ctrl2.y +
        Math.pow(t, 3) * targetY;

      if (
        x >= minX - padding &&
        x <= maxX + padding &&
        y >= minY - padding &&
        y <= maxY + padding
      ) {
        return true;
      }
    }

    return false;
  };

  // Handle mouse move for node dragging, connection drawing, and marquee
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }
    
    // Handle marquee selection
    if (isMarqueeSelecting && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - offset.x) / zoom;
      const y = (e.clientY - rect.top - offset.y) / zoom;
      setMarqueeEnd({ x, y });
      // Live preview selection while dragging marquee
      const marqStart = marqueeStart ?? { x, y };
      const nodesInMarquee = nodes.filter(node => nodeIntersectsMarquee(node, marqStart, { x, y }));
      const connectionsInMarquee = connections.filter(conn => connectionIntersectsMarquee(conn, marqStart, { x, y }));

      setSelectedNodeIds(() => {
        const base = marqueeAdditive ? new Set(marqueeBaseSelectionRef.current) : new Set<string>();
        nodesInMarquee.forEach(n => base.add(n.id));
        return base;
      });

      setSelectedConnectionIds(() => {
        const base = marqueeAdditive ? new Set(marqueeBaseConnectionsRef.current) : new Set<string>();
        connectionsInMarquee.forEach(c => base.add(c.id));
        return base;
      });
      return;
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

  const finalizeMarqueeSelection = (marqStart: Position, marqEnd: Position) => {
    const nodesInMarquee = nodes.filter(node =>
      nodeIntersectsMarquee(node, marqStart, marqEnd)
    );
    const connectionsInMarquee = connections.filter(conn =>
      connectionIntersectsMarquee(conn, marqStart, marqEnd)
    );

    setSelectedNodeIds(() => {
      const base = marqueeAdditive ? new Set(marqueeBaseSelectionRef.current) : new Set<string>();
      nodesInMarquee.forEach(n => base.add(n.id));
      return base;
    });

    setSelectedConnectionIds(() => {
      const base = marqueeAdditive ? new Set(marqueeBaseConnectionsRef.current) : new Set<string>();
      connectionsInMarquee.forEach(c => base.add(c.id));
      return base;
    });

    if (nodesInMarquee.length > 0) {
      onNodeSelect(nodesInMarquee[0].id);
    } else if (!marqueeAdditive) {
      onNodeSelect(null);
    }

    // Check if drag distance is significant to prevent accidental click handling
    const dx = Math.abs(marqEnd.x - marqStart.x);
    const dy = Math.abs(marqEnd.y - marqStart.y);
    if (dx > 2 || dy > 2) {
        preventClickRef.current = true;
    }

    setIsMarqueeSelecting(false);
    setMarqueeStart(null);
    setMarqueeEnd(null);
    setMarqueeAdditive(false);
  };

  // Handle mouse up for connection completion, node drag end, and marquee selection
  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);
    setDraggingNodeId(null);
    
    // Finalize marquee selection
    if (isMarqueeSelecting && marqueeStart && marqueeEnd) {
      finalizeMarqueeSelection(marqueeStart, marqueeEnd);
      return;
    }
    
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

      const isSelected = selectedConnectionIds.has(conn.id);
      // Midpoint for focus indicator (approximate)
      const midX = (sourceX + targetX) / 2;
      const midY = (sourceY + targetY) / 2;

      return (
        <g key={conn.id}>
          {/* Invisible wider stroke for easier clicking */}
          <path
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={16}
            strokeLinecap="round"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onClick={(ev) => {
              ev.stopPropagation();
              handleSelectConnection(conn.id, ev as unknown as React.MouseEvent);
            }}
          />
          {/* Visible path */}
          <path
            d={path}
            fill="none"
            stroke={isSelected ? '#ef4444' : '#6366f1'}
            strokeWidth={isSelected ? 3 : 2}
            strokeLinecap="round"
            style={{ pointerEvents: 'none' }}
          />

          {isSelected && (
            // Focus indicator: a small circular button rendered at the midpoint
            <g
              transform={`translate(${midX}, ${midY})`}
              style={{ cursor: 'pointer' }}
              onClick={(ev) => {
                ev.stopPropagation();
                if (onConnectionDelete) {
                  onConnectionDelete(conn.id);
                }
                setSelectedConnectionIds(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(conn.id);
                  return newSet;
                });
              }}
            >
              <circle cx={0} cy={0} r={10} fill="#ffffff" stroke="#ef4444" strokeWidth={2} />
              <text x={-4} y={4} fontSize={12} fill="#ef4444" fontWeight={700}>✕</text>
            </g>
          )}
        </g>
      );
    });
  };

  // Handle Backspace/Delete and Ctrl/Cmd+Z
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      // Undo
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (onUndo) onUndo();
        return;
      }

      if (ev.key === 'Backspace' || ev.key === 'Delete') {
        // Delete all selected nodes
        if (selectedNodeIds.size > 0) {
          selectedNodeIds.forEach(nodeId => {
            onNodeDelete(nodeId);
          });
          setSelectedNodeIds(new Set());
          onNodeSelect(null);
          return;
        }
        
        // Delete all selected connections
        if (selectedConnectionIds.size > 0 && onConnectionDelete) {
          selectedConnectionIds.forEach(connId => {
            onConnectionDelete(connId);
          });
          setSelectedConnectionIds(new Set());
          return;
        }
        
        // Fallback: delete single selected node
        if (selectedNodeId) {
          onNodeDelete(selectedNodeId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, selectedNodeIds, selectedConnectionIds, onNodeDelete, onConnectionDelete, onUndo]);

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

      {/* Delete button for selected nodes */}
      {(selectedNodeIds.size > 0 || selectedNodeId) && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => {
            if (selectedNodeIds.size > 0) {
              selectedNodeIds.forEach(nodeId => onNodeDelete(nodeId));
              setSelectedNodeIds(new Set());
              onNodeSelect(null);
            } else if (selectedNodeId) {
              onNodeDelete(selectedNodeId);
            }
          }}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-red-500 text-white rounded-lg shadow-md px-3 py-2 hover:bg-red-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">
            {selectedNodeIds.size > 1 
              ? `Delete ${selectedNodeIds.size} Nodes` 
              : 'Delete Node'}
          </span>
        </motion.button>
      )}

      {/* Delete button for selected connections */}
      {selectedConnectionIds.size > 0 && onConnectionDelete && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => {
            selectedConnectionIds.forEach(connId => onConnectionDelete(connId));
            setSelectedConnectionIds(new Set());
          }}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-red-500 text-white rounded-lg shadow-md px-3 py-2 hover:bg-red-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">
            {selectedConnectionIds.size > 1 
              ? `Delete ${selectedConnectionIds.size} Connections` 
              : 'Delete Connection'}
          </span>
        </motion.button>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`w-full h-full ${draggingNodeId ? 'cursor-grabbing' : isPanning ? 'cursor-grabbing' : isMarqueeSelecting ? 'cursor-crosshair' : isDrawingConnection ? 'cursor-crosshair' : 'cursor-default'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={() => {
          setIsPanning(false);
          setDraggingNodeId(null);
          setIsDrawingConnection(false);
          setConnectionStart(null);
          setConnectionEnd(null);

          if (isMarqueeSelecting && marqueeStart && marqueeEnd) {
            finalizeMarqueeSelection(marqueeStart, marqueeEnd);
          } else {
            setIsMarqueeSelecting(false);
            setMarqueeStart(null);
            setMarqueeEnd(null);
            setMarqueeAdditive(false);
          }
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={(e) => {
          // If we just finished a marquee selection, prevent clearing the selection
          if (preventClickRef.current) {
            preventClickRef.current = false;
            return;
          }

          if (e.target === canvasRef.current) {
            // Clear node and connection selection when clicking background
            setSelectedNodeIds(new Set());
            setSelectedConnectionIds(new Set());
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
          className="canvas-transform-layer"
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
            
            {/* Marquee selection rectangle */}
            {isMarqueeSelecting && marqueeStart && marqueeEnd && (
              <rect
                x={Math.min(marqueeStart.x, marqueeEnd.x)}
                y={Math.min(marqueeStart.y, marqueeEnd.y)}
                width={Math.abs(marqueeEnd.x - marqueeStart.x)}
                height={Math.abs(marqueeEnd.y - marqueeStart.y)}
                fill="rgba(99, 102, 241, 0.1)"
                stroke="#6366f1"
                strokeWidth={1}
                strokeDasharray="4,2"
              />
            )}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => (
            <WorkflowNode
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id || selectedNodeIds.has(node.id)}
              isDragging={draggingNodeId === node.id}
              onSelect={(e) => handleSelectNode(node.id, e)}
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