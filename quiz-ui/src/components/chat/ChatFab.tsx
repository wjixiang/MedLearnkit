import { useChatSidebar } from "./ChatSidebarContext";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatFab() {
  const { open, toggle, loading } = useChatSidebar();

  if (open || loading) return null;

  return (
    <Button
      onClick={toggle}
      size="icon"
      className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg transition-transform hover:scale-110"
    >
      <MessageSquare size={22} />
    </Button>
  );
}
