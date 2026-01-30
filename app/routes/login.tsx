import React from "react";

export default function CancerLINCLogin() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-gray-200 to-gray-500">
            <div className="bg-white w-full max-w-md p-8">
                <div className="flex flex-col items-center mb-6">
                    <img
                        src="/public/CancerLINC-Logo-1.png"
                        alt="CancerLINC Logo"
                        className="w-40 mb-4"
                    />
                    <h2 className="text-2xl text-gray-800">Login</h2>
                    <p className="text-gray-500 text-center text-sm mt-2">
                        Enter your email address and password to access your
                        account.
                    </p>
                </div>

                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        window.location.href = "/";
                    }}
                >
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address
                        </label>
                        <div className="flex items-center border rounded-lg px-3 py-2">
                            <span className="text-gray-400 mr-2 text-lg">
                                ✉
                            </span>
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="w-full outline-none text-gray-700"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <div className="flex items-center border rounded-lg px-3 py-2">
                            <span className="text-gray-400 mr-2 text-lg">
                                🔒
                            </span>
                            <input
                                type="password"
                                placeholder="Enter your password"
                                className="w-full outline-none text-gray-700"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" className="rounded" />
                            <span>Remember Me</span>
                        </label>
                        <a
                            href="/forgot-pass"
                            className="text-blue-600 hover:underline"
                        >
                            Forgot Password?
                        </a>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800"
                    >
                        LOGIN
                    </button>

                    <div className="flex items-center justify-center text-gray-500 text-sm mt-2">
                        <span className="mx-2">- OR -</span>
                    </div>

                    <button
                        type="button"
                        className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800"
                        onClick={() =>
                            (window.location.href = "/create-account")
                        }
                    >
                        CREATE AN ACCOUNT
                    </button>
                </form>
            </div>
        </div>
    );
}
