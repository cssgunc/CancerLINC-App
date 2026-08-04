import { useState } from "react";
import { Check, X } from "lucide-react";
import ChecklistCard from "~/components/ChecklistCard";
import CollapsibleSection from "~/components/CollapsibleSection";
import {
    addChecklist,
    addChecklistItem,
    archiveChecklist,
    deleteChecklistItem,
    editChecklistItem,
    toggleChecklistItem,
    updateChecklistDetails,
    useChecklists,
} from "~/hooks/useChecklists";

interface ChecklistWidgetProps {
    patientId: string;
    /** Used only for the section heading, e.g. "David's Checklists". */
    patientFirstName?: string;
}

export default function ChecklistWidget({
    patientId,
    patientFirstName,
}: ChecklistWidgetProps) {
    const { checklists, loading, error } = useChecklists(patientId);
    const [actionError, setActionError] = useState("");
    const [isAddingChecklist, setIsAddingChecklist] = useState(false);
    const [newChecklistTitle, setNewChecklistTitle] = useState("");

    const heading = patientFirstName
        ? `${patientFirstName}'s Checklists`
        : "Checklists";

    function run(action: () => Promise<unknown>) {
        setActionError("");
        void action().catch((err: unknown) => {
            console.error("Checklist action failed:", err);
            setActionError(
                err instanceof Error
                    ? err.message
                    : "Could not save the checklist change."
            );
        });
    }

    function cancelNewChecklist() {
        setNewChecklistTitle("");
        setIsAddingChecklist(false);
    }

    function commitNewChecklist() {
        const title = newChecklistTitle.trim();
        if (title) {
            run(() => addChecklist(patientId, { title }));
        }
        cancelNewChecklist();
    }

    return (
        <CollapsibleSection
            title={heading}
            actions={
                <button
                    type="button"
                    className="shrink-0 whitespace-nowrap text-sm font-medium text-gray-500 underline transition-colors hover:text-black"
                    onClick={() => setIsAddingChecklist(true)}
                >
                    + Add
                </button>
            }
        >
            {actionError ? (
                <p className="mb-3 text-sm text-red-600">{actionError}</p>
            ) : null}

            {isAddingChecklist ? (
                <div className="mb-3 flex items-center gap-1">
                    <input
                        autoFocus
                        value={newChecklistTitle}
                        placeholder="New checklist title"
                        onChange={(event) =>
                            setNewChecklistTitle(event.target.value)
                        }
                        onKeyDown={(event) => {
                            if (event.key === "Enter") commitNewChecklist();
                            if (event.key === "Escape") cancelNewChecklist();
                        }}
                        className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-[14px] text-gray-900 focus:border-gray-500 focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={commitNewChecklist}
                        aria-label="Save new checklist"
                        className="p-1 text-gray-500 transition-colors hover:text-green-600"
                    >
                        <Check className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={cancelNewChecklist}
                        aria-label="Cancel new checklist"
                        className="p-1 text-gray-500 transition-colors hover:text-gray-900"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : null}

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                {loading ? (
                    <p className="text-sm text-gray-500">
                        Loading checklists...
                    </p>
                ) : error ? (
                    <p className="text-sm text-red-600">
                        Could not load checklists: {error}
                    </p>
                ) : checklists.length === 0 ? (
                    <p className="text-sm text-gray-500">
                        No checklists found.
                    </p>
                ) : (
                    checklists.map((checklist) => (
                        <ChecklistCard
                            key={checklist.id}
                            checklist={checklist}
                            onToggleItem={(index) =>
                                run(() =>
                                    toggleChecklistItem(
                                        patientId,
                                        checklist,
                                        index
                                    )
                                )
                            }
                            onEditItem={(index, text) =>
                                run(() =>
                                    editChecklistItem(
                                        patientId,
                                        checklist,
                                        index,
                                        text
                                    )
                                )
                            }
                            onDeleteItem={(index) =>
                                run(() =>
                                    deleteChecklistItem(
                                        patientId,
                                        checklist,
                                        index
                                    )
                                )
                            }
                            onAddItem={(text) =>
                                run(() =>
                                    addChecklistItem(patientId, checklist, text)
                                )
                            }
                            onEditDetails={(details) =>
                                run(() =>
                                    updateChecklistDetails(
                                        patientId,
                                        checklist.id,
                                        details
                                    )
                                )
                            }
                            onArchive={() =>
                                run(() =>
                                    archiveChecklist(patientId, checklist.id)
                                )
                            }
                        />
                    ))
                )}
            </div>
        </CollapsibleSection>
    );
}
