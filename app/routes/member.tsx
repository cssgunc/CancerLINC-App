import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { ImagePlus, Send } from "lucide-react";
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
    serverTimestamp,
    setDoc,
    startAfter,
    Timestamp,
} from "firebase/firestore";
import { db } from "~/services/firebase_app";
import { useAuth } from "~/services/firebase_provider";

type ChatMessage = {
    id: string;
    direction: "sent" | "received";
    text: string;
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

function formatMessageTime(timestamp?: Timestamp) {
    if (!timestamp) return "";
    return timestamp.toDate().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });
}

export default function MemberPage() {
    const params = useParams();
    const { user } = useAuth();
    const userId = params.user ? decodeURIComponent(params.user) : "";
    const [chatUserProfile, setChatUserProfile] = useState<UserProfile | null>(
        null
    );
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const messageContainerRef = useRef<HTMLDivElement | null>(null);
    const oldestCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(
        null
    );

    const chatId = useMemo(() => {
        if (!user?.uid || !userId) return "";
        return [user.uid, userId].sort().join("__");
    }, [user?.uid, userId]);

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

    const mapMessageDoc = useCallback(
        (messageDoc: QueryDocumentSnapshot<DocumentData>): ChatMessage => {
            const data = messageDoc.data() as {
                senderId?: string;
                content?: string;
                timestamp?: Timestamp;
            };

            return {
                id: messageDoc.id,
                direction: data.senderId === user?.uid ? "sent" : "received",
                text: data.content ?? "",
                timestamp: formatMessageTime(data.timestamp),
            };
        },
        [user?.uid]
    );

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

            oldestCursorRef.current = snapshot.docs.at(-1) ?? null;
            setHasMoreMessages(snapshot.docs.length === PAGE_SIZE);
            setMessages(snapshot.docs.map(mapMessageDoc).reverse());
            scrollToBottom();
        } finally {
            setIsLoadingMessages(false);
        }
    }, [chatId, mapMessageDoc, scrollToBottom]);

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

            const olderMessages = snapshot.docs.map(mapMessageDoc).reverse();
            setMessages((current) => [...olderMessages, ...current]);

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
    }, [chatId, hasMoreMessages, isLoadingOlder, mapMessageDoc]);

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

    async function sendMessage() {
        const content = newMessage.trim();
        if (!content || !user?.uid || !userId || !chatId || isSending) return;

        const chatRef = doc(db, "chats", chatId);
        const messageRef = doc(collection(db, "chats", chatId, "messages"));

        setIsSending(true);

        try {
            await setDoc(messageRef, {
                messageId: messageRef.id,
                senderId: user.uid,
                content,
                timestamp: serverTimestamp(),
                isRead: false,
            });

            await setDoc(
                chatRef,
                {
                    chatId,
                    participants: [user.uid, userId].sort(),
                    lastMessage: content,
                    lastMessageTimestamp: serverTimestamp(),
                },
                { merge: true }
            );

            setNewMessage("");
            await loadInitialMessages();
        } catch {
            return;
        } finally {
            setIsSending(false);
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

                    <section className="flex h-[704px] w-full flex-col bg-white p-6 shadow-md">
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

                                    return (
                                        <div
                                            key={message.id}
                                            className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                                        >
                                            <div
                                                className={`max-w-[75%] ${isSent ? "items-end" : "items-start"} flex flex-col`}
                                            >
                                                <div
                                                    className={`rounded-2xl px-4 py-3 text-[16px] ${isSent ? "bg-black text-white" : "bg-[#F0F0F0] text-black"}`}
                                                >
                                                    {message.text}
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

                            <div className="mt-4 flex items-center gap-3">
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
                                >
                                    <ImagePlus size={22} />
                                </button>

                                <button
                                    type="button"
                                    className="flex h-12 w-12 items-center justify-center rounded-md bg-black text-white"
                                    aria-label="Send message"
                                    onClick={() => void sendMessage()}
                                    disabled={isSending || !newMessage.trim()}
                                >
                                    <Send size={22} />
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
