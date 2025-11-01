import React from "react";

export default function CancerLINCForgotPassowrd() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-gray-200 to-gray-500">
            <div className="bg-white w-full max-w-md p-8">
                <a href="/">
                    <p
                        className="text-gray-500 text-sm mt-2"
                        text-gray-500
                        text-sm
                        mt-2
                    >
                        {"<"} Back to login
                    </p>
                </a>
                <p>
                    <br></br>
                    <br></br>
                </p>
                <div className="flex flex-col items-center mb-6">
                    <h2 className="text-2xl text-gray-800">Verify Email</h2>
                    <p className="text-gray-500 text-center text-sm mt-2">
                        A verification code was sent to xxxxx@email.com. Please
                        enter it below. <br></br>
                        The code will expire in 10 minutes.
                    </p>
                </div>

                <form className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Enter Verification Code
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
                        onClick={() => (window.location.href = "/")}
                    >
                        CONTINUE
                    </button>
                    <a href="/">
                        <p
                            className="text-gray-500 text-center text-sm mt-2"
                            text-gray-500
                            text-sm
                            mt-2
                        >
                            Send New Code
                        </p>
                    </a>
                    <p>
                        <br></br>
                    </p>
                </form>
            </div>
        </div>
    );
}
