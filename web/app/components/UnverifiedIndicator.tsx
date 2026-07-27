import { useEffect, useState } from "react";
import { UserRoundCheck } from "lucide-react";
import { useMatch, useNavigate } from "react-router";
import {
    collection,
    getCountFromServer,
    query,
    where,
} from "firebase/firestore";
import { db } from "~/services/firebase_app";

export default function UnverifiedIndicator() {
    const navigate = useNavigate();
    const onUnverifiedPage = useMatch("/unverified");
    const [count, setCount] = useState(0);

    useEffect(() => {
        getCountFromServer(
            query(
                collection(db, "users"),
                where("role", "==", "patient"),
                where("isVerified", "==", false)
            )
        )
            .then((snap) => setCount(snap.data().count))
            .catch(() => {
                // Non-critical — badge stays hidden
            });
    }, []);

    return (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={() =>
                    onUnverifiedPage
                        ? navigate("/", { replace: true })
                        : navigate("/unverified")
                }
                aria-label={
                    onUnverifiedPage
                        ? "Back to dashboard"
                        : "Unverified patients"
                }
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            >
                <UserRoundCheck className="h-5 w-5" />
                {count > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white bg-amber-500">
                        {count}
                    </span>
                ) : null}
            </button>
        </div>
    );
}
