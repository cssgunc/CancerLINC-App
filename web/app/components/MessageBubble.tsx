import type { ChatMessage } from "~/hooks/useChat";

interface MessageBubbleProps {
    message: ChatMessage;
    /** Sender label shown above the first bubble in a consecutive run. */
    senderLabel: string;
    /** True for the first message in a consecutive run from the same sender. */
    startsChunk: boolean;
    /** True for the last message in a consecutive run from the same sender. */
    endsChunk: boolean;
}

/**
 * A single chat bubble, grouped visually with consecutive messages from the
 * same sender via `startsChunk` / `endsChunk`.
 */
export default function MessageBubble({
    message,
    senderLabel,
    startsChunk,
    endsChunk,
}: MessageBubbleProps) {
    const isSent = message.direction === "sent";

    return (
        <div
            className={`flex ${isSent ? "justify-end" : "justify-start"} ${startsChunk ? "pt-4" : "pt-0.5"}`}
        >
            <div
                className={`max-w-[75%] ${isSent ? "items-end" : "items-start"} flex flex-col`}
            >
                {startsChunk && senderLabel ? (
                    <span className="mb-1 text-xs font-medium text-[#666666]">
                        {senderLabel}
                    </span>
                ) : null}
                <div
                    className={`rounded-2xl px-4 py-3 text-[16px] ${isSent ? "bg-black text-white" : "bg-[#F0F0F0] text-black"}`}
                >
                    {message.messageType === "image" ? (
                        message.imageUrl ? (
                            <img
                                src={message.imageUrl}
                                alt="Chat attachment"
                                className="max-h-72 rounded-xl object-cover"
                            />
                        ) : (
                            <span>Image unavailable</span>
                        )
                    ) : (
                        message.text
                    )}
                </div>
                {endsChunk ? (
                    <span
                        className={`mt-1 text-[16px] text-[#999999] ${isSent ? "text-right" : "text-left"}`}
                    >
                        {message.timestamp}
                    </span>
                ) : null}
                {endsChunk && isSent && message.isRead ? (
                    <span className="mt-0.5 text-xs text-[#999999] self-end">
                        Read
                    </span>
                ) : null}
            </div>
        </div>
    );
}
