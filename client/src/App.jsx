// client/src/App.jsx
import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { ChatView } from "./components/ChatView.jsx";
import { ChatInput } from "./components/ChatInput.jsx";
import { PipelineVisualizer } from "./components/PipelineVisualizer.jsx";
import { KnowledgeModal } from "./components/KnowledgeModal.jsx";
import { SettingsModal } from "./components/SettingsModal.jsx";
import {
  fetchHealth,
  fetchKnowledgeCorpora,
  saveSettings,
  streamChat,
} from "./services/api.js";

export function App() {
  const [sessions, setSessions] = useState([
    { id: "default", title: "New Architecture Thread", messages: [] },
  ]);
  const [currentSessionId, setCurrentSessionId] = useState("default");
  const [selectedModel, setSelectedModel] = useState("openai/gpt-oss-120b");
  const [selectedFilter, setSelectedFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingCitations, setStreamingCitations] = useState([]);
  const [telemetry, setTelemetry] = useState([]);

  // Modals & Panels
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(false);
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Server metadata
  const [health, setHealth] = useState(null);
  const [knowledgeData, setKnowledgeData] = useState(null);

  // Load server status on mount
  useEffect(() => {
    fetchHealth().then(setHealth);
    fetchKnowledgeCorpora().then(setKnowledgeData);
  }, []);

  const currentSession =
    sessions.find((s) => s.id === currentSessionId) || sessions[0];
  const messages = currentSession?.messages || [];

  const handleNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSess = { id: newId, title: "New Architecture Thread", messages: [] };
    setSessions((prev) => [newSess, ...prev]);
    setCurrentSessionId(newId);
    setTelemetry([]);
    setStreamingContent("");
  };

  const handleSendMessage = async (queryText) => {
    if (!queryText.trim() || isLoading) return;

    const userMessage = { role: "user", content: queryText };
    const updatedMessages = [...messages, userMessage];

    // Update session title if first message
    const newTitle =
      messages.length === 0 ? queryText.slice(0, 32) + "..." : currentSession.title;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId
          ? { ...s, title: newTitle, messages: updatedMessages }
          : s
      )
    );

    setIsLoading(true);
    setStreamingContent("");
    setStreamingCitations([]);
    setTelemetry([]);
    setIsVisualizerOpen(true); // Automatically open telemetry to show the 10 steps

    let accumulatedTokens = "";
    let finalCitations = [];

    await streamChat({
      query: queryText,
      history: messages,
      filter: selectedFilter === "all" ? null : selectedFilter,
      model: selectedModel,
      onTelemetry: (item) => {
        setTelemetry((prev) => {
          const filtered = prev.filter((x) => x.stage !== item.stage);
          return [...filtered, item].sort((a, b) => a.stage - b.stage);
        });
      },
      onCitations: (cites) => {
        finalCitations = cites;
        setStreamingCitations(cites);
      },
      onToken: (token) => {
        accumulatedTokens += token;
        setStreamingContent(accumulatedTokens);
      },
      onDone: () => {
        const assistantMessage = {
          role: "assistant",
          content: accumulatedTokens,
          citations: finalCitations,
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId
              ? { ...s, messages: [...updatedMessages, assistantMessage] }
              : s
          )
        );

        setStreamingContent("");
        setStreamingCitations([]);
        setIsLoading(false);
      },
      onError: (err) => {
        const errorMsg = {
          role: "assistant",
          content: `⚠️ **Pipeline Error:** ${err}\n\nPlease check server connection or configuration.`,
          citations: [],
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId
              ? { ...s, messages: [...updatedMessages, errorMsg] }
              : s
          )
        );
        setIsLoading(false);
      },
    });
  };

  const handleSaveSettings = async (settings) => {
    await saveSettings(settings);
    const updatedHealth = await fetchHealth();
    setHealth(updatedHealth);
  };

  const handleSyncKnowledge = async () => {
    const res = await fetch("/api/knowledge/sync", { method: "POST" });
    const data = await res.json();
    const updated = await fetchKnowledgeCorpora();
    setKnowledgeData(updated);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", position: "relative" }}>
      {/* Background Orbital Rings Graphic */}
      <div className="orbital-rings-bg">
        <div className="orbital-ring orbital-ring-1" />
        <div className="orbital-ring orbital-ring-2" />
        <div className="orbital-ring orbital-ring-3" />
      </div>

      {/* Header */}
      <Header
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onOpenKnowledge={() => setIsKnowledgeOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleVisualizer={() => setIsVisualizerOpen(!isVisualizerOpen)}
        isVisualizerOpen={isVisualizerOpen}
        telemetryCount={telemetry.length}
        health={health}
      />

      {/* Main Workspace */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}>
        {/* Sidebar */}
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={setCurrentSessionId}
          onNewSession={handleNewSession}
          corpora={knowledgeData?.frameworks || []}
          selectedFilter={selectedFilter}
          onSelectFilter={setSelectedFilter}
        />

        {/* Chat Conversation View & Input */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, position: "relative" }}>
          <ChatView
            messages={messages}
            isLoading={isLoading}
            streamingContent={streamingContent}
            streamingCitations={streamingCitations}
            onSelectPrompt={handleSendMessage}
          />

          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            selectedFilter={selectedFilter}
            onSelectFilter={setSelectedFilter}
          />
        </div>

        {/* 10-Step Pipeline Visualizer Drawer */}
        <PipelineVisualizer
          isOpen={isVisualizerOpen}
          onClose={() => setIsVisualizerOpen(false)}
          telemetry={telemetry}
          isLoading={isLoading}
        />
      </div>

      {/* Knowledge Corpora Modal */}
      <KnowledgeModal
        isOpen={isKnowledgeOpen}
        onClose={() => setIsKnowledgeOpen(false)}
        knowledgeData={knowledgeData}
        onSyncKnowledge={handleSyncKnowledge}
      />

      {/* API Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
}
