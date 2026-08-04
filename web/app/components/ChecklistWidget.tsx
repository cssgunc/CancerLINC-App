import React, { useState } from "react";
import ChecklistCard from "~/components/ChecklistCard";
import CollapsibleSection from "~/components/CollapsibleSection";
import {
    addChecklist,
    addChecklistItem,
    deleteChecklist,
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

    return (
        <CollapsibleSection
            title={heading}
            actions={
                <button
                    type="button"
                    className="shrink-0 whitespace-nowrap text-sm font-medium text-gray-500 underline transition-colors hover:text-black"
                    onClick={() => {
                        const title = window.prompt("New checklist title");
                        if (title && title.trim()) {
                            run(() =>
                                addChecklist(patientId, { title: title.trim() })
                            );
                        }
                    }}
                >
                    + Add
                </button>
            }
        >
            {actionError ? (
                <p className="mb-3 text-sm text-red-600">{actionError}</p>
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
                            onRename={(title) =>
                                run(() =>
                                    updateChecklistDetails(
                                        patientId,
                                        checklist.id,
                                        { title }
                                    )
                                )
                            }
                            onDelete={() =>
                                run(() =>
                                    deleteChecklist(patientId, checklist.id)
                                )
                            }
                        />
                    ))
                )}
            </div>
        </CollapsibleSection>
    );
}
