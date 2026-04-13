import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { ImagePlus, Send, X } from "lucide-react";
import { useParams } from "react-router";
import {
    collection,
    type DocumentData,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    type QueryDocumentSnapshot,
    query,
    startAfter,
    Timestamp,
} from "firebase/firestore";
import { db } from "~/services/firebase_app";
import {
    CHAT_ATTACHMENT_SETTINGS,
    formatMaxImageSizeLabel,
} from "~/services/chat_settings";
import {
    ChatAttachmentValidationError,
    sendChatMessageWithOptionalImage,
    validateChatImageFile,
} from "~/services/chat_attachment_service";
import { useAuth } from "~/services/firebase_provider";

type ChatMessage = {
    id: string;
    senderId: string;
    direction: "sent" | "received";
    messageType: "text" | "image";
    text: string;
    imageUrl?: string;
    clientBatchId?: string;
    clientOrder: number;
    sortTimestamp: number;
    timestamp: string;
};

type UserProfile = {
    uid: string;
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
};

const PAGE_SIZE = 20;

function formatMessageDateTime(timestamp?: Timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const datePart = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });
    return `${datePart} · ${timePart}`;
}

export default function MemberPage() {
    const params = useParams();
    const { user } = useAuth();
    const userId = params.user ? decodeURIComponent(params.user) : "";
    const [chatUserProfile, setChatUserProfile] = useState<UserProfile | null>(
        null
    );
    const [currentUserName, setCurrentUserName] = useState<string>("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState("");
    const [composerError, setComposerError] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [senderProfiles, setSenderProfiles] = useState<
        Record<string, string>
    >({});
    const messageContainerRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const oldestCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(
        null
    );

    const chatId = useMemo(() => {
        return userId ?? "";
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            setChatUserProfile(null);
            return;
        }

        let isActive = true;

        async function loadUserProfile() {
            const snapshot = await getDoc(doc(db, "users", userId));
            if (!isActive) return;

            if (!snapshot.exists()) {
                setChatUserProfile(null);
                return;
            }

            const data = snapshot.data() as Omit<UserProfile, "uid">;
            setChatUserProfile({ uid: snapshot.id, ...data });
        }

        loadUserProfile().catch(() => {
            if (isActive) setChatUserProfile(null);
        });

        return () => {
            isActive = false;
        };
    }, [userId]);

    useEffect(() => {
        if (!user?.uid) return;

        let isActive = true;

        async function loadCurrentUserProfile() {
            const snapshot = await getDoc(doc(db, "users", user!.uid));
            if (!isActive || !snapshot.exists()) return;

            const d = snapshot.data() as Omit<UserProfile, "uid">;
            const name =
                `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() ||
                d.username ||
                d.email ||
                "";
            setCurrentUserName(name);
        }

        loadCurrentUserProfile().catch(() => {});

        return () => {
            isActive = false;
        };
    }, [user?.uid]);

    const mapMessageDoc = useCallback(
        (messageDoc: QueryDocumentSnapshot<DocumentData>): ChatMessage => {
            const data = messageDoc.data() as {
                senderId?: string;
                content?: string;
                messageType?: "text" | "image";
                imageUrl?: string;
                clientBatchId?: string;
                clientOrder?: number;
                timestamp?: Timestamp;
            };

            return {
                id: messageDoc.id,
                senderId: data.senderId ?? "",
                direction: data.senderId === user?.uid ? "sent" : "received",
                messageType: data.messageType ?? "text",
                text: data.content ?? "",
                imageUrl: data.imageUrl,
                clientBatchId: data.clientBatchId,
                clientOrder: data.clientOrder ?? 0,
                sortTimestamp: data.timestamp?.toMillis() ?? 0,
                timestamp: formatMessageDateTime(data.timestamp),
            };
        },
        [user?.uid]
    );

    const loadSenderProfiles = useCallback(
        async (msgs: ChatMessage[]) => {
            const unknownIds = [
                ...new Set(
                    msgs
                        .map((m) => m.senderId)
                        .filter(
                            (id) =>
                                id &&
                                id !== user?.uid &&
                                id !== userId &&
                                !(id in senderProfiles)
                        )
                ),
            ];
            if (!unknownIds.length) return;

            const fetched: Record<string, string> = {};
            await Promise.all(
                unknownIds.map(async (id) => {
                    try {
                        const snap = await getDoc(doc(db, "users", id));
                        if (snap.exists()) {
                            const d = snap.data() as Omit<UserProfile, "uid">;
                            const name =
                                `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() ||
                                d.username ||
                                d.email ||
                                id;
                            fetched[id] = name ?? id;
                        } else {
                            fetched[id] = id;
                        }
                    } catch {
                        fetched[id] = id;
                    }
                })
            );
            setSenderProfiles((prev) => ({ ...prev, ...fetched }));
        },
        [user?.uid, userId, senderProfiles]
    );

    const sortMessagesAscending = useCallback((items: ChatMessage[]) => {
        return [...items].sort((a, b) => {
            if (a.sortTimestamp !== b.sortTimestamp) {
                return a.sortTimestamp - b.sortTimestamp;
            }

            if ((a.clientBatchId ?? "") !== (b.clientBatchId ?? "")) {
                return (a.clientBatchId ?? "").localeCompare(
                    b.clientBatchId ?? ""
                );
            }

            return a.clientOrder - b.clientOrder;
        });
    }, []);

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            const container = messageContainerRef.current;
            if (!container) return;
            container.scrollTop = container.scrollHeight;
        });
    }, []);

    const loadInitialMessages = useCallback(async () => {
        if (!chatId) {
            setMessages([]);
            setHasMoreMessages(false);
            oldestCursorRef.current = null;
            return;
        }

        setIsLoadingMessages(true);

        try {
            const messagesRef = collection(db, "chats", chatId, "messages");
            const initialQuery = query(
                messagesRef,
                orderBy("timestamp", "desc"),
                limit(PAGE_SIZE)
            );
            const snapshot = await getDocs(initialQuery);

            const mapped = sortMessagesAscending(
                snapshot.docs.map(mapMessageDoc)
            );
            oldestCursorRef.current = snapshot.docs.at(-1) ?? null;
            setHasMoreMessages(snapshot.docs.length === PAGE_SIZE);
            setMessages(mapped);
            scrollToBottom();
            void loadSenderProfiles(mapped);
        } finally {
            setIsLoadingMessages(false);
        }
    }, [
        chatId,
        loadSenderProfiles,
        mapMessageDoc,
        scrollToBottom,
        sortMessagesAscending,
    ]);

    const loadOlderMessages = useCallback(async () => {
        if (
            !chatId ||
            !oldestCursorRef.current ||
            isLoadingOlder ||
            !hasMoreMessages
        ) {
            return;
        }

        const container = messageContainerRef.current;
        const previousScrollHeight = container?.scrollHeight ?? 0;
        const previousScrollTop = container?.scrollTop ?? 0;

        setIsLoadingOlder(true);

        try {
            const messagesRef = collection(db, "chats", chatId, "messages");
            const olderQuery = query(
                messagesRef,
                orderBy("timestamp", "desc"),
                startAfter(oldestCursorRef.current),
                limit(PAGE_SIZE)
            );
            const snapshot = await getDocs(olderQuery);

            if (!snapshot.docs.length) {
                setHasMoreMessages(false);
                return;
            }

            oldestCursorRef.current = snapshot.docs.at(-1) ?? null;
            setHasMoreMessages(snapshot.docs.length === PAGE_SIZE);

            const olderMessages = sortMessagesAscending(
                snapshot.docs.map(mapMessageDoc)
            );
            void loadSenderProfiles(olderMessages);
            setMessages((current) =>
                sortMessagesAscending([...olderMessages, ...current])
            );

            requestAnimationFrame(() => {
                const nextContainer = messageContainerRef.current;
                if (!nextContainer) return;

                const newScrollHeight = nextContainer.scrollHeight;
                nextContainer.scrollTop =
                    newScrollHeight - previousScrollHeight + previousScrollTop;
            });
        } finally {
            setIsLoadingOlder(false);
        }
    }, [
        chatId,
        hasMoreMessages,
        isLoadingOlder,
        loadSenderProfiles,
        mapMessageDoc,
        sortMessagesAscending,
    ]);

    useEffect(() => {
        void loadInitialMessages();
    }, [loadInitialMessages]);

    const chatUserFullName = useMemo(() => {
        if (!chatUserProfile) return "Unknown User";

        const fullName =
            `${chatUserProfile.firstName ?? ""} ${chatUserProfile.lastName ?? ""}`.trim();

        return fullName || "Unknown User";
    }, [chatUserProfile]);

    const chatUserFirstName = useMemo(() => {
        if (!chatUserProfile?.firstName?.trim()) return "User";
        return chatUserProfile.firstName.trim();
    }, [chatUserProfile]);

    useEffect(() => {
        if (!selectedImage) {
            setSelectedImagePreviewUrl("");
            return;
        }

        const objectUrl = URL.createObjectURL(selectedImage);
        setSelectedImagePreviewUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [selectedImage]);

    function clearSelectedImage() {
        setSelectedImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    async function sendMessage() {
        if (!user?.uid || !userId || !chatId || isSending) return;

        setComposerError("");
        setIsSending(true);

        try {
            await sendChatMessageWithOptionalImage({
                chatId,
                senderId: user.uid,
                text: newMessage,
                imageFile: selectedImage,
            });
            setNewMessage("");
            clearSelectedImage();
            await loadInitialMessages();
        } catch (error) {
            if (error instanceof ChatAttachmentValidationError) {
                setComposerError(error.message);
            } else {
                setComposerError(
                    "Unable to send the message right now. Please try again."
                );
            }
            return;
        } finally {
            setIsSending(false);
        }
    }

    function handleSelectImage() {
        fileInputRef.current?.click();
    }

    function handleImageInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setComposerError("");

        try {
            validateChatImageFile(file);
            setSelectedImage(file);
        } catch (error) {
            clearSelectedImage();
            if (error instanceof ChatAttachmentValidationError) {
                setComposerError(error.message);
                return;
            }

            setComposerError("Unable to attach that image.");
        }
    }

    function handleMessagesScroll(e: React.UIEvent<HTMLDivElement>) {
        if (e.currentTarget.scrollTop <= 80) {
            void loadOlderMessages();
        }
    }

    return (
        <div
            className="min-h-screen bg-white px-8 py-10 text-black"
            style={{ fontFamily: "Inter, sans-serif" }}
        >
            <h1 className="text-center text-[32px] font-medium leading-tight text-black">
                {chatUserFullName}
            </h1>

            <div className="mx-auto mt-10 flex w-full max-w-[1400px] items-start justify-center gap-10">
                <div className="w-[25vw] min-w-[280px]">
                    <h2 className="mb-3 text-[24px] font-semibold leading-tight text-black">
                        {chatUserFullName}&apos;s Referrals
                    </h2>

                    <section className="h-[72vh] w-full bg-white p-6 shadow-md" />
                </div>

                <div className="w-[33vw] min-w-[673px]">
                    <h2 className="mb-3 text-right text-[24px] font-semibold leading-tight text-black">
                        Chat with {chatUserFirstName}
                    </h2>

                    <section className="flex h-[72vh] min-h-[400px] w-full flex-col bg-white p-6 shadow-md">
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

                            <div className="space-y-4 pb-6">
                                {isLoadingMessages ? (
                                    <p className="text-center text-sm text-[#999999]">
                                        Loading messages...
                                    </p>
                                ) : null}

                                {messages.map((message) => {
                                    const isSent = message.direction === "sent";
                                    const isPatient =
                                        message.senderId === userId;
                                    const senderLabel = isSent
                                        ? currentUserName || "You"
                                        : isPatient
                                          ? chatUserFullName
                                          : (senderProfiles[message.senderId] ??
                                            message.senderId);

                                    return (
                                        <div
                                            key={message.id}
                                            className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                                        >
                                            <div
                                                className={`max-w-[75%] ${isSent ? "items-end" : "items-start"} flex flex-col`}
                                            >
                                                {senderLabel ? (
                                                    <span className="mb-1 text-xs font-medium text-[#666666]">
                                                        {senderLabel}
                                                    </span>
                                                ) : null}
                                                <div
                                                    className={`rounded-2xl px-4 py-3 text-[16px] ${isSent ? "bg-black text-white" : "bg-[#F0F0F0] text-black"}`}
                                                >
                                                    {message.messageType ===
                                                    "image" ? (
                                                        message.imageUrl ? (
                                                            <img
                                                                src={
                                                                    message.imageUrl
                                                                }
                                                                alt="Chat attachment"
                                                                className="max-h-72 rounded-xl object-cover"
                                                            />
                                                        ) : (
                                                            <span>
                                                                Image
                                                                unavailable
                                                            </span>
                                                        )
                                                    ) : (
                                                        message.text
                                                    )}
                                                </div>
                                                <span
                                                    className={`mt-1 text-[16px] text-[#999999] ${isSent ? "text-right" : "text-left"}`}
                                                >
                                                    {message.timestamp}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

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
                                    onChange={(e) =>
                                        setNewMessage(e.target.value)
                                    }
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
                                        isSending ||
                                        (!newMessage.trim() && !selectedImage)
                                    }
                                >
                                    <Send size={22} />
                                </button>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-4 text-xs text-[#666666]">
                                <p>
                                    One image per message. Max{" "}
                                    {formatMaxImageSizeLabel()}. Allowed:{" "}
                                    {
                                        CHAT_ATTACHMENT_SETTINGS.acceptedFileExtensionsLabel
                                    }
                                </p>
                                {composerError ? (
                                    <p className="text-right text-[#B42318]">
                                        {composerError}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
