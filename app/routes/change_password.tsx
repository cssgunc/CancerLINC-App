import React from "react";
import { Link, useNavigate } from "react-router";

export default function CancerLINCForgotPassowrd() {
    const navigate = useNavigate();
    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-gray-200 to-gray-500">
            <div className="bg-white w-full max-w-md p-8">
                <Link to="/">
                    <p
                        className="text-gray-500 text-sm mt-2"
                        text-gray-500
                        text-sm
                        mt-2
                    >
                        {"<"} Back to login
                    </p>
                </Link>
                <p>
                    <br></br>
                    <br></br>
                </p>
                <div className="flex flex-col items-center mb-6">
                    <h2 className="text-2xl text-gray-800">Change Password</h2>
                    <p className="text-gray-500 text-center text-sm mt-2">
                        Create a new password. It must include 12 characters and
                        at least one number.
                    </p>
                </div>

                <form className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            New Password
                        </label>
                        <div className="flex items-center border rounded-lg px-3 py-2">
                            <input
                                type="email"
                                className="w-full outline-none text-gray-700"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Retype New Password
                        </label>
                        <div className="flex items-center border rounded-lg px-3 py-2">
                            <input
                                type="email"
                                className="w-full outline-none text-gray-700"
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800"
                        onClick={() => navigate("/")}
                    >
                        LOGIN
                    </button>
                    <p>
                        <br></br>
                    </p>
                </form>
            </div>
        </div>
    );
}
