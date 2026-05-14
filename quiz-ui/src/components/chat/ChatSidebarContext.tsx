import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { ChatConfigProvider, useChatRuntime } from "./";
import { notebookApi } from "@/lib/api";
import type { ModelOption } from "./types";
import type { UseChatRuntime } from "./hooks/useChatRuntime";

const CHAT_MODELS: ModelOption[] = [
  { id: "qwen-plus", name: "Qwen Plus", group: "通义千问" },
  { id: "qwen-turbo", name: "Qwen Turbo", group: "通义千问" },
  { id: "qwen-max", name: "Qwen Max", group: "通义千问" },
  { id: "deepseek-v3", name: "DeepSeek V3", group: "DeepSeek" },
  { id: "glm-4-plus", name: "GLM-4 Plus", group: "智谱" },
  { id: "glm-4-flash", name: "GLM-4 Flash", group: "智谱" },
];

export interface NotebookMeta {
  notebook_id: string;
  source_name: string;
  source_type: string;
}

interface ChatSidebarContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  notebooks: NotebookMeta[];
  selectedNotebook: string;
  setSelectedNotebook: (id: string) => void;
  runtime: UseChatRuntime;
  loading: boolean;
}

const ChatSidebarContext = createContext<ChatSidebarContextType | null>(null);

export function useChatSidebar() {
  const ctx = useContext(ChatSidebarContext);
  if (!ctx)
    throw new Error("useChatSidebar must be used within ChatSidebarProvider");
  return ctx;
}

function ChatSidebarInner({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState("");
  const [loading, setLoading] = useState(true);
  const runtime = useChatRuntime();

  useEffect(() => {
    notebookApi
      .listNotebooks()
      .then((data: NotebookMeta[]) => {
        setNotebooks(data);
        if (data.length > 0 && !selectedNotebook) {
          setSelectedNotebook(data[0].notebook_id);
        }
      })
      .catch((err) => console.error("Failed to load notebooks:", err))
      .finally(() => setLoading(false));
  }, []);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <ChatSidebarContext.Provider
      value={{
        open,
        setOpen,
        toggle,
        notebooks,
        selectedNotebook,
        setSelectedNotebook,
        runtime,
        loading,
      }}
    >
      {children}
    </ChatSidebarContext.Provider>
  );
}

export function ChatSidebarProvider({ children }: { children: ReactNode }) {
  const ragBaseUrl =
    import.meta.env.VITE_RAG_API_URL || "http://localhost:8000";

  return (
    <ChatConfigProvider
      config={{
        apiBaseUrl: ragBaseUrl,
        chatEndpoint: "/chat",
        getAccessToken: () => null,
        models: CHAT_MODELS,
        defaults: {
          model: "qwen-plus",
          useHyDE: false,
          useHybrid: false,
          useReasoning: true,
        },
      }}
    >
      <ChatSidebarInner>{children}</ChatSidebarInner>
    </ChatConfigProvider>
  );
}
