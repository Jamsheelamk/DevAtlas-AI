// client/src/components/ChatView.jsx
import React, { useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage.jsx";
import { Sparkles, Terminal, Cpu, Database, Network } from "lucide-react";

export function ChatView({
  messages = [],
  isLoading,
  streamingContent,
  streamingCitations,
  onSelectPrompt,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const starterCards = [
    {
      icon: Network,
      color: "#a855f7",
      title: "LangGraph StateGraph & Persistence",
      prompt: "Show me how to build a stateful multi-actor agent in LangGraph JS using Annotation.Root and MemorySaver checkpointer.",
      tag: "Multi-Agent AI",
    },
    {
      icon: Terminal,
      color: "#06b6d4",
      title: "React 19 Actions & useActionState",
      prompt: "Explain how React 19 Actions work with useActionState and useOptimistic for async mutations and optimistic UI updates.",
      tag: "Frontend",
    },
    {
      icon: Database,
      color: "#ec4899",
      title: "Qdrant HNSW Indexing & Filtering",
      prompt: "How does Qdrant handle HNSW vector indexing and single-stage payload metadata filtering in JavaScript?",
      tag: "Vector Search",
    },
    {
      icon: Cpu,
      color: "#f97316",
      title: "Groq LPU Inference & Token Streaming",
      prompt: "What makes Groq LPUs faster than GPUs, and how do I stream LLaMA 3.3 70B completions via SSE in Node.js?",
      tag: "LPU Inference",
    },
  ];

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 32px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {messages.length === 0 ? (
        <div style={{
          maxWidth: "850px",
          margin: "auto",
          width: "100%",
          padding: "20px 0",
        }}>
          {/* Hero Banner */}
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              borderRadius: "20px",
              background: "rgba(56, 189, 248, 0.1)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              marginBottom: "16px",
            }}>
              <Sparkles size={14} color="var(--cyan-glow)" />
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--cyan-glow)" }}>
                Corrective RAG Pipeline with 9 Live Official Framework Corpora
              </span>
            </div>

            <h1 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "2.4rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              marginBottom: "12px",
              color: "#ffffff",
            }}>
              Architectural Intelligence for{" "}
              <span style={{
                background: "linear-gradient(135deg, #38bdf8, #a855f7)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                Developer & AI Agents
              </span>
            </h1>

            <p style={{
              fontSize: "1rem",
              color: "var(--text-secondary)",
              maxWidth: "600px",
              margin: "0 auto",
              lineHeight: 1.6,
            }}>
              Specialized in production-grade AI Agent architectures, RAG design, vector databases, and fullstack modern web platforms. Grounded directly in official docs.
            </p>
          </div>

          {/* 4 Starter Architecture Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}>
            {starterCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  onClick={() => onSelectPrompt(card.prompt)}
                  className="glass-panel glow-on-hover"
                  style={{
                    padding: "18px",
                    borderRadius: "12px",
                    cursor: "pointer",
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
                      marginBottom: "12px",
                    }}>
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        background: `rgba(255, 255, 255, 0.05)`,
                        border: `1px solid ${card.color}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        <Icon size={18} color={card.color} />
                      </div>
                      <span style={{
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: "rgba(255, 255, 255, 0.05)",
                        color: "var(--text-secondary)",
                      }}>
                        {card.tag}
                      </span>
                    </div>

                    <h3 style={{
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      color: "#ffffff",
                      marginBottom: "8px",
                    }}>
                      {card.title}
                    </h3>

                    <p style={{
                      fontSize: "0.82rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.45,
                    }}>
                      {card.prompt}
                    </p>
                  </div>

                  <div style={{
                    marginTop: "14px",
                    fontSize: "0.74rem",
                    fontWeight: 600,
                    color: "var(--cyan-glow)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}>
                    <span>Explore Architecture</span>
                    <span>→</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: "880px", margin: "0 auto", width: "100%" }}>
          {messages.map((msg, index) => (
            <ChatMessage key={index} message={msg} />
          ))}

          {/* Live Streaming Delta Assistant Message */}
          {isLoading && streamingContent && (
            <ChatMessage
              message={{
                role: "assistant",
                content: streamingContent,
                citations: streamingCitations || [],
              }}
            />
          )}

          {/* Loading indicator when waiting for first token */}
          {isLoading && !streamingContent && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "16px 20px",
              borderRadius: "10px",
              background: "rgba(9, 32, 42, 0.6)",
              border: "1px solid var(--surface-glass-border)",
              color: "var(--cyan-glow)",
              fontSize: "0.86rem",
              width: "fit-content",
            }}>
              <Sparkles size={16} className="spin" />
              <span>Running 10-step Corrective RAG pipeline...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
