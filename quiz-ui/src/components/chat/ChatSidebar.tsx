import { useChatSidebar } from "./ChatSidebarContext";
import { ChatInterface } from "./ChatInterface";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BookOpen } from "lucide-react";

export function ChatSidebar() {
  const {
    open,
    setOpen,
    notebooks,
    selectedNotebook,
    setSelectedNotebook,
    runtime,
  } = useChatSidebar();

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
      selectedNotebook,
      "",
      "",
      false,
      false,
      selectedModel,
      true,
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:w-[420px] sm:max-w-[420px] p-0 gap-0 flex flex-col h-full"
      >
        <SheetHeader className="flex-row items-center gap-2 border-b px-3 py-2 space-y-0">
          <BookOpen size={16} className="text-primary shrink-0" />
          <SheetTitle className="text-sm">AI 课本问答</SheetTitle>
          <select
            value={selectedNotebook}
            onChange={(e) => setSelectedNotebook(e.target.value)}
            className="text-xs border rounded px-1.5 py-0.5 bg-background ml-auto max-w-[140px] truncate"
          >
            {notebooks.map((nb) => (
              <option key={nb.notebook_id} value={nb.notebook_id}>
                {nb.source_name}
              </option>
            ))}
          </select>
        </SheetHeader>

        {notebooks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-sm text-muted-foreground text-center">
              暂无可用的课本数据。
              <br />
              请先在 notebook-rag 中嵌入课本。
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <ChatInterface
              messages={runtime.messages}
              statusMessages={runtime.statusMessages}
              currentAiMessage={runtime.currentAiMessage}
              loading={runtime.loading}
              selectedSource={selectedNotebook}
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
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
