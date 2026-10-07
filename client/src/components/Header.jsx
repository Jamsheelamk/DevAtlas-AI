// client/src/components/Header.jsx
import React from "react";
import {
  Layers,
  Activity,
  BookOpen,
  Settings,
  Sparkles,
  ChevronDown,
} from "lucide-react";

export function Header({
  selectedModel,
  onSelectModel,
  onOpenKnowledge,
  onOpenSettings,
  onToggleVisualizer,
  isVisualizerOpen,
  telemetryCount,
  health,
}) {
  const models = [
    { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", desc: "Flagship Reasoning" },
    { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B", desc: "Code & Architecture" },
    { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", desc: "Ultra-Fast Edge" },
  ];

  return (
    <header className="glass-panel" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 24px",
      borderBottom: "1px solid var(--surface-glass-border)",
      position: "relative",
      zIndex: 10,
    }}>
      {/* Brand Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: "38px",
          height: "38px",
          borderRadius: "10px",
          background: "linear-gradient(135deg, #22d3ee, #783cb8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 15px rgba(56, 189, 248, 0.4)",
        }}>
          <Layers size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "1.25rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#ffffff",
            }}>
              DevAtlas <span style={{ color: "var(--cyan-glow)" }}>AI</span>
            </h1>
            <span style={{
              fontSize: "0.65rem",
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: "4px",
              background: "rgba(56, 189, 248, 0.15)",
              color: "var(--cyan-glow)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              textTransform: "uppercase",
            }}>
              RAG 10-Step
            </span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Developer & AI Agent Engineering Intelligence
          </p>
        </div>
      </div>

      {/* Center: Model Selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(5, 24, 33, 0.6)",
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid var(--surface-glass-border)",
        }}>
          <Sparkles size={16} color="var(--cyan-glow)" />
          <select
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              color: "#f8fafc",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id} style={{ background: "#09202a", color: "#f8fafc" }}>
                {m.name} — {m.desc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Pipeline Telemetry Inspector Toggle */}
        <button
          onClick={onToggleVisualizer}
          className="glow-on-hover"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: isVisualizerOpen ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
            border: `1px solid ${isVisualizerOpen ? "var(--cyan-glow)" : "var(--surface-glass-border)"}`,
            color: isVisualizerOpen ? "var(--cyan-glow)" : "#f8fafc",
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "0.82rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
          title="Toggle 10-Step AI Pipeline Telemetry Inspector"
        >
          <Activity size={16} />
          <span>Pipeline Inspector</span>
          {telemetryCount > 0 && (
            <span style={{
              background: "var(--cyan-glow)",
              color: "#051821",
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: "10px",
            }}>
              {telemetryCount}
            </span>
          )}
        </button>

        {/* Knowledge Explorer Button */}
        <button
          onClick={onOpenKnowledge}
          className="glow-on-hover"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--surface-glass-border)",
            color: "#f8fafc",
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "0.82rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
          title="Browse 9 Framework Documentation Corpora"
        >
          <BookOpen size={16} />
          <span>Corpora (9)</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="glow-on-hover"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--surface-glass-border)",
            color: "#f8fafc",
            padding: "6px 10px",
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
          title="API Keys & Settings"
        >
          <Settings size={16} />
        </button>

        {/* Health status pill */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 8px",
          borderRadius: "12px",
          background: health?.status === "ok" ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
          border: `1px solid ${health?.status === "ok" ? "rgba(34, 197, 94, 0.3)" : "rgba(234, 179, 8, 0.3)"}`,
          fontSize: "0.72rem",
          color: health?.status === "ok" ? "#4ade80" : "#facc15",
        }}>
          <span style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: health?.status === "ok" ? "#4ade80" : "#facc15",
          }} />
          <span>{health?.status === "ok" ? "Ready" : "Standby"}</span>
        </div>
      </div>
    </header>
  );
}
