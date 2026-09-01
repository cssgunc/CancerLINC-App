import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    collection,
    type DocumentData,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    type QueryDocumentSnapshot,
    query,
    startAfter,
    Timestamp,
    writeBatch,
} from "firebase/firestore";
import { db } from "~/services/firebase_app";
import {
    ChatAttachmentValidationError,
    sendChatMessageWithOptionalImage,
    validateChatImageFile,
} from "~/services/chat_attachment_service";
import { useAuth } from "~/services/firebase_provider";
import type { UserProfile } from "~/hooks/usePatientProfile";
import { formatMessageDateTime } from "~/utils/format_datetime";

export type ChatMessage = {
    id: string;
    senderId: string;
    senderName: string;
    direction: "sent" | "received";
    messageType: "text" | "image";
    text: string;
    imageUrl?: string;
    clientBatchId?: string;
    clientOrder: number;
    sortTimestamp: number;
    timestamp: string;
    isRead: boolean;
};

const PAGE_SIZE = 20;

/**
 * Owns the message list for a patient's chat: the live subscription, older-page
 * loading, sender name resolution, read receipts, and sending (text and/or a
 * single image).
 */
export function useChat(userId: string, currentUserName: string) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState("");
    const [composerError, setComposerError] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [lastExportedAtMs, setLastExportedAtMs] = useState<number | null>(
        null
    );
    const [senderProfiles, setSenderProfiles] = useState<
        Record<string, string>
    >({});
    const messageContainerRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const oldestCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(
        null
    );
    const fetchedSenderIdsRef = useRef<Set<string>>(new Set());

    const chatId = useMemo(() => {
        return userId ?? "";
    }, [userId]);

    const mapMessageDoc = useCallback(
        (messageDoc: QueryDocumentSnapshot<DocumentData>): ChatMessage => {
            const data = messageDoc.data() as {
                senderId?: string;
                senderName?: string;
                content?: string;
                messageType?: "text" | "image";
                imageUrl?: string;
                clientBatchId?: string;
                clientOrder?: number;
                timestamp?: Timestamp;
                isRead?: boolean;
            };

            return {
                id: messageDoc.id,
                senderId: data.senderId ?? "",
                senderName: data.senderName ?? "",
                direction: data.senderId === user?.uid ? "sent" : "received",
                messageType: data.messageType ?? "text",
                text: data.content ?? "",
                imageUrl: data.imageUrl,
                clientBatchId: data.clientBatchId,
                clientOrder: data.clientOrder ?? 0,
                sortTimestamp: data.timestamp?.toMillis() ?? 0,
                timestamp: formatMessageDateTime(data.timestamp),
                isRead: data.isRead ?? false,
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
                                !fetchedSenderIdsRef.current.has(id)
                        )
                ),
            ];
            if (!unknownIds.length) return;

            unknownIds.forEach((id) => fetchedSenderIdsRef.current.add(id));

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
        [user?.uid, userId]
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

    const markReceivedMessagesRead = useCallback(
        (docs: QueryDocumentSnapshot<DocumentData>[]) => {
            if (!user?.uid) return;
            const unread = docs.filter((d) => {
                const data = d.data();
                return data.isRead === false && data.senderId !== user.uid;
            });
            if (!unread.length) return;
            const batch = writeBatch(db);
            unread.forEach((d) => batch.update(d.ref, { isRead: true }));
            void batch.commit();
        },
        [user?.uid]
    );

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
            markReceivedMessagesRead(snapshot.docs);
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
        markReceivedMessagesRead,
        sortMessagesAscending,
    ]);

    useEffect(() => {
        if (!chatId) {
            setMessages([]);
            setHasMoreMessages(false);
            oldestCursorRef.current = null;
            return;
        }

        setIsLoadingMessages(true);
        fetchedSenderIdsRef.current = new Set();

        const messagesRef = collection(db, "chats", chatId, "messages");
        const liveQuery = query(
            messagesRef,
            orderBy("timestamp", "desc"),
            limit(PAGE_SIZE)
        );

        const unsubscribe = onSnapshot(liveQuery, (snapshot) => {
            const mapped = sortMessagesAscending(
                snapshot.docs.map(mapMessageDoc)
            );
            oldestCursorRef.current = snapshot.docs.at(-1) ?? null;
            setHasMoreMessages(snapshot.docs.length === PAGE_SIZE);
            // Known bug: this replaces the list with only the newest page, discarding
            // older pages loaded by loadOlderMessages. Carried over unchanged during the
            // member.tsx split. See https://github.com/cssgunc/CancerLINC-App/issues/77
            setMessages(mapped);
            setIsLoadingMessages(false);
            scrollToBottom();
            void loadSenderProfiles(mapped);
            markReceivedMessagesRead(snapshot.docs);
        });

        return unsubscribe;
    }, [
        chatId,
        loadSenderProfiles,
        mapMessageDoc,
        markReceivedMessagesRead,
        scrollToBottom,
        sortMessagesAscending,
    ]);

    useEffect(() => {
        if (!chatId) {
            setLastExportedAtMs(null);
            return;
        }

        // lastTranscriptExportedAt is written exclusively by the
        // recordTranscriptExport Cloud Function — chatSummaryKeys() in
        // firestore.rules denies client writes to it, so this listener only
        // ever reads the watermark, never sets it server-side itself.
        const unsubscribe = onSnapshot(
            doc(db, "chats", chatId),
            (snapshot) => {
                // A chat doc with no messages yet doesn't exist; that's not
                // an error, it just means the transcript was never exported.
                if (!snapshot.exists()) {
                    setLastExportedAtMs(null);
                    return;
                }

                const data = snapshot.data() as {
                    lastTranscriptExportedAt?: Timestamp;
                };
                setLastExportedAtMs(
                    data.lastTranscriptExportedAt?.toMillis() ?? null
                );
            },
            () => {
                setLastExportedAtMs(null);
            }
        );

        return unsubscribe;
    }, [chatId]);

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
                senderName:
                    currentUserName || user.displayName || user.email || "",
                text: newMessage,
                imageFile: selectedImage,
            });
            setNewMessage("");
            clearSelectedImage();
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

    return {
        messages,
        newMessage,
        setNewMessage,
        selectedImage,
        selectedImagePreviewUrl,
        composerError,
        isSending,
        isLoadingMessages,
        isLoadingOlder,
        hasMoreMessages,
        lastExportedAtMs,
        setLastExportedAtMs,
        senderProfiles,
        messageContainerRef,
        fileInputRef,
        loadOlderMessages,
        clearSelectedImage,
        sendMessage,
        handleSelectImage,
        handleImageInputChange,
    };
}
