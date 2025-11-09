"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  Handle,
  Position,
  ConnectionMode,
} from "reactflow";
import "reactflow/dist/style.css";

type WorkflowStep = {
  id: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  payload?: {
    videoBase64?: string;
    brandLogoBase64?: string;
    productImageBase64?: string;
    brandContext?: {
      companyName: string;
      productName: string;
      briefPrompt?: string;
    };
  };
  output: {
    report?: Record<string, unknown>;
    prompt?: string;
    model?: string;
    warnings?: string[];
    rawText?: string | null;
  } | null;
  warnings: string[];
  metadata?: Record<string, unknown> | null;
};

type WorkflowGraphProps = {
  steps: WorkflowStep[];
  onNodeClick?: (stepId: string) => void;
  selectedNodeId?: string | null;
};

const STEP_LABELS: Record<string, string> = {
  "overall-critic": "Overall Critic Agent",
  "visual-style": "Visual Style Agent",
  synthesizer: "Brand Synthesizer",
  input: "Input",
};

function getStatusColor(status: string): string {
  switch (status) {
    case "success":
      return "bg-green-500";
    case "failed":
      return "bg-red-500";
    case "running":
      return "bg-blue-500 animate-pulse";
    case "pending":
      return "bg-gray-400";
    default:
      return "bg-gray-400";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "success":
      return "✓ Success";
    case "failed":
      return "✗ Failed";
    case "running":
      return "⟳ Running";
    case "pending":
      return "○ Pending";
    default:
      return status;
  }
}

