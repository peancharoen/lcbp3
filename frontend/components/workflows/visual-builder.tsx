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
    dslString?: string; // New prop
    onSave?: (nodes: Node[], edges: Edge[]) => void;
    onDslChange?: (dsl: string) => void;
}

function parseDSL(dsl: string): { nodes: Node[], edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let yOffset = 50;

    try {
        const parsedDsl = JSON.parse(dsl);
        const states = parsedDsl.states || [];

        states.forEach((state: { id: string, name: string, type: string, role?: string, transitions?: { event: string, to: string }[] }) => {
            const isCondition = state.type === 'CONDITION';
            const isStart = state.type === 'START';
            const isEnd = state.type === 'END';

            let nodeType = 'default';
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

            nodes.push({
                id: state.id,
                type: nodeType,
                data: {
                    label: isStart || isEnd ? state.name : `${state.name}\n(${state.role || 'No Role'})`,
                    name: state.name,
                    role: state.role,
                    type: state.type || (isStart ? 'START' : isEnd ? 'END' : 'TASK')
                },
                position: { x: 250, y: yOffset },
                style: style
            });

            if (state.transitions) {
                state.transitions.forEach((trans: { event: string, to: string }) => {
                    edges.push({
                        id: `e-${state.id}-${trans.to}`,
                        source: state.id,
                        target: trans.to,
                        label: trans.event,
                        markerEnd: { type: MarkerType.ArrowClosed }
                    });
                });
            }

            yOffset += 120;
        });

    } catch (e) {
        console.error("Failed to parse DSL as JSON", e);
    }

    return { nodes, edges };
}

function VisualWorkflowBuilderContent({ initialNodes: propNodes, initialEdges: propEdges, dslString, onSave, onDslChange }: VisualWorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(propNodes || initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(propEdges || []);
  const { fitView } = useReactFlow();

  // Sync DSL to nodes when dslString changes
  useEffect(() => {
      if (dslString) {
          const { nodes: newNodes, edges: newEdges } = parseDSL(dslString);
          if (newNodes.length > 0) {
              setNodes(newNodes);
              setEdges(newEdges);
              // Fit view after update
              setTimeout(() => fitView(), 100);
          }
      }
  }, [dslString, setNodes, setEdges, fitView]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const addNode = (type: string, label: string) => {
    const id = `${type}-${Date.now()}`;
    const nodeType = type === 'condition' ? 'CONDITION' : type === 'end' ? 'END' : type === 'start' ? 'START' : 'TASK';

    const newNode: Node = {
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
    const states = nodes.map(n => {
        const outgoingEdges = edges.filter(e => e.source === n.id);
        const transitions = outgoingEdges.map(e => ({
            event: e.label || 'PROCEED',
            to: e.target
        }));

        return {
            id: n.id,
            name: n.data.name || n.data.label.split('\n')[0],
            type: n.data.type || 'TASK',
            role: n.data.role,
            transitions: transitions
        };
    });

    const dslObj = { states };
    const dsl = JSON.stringify(dslObj, null, 2);

    console.log("Generated DSL:", dsl);
    onDslChange?.(dsl);
    alert("DSL Updated from Visual Builder!");
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

          <Panel position="top-right" className="flex gap-2 p-2 bg-white/80 dark:bg-black/50 rounded-lg backdrop-blur-sm border shadow-sm">
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
    )
}
