import { useEffect, useRef, useState } from "react";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    query,
    where,
} from "firebase/firestore";
import { db } from "~/services/firebase_app";
import { useAuth } from "~/services/firebase_provider";
import { normalizeStatus, type PatientStatus } from "~/types/status";
import { formatPersonName } from "~/utils/format_datetime";

export type UserProfile = {
    uid: string;
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    role?: "patient" | "social_worker" | "admin";
    status?: PatientStatus;
    assignedSocialWorkerId?: string;
    assignedSocialWorkerName?: string;
    isVerified?: boolean;
    isBanned?: boolean;
};

export type SocialWorkerOption = {
    id: string;
    name: string;
};

/**
 * Live patient profile plus the current-user profile and social worker list
 * needed to render and edit the patient controls panel.
 */
export function usePatientProfile(userId: string) {
    const { user } = useAuth();
    const [chatUserProfile, setChatUserProfile] = useState<UserProfile | null>(
        null
    );
    const [currentUserProfile, setCurrentUserProfile] =
        useState<UserProfile | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string>("");
    const [socialWorkers, setSocialWorkers] = useState<SocialWorkerOption[]>(
        []
    );
    const [selectedSocialWorkerId, setSelectedSocialWorkerId] = useState("");
    const [selectedStatus, setSelectedStatus] =
        useState<PatientStatus>("closed");
    const initializedWorkerRef = useRef(false);

    // Live-subscribe to the patient doc so the displayed status (and assignment)
    // always reflects the DB — including status changes made by Cloud Functions
    // when a new message arrives.
    useEffect(() => {
        if (!userId) {
            setChatUserProfile(null);
            return;
        }

        initializedWorkerRef.current = false;

        const unsubscribe = onSnapshot(
            doc(db, "users", userId),
            (snapshot) => {
                if (!snapshot.exists()) {
                    setChatUserProfile(null);
                    return;
                }

                const data = snapshot.data() as Omit<UserProfile, "uid">;
                setChatUserProfile({ uid: snapshot.id, ...data });
                setSelectedStatus(normalizeStatus(data.status));

                // Only seed the dropdown on first load so live updates don't
                // clobber an in-progress selection the user hasn't assigned yet.
                if (!initializedWorkerRef.current) {
                    setSelectedSocialWorkerId(
                        data.assignedSocialWorkerId ?? user?.uid ?? ""
                    );
                    initializedWorkerRef.current = true;
                }
            },
            () => {
                setChatUserProfile(null);
            }
        );

        return unsubscribe;
    }, [user?.uid, userId]);

    useEffect(() => {
        if (!user?.uid) return;

        let isActive = true;

        async function loadCurrentUserProfile() {
            const snapshot = await getDoc(doc(db, "users", user!.uid));
            if (!isActive || !snapshot.exists()) return;

            const d = snapshot.data() as Omit<UserProfile, "uid">;
            const profile = { uid: snapshot.id, ...d };
            const name = formatPersonName(profile);
            setCurrentUserProfile(profile);
            setCurrentUserName(name);
        }

        loadCurrentUserProfile().catch(() => {});

        return () => {
            isActive = false;
        };
    }, [user?.uid]);

    useEffect(() => {
        let isActive = true;

        async function loadSocialWorkers() {
            const snapshot = await getDocs(
                query(
                    collection(db, "users"),
                    where("role", "in", ["social_worker", "admin"]),
                    limit(100)
                )
            );
            if (!isActive) return;

            const options = snapshot.docs
                .map((workerDoc) => {
                    const data = workerDoc.data() as Omit<UserProfile, "uid">;
                    return {
                        id: workerDoc.id,
                        name: formatPersonName({
                            uid: workerDoc.id,
                            ...data,
                        }),
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name));

            setSocialWorkers(options);
        }

        loadSocialWorkers().catch(() => {
            if (isActive) setSocialWorkers([]);
        });

        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        if (!chatUserProfile?.assignedSocialWorkerId && user?.uid) {
            setSelectedSocialWorkerId(user.uid);
        }
    }, [chatUserProfile?.assignedSocialWorkerId, user?.uid]);

    return {
        chatUserProfile,
        setChatUserProfile,
        currentUserProfile,
        currentUserName,
        socialWorkers,
        selectedSocialWorkerId,
        setSelectedSocialWorkerId,
        selectedStatus,
        setSelectedStatus,
    };
}
