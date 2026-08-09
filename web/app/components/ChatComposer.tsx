import type { ChangeEvent, RefObject } from "react";
import { ImagePlus, Send, X } from "lucide-react";
import {
    CHAT_ATTACHMENT_SETTINGS,
    formatMaxImageSizeLabel,
} from "~/services/chat_settings";

interface ChatComposerProps {
    newMessage: string;
    setNewMessage: (value: string) => void;
    selectedImage: File | null;
    selectedImagePreviewUrl: string;
    composerError: string;
    isSending: boolean;
    fileInputRef: RefObject<HTMLInputElement | null>;
    handleSelectImage: () => void;
    handleImageInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
    clearSelectedImage: () => void;
    sendMessage: () => Promise<void>;
}

/** Textarea, image picker + preview, and send button for the chat panel. */
export default function ChatComposer({
    newMessage,
    setNewMessage,
    selectedImage,
    selectedImagePreviewUrl,
    composerError,
    isSending,
    fileInputRef,
    handleSelectImage,
    handleImageInputChange,
    clearSelectedImage,
    sendMessage,
}: ChatComposerProps) {
    return (
        <div className="mt-auto">
            <div className="h-px w-full bg-[#D9D9D9]" />

            {selectedImage ? (
                <div className="mt-4 rounded-2xl border border-[#D9D9D9] bg-[#FAFAFA] p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-black">
                                Image ready to send
                            </p>
                            <p className="text-xs text-[#666666]">
                                {selectedImage.name}
                            </p>
                        </div>

                        <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#D9D9D9] bg-white text-black"
                            aria-label="Remove selected image"
                            onClick={clearSelectedImage}
                            disabled={isSending}
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {selectedImagePreviewUrl ? (
                        <img
                            src={selectedImagePreviewUrl}
                            alt="Selected attachment preview"
                            className="mt-3 max-h-56 rounded-xl object-cover"
                        />
                    ) : null}
                </div>
            ) : null}

            <div className="mt-4 flex items-center gap-3">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={CHAT_ATTACHMENT_SETTINGS.acceptedMimeTypes.join(
                        ","
                    )}
                    className="hidden"
                    onChange={handleImageInputChange}
                />

                <input
                    type="text"
                    placeholder="Type message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void sendMessage();
                        }
                    }}
                    className="h-12 flex-1 rounded-2xl border-0 bg-[#F0F0F0] px-4 text-base text-black placeholder:italic placeholder:text-[#999999] focus:outline-none"
                />

                <button
                    type="button"
                    className="flex h-12 w-12 items-center justify-center rounded-md bg-black text-white"
                    aria-label="Add photo"
                    onClick={handleSelectImage}
                    disabled={isSending}
                >
                    <ImagePlus size={22} />
                </button>

                <button
                    type="button"
                    className="flex h-12 w-12 items-center justify-center rounded-md bg-black text-white"
                    aria-label="Send message"
                    onClick={() => void sendMessage()}
                    disabled={
                        isSending || (!newMessage.trim() && !selectedImage)
                    }
                >
                    <Send size={22} />
                </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 text-xs text-[#666666]">
                <p>
                    One image per message. Max {formatMaxImageSizeLabel()}.
                    Allowed:{" "}
                    {CHAT_ATTACHMENT_SETTINGS.acceptedFileExtensionsLabel}
                </p>
                {composerError ? (
                    <p className="text-right text-[#B42318]">{composerError}</p>
                ) : null}
            </div>
        </div>
    );
}
