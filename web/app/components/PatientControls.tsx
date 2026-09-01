import { type Dispatch, type SetStateAction, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { doc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "~/services/firebase_app";
import {
    PATIENT_STATUSES,
    statusLabel,
    type PatientStatus,
} from "~/types/status";
import { formatPersonName } from "~/utils/format_datetime";
import type {
    SocialWorkerOption,
    UserProfile,
} from "~/hooks/usePatientProfile";

interface PatientControlsProps {
    userId: string;
    chatUserProfile: UserProfile | null;
    setChatUserProfile: Dispatch<SetStateAction<UserProfile | null>>;
    currentUserProfile: UserProfile | null;
    socialWorkers: SocialWorkerOption[];
    selectedSocialWorkerId: string;
    setSelectedSocialWorkerId: (id: string) => void;
    selectedStatus: PatientStatus;
    setSelectedStatus: (status: PatientStatus) => void;
}

/**
 * Assignment / status / verify-deny panel for the patient being viewed on
 * the member page. Collapsed by default; expands to reveal the editable
 * controls.
 */
export default function PatientControls({
    userId,
    chatUserProfile,
    setChatUserProfile,
    currentUserProfile,
    socialWorkers,
    selectedSocialWorkerId,
    setSelectedSocialWorkerId,
    selectedStatus,
    setSelectedStatus,
}: PatientControlsProps) {
    const [controlsOpen, setControlsOpen] = useState(false);
    const [isSavingAssignment, setIsSavingAssignment] = useState(false);
    const [isSavingStatus, setIsSavingStatus] = useState(false);
    const [isSavingVerification, setIsSavingVerification] = useState(false);
    const [memberActionError, setMemberActionError] = useState("");

    async function handleAssignSocialWorker() {
        if (!userId || !selectedSocialWorkerId) return;

        const selectedWorker =
            socialWorkers.find(
                (worker) => worker.id === selectedSocialWorkerId
            ) ??
            (selectedSocialWorkerId === currentUserProfile?.uid
                ? {
                      id: currentUserProfile.uid,
                      name: formatPersonName(currentUserProfile),
                  }
                : null);

        if (!selectedWorker) {
            setMemberActionError("Select a social worker before assigning.");
            return;
        }

        setMemberActionError("");
        setIsSavingAssignment(true);

        try {
            await updateDoc(doc(db, "users", userId), {
                assignedSocialWorkerId: selectedWorker.id,
                assignedSocialWorkerName: selectedWorker.name,
            });
            setChatUserProfile((current) =>
                current
                    ? {
                          ...current,
                          assignedSocialWorkerId: selectedWorker.id,
                          assignedSocialWorkerName: selectedWorker.name,
                      }
                    : current
            );
        } catch {
            setMemberActionError(
                "Unable to assign the social worker right now. Please try again."
            );
        } finally {
            setIsSavingAssignment(false);
        }
    }

    async function handleStatusChange(nextStatus: PatientStatus) {
        if (!userId || nextStatus === selectedStatus) return;

        const previousStatus = selectedStatus;
        setMemberActionError("");
        setSelectedStatus(nextStatus);
        setIsSavingStatus(true);

        try {
            await updateDoc(doc(db, "users", userId), {
                status: nextStatus,
            });
            setChatUserProfile((current) =>
                current ? { ...current, status: nextStatus } : current
            );
        } catch {
            setSelectedStatus(previousStatus);
            setMemberActionError(
                "Unable to update the patient status right now. Please try again."
            );
        } finally {
            setIsSavingStatus(false);
        }
    }

    async function handleVerify() {
        if (!userId) return;

        const previousIsVerified = chatUserProfile?.isVerified;
        const previousIsBanned = chatUserProfile?.isBanned;
        setMemberActionError("");
        setChatUserProfile((current) =>
            current
                ? { ...current, isVerified: true, isBanned: false }
                : current
        );
        setIsSavingVerification(true);

        try {
            await updateDoc(doc(db, "users", userId), {
                isVerified: true,
                isBanned: false,
                updatedAt: Timestamp.now(),
            });
        } catch {
            setChatUserProfile((current) =>
                current
                    ? {
                          ...current,
                          isVerified: previousIsVerified,
                          isBanned: previousIsBanned,
                      }
                    : current
            );
            setMemberActionError(
                "Unable to verify the patient right now. Please try again."
            );
        } finally {
            setIsSavingVerification(false);
        }
    }

    async function handleDeny() {
        if (!userId) return;

        const previousIsVerified = chatUserProfile?.isVerified;
        const previousIsBanned = chatUserProfile?.isBanned;
        setMemberActionError("");
        setChatUserProfile((current) =>
            current
                ? { ...current, isBanned: true, isVerified: false }
                : current
        );
        setIsSavingVerification(true);

        try {
            await updateDoc(doc(db, "users", userId), {
                isBanned: true,
                isVerified: false,
                updatedAt: Timestamp.now(),
            });
        } catch {
            setChatUserProfile((current) =>
                current
                    ? {
                          ...current,
                          isVerified: previousIsVerified,
                          isBanned: previousIsBanned,
                      }
                    : current
            );
            setMemberActionError(
                "Unable to deny the patient right now. Please try again."
            );
        } finally {
            setIsSavingVerification(false);
        }
    }

    return (
        <section className="mb-5 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
            <button
                type="button"
                onClick={() => setControlsOpen((open) => !open)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] text-[#4B5563]">
                        <SlidersHorizontal size={18} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#666666]">
                            Patient Controls
                        </p>
                        <p className="text-sm text-[#4B5563]">
                            {chatUserProfile?.assignedSocialWorkerName ||
                                "All of Client Services"}{" "}
                            · {statusLabel(selectedStatus)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {memberActionError ? (
                        <span className="text-sm text-[#B42318]">
                            {memberActionError}
                        </span>
                    ) : null}
                    <ChevronDown
                        size={18}
                        className={`transition-transform ${
                            controlsOpen ? "rotate-180" : ""
                        }`}
                    />
                </div>
            </button>

            {controlsOpen ? (
                <div className="border-t border-[#E5E7EB] px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-[#666666]">
                                Assigned Social Worker
                            </span>
                            <select
                                value={selectedSocialWorkerId}
                                onChange={(e) =>
                                    setSelectedSocialWorkerId(e.target.value)
                                }
                                className="min-w-[220px] rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-green-600"
                                disabled={isSavingAssignment}
                            >
                                <option value="">All of Client Services</option>
                                {currentUserProfile?.uid &&
                                !socialWorkers.some(
                                    (worker) =>
                                        worker.id === currentUserProfile.uid
                                ) ? (
                                    <option value={currentUserProfile.uid}>
                                        {formatPersonName(currentUserProfile) ||
                                            "Current user"}
                                    </option>
                                ) : null}
                                {socialWorkers.map((worker) => (
                                    <option key={worker.id} value={worker.id}>
                                        {worker.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => void handleAssignSocialWorker()}
                                disabled={
                                    isSavingAssignment ||
                                    !selectedSocialWorkerId ||
                                    selectedSocialWorkerId ===
                                        chatUserProfile?.assignedSocialWorkerId
                                }
                                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSavingAssignment
                                    ? "Saving..."
                                    : selectedSocialWorkerId ===
                                        chatUserProfile?.assignedSocialWorkerId
                                      ? "Assigned"
                                      : "Assign"}
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-[#666666]">
                                Patient Status
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {PATIENT_STATUSES.map((status) => {
                                    const isActiveStatus =
                                        selectedStatus === status;
                                    return (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() =>
                                                void handleStatusChange(status)
                                            }
                                            disabled={isSavingStatus}
                                            className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors ${
                                                isActiveStatus
                                                    ? "bg-black text-white"
                                                    : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
                                            } disabled:cursor-not-allowed disabled:opacity-60`}
                                        >
                                            {statusLabel(status)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-[#666666]">
                                Verification
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {/* Current state pill */}
                                <span className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
                                    {chatUserProfile?.isBanned
                                        ? "Denied"
                                        : chatUserProfile?.isVerified
                                          ? "Verified"
                                          : "Unverified"}
                                </span>
                                {/* Verify action — hidden when already verified and not banned */}
                                {!chatUserProfile?.isVerified ||
                                chatUserProfile?.isBanned ? (
                                    <button
                                        type="button"
                                        onClick={() => void handleVerify()}
                                        disabled={isSavingVerification}
                                        className="rounded-full bg-[#F3F4F6] px-4 py-2 text-sm font-medium text-[#4B5563] capitalize transition-colors hover:bg-[#E5E7EB] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Verify
                                    </button>
                                ) : null}
                                {/* Deny action — hidden when already banned */}
                                {!chatUserProfile?.isBanned ? (
                                    <button
                                        type="button"
                                        onClick={() => void handleDeny()}
                                        disabled={isSavingVerification}
                                        className="rounded-full bg-[#F3F4F6] px-4 py-2 text-sm font-medium text-[#4B5563] capitalize transition-colors hover:bg-[#E5E7EB] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Deny
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
