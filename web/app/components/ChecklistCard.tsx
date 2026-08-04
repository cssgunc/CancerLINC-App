import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Checklist } from "~/types/checklist";

interface ChecklistCardProps {
    checklist: Checklist;
    onToggleItem: (index: number) => void;
    onEditItem: (index: number, text: string) => void;
    onDeleteItem: (index: number) => void;
    onAddItem: (text: string) => void;
    onEditDetails: (details: { title: string; subtitle: string }) => void;
    onArchive: () => void;
}

export default function ChecklistCard({
    checklist,
    onToggleItem,
    onEditItem,
    onDeleteItem,
    onAddItem,
    onEditDetails,
    onArchive,
}: ChecklistCardProps) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [itemDraft, setItemDraft] = useState("");
    const [newItemText, setNewItemText] = useState("");
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [isEditingDetails, setIsEditingDetails] = useState(false);
    const [titleDraft, setTitleDraft] = useState(checklist.title);
    const [subtitleDraft, setSubtitleDraft] = useState(checklist.subtitle);

    const completedCount = checklist.items.filter(
        (item) => item.checked
    ).length;

    function startEditingItem(index: number) {
        setEditingIndex(index);
        setItemDraft(checklist.items[index].text);
    }

    function commitItemEdit() {
        if (editingIndex === null) return;
        const text = itemDraft.trim();
        if (text && text !== checklist.items[editingIndex].text) {
            onEditItem(editingIndex, text);
        }
        setEditingIndex(null);
        setItemDraft("");
    }

    function commitNewItem() {
        const text = newItemText.trim();
        if (text) {
            onAddItem(text);
        }
        setNewItemText("");
        setIsAddingItem(false);
    }

    function startEditingDetails() {
        setTitleDraft(checklist.title);
        setSubtitleDraft(checklist.subtitle);
        setIsEditingDetails(true);
    }

    function cancelEditingDetails() {
        setTitleDraft(checklist.title);
        setSubtitleDraft(checklist.subtitle);
        setIsEditingDetails(false);
    }

    function commitDetails() {
        const title = titleDraft.trim();
        const subtitle = subtitleDraft.trim();

        // A checklist with no title is unidentifiable in the list, so an empty
        // title discards the edit rather than saving it. Subtitles are optional.
        if (!title) {
            cancelEditingDetails();
            return;
        }

        if (title !== checklist.title || subtitle !== checklist.subtitle) {
            onEditDetails({ title, subtitle });
        }
        setIsEditingDetails(false);
    }

    return (
        <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    {isEditingDetails ? (
                        <div className="space-y-1">
                            <input
                                autoFocus
                                value={titleDraft}
                                placeholder="Checklist title"
                                onChange={(event) =>
                                    setTitleDraft(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") commitDetails();
                                    if (event.key === "Escape")
                                        cancelEditingDetails();
                                }}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-[15px] font-bold text-gray-900 focus:border-gray-500 focus:outline-none"
                            />
                            <input
                                value={subtitleDraft}
                                placeholder="Subtitle (optional)"
                                onChange={(event) =>
                                    setSubtitleDraft(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") commitDetails();
                                    if (event.key === "Escape")
                                        cancelEditingDetails();
                                }}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-[13px] text-gray-600 focus:border-gray-500 focus:outline-none"
                            />
                        </div>
                    ) : (
                        <>
                            <h3 className="text-[15px] font-bold leading-tight text-gray-900">
                                {checklist.title || "Untitled checklist"}
                            </h3>

                            {checklist.subtitle ? (
                                <p className="mt-0.5 text-[13px] text-gray-500">
                                    {checklist.subtitle}
                                </p>
                            ) : null}
                        </>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    {isEditingDetails ? (
                        <>
                            <button
                                type="button"
                                onClick={commitDetails}
                                aria-label="Save checklist details"
                                className="p-1 text-gray-500 transition-colors hover:text-green-600"
                            >
                                <Check className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={cancelEditingDetails}
                                aria-label="Cancel checklist details edit"
                                className="p-1 text-gray-500 transition-colors hover:text-gray-900"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </>
                    ) : (
                        <>
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">
                                {completedCount}/{checklist.items.length}
                            </span>
                            <button
                                type="button"
                                onClick={startEditingDetails}
                                aria-label="Edit checklist title and subtitle"
                                className="p-1 text-gray-400 transition-colors hover:text-gray-700"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            `Remove the "${checklist.title || "Untitled"}" checklist from this patient's list? It will be archived, not permanently deleted.`
                                        )
                                    ) {
                                        onArchive();
                                    }
                                }}
                                aria-label="Archive checklist"
                                className="p-1 text-gray-400 transition-colors hover:text-red-600"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <ul className="mt-3 space-y-1">
                {checklist.items.length === 0 ? (
                    <li className="py-1 text-[13px] text-gray-500">
                        No items yet.
                    </li>
                ) : (
                    checklist.items.map((item, index) => (
                        <li
                            key={`${index}-${item.text}`}
                            className="group flex items-start gap-2 rounded px-1 py-1 hover:bg-gray-50"
                        >
                            <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={() => onToggleItem(index)}
                                aria-label={item.text}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[#A3D146]"
                            />

                            {editingIndex === index ? (
                                <div className="flex min-w-0 flex-1 items-center gap-1">
                                    <input
                                        autoFocus
                                        value={itemDraft}
                                        onChange={(event) =>
                                            setItemDraft(event.target.value)
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter")
                                                commitItemEdit();
                                            if (event.key === "Escape") {
                                                setEditingIndex(null);
                                                setItemDraft("");
                                            }
                                        }}
                                        className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-[14px] text-gray-900 focus:border-gray-500 focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={commitItemEdit}
                                        aria-label="Save item"
                                        className="p-1 text-gray-500 transition-colors hover:text-green-600"
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingIndex(null);
                                            setItemDraft("");
                                        }}
                                        aria-label="Cancel edit"
                                        className="p-1 text-gray-500 transition-colors hover:text-gray-900"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span
                                        className={`min-w-0 flex-1 text-[14px] leading-snug ${
                                            item.checked
                                                ? "text-gray-400 line-through"
                                                : "text-gray-900"
                                        }`}
                                    >
                                        {item.text}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                startEditingItem(index)
                                            }
                                            aria-label="Edit item"
                                            className="p-1 text-gray-400 transition-colors hover:text-gray-700"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDeleteItem(index)}
                                            aria-label="Delete item"
                                            className="p-1 text-gray-400 transition-colors hover:text-red-600"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))
                )}
            </ul>

            {isAddingItem ? (
                <div className="mt-2 flex items-center gap-1">
                    <input
                        autoFocus
                        value={newItemText}
                        placeholder="New item"
                        onChange={(event) => setNewItemText(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") commitNewItem();
                            if (event.key === "Escape") {
                                setNewItemText("");
                                setIsAddingItem(false);
                            }
                        }}
                        className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-[14px] text-gray-900 focus:border-gray-500 focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={commitNewItem}
                        aria-label="Save new item"
                        className="p-1 text-gray-500 transition-colors hover:text-green-600"
                    >
                        <Check className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setNewItemText("");
                            setIsAddingItem(false);
                        }}
                        aria-label="Cancel new item"
                        className="p-1 text-gray-500 transition-colors hover:text-gray-900"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsAddingItem(true)}
                    className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-gray-500 transition-colors hover:text-black"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add item
                </button>
            )}
        </article>
    );
}
