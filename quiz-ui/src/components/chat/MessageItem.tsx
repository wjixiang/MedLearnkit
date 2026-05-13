import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, Copy, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { ChatMessage } from "./types";
import { ChatMarkdown } from "./ChatMarkdown";
import { MessageSources } from "./MessageSources";

interface MessageItemProps {
  message: ChatMessage;
  onRegenerate?: () => void;
  loading?: boolean;
  cotContent?: string;
  showCoT?: boolean;
  isRenderRef?: boolean;
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part: unknown) => typeof part === "object" && part !== null && "type" in (part as Record<string, unknown>) && (part as Record<string, unknown>).type === "text")
      .map((part: Record<string, unknown>) => (part as Record<string, unknown>).text)
      .join(" ");
  }
  return String(content ?? "");
}

function stripRefAnnotations(text: string): string {
  return text.replace(/\[ref:\d+\]/g, "").trim();
}

export function MessageItem({
  message,
  onRegenerate,
  loading,
  cotContent,
  showCoT = true,
}: MessageItemProps) {
  const [showSources, setShowSources] = useState(false);
  const [showCoTDetails, setShowCoTDetails] = useState(true);
  const isAi = message.sender === "ai";
  const isUser = message.sender === "user";

  const handleCopy = async () => {
    const textContent = stripRefAnnotations(extractTextContent(message.content));
    try {
      await navigator.clipboard.writeText(textContent);
      toast.success("复制成功", { duration: 2000 });
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = textContent;
      textarea.style.position = "fixed";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("复制成功", { duration: 2000 });
    }
  };

  if (message.messageType === "status") {
    return (
      <div className="my-2">
        <div className="flex items-center text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
          <CheckIcon className="w-3 h-3 mr-1" />
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${isUser ? "mb-4" : "mb-6"}`}>
      <div className="w-full">
        <div
          className={`${isUser ? "bg-muted/50" : ""} ${message.isErrorMessage ? "bg-destructive/10" : ""} rounded-sm`}
        >
          {showCoT && isAi && (message.CoT || cotContent) && (
            <div className="border border-border/50">
              <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30"
                onClick={() => setShowCoTDetails((prev) => !prev)}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  思考过程
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${showCoTDetails ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
              {showCoTDetails && (
                <div className="px-3 pb-2">
                  <div className="text-xs text-muted-foreground p-2 rounded bg-muted/50">
                    <ChatMarkdown
                      content={message.CoT || cotContent || ""}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="px-3 py-2">
            <ChatMarkdown
              content={extractTextContent(message.content)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-1 px-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">
              {format(message.timestamp, "HH:mm")}
            </span>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleCopy}
            >
              <Copy size={12} />
            </Button>

            {isAi && onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onRegenerate}
                disabled={loading}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
              </Button>
            )}

            {isAi && message.sources && message.sources.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowSources((prev) => !prev)}
              >
                <Info size={12} />
                <span className="ml-1">{message.sources.length}</span>
              </Button>
            )}
          </div>
        </div>

        {isAi &&
          message.messageType === "content" &&
          message.sources &&
          showSources && (
            <div className="mt-2 px-3">
              <MessageSources
                sources={message.sources}
                content={extractTextContent(message.content)}
              />
            </div>
          )}
      </div>
    </div>
  );
}
