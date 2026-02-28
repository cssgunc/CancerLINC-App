import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "~/services/firebase_provider";
import { sendEmailVerification } from "firebase/auth";

export default function VerifyEmail() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [checkingVerification, setCheckingVerification] = useState(false);
    const [resendingEmail, setResendingEmail] = useState(false);

    const onClickContinue = async () => {
        if (!user) {
            alert("You’re not signed in. Please log in again.");
            navigate("/login");
            return;
        }

        setCheckingVerification(true);
        try {
            // Firebase doesn't automatically refresh `emailVerified` just because
            // the user clicked the verification link in a different tab/window.
            await user.reload();

            if (!user.emailVerified) {
                alert("Please verify your email before continuing.");
                return;
            }

            navigate("/");
        } finally {
            setCheckingVerification(false);
        }
    };

    const onClickResendEmail = async () => {
        if (!user) {
            alert("You’re not signed in. Please log in again.");
            navigate("/login");
            return;
        }

        setResendingEmail(true);
        try {
            await sendEmailVerification(user);
            alert("Verification email sent. Please check your inbox.");
        } finally {
            setResendingEmail(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-gray-200 to-gray-500">
            <div className="bg-white w-full max-w-md p-8">
                <Link to="/login">
                    <p className="text-gray-500 text-sm mt-2">
                        {"<"} Back to login
                    </p>
                </Link>
                <p>
                    <br></br>
                    <br></br>
                </p>
                <div className="flex flex-col items-center mb-6">
                    <h2 className="text-2xl text-gray-800">Verify Email</h2>
                    <p className="text-gray-500 text-center text-sm mt-2">
                        A verification link was sent to your email. Please click
                        the link to verify your account.
                    </p>
                </div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                    After clicking the link, click below.
                </label>

                <button
                    type="button"
                    className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800"
                    onClick={onClickContinue}
                    disabled={checkingVerification}
                >
                    {checkingVerification ? "CHECKING…" : "CONTINUE"}
                </button>
                <button
                    type="button"
                    className="text-gray-500 text-center text-sm mt-2 w-full"
                    onClick={onClickResendEmail}
                    disabled={resendingEmail}
                >
                    {resendingEmail ? "SENDING…" : "Send New Link"}
                </button>
            </div>
        </div>
    );
}
