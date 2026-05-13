import { createContext, useContext, type ReactNode } from "react";
import type { ChatConfigType } from "./types";

const ChatConfigContext = createContext<ChatConfigType | null>(null);

export function ChatConfigProvider({
  config,
  children,
}: {
  config: ChatConfigType;
  children: ReactNode;
}) {
  return (
    <ChatConfigContext.Provider value={config}>
      {children}
    </ChatConfigContext.Provider>
  );
}

export function useChatConfig(): ChatConfigType {
  const config = useContext(ChatConfigContext);
  if (!config) {
    throw new Error("useChatConfig must be used within a ChatConfigProvider");
  }
  return config;
}
