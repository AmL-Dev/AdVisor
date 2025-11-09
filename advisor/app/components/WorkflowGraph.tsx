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
  "logo-detection": "Logo Detection Agent",
  "frame-extraction": "Frame Extraction Agent",
  "audio-analysis": "Audio Analysis Agent",
  "color-harmony": "Color Harmony Agent",
  "safety-ethics": "Safety & Ethics Agent",
  "message-clarity": "Message Clarity Agent",
  synthesizer: "Brand Synthesizer",
  advisor: "Advisor Agent",
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
    const advisorStep = steps.find((s) => s.id === "advisor");
    const agentSteps = steps.filter(
      (s) => s.id !== "input" && s.id !== "synthesizer" && s.id !== "advisor",
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

    // Group steps by execution phase for better left-to-right layout
    const parallelSteps = agentSteps.filter(
      (s) => ["overall-critic", "visual-style", "frame-extraction", "audio-analysis", "safety-ethics", "message-clarity"].includes(s.id)
    );
    const sequentialSteps = agentSteps.filter(
      (s) => ["logo-detection", "color-harmony"].includes(s.id)
    );

    // Add parallel agent nodes (vertical stack at x=360)
    let frameExtractionY = 160; // Default fallback
    parallelSteps.forEach((step, index) => {
      const x = 360;
      const y = 40 + index * 220;

      // Track frame-extraction position for alignment
      if (step.id === "frame-extraction") {
        frameExtractionY = y;
      }

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
            strokeDasharray: step.status === "running" ? "5,5" : undefined,
          },
        });
      }
    });

    // Add sequential agent nodes (logo-detection, color-harmony) aligned with frame-extraction
    let sequentialX = 720;
    sequentialSteps.forEach((step, index) => {
      // Align logo-detection with frame-extraction, stack color-harmony below
      const y = step.id === "logo-detection" 
        ? frameExtractionY 
        : frameExtractionY + 220; // Position color-harmony below logo-detection
      
      workflowNodes.push({
        id: step.id,
        type: "workflow",
        position: { x: sequentialX, y },
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

      // Connect from previous step with improved routing
      let sourceId = "frame-extraction";
      if (step.id === "color-harmony") {
        sourceId = "logo-detection";
      } else if (step.id === "logo-detection") {
        sourceId = "frame-extraction";
      }

      const sourceStep = workflowNodes.find((n) => n.id === sourceId);
      if (sourceStep) {
        workflowEdges.push({
          id: `${sourceId}-${step.id}`,
          source: sourceId,
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
            strokeWidth: step.status === "running" ? 3 : 2.5,
          },
          markerEnd: {
            type: "arrowclosed",
            color: step.status === "success"
              ? "#10b981"
              : step.status === "failed"
              ? "#ef4444"
              : step.status === "running"
              ? "#3b82f6"
              : "#9ca3af",
          },
        });
      }

      sequentialX += 360; // Move right for next sequential step
    });

    // Add synthesizer node to the right (after all sequential steps)
    if (synthesizerStep) {
      const synthesizerX = sequentialSteps.length > 0 
        ? sequentialX 
        : 1080; // Position after sequential steps or default
      // Center synthesizer vertically between logo-detection and color-harmony if they exist
      const synthesizerY = sequentialSteps.length >= 2 
        ? frameExtractionY + 110 // Center between logo-detection and color-harmony
        : sequentialSteps.length === 1 && sequentialSteps[0].id === "logo-detection"
          ? frameExtractionY
          : 160; // Default center
      
      workflowNodes.push({
        id: synthesizerStep.id,
        type: "workflow",
        position: { x: synthesizerX, y: synthesizerY },
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

      // Connect brand alignment agents to the synthesizer
      // This includes: overall-critic, visual-style, frame-extraction, 
      // audio-analysis, logo-detection, and color-harmony
      // (but NOT safety-ethics and message-clarity - they go to advisor)
      const brandAlignmentAgents = agentSteps.filter(
        (s) => !["safety-ethics", "message-clarity"].includes(s.id)
      );
      brandAlignmentAgents.forEach((step) => {
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
            strokeWidth: synthesizerStep.status === "running" ? 3 : 2.5,
            opacity: step.status === "success" ? 0.8 : 0.6,
          },
          markerEnd: {
            type: "arrowclosed",
            color: synthesizerStep.status === "success"
              ? "#10b981"
              : synthesizerStep.status === "failed"
              ? "#ef4444"
              : synthesizerStep.status === "running"
              ? "#3b82f6"
              : "#9ca3af",
          },
        });
      });
    }

    // Add advisor node to the right (after synthesizer)
    if (advisorStep) {
      // Calculate advisor X position: after synthesizer
      let advisorX = 1440; // Default
      if (synthesizerStep) {
        const synthesizerX = sequentialSteps.length > 0 
          ? sequentialX 
          : 1080;
        advisorX = synthesizerX + 360;
      }
      
      // Center advisor vertically (same as synthesizer)
      const advisorY = synthesizerStep
        ? (sequentialSteps.length >= 2 
            ? frameExtractionY + 110
            : sequentialSteps.length === 1 && sequentialSteps[0].id === "logo-detection"
              ? frameExtractionY
              : 160)
        : 160;
      
      workflowNodes.push({
        id: advisorStep.id,
        type: "workflow",
        position: { x: advisorX, y: advisorY },
        data: {
          id: advisorStep.id,
          label: STEP_LABELS[advisorStep.id] || advisorStep.id,
          status: advisorStep.status,
          payload: advisorStep.payload,
          output: advisorStep.output,
          startedAt: advisorStep.startedAt,
          endedAt: advisorStep.endedAt,
        },
        selected: selectedNodeId === advisorStep.id,
      });

      // Connect synthesizer, safety-ethics, and message-clarity to advisor
      const advisorSources = [];
      if (synthesizerStep) {
        advisorSources.push(synthesizerStep.id);
      }
      const safetyEthicsStep = steps.find((s) => s.id === "safety-ethics");
      const messageClarityStep = steps.find((s) => s.id === "message-clarity");
      if (safetyEthicsStep) {
        advisorSources.push("safety-ethics");
      }
      if (messageClarityStep) {
        advisorSources.push("message-clarity");
      }

      advisorSources.forEach((sourceId) => {
        const sourceNode = workflowNodes.find((n) => n.id === sourceId);
        if (sourceNode) {
          workflowEdges.push({
            id: `${sourceId}-${advisorStep.id}`,
            source: sourceId,
            target: advisorStep.id,
            animated: advisorStep.status === "running",
            type: "smoothstep",
            style: {
              stroke:
                advisorStep.status === "success"
                  ? "#10b981"
                  : advisorStep.status === "failed"
                  ? "#ef4444"
                  : advisorStep.status === "running"
                  ? "#3b82f6"
                  : "#9ca3af",
              strokeWidth: advisorStep.status === "running" ? 3 : 2.5,
              opacity: 0.8,
            },
            markerEnd: {
              type: "arrowclosed",
              color: advisorStep.status === "success"
                ? "#10b981"
                : advisorStep.status === "failed"
                ? "#ef4444"
                : advisorStep.status === "running"
                ? "#3b82f6"
                : "#9ca3af",
            },
          });
        }
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

