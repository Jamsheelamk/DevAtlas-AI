// client/src/components/ChatInput.jsx
import React, { useState } from "react";
import { Send, Sparkles, Filter } from "lucide-react";

export function ChatInput({
  onSendMessage,
  isLoading,
  selectedFilter,
  onSelectFilter,
}) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSendMessage(prompt.trim());
    setPrompt("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const quickFilters = [
    { id: "all", label: "All Docs" },
    { id: "langgraph", label: "LangGraph JS" },
    { id: "groq", label: "Groq LPU" },
    { id: "qdrant", label: "Qdrant Vector" },
    { id: "upstash", label: "Upstash Redis" },
    { id: "react", label: "React 19" },
    { id: "nextjs", label: "Next.js" },
  ];

  return (
    <div style={{
      padding: "16px 24px",
      background: "linear-gradient(to top, rgba(9, 32, 42, 0.95), rgba(9, 32, 42, 0.6) 80%, transparent)",
      position: "relative",
      zIndex: 10,
    }}>
      {/* Quick Framework Filter Pills */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        marginBottom: "10px",
        overflowX: "auto",
        paddingBottom: "4px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-muted)", fontSize: "0.72rem", marginRight: "4px" }}>
          <Filter size={12} />
          <span>Scope:</span>
        </div>
        {quickFilters.map((qf) => {
          const isActive = selectedFilter === qf.id;
          return (
            <button
              key={qf.id}
              type="button"
              onClick={() => onSelectFilter(qf.id)}
              style={{
                background: isActive ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
                border: `1px solid ${isActive ? "var(--cyan-glow)" : "rgba(255, 255, 255, 0.1)"}`,
                color: isActive ? "var(--cyan-glow)" : "var(--text-secondary)",
                borderRadius: "14px",
                padding: "3px 10px",
                fontSize: "0.74rem",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              {qf.label}
            </button>
          );
        })}
      </div>

      {/* Main Composer Box */}
      <form
        onSubmit={handleSubmit}
        className="glass-panel-glow"
        style={{
          borderRadius: "12px",
          display: "flex",
          alignItems: "flex-end",
          padding: "10px 14px",
          gap: "10px",
          background: "rgba(5, 24, 33, 0.8)",
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask DevAtlas AI about LangGraph Multi-Agents, React 19 Actions, Qdrant HNSW indexing, or Groq LPUs..."
          disabled={isLoading}
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#f8fafc",
            fontSize: "0.92rem",
            resize: "none",
            maxHeight: "120px",
            lineHeight: 1.5,
            fontFamily: "inherit",
          }}
        />

        <button
          type="submit"
          disabled={!prompt.trim() || isLoading}
          style={{
            background: prompt.trim() && !isLoading
              ? "linear-gradient(135deg, #22d3ee, #783cb8)"
              : "rgba(255, 255, 255, 0.1)",
            border: "none",
            color: "#ffffff",
            padding: "8px 14px",
            borderRadius: "8px",
            cursor: prompt.trim() && !isLoading ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.82rem",
            fontWeight: 600,
            transition: "all 0.2s ease",
            boxShadow: prompt.trim() && !isLoading ? "0 0 15px rgba(56, 189, 248, 0.4)" : "none",
          }}
        >
          {isLoading ? (
            <span>Generating...</span>
          ) : (
            <>
              <span>Send</span>
              <Send size={14} />
            </>
          )}
        </button>
      </form>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "6px",
        padding: "0 4px",
        fontSize: "0.72rem",
        color: "var(--text-muted)",
      }}>
        <span>Shift + Enter for newline</span>
        <span>10-Stage Corrective RAG Pipeline Active</span>
      </div>
    </div>
  );
}
