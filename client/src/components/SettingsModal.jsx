// client/src/components/SettingsModal.jsx
import React, { useState } from "react";
import { Settings, Key, X, Check, ExternalLink } from "lucide-react";

export function SettingsModal({
  isOpen,
  onClose,
  onSaveSettings,
}) {
  if (!isOpen) return null;

  const [groqKey, setGroqKey] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    await onSaveSettings({ groqApiKey: groqKey.trim() });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

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
        maxWidth: "520px",
        borderRadius: "16px",
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
            <Settings size={20} color="var(--cyan-glow)" />
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff" }}>
              API Settings & Keys
            </h2>
          </div>
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

        {/* Content */}
        <form onSubmit={handleSave} style={{ padding: "20px 24px" }}>
          <div style={{ marginBottom: "18px" }}>
            <label style={{
              display: "block",
              fontSize: "0.84rem",
              fontWeight: 600,
              color: "#f8fafc",
              marginBottom: "6px",
            }}>
              Groq Cloud API Key
            </label>
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(5, 24, 33, 0.8)",
              border: "1px solid var(--surface-glass-border)",
              borderRadius: "8px",
              padding: "8px 12px",
              gap: "8px",
            }}>
              <Key size={16} color="var(--cyan-glow)" />
              <input
                type="password"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#f8fafc",
                  fontSize: "0.88rem",
                  width: "100%",
                }}
              />
            </div>
            <p style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              marginTop: "6px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}>
              <span>Get a 100% free API key at</span>
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--cyan-glow)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "2px" }}
              >
                <span>console.groq.com</span>
                <ExternalLink size={10} />
              </a>
            </p>
          </div>

          <div style={{
            background: "rgba(56, 189, 248, 0.08)",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "20px",
            fontSize: "0.76rem",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}>
            <b style={{ color: "var(--cyan-glow)" }}>Zero Mandatory Configuration:</b> Embeddings run 100% locally on CPU with MiniLM-L6-v2, and Qdrant & Redis use built-in local vector and cache stores out-of-the-box.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--surface-glass-border)",
                color: "#f8fafc",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.84rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              style={{
                background: "linear-gradient(135deg, #22d3ee, #783cb8)",
                border: "none",
                color: "#ffffff",
                padding: "8px 18px",
                borderRadius: "8px",
                fontSize: "0.84rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {saved ? (
                <>
                  <Check size={16} />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Key</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
