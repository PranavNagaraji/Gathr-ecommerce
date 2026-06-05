// app/sign-in/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image"; // Using next/image is better
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function CustomSignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [redirectingToSignUp, setRedirectingToSignUp] = useState(false);
  const router = useRouter();

  if (!isLoaded) {
    return null; // Or a loading spinner
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(""); // Clear previous errors

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        // Use window.location so the server middleware re-evaluates the session
        window.location.href = "/";
      } else if (result.status === "needs_second_factor") {
        setError("Two-factor authentication required. Please check your authenticator app.");
      } else {
        console.log("Sign-in incomplete:", result);
        setError("Sign-in could not be completed. Please try again.");
      }
    } catch (err) {
      console.error("Full sign-in error:", err);

      const clerkError = err.errors?.[0];
      const code = clerkError?.code;

      // Account does not exist → guide to sign-up
      if (code === "form_identifier_not_found") {
        setRedirectingToSignUp(true);
        setError("No account found with this email.");
        // Auto-redirect after 2.5 seconds so the user sees the message
        setTimeout(() => {
          router.push("/sign-up");
        }, 2500);
        return;
      }

      // Wrong password
      if (code === "form_password_incorrect") {
        setError("Incorrect password. Please try again.");
        return;
      }

      // Too many attempts
      if (code === "too_many_requests") {
        setError("Too many login attempts. Please wait a moment and try again.");
        return;
      }

      // Generic fallback — extract the most useful message from Clerk's error shape
      const message =
        clerkError?.longMessage ||
        clerkError?.message ||
        clerkError?.shortMessage ||
        "Sign-in failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    setError("");
    try {
      await signIn.authenticateWithRedirect({
        strategy: provider,
        // redirectUrl is the intermediate SSO callback Clerk needs to complete the handshake
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err) {
      console.error("OAuth error:", err);
      const errorMessage =
        err.errors?.[0]?.longMessage ||
        err.errors?.[0]?.message ||
        `Sign-in with ${provider.replace("oauth_", "")} failed.`;
      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-300 md:grid md:grid-cols-2">
      <div className="relative hidden md:block">
        {/* Recommended to use next/image */}
        <Image
          src="/sign-in.jpg" // Make sure this is in your /public folder
          alt="Sign in"
          layout="fill"
          objectFit="cover"
          priority
        />
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
            <p className="text-gray-400 text-sm mt-1">
              Sign in to continue to your account
            </p>
          </div>

          <div className="flex flex-col gap-3 mb-6">
            <button
              onClick={() => handleOAuth("oauth_google")}
              className="w-full flex items-center justify-center gap-2 border border-gray-700 rounded-lg py-2 hover:bg-gray-800 transition"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                className="w-5 h-5"
              />
              <span className="text-sm font-medium text-gray-200">
                Continue with Google
              </span>
            </button>

            <button
              onClick={() => handleOAuth("oauth_github")}
              className="w-full flex items-center justify-center gap-2 border border-gray-700 rounded-lg py-2 hover:bg-gray-800 transition"
            >
              <img
                src="https://www.svgrepo.com/show/512317/github-142.svg"
                alt="GitHub"
                className="w-5 h-5 bg-white rounded-full"
              />
              <span className="text-sm font-medium text-gray-200">
                Continue with GitHub
              </span>
            </button>
          </div>

          <div className="relative flex items-center mb-6">
            <div className="flex-grow border-t border-gray-700"></div>
            <span className="mx-2 text-sm text-gray-500">OR</span>
            <div className="flex-grow border-t border-gray-700"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Display error message here */}
            {error && (
              <div className="rounded-lg bg-red-950/60 border border-red-700/50 px-4 py-3 text-sm text-center text-red-400">
                <p>{error}</p>
                {redirectingToSignUp && (
                  <p className="mt-1.5 text-red-300">
                    Redirecting to sign-up…{" "}
                    <Link href="/sign-up" className="underline font-medium text-red-200 hover:text-white">
                      Go now
                    </Link>
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-green-800 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <p className="text-sm text-gray-400 text-center mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="text-green-400 hover:underline font-medium"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  ); 
}