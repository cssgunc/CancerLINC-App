import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { signUpWithEmail } from "~/services/auth_service";

export default function CreateAccount() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (isSubmitting) return;

        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!acceptedTerms) {
            setError("You must accept the Terms and Conditions.");
            return;
        }

        setIsSubmitting(true);
        try {
            await signUpWithEmail({
                email,
                password,
                displayName,
                remember: false,
            });
            navigate("/verify-email");
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to create account";
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-gray-200 to-gray-500">
            <div className="bg-white w-full max-w-md p-8">
                <Link to="/login">
                    <p className="text-gray-500 text-sm mt-2">
                        {"<"} Back to login
                    </p>
                </Link>

                <p>
                    <br />
                    <br />
                </p>

                <div className="flex flex-col items-center mb-6">
                    <h2 className="text-2xl text-gray-800">Create Account</h2>
                </div>

                <form className="space-y-4" onSubmit={onSubmit}>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                        </label>
                        <div className="flex items-center border rounded-lg px-3 py-2">
                            <input
                                type="email"
                                className="w-full outline-none text-gray-700"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Username
                        </label>
                        <div className="flex items-center border rounded-lg px-3 py-2">
                            <input
                                type="text"
                                className="w-full outline-none text-gray-700"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                autoComplete="username"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <div className="flex items-center border rounded-lg px-3 py-2">
                            <input
                                type="password"
                                className="w-full outline-none text-gray-700"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Confirm Password
                        </label>
                        <div className="flex items-center border rounded-lg px-3 py-2">
                            <input
                                type="password"
                                className="w-full outline-none text-gray-700"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                autoComplete="new-password"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <label className="flex items-start space-x-2">
                        <input
                            type="checkbox"
                            className="rounded mt-1"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            required
                            disabled={isSubmitting}
                        />
                        <span className="block text-sm font-medium text-gray-700">
                            I have read and consent to the{" "}
                            <a href="#" className="font-semibold underline">
                                Terms and Conditions
                            </a>
                        </span>
                    </label>

                    {error ? (
                        <p className="text-sm text-red-600">{error}</p>
                    ) : null}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        aria-busy={isSubmitting}
                        className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "SIGNING UP..." : "SIGN UP"}
                    </button>

                    <p>
                        <br />
                    </p>
                </form>
            </div>
        </div>
    );
}
