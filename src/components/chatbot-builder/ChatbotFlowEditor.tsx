import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChatbotFlow, useChatbotFlowNodes, useChatbotFlowEdges } from '@/hooks/useChatbotFlows';
import { ChatbotFlowSidebar } from './ChatbotFlowSidebar';
import { ChatbotNodeConfig } from './ChatbotNodeConfig';
import { ChatbotTestDialog } from './ChatbotTestDialog';
import { Button } from '@/components/ui/button';
import { Save, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

// Import custom nodes
import { StartNode } from './nodes/StartNode';
import { MessageNode } from './nodes/MessageNode';
import { ConditionNode } from './nodes/ConditionNode';
import { ActionNode } from './nodes/ActionNode';
import { DelayNode } from './nodes/DelayNode';
import { AIResponseNode } from './nodes/AIResponseNode';
import { EndNode } from './nodes/EndNode';
import { QuestionNode } from './nodes/QuestionNode';

const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  question: QuestionNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  ai_response: AIResponseNode,
  end: EndNode,
};

interface ChatbotFlowEditorProps {
  flow: ChatbotFlow;
}

const ChatbotFlowEditorInner = ({ flow }: ChatbotFlowEditorProps) => {
  const { user } = useAuth();
  const { screenToFlowPosition } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { nodes: savedNodes, saveNodes } = useChatbotFlowNodes(flow.id);
  const { edges: savedEdges, saveEdges } = useChatbotFlowEdges(flow.id);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  // Load saved nodes and edges
  useEffect(() => {
    if (savedNodes) {
      const loadedNodes: Node[] = savedNodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: { x: n.position_x, y: n.position_y },
        data: n.data,
      }));
      setNodes(loadedNodes.length > 0 ? loadedNodes : getDefaultNodes());
    } else {
      setNodes(getDefaultNodes());
    }
  }, [savedNodes, setNodes]);

  useEffect(() => {
    if (savedEdges) {
      const loadedEdges: Edge[] = savedEdges.map((e) => ({
        id: e.id,
        source: e.source_node_id,
        target: e.target_node_id,
        sourceHandle: e.source_handle || undefined,
        targetHandle: e.target_handle || undefined,
        label: e.label || undefined,
      }));
      setEdges(loadedEdges);
    }
  }, [savedEdges, setEdges]);

  const getDefaultNodes = (): Node[] => [
    {
      id: 'start-1',
      type: 'start',
      position: { x: 250, y: 50 },
      data: { label: 'Início' },
    },
  ];

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      // Use screenToFlowPosition to get correct position in canvas coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: getDefaultDataForType(type),
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, screenToFlowPosition]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      // Save nodes
      const nodesToSave = nodes.map((n) => ({
        flow_id: flow.id,
        user_id: user.id,
        type: n.type || 'unknown',
        position_x: n.position.x,
        position_y: n.position.y,
        data: n.data as Record<string, any>,
      }));
      
      const savedNodesList = await saveNodes.mutateAsync(nodesToSave);
      
      // Create a mapping from old node IDs to new node IDs
      const nodeIdMap = new Map<string, string>();
      nodes.forEach((n, index) => {
        if (savedNodesList[index]) {
          nodeIdMap.set(n.id, savedNodesList[index].id);
        }
      });

      // Save edges with updated node IDs
      const edgesToSave = edges.map((e) => ({
        flow_id: flow.id,
        user_id: user.id,
        source_node_id: nodeIdMap.get(e.source) || e.source,
        target_node_id: nodeIdMap.get(e.target) || e.target,
        source_handle: e.sourceHandle || null,
        target_handle: e.targetHandle || null,
        label: typeof e.label === 'string' ? e.label : null,
      }));
      
      await saveEdges.mutateAsync(edgesToSave);
      toast.success('Fluxo salvo com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar fluxo');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateNodeData = useCallback((nodeId: string, data: Record<string, any>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      )
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...data } } : null);
    }
  }, [setNodes, selectedNode]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [setNodes, setEdges, selectedNode]);

  // Add onDelete callback to nodes and highlight effect
  const nodesWithExtras = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onDelete: node.type !== 'start' ? () => deleteNode(node.id) : undefined,
    },
    style: highlightedNodeId === node.id ? {
      boxShadow: '0 0 0 3px hsl(var(--primary))',
      borderRadius: '12px',
    } : undefined,
  }));

  return (
    <div className="flex-1 flex">
      <ChatbotFlowSidebar />
      
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodesWithExtras}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-muted/30"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap 
            nodeStrokeColor="#666"
            nodeColor="#333"
            nodeBorderRadius={8}
          />
          <Panel position="top-right" className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowTestDialog(true)}
            >
              <Play className="h-4 w-4 mr-2" />
              Testar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {selectedNode && (
        <ChatbotNodeConfig
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdate={updateNodeData}
        />
      )}

      <ChatbotTestDialog
        open={showTestDialog}
        onOpenChange={setShowTestDialog}
        flowName={flow.name}
        nodes={nodes}
        edges={edges}
        onHighlightNode={setHighlightedNodeId}
      />
    </div>
  );
};

// Wrapper component with ReactFlowProvider
export const ChatbotFlowEditor = ({ flow }: ChatbotFlowEditorProps) => {
  return (
    <ReactFlowProvider>
      <ChatbotFlowEditorInner flow={flow} />
    </ReactFlowProvider>
  );
};

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

function getDefaultDataForType(type: string): Record<string, any> {
  switch (type) {
    case 'start':
      return { label: 'Início' };
    case 'message':
      return { message: '', delay: 0 };
    case 'question':
      return { question: '', variable: '', options: [] };
    case 'condition':
      return { 
        conditionMode: 'variable', 
        logicOperator: 'and',
        conditions: [{ id: generateId(), variable: '', operator: 'equals', value: '' }],
        intents: [{ id: generateId(), label: '', description: '' }]
      };
    case 'action':
      return { actionType: 'add_tag', config: {} };
    case 'delay':
      return { duration: 5, unit: 'seconds' };
    case 'ai_response':
      return { prompt: '', maxTokens: 500 };
    case 'end':
      return { label: 'Fim' };
    default:
      return {};
  }
}
