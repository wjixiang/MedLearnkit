import { useRef, useEffect, useCallback, memo } from "react";
import { MessageItem } from "./MessageItem";
import { Loader2, Bot, Info, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStickToBottom } from "use-stick-to-bottom";
import type { ChatMessage } from "./types";

interface ChatThreadProps {
  messages: ChatMessage[];
  statusMessages: string[];
  currentAiMessage: ChatMessage;
  loading: boolean;
  selectedSource: string;
  onRegenerateLastMessage: (source: string) => void;
  showScrollButton: boolean;
  followMode: boolean;
  onEnableFollowMode: () => void;
}

const HistoryMessages = memo(
  ({
    messages,
    statusMessages,
    loading,
    selectedSource,
    onRegenerateLastMessage,
  }: {
    messages: ChatMessage[];
    statusMessages: string[];
    loading: boolean;
    selectedSource: string;
    onRegenerateLastMessage: (source: string) => void;
  }) => {
    if (messages.length === 0 && statusMessages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
          <Bot size={40} className="mb-2" />
        </div>
      );
    }

    return (
      <>
        {[...messages].map((message, index) => {
          const isAi = message.sender === "ai";

          return (
            <div key={index} className="space-y-2 select-text">
              <MessageItem
                message={message}
                onRegenerate={
                  isAi
                    ? () => onRegenerateLastMessage(selectedSource)
                    : undefined
                }
                loading={loading}
                showCoT={true}
                isRenderRef={true}
              />

              {message.sender === "user" &&
                statusMessages.length > 0 &&
                index === messages.length - 1 && (
                  <div className="ml-11 mt-2">
                    <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-muted">
                      <Info className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-blue-600">处理进度</p>
                        {statusMessages.map((msg, i) => (
                          <p key={i} className="text-muted-foreground">
                            {msg}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          );
        })}
      </>
    );
  },
);

HistoryMessages.displayName = "HistoryMessages";

export function ChatThread({
  messages,
  statusMessages,
  currentAiMessage,
  loading,
  selectedSource,
  onRegenerateLastMessage,
  showScrollButton,
  followMode,
  onEnableFollowMode,
}: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { scrollRef, contentRef, scrollToBottom } =
    useStickToBottom();

  useEffect(() => {
    if (followMode) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages, currentAiMessage, followMode, scrollToBottom]);

  const scrollToBottomAndEnableFollow = useCallback(() => {
    onEnableFollowMode();
    scrollToBottom();
  }, [onEnableFollowMode, scrollToBottom]);

  return (
    <div className="flex-1 flex flex-col relative h-full">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex-col-reverse p-4"
      >
        <div ref={contentRef} className="pb-4">
          <HistoryMessages
            messages={messages}
            statusMessages={statusMessages}
            loading={loading}
            selectedSource={selectedSource}
            onRegenerateLastMessage={onRegenerateLastMessage}
          />

          {(currentAiMessage.content || currentAiMessage.CoT) && (
            <MessageItem
              message={{
                ...currentAiMessage,
                timestamp: new Date(),
              }}
              showCoT={true}
              isRenderRef={!loading}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {loading && (
          <div className="flex items-center justify-center mt-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            正在检索相关内容...
          </div>
        )}
      </div>

      {showScrollButton && (
        <Button
          onClick={scrollToBottomAndEnableFollow}
          className="absolute bottom-4 right-8 transition-opacity duration-200 z-20 bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:bg-primary/90"
          size="icon"
          aria-label="滚动到底部"
        >
          <ArrowDown size={16} />
        </Button>
      )}
    </div>
  );
}
