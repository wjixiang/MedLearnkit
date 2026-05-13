import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CoTDisplay } from "./CoTDisplay";
import {
  Send,
  Trash2,
  History,
  Settings,
  Cpu,
} from "lucide-react";
import { ChatThread } from "./ChatThread";
import { useStickToBottom } from "use-stick-to-bottom";
import { toast } from "sonner";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useChatConfig } from "./ChatConfig";
import type { ChatMessage } from "./types";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  statusMessages: string[];
  currentAiMessage: ChatMessage;
  loading: boolean;
  selectedSource: string;
  hasSelectedQuiz?: boolean;
  onSendMessage: (
    message: string,
    selectedSource?: string,
    analysisLLMId?: string,
    workerLLMId?: string,
    useHyDE?: boolean,
    useHybrid?: boolean,
    selectedModel?: string,
    useReasoning?: boolean,
  ) => Promise<void>;
  onRegenerateLastMessage: (source: string) => void;
  onCancelRequest: () => void;
  onClearChat: () => void;
  cotMessages?: string[];
  speechQueue?: string[];
  isSpeaking?: boolean;
  showCoT?: boolean;
  quizContentForInput?: string | null;
  onMessagesUpdate?: (messages: ChatMessage[]) => void;
  onSessionTitleChange?: (title: string) => void;
  hideHeader?: boolean;
}

export function ChatInterface({
  messages,
  statusMessages,
  currentAiMessage,
  loading,
  selectedSource,
  onSendMessage,
  onRegenerateLastMessage,
  onCancelRequest,
  onClearChat,
  quizContentForInput,
  cotMessages = [],
  speechQueue = [],
  isSpeaking = false,
  showCoT = false,
}: ChatInterfaceProps) {
  const config = useChatConfig();

  const [input, setInput] = useState("");
  const [useHyDE, setUseHyDE] = useState(config.defaults.useHyDE);
  const [useHybrid, setUseHybrid] = useState(config.defaults.useHybrid);
  const [useReasoning, setUseReasoning] = useState(config.defaults.useReasoning);
  const [selectedModel, setSelectedModel] = useState(config.defaults.model);
  const [followMode, setFollowMode] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isAtBottom } = useStickToBottom();

  const chatThread = useMemo(
    () => (
      <ChatThread
        messages={messages}
        statusMessages={statusMessages}
        currentAiMessage={currentAiMessage}
        loading={loading}
        selectedSource={selectedSource}
        onRegenerateLastMessage={onRegenerateLastMessage}
        showScrollButton={!isAtBottom && !followMode}
        followMode={followMode}
        onEnableFollowMode={() => setFollowMode(true)}
      />
    ),
    [
      messages,
      statusMessages,
      currentAiMessage,
      loading,
      selectedSource,
      onRegenerateLastMessage,
      isAtBottom,
      followMode,
    ],
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  useEffect(() => {
    if (quizContentForInput) {
      setInput(quizContentForInput);
    }
  }, [quizContentForInput]);

  const sendMessage = useCallback(async () => {
    if (input.trim() === "" || loading) return;

    try {
      await onSendMessage(
        input.trim(),
        "vault",
        "",
        "",
        useHyDE,
        useHybrid,
        selectedModel,
        useReasoning,
      );
      setInput("");
    } catch (error: unknown) {
      const err = error as Error;
      toast.error("发送消息失败: " + (err.message || "未知错误"));
    }
  }, [input, loading, onSendMessage, useHyDE, useHybrid, selectedModel, useReasoning]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();

    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      sendMessage();
    }
  };

  const modelsByGroup = useMemo(() => {
    const groups = new Map<string, typeof config.models>();
    for (const model of config.models) {
      const group = model.group || "默认";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(model);
    }
    return groups;
  }, [config.models]);

  return (
    <div className="h-full flex flex-col">
      {showCoT && (cotMessages.length > 0 || speechQueue.length > 0) && (
        <div className="px-4 pt-2">
          <CoTDisplay
            cotMessages={cotMessages}
            speechQueue={speechQueue}
            isSpeaking={isSpeaking}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0">{chatThread}</div>

        <div className="w-full p-1 bg-transparent z-10">
          <div className="p-0 shrink-0 bg-background">
            <div className="relative w-full px-0">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="向课本提问..."
                className="resize-none pr-10 pb-6 bg-background max-h-[200px]"
                rows={2}
                disabled={loading}
              />
              <div className="absolute right-2 bottom-7 flex gap-1">
                {loading ? (
                  <Button
                    variant="destructive"
                    onClick={onCancelRequest}
                    size="sm"
                    className="h-8"
                  >
                    取消
                  </Button>
                ) : (
                  <Button
                    onClick={sendMessage}
                    disabled={input.trim() === ""}
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Send size={16} />
                  </Button>
                )}
              </div>

              <div className="absolute bottom-1 left-1 w-auto">
                <Menubar className="bg-transparent border-none p-0 h-5">
                  <MenubarMenu>
                    <MenubarTrigger className="h-5 px-2 py-0.5 text-xs">
                      <History size={16} />
                    </MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem disabled>
                        <span className="text-muted-foreground">暂无历史记录</span>
                      </MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>

                  <MenubarMenu>
                    <MenubarTrigger className="h-5 px-2 py-0.5 text-xs">
                      <Settings size={16} />
                    </MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem
                        onClick={onClearChat}
                        disabled={messages.length === 0 || loading}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> 清空对话
                      </MenubarItem>
                      <MenubarSeparator />
                      <MenubarItem
                        onClick={() => setUseHyDE(!useHyDE)}
                        className={useHyDE ? "bg-accent" : ""}
                      >
                        {useHyDE ? "✓ " : ""}启用HyDE检索
                      </MenubarItem>
                      <MenubarItem
                        onClick={() => setUseHybrid(!useHybrid)}
                        className={useHybrid ? "bg-accent" : ""}
                      >
                        {useHybrid ? "✓ " : ""}启用混合检索
                      </MenubarItem>
                      <MenubarItem
                        onClick={() => setUseReasoning(!useReasoning)}
                        className={useReasoning ? "bg-accent" : ""}
                      >
                        {useReasoning ? "✓ " : ""}启用推理模式
                      </MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>

                  {config.models.length > 0 && (
                    <MenubarMenu>
                      <MenubarTrigger className="h-5 px-2 py-0.5 text-xs">
                        <Cpu size={16} />
                      </MenubarTrigger>
                      <MenubarContent>
                        <div className="p-2">
                          <label className="text-xs text-muted-foreground">
                            选择模型
                          </label>
                          <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="w-full mt-1 text-sm bg-background border rounded px-2 py-1"
                          >
                            {[...modelsByGroup.entries()].map(
                              ([group, models]) => (
                                <optgroup key={group} label={group}>
                                  {models.map((model) => (
                                    <option key={model.id} value={model.id}>
                                      {model.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ),
                            )}
                          </select>
                        </div>
                      </MenubarContent>
                    </MenubarMenu>
                  )}
                </Menubar>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
