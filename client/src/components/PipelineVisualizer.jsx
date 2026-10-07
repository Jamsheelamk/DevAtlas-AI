// client/src/components/PipelineVisualizer.jsx
import React from "react";
import {
  CheckCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  X,
  Sparkles,
  Shield,
  Layers,
  Database,
  Search,
  Filter,
  FileText,
  Cpu,
  BookmarkCheck,
  SendHorizontal
} from "lucide-react";

export function PipelineVisualizer({
  isOpen,
  onClose,
  telemetry = [],
  isLoading,
}) {
  if (!isOpen) return null;

  const STAGES = [
    { num: 1, name: "Input Processing", icon: FileText, desc: "Text cleaning, language & context loading" },
    { num: 2, name: "Intent Classification", icon: Shield, desc: "Task identification & tech scope guardrails" },
    { num: 3, name: "Query Understanding / Rewriting", icon: Filter, desc: "Coreference resolution & framework tag extraction" },
    { num: 4, name: "RAG Retrieval", icon: Search, desc: "MiniLM-L6-v2 embeddings -> Qdrant vector search" },
    { num: 5, name: "Re-Ranking & Deduplication", icon: Layers, desc: "Semantic relevance scoring & chunk deduplication" },
    { num: 6, name: "Context Assembly", icon: Database, desc: "Token budgeting & prompt structure assembly" },
    { num: 7, name: "LLM Response Generation", icon: Cpu, desc: "Groq LPU streaming (LLaMA 3.3 70B)" },
    { num: 8, name: "Validation & Guardrails", icon: RefreshCw, desc: "Self-RAG grounding check & retry loop" },
    { num: 9, name: "Source / Citation Generation", icon: BookmarkCheck, desc: "Canonical documentation links & framework badges" },
    { num: 10, name: "Final Response & Persistence", icon: SendHorizontal, desc: "SSE delivery & Upstash Redis query caching" },
  ];

  const getStageTelemetry = (num) => {
    return telemetry.find((t) => t.stage === num) || null;
  };

  return (
    <div style={{
      position: "fixed",
      top: "65px",
      right: 0,
      width: "420px",
      height: "calc(100vh - 65px)",
      background: "rgba(5, 24, 33, 0.95)",
      backdropFilter: "blur(24px)",
      borderLeft: "1px solid var(--surface-glass-border)",
      boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.5)",
      zIndex: 20,
      display: "flex",
      flexDirection: "column",
      padding: "20px",
      overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: "14px",
        borderBottom: "1px solid var(--surface-glass-border)",
        marginBottom: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={18} color="var(--cyan-glow)" />
          <h2 style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "#ffffff",
            fontFamily: "'Outfit', sans-serif",
          }}>
            10-Stage Pipeline Telemetry
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: "4px",
          }}
        >
          <X size={18} />
        </button>
      </div>

      <p style={{
        fontSize: "0.78rem",
        color: "var(--text-secondary)",
        marginBottom: "16px",
        lineHeight: 1.4,
      }}>
        Live execution monitor for DevAtlas AI Corrective RAG flow with active reflection.
      </p>

      {/* 10 Step List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
        {STAGES.map((s) => {
          const telem = getStageTelemetry(s.num);
          const isComplete = Boolean(telem);
          const Icon = s.icon;

          return (
            <div
              key={s.num}
              style={{
                borderRadius: "8px",
                padding: "10px 12px",
                background: isComplete ? "rgba(13, 59, 76, 0.45)" : "rgba(255, 255, 255, 0.02)",
                border: `1px solid ${isComplete ? "rgba(56, 189, 248, 0.3)" : "rgba(255, 255, 255, 0.05)"}`,
                transition: "all 0.2s ease",
              }}
            >
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "4px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: isComplete ? "var(--cyan-glow)" : "rgba(255, 255, 255, 0.1)",
                    color: isComplete ? "#051821" : "var(--text-muted)",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {s.num}
                  </span>
                  <span style={{
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    color: isComplete ? "#ffffff" : "var(--text-secondary)",
                  }}>
                    {s.name}
                  </span>
                </div>

                {isComplete && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {telem.latencyMs !== undefined && (
                      <span style={{
                        fontSize: "0.7rem",
                        color: "var(--cyan-glow)",
                        background: "rgba(56, 189, 248, 0.1)",
                        padding: "1px 6px",
                        borderRadius: "4px",
                      }}>
                        {telem.latencyMs}ms
                      </span>
                    )}
                    <CheckCircle size={14} color="#4ade80" />
                  </div>
                )}
              </div>

              {/* Stage details */}
              {isComplete && (
                <div style={{
                  fontSize: "0.74rem",
                  color: "var(--text-secondary)",
                  marginTop: "6px",
                  paddingTop: "6px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                }}>
                  {s.num === 1 && (
                    <span>Language: <b>{telem.language}</b> • Words: <b>{telem.wordCount}</b></span>
                  )}
                  {s.num === 2 && (
                    <span>Intent: <b style={{ color: "var(--cyan-glow)" }}>{telem.intent}</b></span>
                  )}
                  {s.num === 3 && (
                    <div>
                      {telem.detectedLibraries?.length > 0 ? (
                        <span>Scoped: <b>{telem.detectedLibraries.join(", ")}</b></span>
                      ) : (
                        <span>Broad developer query</span>
                      )}
                    </div>
                  )}
                  {s.num === 4 && (
                    <span>Retrieved: <b>{telem.candidateCount} candidate chunks</b></span>
                  )}
                  {s.num === 5 && (
                    <span>Selected: <b>{telem.selectedCount} chunks</b> (Top score: {telem.topScore})</span>
                  )}
                  {s.num === 6 && (
                    <span>Budget: ~<b>{telem.approxTokens} tokens</b></span>
                  )}
                  {s.num === 7 && (
                    <span>Model: <b>{telem.modelUsed}</b> (Streaming LPU)</span>
                  )}
                  {s.num === 8 && (
                    <div>
                      <span>Grounding: <b>{(telem.groundingScore * 100).toFixed(0)}%</b></span>
                      {telem.retryCount > 0 && <span style={{ color: "#facc15", marginLeft: "6px" }}>• Retried</span>}
                    </div>
                  )}
                  {s.num === 9 && (
                    <span>Generated <b>{telem.citationCount} official documentation links</b></span>
                  )}
                  {s.num === 10 && (
                    <span>Completed in <b>{telem.totalLatencyMs}ms</b> total</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
