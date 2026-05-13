import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import type {
  ChatMessage,
  AgentMessage,
  NodeStatus,
  ChatReq,
} from "../types";
import { useChatConfig } from "../ChatConfig";

const emptyAiMessage = (): ChatMessage => ({
  CoT: "",
  content: "",
  sender: "ai",
  timestamp: new Date(),
  isVisible: true,
  messageType: "content",
});

export interface UseChatRuntime {
  mode: "simple" | "agent";
  setMode: (mode: "simple" | "agent") => void;
  messages: ChatMessage[];
  statusMessages: string[];
  currentAiMessage: ChatMessage;
  loading: boolean;
  nodeStatus: NodeStatus | null;
  sendMessage: (
    input: string,
    selectedSource?: string,
    analysisLLMId?: string,
    workerLLMId?: string,
    useHyDE?: boolean,
    useHybrid?: boolean,
    selectedModel?: string,
    useReasoning?: boolean,
  ) => Promise<void>;
  cancelRequest: () => void;
  regenerateLastMessage: (
    selectedSource?: string,
    analysisLLMId?: string,
    workerLLMId?: string,
    useHyDE?: boolean,
  ) => Promise<void>;
  clearChat: () => void;
  cotMessages: string[];
  speechQueue: string[];
  isSpeaking: boolean;
}

