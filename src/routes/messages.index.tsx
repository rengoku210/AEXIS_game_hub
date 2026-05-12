import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/messages/")({
  component: MessagesEmpty,
});

function MessagesEmpty() {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[60vh] p-8 text-muted-foreground">
      <MessageSquare className="size-10 mb-4 opacity-40" />
      <p className="font-mono text-[10px] uppercase tracking-widest mb-2">Select a conversation</p>
      <p className="text-sm">Pick a thread from the left, or start one from a listing or order.</p>
    </div>
  );
}