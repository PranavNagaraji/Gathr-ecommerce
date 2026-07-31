"use client";
import React, { useState, useEffect, useRef } from "react";
import { useSignUp } from "@clerk/nextjs";

const roleOptions = [
  {
    value: "customer",
    title: "Customer",
    description: "Shop and buy products from local merchants",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    value: "merchant",
    title: "Merchant",
    description: "Sell products & manage your store",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V5a2 2 0 012-2h2a2 2 0 012 2v6" />
      </svg>
    ),
  },
  {
    value: "carrier",
    title: "Carrier",
    description: "Deliver orders & earn on flexible shifts",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    ),
  },
];

const Signup = () => {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [role, setRole] = useState("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const confirmBtnRef = useRef(null);
  const roleCardContainerRef = useRef(null);

  // Keyboard accessibility for modal (Escape key listener)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showConfirmModal && e.key === "Escape") {
        setShowConfirmModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showConfirmModal]);

  // Focus trap / focus management when modal opens/closes
  useEffect(() => {
    if (showConfirmModal) {
      setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
    }
  }, [showConfirmModal]);

  if (!isLoaded) return null;

  const handleFormSubmitClick = (e) => {
    e.preventDefault();
    setError("");
    if (!role) {
      setError("Please select a role to continue.");
      return;
    }
    // Show confirmation modal before calling signUp.create()
    setShowConfirmModal(true);
  };

  const handleConfirmSignUp = async () => {
    setShowConfirmModal(false);
    setError("");
    setIsSubmitting(true);

    try {
      await signUp.create({
        emailAddress: email,
        password,
        unsafeMetadata: { intended_role: role },
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      console.error("Sign-up error:", JSON.stringify(err, null, 2));
      const clerkError = err.errors?.[0];
      const msg =
        clerkError?.longMessage ||
        clerkError?.message ||
        "Sign-up failed. Please try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelModal = () => {
    setShowConfirmModal(false);
    setTimeout(() => {
      roleCardContainerRef.current?.focus();
    }, 50);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({ code });
      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        window.location.href = `/auth-callback?role=${role}`;
      } else {
        setError("Verification could not be completed. Please try again.");
      }
    } catch (err) {
      console.error("Verification error:", JSON.stringify(err, null, 2));
      const clerkError = err.errors?.[0];
      const msg =
        clerkError?.longMessage ||
        clerkError?.message ||
        "Invalid code. Please try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async (provider) => {
    setError("");
    if (!role) {
      setError("Please select a role first to continue with OAuth.");
      return;
    }
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("intended_role", role);
      }
      await signUp.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: `/auth-callback?role=${role}`,
        unsafeMetadata: { intended_role: role },
      });
    } catch (err) {
      console.error("OAuth error:", JSON.stringify(err, null, 2));
      const clerkError = err.errors?.[0];
      const msg =
        clerkError?.longMessage ||
        clerkError?.message ||
        `Sign-up with ${provider.replace("oauth_", "")} failed.`;
      setError(msg);
    }
  };

  const selectedRoleObj = roleOptions.find((r) => r.value === role) || roleOptions[0];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-300 md:grid md:grid-cols-2 relative">
      <div className="flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white tracking-tight">Create your account</h2>
            <p className="text-gray-400 text-sm mt-1.5">
              Select your role, then continue with email or social sign in
            </p>
          </div>

          {/* Role selection radio-cards */}
          <div className="mb-6" ref={roleCardContainerRef} tabIndex={-1}>
            <label className="block text-sm font-semibold text-gray-200 mb-2.5">
              I want to join Gathr as:
            </label>
            <div className="grid grid-cols-1 gap-2.5" role="radiogroup" aria-label="Select your role">
              {roleOptions.map((r) => {
                const isSelected = role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setRole(r.value);
                      setError("");
                    }}
                    className={`flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition duration-200 cursor-pointer ${
                      isSelected
                        ? "border-green-500 bg-green-950/30 text-white ring-1 ring-green-500 shadow-md shadow-green-950/20"
                        : "border-gray-800 bg-gray-800/60 hover:bg-gray-800 hover:border-gray-700 text-gray-300"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-lg shrink-0 ${
                        isSelected ? "bg-green-600/20 text-green-400" : "bg-gray-700/50 text-gray-400"
                      }`}
                    >
                      {r.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-white">{r.title}</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? "border-green-500 bg-green-500" : "border-gray-600"
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-gray-950" />}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{r.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Social Auth */}
          <div className="flex flex-col gap-3 mb-6">
            <button
              type="button"
              disabled={!role}
              onClick={() => handleOAuth("oauth_google")}
              title={!role ? "Select a role first" : "Continue with Google"}
              className="w-full flex items-center justify-center gap-2.5 border border-gray-700 bg-gray-800/40 rounded-xl py-2.5 hover:bg-gray-800 transition text-sm font-medium text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                className="w-5 h-5"
              />
              <span>Continue with Google</span>
            </button>
            <button
              type="button"
              disabled={!role}
              onClick={() => handleOAuth("oauth_github")}
              title={!role ? "Select a role first" : "Continue with GitHub"}
              className="w-full flex items-center justify-center gap-2.5 border border-gray-700 bg-gray-800/40 rounded-xl py-2.5 hover:bg-gray-800 transition text-sm font-medium text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <img
                src="https://www.svgrepo.com/show/512317/github-142.svg"
                alt="GitHub"
                className="w-5 h-5 bg-white rounded-full"
              />
              <span>Continue with GitHub</span>
            </button>
          </div>

          <div className="relative flex items-center mb-6">
            <div className="flex-grow border-t border-gray-800"></div>
            <span className="mx-3 text-xs uppercase tracking-wider text-gray-500 font-medium">or email</span>
            <div className="flex-grow border-t border-gray-800"></div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 rounded-xl bg-red-950/60 border border-red-700/50 px-4 py-3 text-sm text-center text-red-400 font-medium">
              {error}
            </div>
          )}

          {!pendingVerification ? (
            <form onSubmit={handleFormSubmitClick} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 bg-gray-800/90 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-gray-800/90 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !role}
                className="w-full bg-green-600 text-white py-2.5 px-4 rounded-xl hover:bg-green-500 active:bg-green-700 transition font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-950/30 cursor-pointer"
              >
                {isSubmitting ? "Creating account…" : "Sign Up with Email"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Verification code sent to <span className="text-white font-medium">{email}</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  placeholder="Enter 6-digit code"
                  className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition tracking-widest text-center"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-green-600 text-white py-2.5 px-4 rounded-xl hover:bg-green-500 transition font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? "Verifying…" : "Verify & Continue"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPendingVerification(false);
                  setError("");
                }}
                className="w-full text-xs text-gray-400 hover:text-gray-200 transition py-1 cursor-pointer"
              >
                ← Back to registration
              </button>
            </form>
          )}

          {/* Footer */}
          <p className="text-xs text-gray-400 text-center mt-6">
            Already have an account?{" "}
            <a href="/sign-in" className="text-green-400 hover:underline font-semibold">
              Sign In
            </a>
          </p>
        </div>
      </div>

      <div className="relative hidden md:block">
        <img
          src="/sign-up.jpg"
          alt="Sign up background"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Role Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          onClick={handleCancelModal}
        >
          <div
            className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-2xl space-y-4 transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-950/60 border border-green-700/40 text-green-400 rounded-xl">
                {selectedRoleObj.icon}
              </div>
              <div>
                <h3 id="confirm-modal-title" className="text-lg font-bold text-white">
                  Confirm your role
                </h3>
                <p className="text-xs text-gray-400">Please confirm before proceeding</p>
              </div>
            </div>

            <div className="py-2 border-y border-gray-700/60 text-sm text-gray-300">
              You selected <span className="font-semibold text-white">{selectedRoleObj.title}</span> ({selectedRoleObj.description}). Is this correct?
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancelModal}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/70 hover:bg-gray-700 border border-gray-600/50 rounded-xl transition cursor-pointer"
              >
                No, go back
              </button>
              <button
                type="button"
                ref={confirmBtnRef}
                onClick={handleConfirmSignUp}
                className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 rounded-xl shadow-lg shadow-green-950/40 transition cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Signup;