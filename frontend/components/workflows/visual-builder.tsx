'use client';

import { useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ReactFlowProvider,
  Panel,
  MarkerType,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Plus, Download, Save, Layout } from 'lucide-react';

interface WorkflowStateNodeData {
  label?: string;
  name?: string;
  role?: string;
  type?: string;
}

interface RawTransitionShape {
  to?: string;
  target?: string;
  require?: {
    role?: string | string[];
  };
}

interface RawStateShape {
  id?: string;
  name: string;
  type?: string;
  role?: string;
  initial?: boolean;
  terminal?: boolean;
  on?: Record<string, RawTransitionShape>;
}

interface CompiledTransitionShape {
  to?: string;
  target?: string;
  requirements?: {
    roles?: string[];
  };
}

interface CompiledStateShape {
  initial?: boolean;
  terminal?: boolean;
  transitions?: Record<string, CompiledTransitionShape>;
}

interface ParsedDslShape {
  workflow?: string;
  initialState?: string;
  states?: RawStateShape[] | Record<string, CompiledStateShape>;
  dslDefinition?: string;
}

// Define custom node styles (simplified for now)
const nodeStyle = {
  padding: '10px 20px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  fontSize: '14px',
  fontWeight: 500,
  background: 'white',
  color: '#333',
  width: 180, // Increased width for role display
  textAlign: 'center' as const,
  whiteSpace: 'pre-wrap' as const, // Allow multiline
};

const conditionNodeStyle = {
  ...nodeStyle,
  background: '#fef3c7', // Amber-100
  borderColor: '#d97706', // Amber-600
  borderStyle: 'dashed',
  borderRadius: '24px', // More rounded
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 250, y: 5 },
    style: { ...nodeStyle, background: '#10b981', color: 'white', border: 'none' },
  },
];

interface VisualWorkflowBuilderProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  dslString?: string;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
  onDslChange?: (dsl: string) => void;
}

const createNode = (
  name: string,
  yOffset: number,
  options?: {
    isCondition?: boolean;
    isStart?: boolean;
    isEnd?: boolean;
    role?: string;
    type?: string;
  }
): Node<WorkflowStateNodeData> => {
  const isCondition = options?.isCondition === true;
  const isStart = options?.isStart === true;
  const isEnd = options?.isEnd === true;

  let nodeType: Node['type'] = 'default';
  let style = { ...nodeStyle };

  if (isStart) {
    nodeType = 'input';
    style = { ...nodeStyle, background: '#10b981', color: 'white', border: 'none' };
  } else if (isEnd) {
    nodeType = 'output';
    style = { ...nodeStyle, background: '#ef4444', color: 'white', border: 'none' };
  } else if (isCondition) {
    style = conditionNodeStyle;
  }

  return {
    id: name,
    type: nodeType,
    data: {
      label: isStart || isEnd ? name : `${name}\n(${options?.role || 'No Role'})`,
      name,
      role: options?.role,
      type: options?.type || (isStart ? 'START' : isEnd ? 'END' : 'TASK'),
    },
    position: { x: 250, y: yOffset },
    style,
  };
};

const createEdge = (source: string, target: string, label: string): Edge => ({
  id: `e-${source}-${label}-${target}`,
  source,
  target,
  label,
  markerEnd: { type: MarkerType.ArrowClosed },
});

function parseDSL(dsl: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let yOffset = 50;

  try {
    const parsedDsl = JSON.parse(dsl) as ParsedDslShape;

    if (typeof parsedDsl.dslDefinition === 'string') {
      return parseDSL(parsedDsl.dslDefinition);
    }

    if (Array.isArray(parsedDsl.states)) {
      parsedDsl.states.forEach((state) => {
        const stateName = state.name || state.id || `node-${Date.now()}`;
        const role =
          state.role ||
          (Array.isArray(state.on?.SUBMIT?.require?.role)
            ? state.on?.SUBMIT?.require?.role.join(', ')
            : state.on?.SUBMIT?.require?.role);
        const isCondition = state.type === 'CONDITION';
        const isStart = state.initial === true || state.type === 'START';
        const isEnd = state.terminal === true || state.type === 'END';

        nodes.push(
          createNode(stateName, yOffset, {
            isCondition,
            isStart,
            isEnd,
            role,
            type: state.type,
          })
        );

        if (state.on) {
          Object.entries(state.on).forEach(([eventName, transition]) => {
            const target = transition?.to || transition?.target;
            if (target) {
              edges.push(createEdge(stateName, target, eventName));
            }
          });
        }

        yOffset += 120;
      });

      return { nodes, edges };
    }

    if (parsedDsl.states && typeof parsedDsl.states === 'object') {
      Object.entries(parsedDsl.states).forEach(([stateName, state]) => {
        const roles = state.transitions
          ? Object.values(state.transitions)
              .flatMap((transition) => transition.requirements?.roles || [])
              .filter((role, index, array) => array.indexOf(role) === index)
          : [];
        const isStart = parsedDsl.initialState === stateName || state.initial === true;
        const isEnd = state.terminal === true;

        nodes.push(
          createNode(stateName, yOffset, {
            isStart,
            isEnd,
            role: roles.join(', '),
          })
        );

        if (state.transitions) {
          Object.entries(state.transitions).forEach(([eventName, transition]) => {
            const target = transition?.to || transition?.target;
            if (target) {
              edges.push(createEdge(stateName, target, eventName));
            }
          });
        }

        yOffset += 120;
      });
    }
  } catch (_e) {
    // Failed to parse DSL as JSON - nodes/edges remain empty
  }

  return { nodes, edges };
}

