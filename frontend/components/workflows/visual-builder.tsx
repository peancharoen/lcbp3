"use client";

import { useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const nodeTypes = {
  // We can define custom node types here if needed
};

// Color mapping for node types
const nodeColors: Record<string, string> = {
  start: "#10b981", // green
  step: "#3b82f6",  // blue
  condition: "#f59e0b", // amber
  end: "#ef4444",   // red
};

export function VisualWorkflowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type: "default", // Using default node type for now
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node` },
      style: {
        background: nodeColors[type] || "#64748b",
        color: "white",
        padding: 10,
        borderRadius: 5,
        border: "1px solid #fff",
        width: 150,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const generateDSL = () => {
    // Convert visual workflow to DSL (Mock implementation)
    const dsl = {
      name: "Generated Workflow",
      steps: nodes.map((node) => ({
        step_name: node.data.label,
        step_type: "APPROVAL",
      })),
      connections: edges.map((edge) => ({
        from: edge.source,
        to: edge.target,
      })),
    };
    alert(JSON.stringify(dsl, null, 2));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => addNode("start")} variant="outline" size="sm" className="border-green-500 text-green-600 hover:bg-green-50">
          Add Start
        </Button>
        <Button onClick={() => addNode("step")} variant="outline" size="sm" className="border-blue-500 text-blue-600 hover:bg-blue-50">
          Add Step
        </Button>
        <Button onClick={() => addNode("condition")} variant="outline" size="sm" className="border-amber-500 text-amber-600 hover:bg-amber-50">
          Add Condition
        </Button>
        <Button onClick={() => addNode("end")} variant="outline" size="sm" className="border-red-500 text-red-600 hover:bg-red-50">
          Add End
        </Button>
        <Button onClick={generateDSL} className="ml-auto" size="sm">
          Generate DSL
        </Button>
      </div>

      <Card className="h-[600px] border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <Background color="#aaa" gap={16} />
        </ReactFlow>
      </Card>
    </div>
  );
}
