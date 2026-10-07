// client/src/components/KnowledgeModal.jsx
import React, { useState } from "react";
import { BookOpen, RefreshCw, X, Check, Layers, ExternalLink } from "lucide-react";

export function KnowledgeModal({
  isOpen,
  onClose,
  knowledgeData,
  onSyncKnowledge,
}) {
  if (!isOpen) return null;

  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await onSyncKnowledge();
    setSyncing(false);
  };

  const frameworks = knowledgeData?.frameworks || [];

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.7)",
      backdropFilter: "blur(12px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 50,
      padding: "20px",
    }}>
      <div className="glass-panel" style={{
        width: "100%",
        maxWidth: "750px",
        maxHeight: "85vh",
        borderRadius: "16px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid rgba(56, 189, 248, 0.3)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: "1px solid var(--surface-glass-border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <BookOpen size={20} color="var(--cyan-glow)" />
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff" }}>
                Knowledge Corpora Explorer
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                Total Indexed Vectors: {knowledgeData?.totalPoints || 0} chunks across 9 official framework sets
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="glow-on-hover"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(56, 189, 248, 0.15)",
                border: "1px solid var(--cyan-glow)",
                color: "var(--cyan-glow)",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: syncing ? "not-allowed" : "pointer",
              }}
            >
              <RefreshCw size={14} className={syncing ? "spin" : ""} />
              <span>{syncing ? "Re-indexing..." : "Re-Index All Corpora"}</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Framework Cards Grid */}
        <div style={{
          padding: "20px 24px",
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
          gap: "14px",
        }}>
          {frameworks.map((fw) => (
            <div
              key={fw.id}
              style={{
                background: "rgba(5, 24, 33, 0.6)",
                borderRadius: "10px",
                padding: "14px",
                border: "1px solid var(--surface-glass-border)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}>
                  <span style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "var(--cyan-glow)",
                  }}>
                    {fw.name}
                  </span>
                  <span style={{
                    fontSize: "0.68rem",
                    background: "rgba(255, 255, 255, 0.08)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    color: "var(--text-secondary)",
                  }}>
                    {fw.chunkCount} chunks
                  </span>
                </div>

                <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Pages: <b>{fw.manifest?.totalPages || fw.manifest?.pages?.length || 1}</b>
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  Indexed: {fw.manifest?.indexedAt || "Today"}
                </div>
              </div>

              <div style={{
                marginTop: "12px",
                paddingTop: "8px",
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                fontSize: "0.68rem",
                color: "#4ade80",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                <Check size={12} />
                <span>RAG Verified Vector Index</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
