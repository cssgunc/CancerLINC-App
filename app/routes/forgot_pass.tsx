import React, { useState } from "react";
import { Link } from "react-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "~/services/firebase_app";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);

    const onClickContinue = async () => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            alert("Please enter your email.");
            return;
        }

        setSending(true);
        try {
            await sendPasswordResetEmail(auth, trimmedEmail);
            alert("Password reset email sent. Please check your inbox.");
        } finally {
            setSending(false);
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
                    <h2 className="text-2xl text-gray-800">Forgot Password?</h2>
                </div>

                <form className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Enter email associated with the account
                        </label>
                        <div className="flex items-center border rounded-lg px-3 py-2">
                            <input
                                type="email"
                                className="w-full outline-none text-gray-700"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800"
                        onClick={onClickContinue}
                        disabled={sending}
                    >
                        {sending ? "SENDING…" : "SEND EMAIL"}
                    </button>
                    <p>
                        <br></br>
                    </p>
                </form>
            </div>
        </div>
    );
}
