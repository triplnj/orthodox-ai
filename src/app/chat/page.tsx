import { ChatBox } from "@/components/chat/ChatBox";
import { productCopy } from "@/lib/productCopy";

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <ChatBox
        contextKey="general"
        title="Ask OrthodoxAI"
        subtitle="Ask questions about Orthodox Christian prayer, fasting, Scripture, worship, saints, doctrine, or daily spiritual life."
     
      />

      <p className="mx-auto mt-6 max-w-3xl text-xs leading-5 text-gray-500">
        {productCopy.disclaimer}
      </p>
    </main>
  );
}