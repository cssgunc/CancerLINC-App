import type { UIEvent } from "react";
import MessageBubble from "~/components/MessageBubble";
import ChatComposer from "~/components/ChatComposer";
import { useChat } from "~/hooks/useChat";

interface ChatPanelProps {
    userId: string;
    chatUserFullName: string;
    currentUserName: string;
}

/** Chat column: heading, scrollable message list, and composer. */
export default function ChatPanel({
    userId,
    chatUserFullName,
    currentUserName,
}: ChatPanelProps) {
    const {
        messages,
        newMessage,
        setNewMessage,
        selectedImage,
        selectedImagePreviewUrl,
        composerError,
        isSending,
        isLoadingMessages,
        isLoadingOlder,
        senderProfiles,
        messageContainerRef,
        fileInputRef,
        loadOlderMessages,
        clearSelectedImage,
        sendMessage,
        handleSelectImage,
        handleImageInputChange,
    } = useChat(userId, currentUserName);

    function handleMessagesScroll(e: UIEvent<HTMLDivElement>) {
        if (e.currentTarget.scrollTop <= 80) {
            void loadOlderMessages();
        }
    }

    return (
        <div className="flex w-[50vw] min-w-[360px] max-w-[600px] flex-col">
            <h2 className="mb-3 text-right text-[24px] font-semibold leading-tight text-black">
                Chat with {chatUserFullName}
            </h2>

            <section className="flex flex-1 flex-col overflow-hidden bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                <div
                    ref={messageContainerRef}
                    onScroll={handleMessagesScroll}
                    className="flex-1 overflow-y-auto pr-1"
                >
                    {isLoadingOlder ? (
                        <p className="pb-3 text-center text-sm text-[#999999]">
                            Loading older messages...
                        </p>
                    ) : null}

                    {!isLoadingMessages && messages.length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-sm text-[#999999]">
                                No messages yet!
                            </p>
                        </div>
                    ) : null}

                    <div className="pb-6">
                        {isLoadingMessages ? (
                            <p className="text-center text-sm text-[#999999]">
                                Loading messages...
                            </p>
                        ) : null}

                        {messages.map((message, index) => {
                            const isSent = message.direction === "sent";
                            const isPatient = message.senderId === userId;
                            const nextMessage = messages[index + 1];
                            const previousMessage = messages[index - 1];
                            const startsChunk =
                                !previousMessage ||
                                previousMessage.senderId !== message.senderId;
                            const endsChunk =
                                !nextMessage ||
                                nextMessage.senderId !== message.senderId;
                            const senderLabel = isSent
                                ? currentUserName || message.senderName || "You"
                                : isPatient
                                  ? chatUserFullName
                                  : message.senderName ||
                                    senderProfiles[message.senderId] ||
                                    message.senderId ||
                                    "Unknown";

                            return (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    senderLabel={senderLabel}
                                    startsChunk={startsChunk}
                                    endsChunk={endsChunk}
                                />
                            );
                        })}
                    </div>
                </div>

                <ChatComposer
                    newMessage={newMessage}
                    setNewMessage={setNewMessage}
                    selectedImage={selectedImage}
                    selectedImagePreviewUrl={selectedImagePreviewUrl}
                    composerError={composerError}
                    isSending={isSending}
                    fileInputRef={fileInputRef}
                    handleSelectImage={handleSelectImage}
                    handleImageInputChange={handleImageInputChange}
                    clearSelectedImage={clearSelectedImage}
                    sendMessage={sendMessage}
                />
            </section>
        </div>
    );
}
