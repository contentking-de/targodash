"use client";

import React, { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const suggestedPrompts = [
  "Auf welcher Position rankt die Website für 'Kredit Deutschland'?",
  "Was ist das Suchvolumen für 'Online Banking', 'Mobile Banking' und 'E-Banking'?",
  "Zeig mir eine Zusammenfassung des Backlink-Profils von targobank.de",
  "Welche sind die Top 10 verweisenden Domains?",
];

export default function SuperAgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/superagent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Fehler: ${error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            SuperAgent
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            KI-gestützte SEO-Analyse mit Echtzeit-Daten
          </p>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 mb-6 rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-violet-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Willkommen beim SuperAgent
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
                Ich bin dein KI-Assistent für SEO-Analysen. Frag mich nach
                Rankings, Suchvolumen, Backlinks und mehr.
              </p>

              {/* Suggested Prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                {suggestedPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(prompt)}
                    className="p-4 text-left text-sm rounded-xl border border-slate-200 dark:border-slate-600 
                             bg-white dark:bg-slate-700/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 
                             hover:border-violet-300 dark:hover:border-violet-500/50 
                             text-slate-700 dark:text-slate-300 transition-all duration-200
                             hover:shadow-md"
                  >
                    <span className="text-violet-500 mr-2">→</span>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-2xl rounded-br-md"
                        : "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-md border border-slate-200 dark:border-slate-600"
                    } px-5 py-3 shadow-sm`}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <MessageContent content={message.content} />
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                    <p
                      className={`text-xs mt-2 ${
                        message.role === "user"
                          ? "text-violet-200"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-bl-md px-5 py-4 shadow-sm border border-slate-200 dark:border-slate-600">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <span
                          className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        Analysiere Daten...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Frag mich etwas über SEO..."
                rows={1}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 
                         bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white
                         placeholder-slate-400 dark:placeholder-slate-500
                         focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
                         resize-none transition-all duration-200"
                style={{ minHeight: "48px", maxHeight: "120px" }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 
                       text-white font-medium shadow-lg shadow-violet-500/25
                       hover:shadow-violet-500/40 hover:scale-[1.02]
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                       transition-all duration-200"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </form>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
            SuperAgent nutzt Claude AI mit DataForSEO für Echtzeit-SEO-Daten
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper function to parse inline markdown (bold, italic)
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  
  // Remove any standalone ** that aren't properly paired
  let cleanText = text;
  
  // First, handle **bold** patterns
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  
  while ((match = boldRegex.exec(cleanText)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const beforeText = cleanText.slice(lastIndex, match.index);
      result.push(<span key={`text-${lastIndex}`}>{beforeText}</span>);
    }
    // Add the bold text
    result.push(<strong key={`bold-${match.index}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < cleanText.length) {
    let remaining = cleanText.slice(lastIndex);
    // Clean up any orphaned ** markers
    remaining = remaining.replace(/\*\*/g, '');
    if (remaining) {
      result.push(<span key={`text-end-${lastIndex}`}>{remaining}</span>);
    }
  }
  
  // If no bold found, just return cleaned text
  if (result.length === 0) {
    const cleaned = cleanText.replace(/\*\*/g, '');
    return [<span key="text-only">{cleaned}</span>];
  }
  
  return result;
}

// Component to render markdown-like content
function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        // Headers (remove ** from headers too)
        if (line.startsWith("### ")) {
          const headerText = line.slice(4).replace(/\*\*/g, '');
          return (
            <h4 key={index} className="font-semibold text-base mt-4 mb-2">
              {headerText}
            </h4>
          );
        }
        if (line.startsWith("## ")) {
          const headerText = line.slice(3).replace(/\*\*/g, '');
          return (
            <h3 key={index} className="font-bold text-lg mt-4 mb-2">
              {headerText}
            </h3>
          );
        }
        if (line.startsWith("# ")) {
          const headerText = line.slice(2).replace(/\*\*/g, '');
          return (
            <h2 key={index} className="font-bold text-xl mt-4 mb-2">
              {headerText}
            </h2>
          );
        }

        // List items
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <li key={index} className="ml-4 list-disc">
              {parseInlineMarkdown(line.slice(2))}
            </li>
          );
        }

        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          return (
            <li key={index} className="ml-4 list-decimal">
              {parseInlineMarkdown(line.replace(/^\d+\.\s/, ""))}
            </li>
          );
        }

        // Empty line
        if (line.trim() === "") {
          return <br key={index} />;
        }

        // Regular paragraph with inline formatting
        return <p key={index}>{parseInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}
