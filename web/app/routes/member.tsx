import { useMemo, useState } from "react";
import { useParams } from "react-router";
import ChatPanel from "~/components/ChatPanel";
import ChecklistWidget from "~/components/ChecklistWidget";
import CollapsibleSection from "~/components/CollapsibleSection";
import PatientControls from "~/components/PatientControls";
import ReferralCard from "~/components/ReferralCard";
import ReferralFormDialog from "~/components/ReferralFormDialog";
import { usePatientProfile } from "~/hooks/usePatientProfile";
import {
    useReferrals,
    addReferral,
    editReferral,
    deleteReferral,
    type ReferralFormData,
} from "~/hooks/useReferrals";
import type { ReferralWithProvider } from "~/types/referral";
import { useAuth } from "~/services/firebase_provider";

export default function MemberPage() {
    const params = useParams();
    const { user } = useAuth();
    const userId = params.user ? decodeURIComponent(params.user) : "";
    const {
        chatUserProfile,
        setChatUserProfile,
        currentUserProfile,
        currentUserName,
        socialWorkers,
        selectedSocialWorkerId,
        setSelectedSocialWorkerId,
        selectedStatus,
        setSelectedStatus,
    } = usePatientProfile(userId);
    const [editingReferral, setEditingReferral] =
        useState<ReferralWithProvider | null>(null);
    const [referralDialogMode, setReferralDialogMode] = useState<
        "add" | "edit" | null
    >(null);
    const { referrals } = useReferrals(userId);

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

    return (
        <div
            className="flex h-full flex-col overflow-hidden px-4 pb-3 pt-5 text-black"
            style={{ fontFamily: "Inter, sans-serif" }}
        >
            <div className="mx-auto flex w-[84vw] max-w-[1400px] flex-1 flex-col min-h-0 pb-2">
                <PatientControls
                    userId={userId}
                    chatUserProfile={chatUserProfile}
                    setChatUserProfile={setChatUserProfile}
                    currentUserProfile={currentUserProfile}
                    socialWorkers={socialWorkers}
                    selectedSocialWorkerId={selectedSocialWorkerId}
                    setSelectedSocialWorkerId={setSelectedSocialWorkerId}
                    selectedStatus={selectedStatus}
                    setSelectedStatus={setSelectedStatus}
                />

                <div className="flex flex-1 items-stretch justify-center gap-6 min-h-0">
                    {/* Referrals + checklists column */}
                    <div className="flex w-[25vw] min-w-[260px] flex-col gap-4 overflow-y-auto">
                        <CollapsibleSection
                            title={`${chatUserFirstName}'s Referrals`}
                            actions={
                                <button
                                    className="shrink-0 whitespace-nowrap text-sm font-medium text-gray-500 underline transition-colors hover:text-black"
                                    onClick={() => {
                                        setEditingReferral(null);
                                        setReferralDialogMode("add");
                                    }}
                                >
                                    + Add
                                </button>
                            }
                        >
                            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                                {referrals.length === 0 ? (
                                    <p className="text-sm text-gray-500">
                                        No referrals found.
                                    </p>
                                ) : (
                                    referrals.map((referral) => (
                                        <ReferralCard
                                            key={referral.id}
                                            referral={referral}
                                            onEdit={() => {
                                                setEditingReferral(referral);
                                                setReferralDialogMode("edit");
                                            }}
                                            onDelete={(id) =>
                                                void deleteReferral(userId, id)
                                            }
                                        />
                                    ))
                                )}
                            </div>
                        </CollapsibleSection>

                        <ChecklistWidget
                            patientId={userId}
                            patientFirstName={chatUserFirstName}
                        />
                    </div>

                    <ChatPanel
                        userId={userId}
                        chatUserFullName={chatUserFullName}
                        currentUserName={currentUserName}
                        patientEmail={chatUserProfile?.email ?? ""}
                        currentUserEmail={user?.email ?? ""}
                        currentUserId={user?.uid ?? ""}
                    />
                </div>
            </div>

            <ReferralFormDialog
                open={referralDialogMode !== null}
                onClose={() => {
                    setReferralDialogMode(null);
                    setEditingReferral(null);
                }}
                onSubmit={async (data: ReferralFormData) => {
                    if (referralDialogMode === "edit" && editingReferral) {
                        await editReferral(userId, editingReferral.id, data);
                    } else {
                        await addReferral(userId, data);
                    }
                    setReferralDialogMode(null);
                    setEditingReferral(null);
                }}
                initialData={
                    referralDialogMode === "edit" ? editingReferral : null
                }
                title={
                    referralDialogMode === "edit"
                        ? "Edit Referral"
                        : "Add Referral"
                }
                patientId={userId}
                socialWorkerId={user?.uid ?? ""}
            />
        </div>
    );
}
