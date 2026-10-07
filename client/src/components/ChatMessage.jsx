// client/src/components/ChatMessage.jsx
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { User, Bot, Copy, Check, ExternalLink, ShieldCheck } from "lucide-react";

export function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "14px",
        padding: "20px 24px",
        borderRadius: "12px",
        marginBottom: "16px",
        background: isUser
          ? "rgba(13, 59, 76, 0.45)"
          : "rgba(9, 32, 42, 0.75)",
        border: `1px solid ${isUser ? "rgba(56, 189, 248, 0.15)" : "var(--surface-glass-border)"}`,
        backdropFilter: "blur(12px)",
        position: "relative",
      }}
    >
      {/* Avatar Icon */}
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          background: isUser
            ? "linear-gradient(135deg, #0284c7, #0369a1)"
            : "linear-gradient(135deg, #0d9488, #7c3aed)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: isUser
            ? "0 0 10px rgba(2, 132, 199, 0.3)"
            : "0 0 15px rgba(124, 58, 237, 0.35)",
        }}
      >
        {isUser ? <User size={18} color="#ffffff" /> : <Bot size={18} color="#ffffff" />}
      </div>

      {/* Message Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}>
          <span style={{
            fontSize: "0.82rem",
            fontWeight: 700,
            color: isUser ? "var(--cyan-glow)" : "#cbd5e1",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            {isUser ? "You" : "DevAtlas AI Architect"}
          </span>

          <button
            onClick={handleCopy}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.75rem",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
            title="Copy message to clipboard"
          >
            {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Markdown Rendered Body */}
        <div
          style={{
            fontSize: "0.94rem",
            lineHeight: 1.65,
            color: "#f8fafc",
            overflowWrap: "break-word",
          }}
        >
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "16px 0 8px", color: "#ffffff" }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ fontSize: "1.15rem", fontWeight: 600, margin: "14px 0 8px", color: "var(--cyan-glow)" }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: "12px 0 6px", color: "#e2e8f0" }}>{children}</h3>,
              p: ({ children }) => <p style={{ marginBottom: "12px" }}>{children}</p>,
              ul: ({ children }) => <ul style={{ paddingLeft: "20px", marginBottom: "12px" }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ paddingLeft: "20px", marginBottom: "12px" }}>{children}</ol>,
              li: ({ children }) => <li style={{ marginBottom: "4px" }}>{children}</li>,
              code: ({ inline, className, children, ...props }) => {
                if (inline) {
                  return (
                    <code style={{
                      background: "rgba(5, 24, 33, 0.8)",
                      color: "var(--cyan-glow)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "0.86em",
                      border: "1px solid rgba(56, 189, 248, 0.2)",
                    }}>
                      {children}
                    </code>
                  );
                }
                return (
                  <div style={{
                    margin: "14px 0",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: "1px solid rgba(56, 189, 248, 0.2)",
                    background: "var(--code-bg)",
                  }}>
                    <pre style={{
                      padding: "14px 16px",
                      overflowX: "auto",
                      fontSize: "0.86rem",
                      color: "#e2e8f0",
                      lineHeight: 1.5,
                    }}>
                      <code>{children}</code>
                    </pre>
                  </div>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Verified Citations Badge Section */}
        {message.citations && message.citations.length > 0 && (
          <div style={{
            marginTop: "16px",
            paddingTop: "14px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "8px",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--cyan-glow)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}>
              <ShieldCheck size={14} />
              <span>Verified Documentation Sources ({message.citations.length})</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {message.citations.map((c, i) => (
                <a
                  key={i}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glow-on-hover"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(5, 24, 33, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    padding: "5px 10px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    color: "#f8fafc",
                    textDecoration: "none",
                  }}
                  title={`Open official ${c.library} documentation: ${c.title}`}
                >
                  <span style={{
                    color: "var(--cyan-glow)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    fontSize: "0.7rem",
                  }}>
                    {c.library}:
                  </span>
                  <span style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.title}
                  </span>
                  <ExternalLink size={12} color="var(--text-secondary)" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