export function useChatRuntime(
  initialMode: "simple" | "agent" = "simple",
): UseChatRuntime {
  const config = useChatConfig();

  const [mode, setMode] = useState<"simple" | "agent">(initialMode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [currentAiMessage, setCurrentAiMessage] =
    useState<ChatMessage>(emptyAiMessage);
  const [cotMessages, setCotMessages] = useState<string[]>([]);
  const [speechQueue, setSpeechQueue] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedContentRef = useRef("");
  const accumulatedCoTRef = useRef("");

  const processChunk = useCallback(async (parsedChunk: AgentMessage) => {
    switch (parsedChunk.type) {
      case "step":
        setMessages((prev) => [
          ...prev,
          {
            messageType: "status",
            sender: "ai",
            timestamp: new Date(),
            isVisible: true,
            content: parsedChunk.content,
          },
        ]);
        break;

      case "notice":
        setMessages((prev) => [
          ...prev,
          {
            messageType: "content",
            sender: "ai",
            timestamp: new Date(),
            isVisible: true,
            content: parsedChunk.content,
          },
        ]);
        break;

      case "cot":
        setCurrentAiMessage((prev) => ({
          ...prev,
          CoT: (prev.CoT ?? "") + parsedChunk.content,
          timestamp: new Date(),
          sources: [],
        }));
        break;

      case "speech":
        if (parsedChunk.speechData?.text) {
          setSpeechQueue((prev) => [...prev, parsedChunk.speechData!.text]);
        }
        if (parsedChunk.speechData?.isComplete) {
          setIsSpeaking(false);
        }
        break;

      case "update":
        setCurrentAiMessage((prev) => ({
          ...prev,
          content: prev.content + parsedChunk.content,
          timestamp: new Date(),
          sources: parsedChunk.references ?? [],
        }));
        break;

      case "done": {
        const aiMessage: ChatMessage = {
          ...currentAiMessage,
          content: accumulatedContentRef.current,
          sources: parsedChunk.references,
          CoT: accumulatedCoTRef.current,
        };
        setMessages((prev) => [...prev, aiMessage]);
        break;
      }

      case "error":
        toast.error(parsedChunk.content);
        setCotMessages([]);
        break;

      case "references":
        break;
    }

    if (parsedChunk.node && parsedChunk.status) {
      setNodeStatus({
        node: parsedChunk.node,
        status: parsedChunk.status,
        error: parsedChunk.error,
      });
    }
  }, [currentAiMessage]);

  const parseStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          try {
            const chunk: AgentMessage = JSON.parse(line);
            await processChunk(chunk);
            if (chunk.type === "update") {
              accumulatedContentRef.current += chunk.content;
            }
            if (chunk.type === "cot") {
              accumulatedCoTRef.current += chunk.content;
            }
          } catch {
            // skip unparseable lines
          }
        }
      }

      if (buffer.trim()) {
        try {
          const chunk: AgentMessage = JSON.parse(buffer);
          await processChunk(chunk);
          if (chunk.type === "update") {
            accumulatedContentRef.current += chunk.content;
          }
          if (chunk.type === "cot") {
            accumulatedCoTRef.current += chunk.content;
          }
        } catch {
          // skip
        }
      }
    },
    [processChunk],
  );

  const sendMessage = useCallback(
    async (
      input: string,
      selectedSource: string = "vault",
      analysisLLMId: string = "",
      workerLLMId: string = "",
      useHyDE: boolean = false,
      useHybrid: boolean = false,
      selectedModel: string = config.defaults.model,
      useReasoning: boolean = config.defaults.useReasoning,
    ) => {
      if (loading) return;

      setLoading(true);
      accumulatedContentRef.current = "";
      accumulatedCoTRef.current = "";
      setCurrentAiMessage(emptyAiMessage());
      setNodeStatus(null);

      const userMessage: ChatMessage = {
        content: input,
        sender: "user",
        timestamp: new Date(),
        isVisible: true,
        messageType: "content",
        metadata: { useHyDE, useHybrid, useReasoning },
      };

      setMessages((prev) => [...prev, userMessage]);
      abortControllerRef.current = new AbortController();

      try {
        const historyMessages = messages.map((msg) => ({
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.timestamp,
          isVisible: msg.isVisible,
          sources: msg.sources,
          messageType: msg.messageType || "content",
        }));

        const requestBody: ChatReq = {
          mode,
          messages: [...historyMessages, userMessage],
          analysisLLMId,
          workerLLMId,
          selectedSource,
          rag_config: {
            useHyDE,
            useHybrid,
            useReasoning,
            topK: 10,
            language: "zh",
            llm: selectedModel,
          },
        };

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        const token = config.getAccessToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const url = `${config.apiBaseUrl}${config.chatEndpoint}`;
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok || !response.body) {
          let errorMessage = "Failed to fetch from API";
          try {
            const errorText = await response.text();
            if (errorText) {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.error || errorMessage;
            }
          } catch {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        await parseStream(response.body.getReader());
      } catch (error: unknown) {
        const err = error as Error;
        if (err.name === "AbortError") {
          toast.info("请求已取消");
          setCurrentAiMessage({
            ...emptyAiMessage(),
            content: "请求已取消。",
          });
        } else {
          toast.error(`发送消息失败: ${err.message}`);
          const errorMsg: ChatMessage = {
            content: `Error: ${err.message}`,
            sender: "ai",
            timestamp: new Date(),
            isVisible: true,
            messageType: "content",
            isErrorMessage: true,
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
        setCurrentAiMessage(emptyAiMessage());
        setNodeStatus(null);
      }
    },
    [loading, messages, mode, parseStream, config],
  );

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  const regenerateLastMessage = useCallback(
    async (
      selectedSource: string = "vault",
      analysisLLMId: string = "",
      workerLLMId: string = "",
      useHyDE: boolean = false,
    ) => {
      if (loading || messages.length === 0) return;

      const lastUserMessageIndex = messages
        .slice()
        .reverse()
        .findIndex((msg) => msg.sender === "user");
      if (lastUserMessageIndex === -1) {
        toast.info("没有找到上一条用户消息");
        return;
      }

      const originalIndex = messages.length - 1 - lastUserMessageIndex;
      const lastUserMessage = messages[originalIndex];

      setMessages((prev) => prev.slice(0, originalIndex + 1));
      await sendMessage(
        lastUserMessage.content,
        selectedSource,
        analysisLLMId,
        workerLLMId,
        useHyDE,
      );
    },
    [loading, messages, sendMessage],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setStatusMessages([]);
    setCurrentAiMessage(emptyAiMessage());
    setLoading(false);
    setNodeStatus(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    mode,
    setMode,
    messages,
    statusMessages,
    currentAiMessage,
    loading,
    nodeStatus,
    sendMessage,
    cancelRequest,
    regenerateLastMessage,
    clearChat,
    cotMessages,
    speechQueue,
    isSpeaking,
  };
}