// Custom Node Component
function WorkflowNode({ data, selected }: { data: any; selected: boolean }) {
  const status = data.status || "pending";
  const label = data.label || data.id;
  const hasOutput = data.output !== null && data.output !== undefined;
  const isInputNode = data.id === "input";

  return (
    <div
      className={`rounded-lg border-2 shadow-lg transition-all ${
        selected
          ? "border-blue-500 shadow-blue-500/50"
          : "border-gray-300 dark:border-gray-700"
      } ${
        status === "running"
          ? "ring-2 ring-blue-400 ring-opacity-50"
          : ""
      }`}
      style={{
        background: "white",
        minWidth: "200px",
        maxWidth: "300px",
      }}
    >
      {!isInputNode && <Handle type="target" position={Position.Left} />}
      
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {label}
          </h3>
          <div
            className={`w-3 h-3 rounded-full ${getStatusColor(status)}`}
            title={getStatusLabel(status)}
          />
        </div>

        {/* Status Badge */}
        <div className="mb-3">
          <span
            className={`inline-block px-2 py-1 text-xs rounded flex items-center gap-1 ${
              status === "success"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : status === "failed"
                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                : status === "running"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:bg-blue-200 animate-pulse"
                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
            }`}
          >
            {status === "running" && <span className="animate-spin">⟳</span>}
            {getStatusLabel(status)}
          </span>
        </div>

        {/* Input Preview - Show specific content for input node */}
        {data.payload && (
          <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
            {isInputNode ? (
              <>
                {data.payload.brandContext && (
                  <div className="truncate">
                    {data.payload.brandContext.companyName} -{" "}
                    {data.payload.brandContext.productName}
                    {data.payload.brandContext.briefPrompt && (
                      <span className="text-gray-500">
                        {" "}
                        {data.payload.brandContext.briefPrompt.length > 30
                          ? data.payload.brandContext.briefPrompt.substring(0, 30) + "..."
                          : data.payload.brandContext.briefPrompt}
                      </span>
                    )}
                  </div>
                )}
                {data.payload.videoBase64 && (
                  <div className="text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1">
                    <span>📹</span>
                    <span>Video</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="font-medium mb-1">Input:</div>
                {data.payload.brandContext && (
                  <div className="truncate">
                    {data.payload.brandContext.companyName} -{" "}
                    {data.payload.brandContext.productName}
                  </div>
                )}
                {data.payload.videoBase64 && (
                  <div className="text-blue-600 dark:text-blue-400">📹 Video</div>
                )}
              </>
            )}
          </div>
        )}

        {/* Output Preview - Hide for input node */}
        {hasOutput && !isInputNode && (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <div className="font-medium mb-1">Output:</div>
            {data.output.report && (
              <div className="truncate">
                {typeof data.output.report === "object"
                  ? JSON.stringify(data.output.report).substring(0, 50) + "..."
                  : String(data.output.report).substring(0, 50)}
              </div>
            )}
            {!data.output.report && data.output.rawText && (
              <div className="truncate">{data.output.rawText.substring(0, 50)}...</div>
            )}
          </div>
        )}

        {/* Click hint */}
        <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">
          Click to expand
        </div>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  workflow: WorkflowNode,
};

export default function WorkflowGraph({
  steps,
  onNodeClick,
  selectedNodeId,
}: WorkflowGraphProps) {
  // Create nodes and edges from steps
  const { nodes, edges } = useMemo(() => {
    const workflowNodes: Node[] = [];
    const workflowEdges: Edge[] = [];

    const inputStep = steps.find((s) => s.id === "input");
    const synthesizerStep = steps.find((s) => s.id === "synthesizer");
    const agentSteps = steps.filter(
      (s) => s.id !== "input" && s.id !== "synthesizer",
    );

    // Add input node
    if (inputStep) {
      workflowNodes.push({
        id: inputStep.id,
        type: "workflow",
        position: { x: 0, y: 160 },
        data: {
          id: inputStep.id,
          label: STEP_LABELS[inputStep.id] || "Input",
          status: inputStep.status,
          payload: inputStep.payload,
          output: inputStep.output,
          startedAt: inputStep.startedAt,
          endedAt: inputStep.endedAt,
        },
        selected: selectedNodeId === inputStep.id,
      });
    }

    // Add agent nodes (vertical stack)
    agentSteps.forEach((step, index) => {
      const x = 360;
      const y = 40 + index * 220;

      workflowNodes.push({
        id: step.id,
        type: "workflow",
        position: { x, y },
        data: {
          id: step.id,
          label: STEP_LABELS[step.id] || step.id,
          status: step.status,
          payload: step.payload,
          output: step.output,
          startedAt: step.startedAt,
          endedAt: step.endedAt,
        },
        selected: selectedNodeId === step.id,
      });

      if (inputStep) {
        workflowEdges.push({
          id: `${inputStep.id}-${step.id}`,
          source: inputStep.id,
          target: step.id,
          animated: step.status === "running",
          type: "smoothstep",
          style: {
            stroke:
              step.status === "success"
                ? "#10b981"
                : step.status === "failed"
                ? "#ef4444"
                : step.status === "running"
                ? "#3b82f6"
                : "#9ca3af",
            strokeWidth: step.status === "running" ? 3 : 2,
          },
        });
      }
    });

    // Add synthesizer node to the right
    if (synthesizerStep) {
      workflowNodes.push({
        id: synthesizerStep.id,
        type: "workflow",
        position: { x: 760, y: 160 },
        data: {
          id: synthesizerStep.id,
          label: STEP_LABELS[synthesizerStep.id] || synthesizerStep.id,
          status: synthesizerStep.status,
          payload: synthesizerStep.payload,
          output: synthesizerStep.output,
          startedAt: synthesizerStep.startedAt,
          endedAt: synthesizerStep.endedAt,
        },
        selected: selectedNodeId === synthesizerStep.id,
      });

      agentSteps.forEach((step) => {
        workflowEdges.push({
          id: `${step.id}-${synthesizerStep.id}`,
          source: step.id,
          target: synthesizerStep.id,
          animated: synthesizerStep.status === "running",
          type: "smoothstep",
          style: {
            stroke:
              synthesizerStep.status === "success"
                ? "#10b981"
                : synthesizerStep.status === "failed"
                ? "#ef4444"
                : synthesizerStep.status === "running"
                ? "#3b82f6"
                : "#9ca3af",
            strokeWidth: synthesizerStep.status === "running" ? 3 : 2,
          },
        });
      });
    }

    return { nodes: workflowNodes, edges: workflowEdges };
  }, [steps, selectedNodeId]);

  const onNodeClickHandler = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  return (
    <div className="w-full h-[600px] border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClickHandler}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        connectionMode={ConnectionMode.Loose}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const status = node.data?.status || "pending";
            if (status === "success") return "#10b981";
            if (status === "failed") return "#ef4444";
            if (status === "running") return "#3b82f6";
            return "#9ca3af";
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}

