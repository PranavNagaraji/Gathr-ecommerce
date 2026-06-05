//This is an intermediate route used to set the roles after successful signup
"use client";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";

export default function AuthCallbackPage() {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const [statusMsg, setStatusMsg] = useState("Finalizing your account…");

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Resolve the intended role from multiple sources in priority order:
    // 1. URL param  — reliable for email/password sign-up
    // 2. unsafeMetadata — written to Clerk BEFORE the OAuth redirect (survives the handshake)
    // 3. sessionStorage — local fallback stored just before the OAuth redirect
    // 4. existing publicMetadata — already-assigned role (sign-in case)
    const urlRole = searchParams.get("role");
    const metaRole = user.unsafeMetadata?.intended_role;
    const storageRole = (typeof window !== "undefined") ? sessionStorage.getItem("intended_role") : null;
    const existingRole = user.publicMetadata?.role;

    // Use URL param first; if missing (Clerk stripped it), fall back to unsafeMetadata / sessionStorage
    const role = urlRole || metaRole || storageRole || existingRole || "customer";

    // Clean up sessionStorage so it doesn't affect future sign-ins
    if (typeof window !== "undefined") sessionStorage.removeItem("intended_role");

    const assignRoleAndRedirect = async () => {
      try {
        // Only call set-role if the user has no role yet OR a non-customer role was explicitly passed
        const shouldSetRole = !existingRole || (urlRole && urlRole !== existingRole) || (!urlRole && metaRole && metaRole !== existingRole) || (!urlRole && !metaRole && storageRole && storageRole !== existingRole);
        if (shouldSetRole) {
          setStatusMsg("Setting up your account…");
          const token = await getToken();
          await axios.post(
            `${apiUrl}/set-role`,
            { userId: user.id, role },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );
        }

        // Navigate AFTER the backend has finished writing to both Clerk + Supabase
        // Use the effective role (newly set or existing) to pick the destination.
        // window.location.href forces a full page reload so Clerk re-issues the JWT
        // with the freshly-written publicMetadata — bypassing any stale token cache.
        setStatusMsg("Redirecting…");
        let dest = "/";
        if (role === "carrier") dest = "/carrier/createCarrier";
        else if (role === "merchant") dest = "/merchant/dashboard";
        else if (role === "customer") dest = "/customer/dashboard";
        window.location.href = dest;
      } catch (err) {
        console.error("Error in auth-callback:", err);
        // Still redirect even on error so the user isn't stuck
        window.location.href = "/";
      }
    };

    assignRoleAndRedirect();
  }, [user, isLoaded]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
      <svg
        className="animate-spin h-10 w-10 text-green-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <p className="text-gray-300 text-sm">{statusMsg}</p>
    </div>
  );
}
