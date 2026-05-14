import { useState, useEffect } from "react";
import {
  ChatConfigProvider,
  ChatInterface,
  useChatRuntime,
} from "@/components/chat";
import { notebookApi } from "@/lib/api";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ModelOption } from "@/components/chat/types";

const CHAT_MODELS: ModelOption[] = [
  { id: "qwen-plus", name: "Qwen Plus", group: "通义千问" },
  { id: "qwen-turbo", name: "Qwen Turbo", group: "通义千问" },
  { id: "qwen-max", name: "Qwen Max", group: "通义千问" },
  { id: "deepseek-v3", name: "DeepSeek V3", group: "DeepSeek" },
  { id: "glm-4-plus", name: "GLM-4 Plus", group: "智谱" },
  { id: "glm-4-flash", name: "GLM-4 Flash", group: "智谱" },
];

interface NotebookMeta {
  notebook_id: string;
  source_name: string;
  source_type: string;
}

export function ChatPage() {
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<string>("");
  const [loading, setLoading] = useState(true);

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

  const ragBaseUrl =
    import.meta.env.VITE_RAG_API_URL || "http://localhost:8000";

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (notebooks.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            暂无可用的课本数据。请先在 notebook-rag 中嵌入课本。
          </p>
          <Link to="/">
            <Button variant="outline">返回首页</Button>
          </Link>
        </div>
      </div>
    );
  }

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
      <div className="h-screen flex flex-col">
        <ChatHeader
          notebooks={notebooks}
          selectedNotebook={selectedNotebook}
          onSelectNotebook={setSelectedNotebook}
        />
        <div className="flex-1 min-h-0">
          <ChatBody notebookId={selectedNotebook} />
        </div>
      </div>
    </ChatConfigProvider>
  );
}

function ChatHeader({
  notebooks,
  selectedNotebook,
  onSelectNotebook,
}: {
  notebooks: NotebookMeta[];
  selectedNotebook: string;
  onSelectNotebook: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-2 bg-background">
      <Link to="/">
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} />
        </Button>
      </Link>
      <h1 className="text-sm font-semibold">AI 课本问答</h1>
      <select
        value={selectedNotebook}
        onChange={(e) => onSelectNotebook(e.target.value)}
        className="text-sm border rounded px-2 py-1 bg-background"
      >
        {notebooks.map((nb) => (
          <option key={nb.notebook_id} value={nb.notebook_id}>
            {nb.source_name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChatBody({ notebookId }: { notebookId: string }) {
  const runtime = useChatRuntime();

  const handleSendMessage = async (
    message: string,
    _selectedSource?: string,
    _analysisLLMId?: string,
    _workerLLMId?: string,
    _useHyDE?: boolean,
    _useHybrid?: boolean,
    selectedModel?: string,
    _useReasoning?: boolean,
  ) => {
    await runtime.sendMessage(
      message,
      notebookId,
      "",
      "",
      false,
      false,
      selectedModel,
      true,
    );
  };

  return (
    <ChatInterface
      messages={runtime.messages}
      statusMessages={runtime.statusMessages}
      currentAiMessage={runtime.currentAiMessage}
      loading={runtime.loading}
      selectedSource={notebookId}
      onSendMessage={handleSendMessage}
      onRegenerateLastMessage={(source) =>
        runtime.regenerateLastMessage(source)
      }
      onCancelRequest={runtime.cancelRequest}
      onClearChat={runtime.clearChat}
      cotMessages={runtime.cotMessages}
      speechQueue={runtime.speechQueue}
      isSpeaking={runtime.isSpeaking}
    />
  );
}