function VisualWorkflowBuilderContent({
  initialNodes: propNodes,
  initialEdges: propEdges,
  dslString,
  onSave,
  onDslChange,
}: VisualWorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(propNodes || initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(propEdges || []);
  const { fitView } = useReactFlow();

  // Sync DSL to nodes when dslString changes
  useEffect(() => {
    if (dslString) {
      const { nodes: newNodes, edges: newEdges } = parseDSL(dslString);
      setNodes(newNodes.length > 0 ? newNodes : propNodes || initialNodes);
      setEdges(newNodes.length > 0 ? newEdges : propEdges || []);
      setTimeout(() => fitView(), 100);
    }
  }, [dslString, fitView, propEdges, propNodes, setEdges, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const addNode = (type: string, label: string) => {
    const id = `${type}-${Date.now()}`;
    const nodeType = type === 'condition' ? 'CONDITION' : type === 'end' ? 'END' : type === 'start' ? 'START' : 'TASK';

    const newNode: Node<WorkflowStateNodeData> = {
      id,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { label: label, name: label, role: 'User', type: nodeType },
      style: { ...nodeStyle },
    };

    if (type === 'end') {
      newNode.style = { ...nodeStyle, background: '#ef4444', color: 'white', border: 'none' };
      newNode.type = 'output';
    } else if (type === 'start') {
      newNode.style = { ...nodeStyle, background: '#10b981', color: 'white', border: 'none' };
      newNode.type = 'input';
    } else if (type === 'condition') {
      newNode.style = conditionNodeStyle;
    }

    setNodes((nds) => nds.concat(newNode));
  };

  const handleSave = () => {
    onSave?.(nodes, edges);
  };

  // Generate JSON DSL
  const generateDSL = () => {
    const states = nodes.map((n) => {
      const outgoingEdges = edges.filter((e) => e.source === n.id);
      const onConfig: Record<string, { to: string }> = {};

      outgoingEdges.forEach((e) => {
        const eventName = e.label || 'PROCEED';
        onConfig[eventName as string] = { to: e.target };
      });

      const isStartNode = n.type === 'input';
      const isEndNode = n.type === 'output';
      const nodeData = n.data as WorkflowStateNodeData;

      const stateObj: {
        name: string;
        type?: string;
        role?: string;
        initial?: boolean;
        terminal?: boolean;
        on?: Record<string, { to: string }>;
      } = {
        name: nodeData.name || nodeData.label?.split('\n')[0] || n.id,
      };

      if (nodeData.type && nodeData.type !== 'START' && nodeData.type !== 'END' && nodeData.type !== 'TASK') {
        stateObj.type = nodeData.type;
      }

      if (nodeData.role && !isStartNode && !isEndNode) {
        stateObj.role = nodeData.role;
      }

      if (isStartNode) {
        stateObj.initial = true;
      }
      if (isEndNode) {
        stateObj.terminal = true;
      }
      if (Object.keys(onConfig).length > 0) {
        stateObj.on = onConfig;
      }

      return stateObj;
    });

    const dslObj = {
      workflow: 'VISUAL_WORKFLOW',
      version: 1,
      states,
    };
    const dsl = JSON.stringify(dslObj, null, 2);

    // DSL generated from visual builder
    onDslChange?.(dsl);
    alert('DSL Updated from Visual Builder!');
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="h-[600px] border rounded-lg overflow-hidden relative bg-slate-50 dark:bg-slate-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          attributionPosition="bottom-right"
        >
          <Controls />
          <Background color="#aaa" gap={16} />

          <Panel
            position="top-right"
            className="flex gap-2 p-2 bg-white/80 dark:bg-black/50 rounded-lg backdrop-blur-sm border shadow-sm"
          >
            <Button size="sm" variant="secondary" onClick={() => addNode('step', 'New Step')}>
              <Plus className="mr-2 h-4 w-4" /> Add Step
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addNode('condition', 'Condition')}>
              <Layout className="mr-2 h-4 w-4" /> Condition
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addNode('end', 'End')}>
              <Plus className="mr-2 h-4 w-4" /> Add End
            </Button>
          </Panel>

          <Panel position="bottom-left" className="flex gap-2">
            <Button size="sm" onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" /> Save Visual State
            </Button>
            <Button size="sm" variant="outline" onClick={generateDSL}>
              <Download className="mr-2 h-4 w-4" /> Generate DSL
            </Button>
          </Panel>
        </ReactFlow>
      </div>
      <div className="text-sm text-muted-foreground">
        <p>Tip: Drag to connect nodes. Use backspace to delete selected nodes.</p>
      </div>
    </div>
  );
}

export function VisualWorkflowBuilder(props: VisualWorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <VisualWorkflowBuilderContent {...props} />
    </ReactFlowProvider>
  );
}
