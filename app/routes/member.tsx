import React from "react";
import { ImagePlus, Send } from "lucide-react";

type ChatMessage = {
    id: string;
    direction: "sent" | "received";
    text: string;
    timestamp: string;
};

const CHAT_MESSAGES: ChatMessage[] = [
    {
        id: "1",
        direction: "received",
        text: "Hi there! Just checking in about tomorrow.",
        timestamp: "9:02 AM",
    },
    {
        id: "2",
        direction: "sent",
        text: "Thanks for reaching out — tomorrow works for me.",
        timestamp: "9:04 AM",
    },
    {
        id: "3",
        direction: "received",
        text: "Perfect. Can we meet around 10:30?",
        timestamp: "9:05 AM",
    },
    {
        id: "4",
        direction: "sent",
        text: "Yes, 10:30 is great. See you then!",
        timestamp: "9:07 AM",
    },
    {
        id: "5",
        direction: "received",
        text: "Awesome, I'll send the location shortly.",
        timestamp: "9:08 AM",
    },
    {
        id: "6",
        direction: "sent",
        text: "Sounds good. Thank you!",
        timestamp: "9:09 AM",
    },
];

export default function MemberPage() {
    return (
        <div
            className="min-h-screen bg-white px-8 py-10 text-black"
            style={{ fontFamily: "Inter, sans-serif" }}
        >
            <h1 className="text-center text-[32px] font-medium leading-tight text-black">
                Chat Box
            </h1>

            <div className="mx-auto mt-10 flex w-full max-w-[1400px] items-start justify-center gap-10">
                <div className="w-[25vw] min-w-[280px]">
                    <h2 className="mb-3 text-[24px] font-semibold leading-tight text-black">
                        Left Panel
                    </h2>

                    <section className="h-[72vh] w-full bg-white p-6 shadow-md" />
                </div>

                <div className="w-[33vw] min-w-[673px]">
                    <h2 className="mb-3 text-right text-[24px] font-semibold leading-tight text-black">
                        Right Panel
                    </h2>

                    <section className="flex h-[704px] w-full flex-col bg-white p-6 shadow-md">
                        <div className="flex-1 overflow-y-auto pr-1">
                            <div className="space-y-4 pb-6">
                                {CHAT_MESSAGES.map((message) => {
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
