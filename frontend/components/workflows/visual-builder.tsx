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
    let yOffset = 100;

    try {
        // Simple line-based parser for the demo YAML structure
        // name: Workflow
        // steps:
        //   - name: Step1 ...

        const lines = dsl.split('\n');
        let currentStep: Record<string, string> | null = null;
        const steps: Record<string, string>[] = [];

        // Very basic parser logic (replace with js-yaml in production)
        let inSteps = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('steps:')) {
                inSteps = true;
                continue;
            }
            if (inSteps && trimmed.startsWith('- name:')) {
                if (currentStep) steps.push(currentStep);
                currentStep = { name: trimmed.replace('- name:', '').trim() };
            } else if (inSteps && currentStep && trimmed.startsWith('next:')) {
                currentStep.next = trimmed.replace('next:', '').trim();
            } else if (inSteps && currentStep && trimmed.startsWith('type:')) {
                currentStep.type = trimmed.replace('type:', '').trim();
            } else if (inSteps && currentStep && trimmed.startsWith('role:')) {
                currentStep.role = trimmed.replace('role:', '').trim();
            }
        }
        if (currentStep) steps.push(currentStep);

        // Generate Nodes
        nodes.push({
            id: 'start',
            type: 'input',
            data: { label: 'Start' },
            position: { x: 250, y: 0 },
            style: { ...nodeStyle, background: '#10b981', color: 'white', border: 'none' }
        });

        steps.forEach((step) => {
            const isCondition = step.type === 'CONDITION';
            nodes.push({
                id: step.name,
                data: { label: `${step.name}\n(${step.role || 'No Role'})`, name: step.name, role: step.role, type: step.type }, // Store role in data
                position: { x: 250, y: yOffset },
                style: isCondition ? conditionNodeStyle : { ...nodeStyle }
            });
            yOffset += 100;
        });

        nodes.push({
            id: 'end',
            type: 'output',
            data: { label: 'End' },
            position: { x: 250, y: yOffset },
            style: { ...nodeStyle, background: '#ef4444', color: 'white', border: 'none' }
        });

        // Generate Edges
        edges.push({ id: 'e-start-first', source: 'start', target: steps[0]?.name || 'end', markerEnd: { type: MarkerType.ArrowClosed } });

        steps.forEach((step, index) => {
            const nextStep = step.next || (index + 1 < steps.length ? steps[index + 1].name : 'end');
            edges.push({
                id: `e-${step.name}-${nextStep}`,
                source: step.name,
                target: nextStep,
                markerEnd: { type: MarkerType.ArrowClosed }
            });
        });

    } catch (e) {
        console.error("Failed to parse DSL", e);
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
    const newNode: Node = {
      id,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { label: label, name: label, role: 'User', type: type === 'condition' ? 'CONDITION' : 'APPROVAL' },
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

  // Mock DSL generation for demonstration
  const generateDSL = () => {
    const steps = nodes
        .filter(n => n.type !== 'input' && n.type !== 'output')
        .map(n => ({
            // name: n.data.label, // Removed duplicate
            // Actually, we should probably separate name and label display.
            // For now, let's assume data.label IS the name, and we render it differently?
            // Wait, ReactFlow Default Node renders 'label'.
            // If I change label to "Name\nRole", then generateDSL will use "Name\nRole" as name.
            // BAD.
            // Fix: ReactFlow Node Component.
            // custom Node?
            // Quick fix: Keep label as Name. Render a CUSTOM NODE?
            // Or just parsing: keep label as name.
            // But user wants to SEE role.
            // If I change label, I break name.
            // Change: Use data.name for name, data.role for role.
            // And label = `${name}\n(${role})`
            // And here: use data.name if available, else label (cleaned).
            name: n.data.name || n.data.label.split('\n')[0],
            role: n.data.role,
            type: n.data.type || 'APPROVAL', // Use stored type
            next: edges.find(e => e.source === n.id)?.target || 'End'
        }));

    const dsl = `name: Visual Workflow
steps:
${steps.map(s => `  - name: ${s.name}
    role: ${s.role || 'User'}
    type: ${s.type}
    next: ${s.next}`).join('\n')}`;

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
