// client/src/components/Sidebar.jsx
import React from "react";
import { Plus, MessageSquare, Database, Terminal, Cpu } from "lucide-react";

export function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  corpora,
  selectedFilter,
  onSelectFilter,
}) {
  const frameworks = [
    { id: "all", name: "All Documentation", color: "#38bdf8" },
    { id: "langgraph", name: "LangGraph JS", color: "#a855f7" },
    { id: "groq", name: "Groq LPUs", color: "#f97316" },
    { id: "qdrant", name: "Qdrant Vector DB", color: "#ec4899" },
    { id: "upstash", name: "Upstash Redis", color: "#10b981" },
    { id: "react", name: "React 19", color: "#06b6d4" },
    { id: "nextjs", name: "Next.js App Router", color: "#3b82f6" },
    { id: "langchain", name: "LangChain JS", color: "#6366f1" },
    { id: "node", name: "Node.js Core", color: "#84cc16" },
    { id: "mdn", name: "MDN Web Standards", color: "#14b8a6" },
  ];

  return (
    <aside className="glass-panel" style={{
      width: "280px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      borderRight: "1px solid var(--surface-glass-border)",
      height: "calc(100vh - 65px)",
      padding: "16px",
      overflowY: "auto",
      zIndex: 5,
    }}>
      <div>
        {/* New Session Button */}
        <button
          onClick={onNewSession}
          className="glow-on-hover"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(120, 60, 184, 0.2))",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            color: "#ffffff",
            padding: "10px 16px",
            borderRadius: "10px",
            fontSize: "0.88rem",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "20px",
          }}
        >
          <Plus size={16} />
          <span>New Architecture Session</span>
        </button>

        {/* Framework Filter Section */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
            padding: "0 4px",
          }}>
            <span style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
            }}>
              Active Knowledge Scope
            </span>
            <span style={{ fontSize: "0.72rem", color: "var(--cyan-glow)" }}>9 Libs</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {frameworks.map((fw) => {
              const active = selectedFilter === fw.id;
              return (
                <button
                  key={fw.id}
                  onClick={() => onSelectFilter(fw.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: active ? `1px solid ${fw.color}` : "1px solid transparent",
                    background: active ? "rgba(255, 255, 255, 0.08)" : "transparent",
                    color: active ? "#ffffff" : "var(--text-secondary)",
                    fontSize: "0.82rem",
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: fw.color,
                      boxShadow: active ? `0 0 8px ${fw.color}` : "none",
                    }} />
                    <span>{fw.name}</span>
                  </div>
                  {active && (
                    <span style={{ fontSize: "0.68rem", color: fw.color, fontWeight: 700 }}>
                      FILTERED
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Sessions */}
        <div>
          <span style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            display: "block",
            marginBottom: "8px",
            padding: "0 4px",
          }}>
            Recent Conversations
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {sessions.map((s) => {
              const isSelected = s.id === currentSessionId;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: isSelected ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
                    background: isSelected ? "rgba(56, 189, 248, 0.1)" : "rgba(255, 255, 255, 0.02)",
                    color: isSelected ? "#ffffff" : "var(--text-secondary)",
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    textAlign: "left",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.title || "New Thread"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info Pill */}
      <div style={{
        marginTop: "16px",
        padding: "10px",
        borderRadius: "8px",
        background: "rgba(5, 24, 33, 0.5)",
        border: "1px solid var(--surface-glass-border)",
        fontSize: "0.72rem",
        color: "var(--text-secondary)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <Cpu size={12} color="var(--cyan-glow)" />
          <span>Local MiniLM-L6-v2 Embeddings</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Database size={12} color="#a855f7" />
          <span>Qdrant Vector Store Active</span>
        </div>
      </div>
    </aside>
  );
}
