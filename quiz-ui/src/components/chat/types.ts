export interface ChatMessage {
  sender: "user" | "ai" | "system";
  timestamp: Date;
  isVisible: boolean;
  messageType: "content" | "status";
  status?: "processing" | "completed" | "failed";
  sources?: Reference[];
  CoT?: string;
  content: string;
  isErrorMessage?: boolean;
  metadata?: {
    node?: string;
    progress?: number;
    useHyDE?: boolean;
    useHybrid?: boolean;
    useReasoning?: boolean;
  };
}

export interface Reference {
  title: string;
  page_number?: string;
  score: number;
  content: string;
  presigned_url: string;
}

export type AgentMessageType =
  | "step"
  | "update"
  | "done"
  | "error"
  | "notice"
  | "result"
  | "references"
  | "quizzes"
  | "stream"
  | "cot"
  | "speech";

export interface AgentMessage {
  type: AgentMessageType;
  content: string;
  task?: string;
  data?: unknown;
  references?: Reference[];
  node?: string;
  status?: "start" | "end" | "error";
  error?: string;
  quizzes?: unknown[];
  speechData?: {
    text: string;
    audioUrl?: string;
    isComplete?: boolean;
    language?: string;
  };
}

export interface NodeStatus {
  node: string;
  status: "start" | "end" | "error";
  error?: string;
}

export interface RAGConfig {
  useHyDE: boolean;
  useHybrid: boolean;
  useReasoning: boolean;
  topK: number;
  language: string;
  llm: string;
}

export interface ChatReq {
  mode: "simple" | "agent";
  messages: ChatMessage[];
  analysisLLMId?: string;
  workerLLMId?: string;
  selectedSource?: string;
  rag_config: RAGConfig;
}

export interface ModelOption {
  id: string;
  name: string;
  group?: string;
}

export interface ChatConfigType {
  apiBaseUrl: string;
  chatEndpoint: string;
  getAccessToken: () => string | null;
  models: ModelOption[];
  defaults: {
    model: string;
    useHyDE: boolean;
    useHybrid: boolean;
    useReasoning: boolean;
  };
}
