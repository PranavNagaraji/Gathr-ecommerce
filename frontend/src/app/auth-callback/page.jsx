// Intermediate route used to set roles after successful signup
"use client";
import { useUser, useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";

export default function AuthCallbackPage() {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const [statusMsg, setStatusMsg] = useState("Finalizing your account…");

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Resolve intended role from priority order:
    // 1. URL param
    // 2. unsafeMetadata
    // 3. sessionStorage fallback
    // 4. existing publicMetadata
    const urlRole = searchParams.get("role");
    const metaRole = user.unsafeMetadata?.intended_role;
    const storageRole = (typeof window !== "undefined") ? sessionStorage.getItem("intended_role") : null;
    const existingRole = user.publicMetadata?.role;

    const role = urlRole || metaRole || storageRole || existingRole || "customer";

    if (typeof window !== "undefined") sessionStorage.removeItem("intended_role");

    const getDashboardPath = (targetRole) => {
      if (targetRole === "carrier") return "/carrier/createCarrier";
      if (targetRole === "merchant") return "/merchant/dashboard";
      return "/customer/dashboard";
    };

    const assignRoleAndRedirect = async () => {
      try {
        const shouldSetRole = !existingRole || (urlRole && urlRole !== existingRole) || (!urlRole && metaRole && metaRole !== existingRole) || (!urlRole && !metaRole && storageRole && storageRole !== existingRole);
        if (shouldSetRole && apiUrl) {
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
              timeout: 4000, // 4-second timeout max to prevent hanging
            }
          );
        }

        setStatusMsg("Redirecting…");
        window.location.href = getDashboardPath(role);
      } catch (err) {
        console.error("Error or timeout in auth-callback:", err);
        // Direct to role dashboard even if set-role API times out or fails (webhook / fallback sync handles Supabase)
        window.location.href = getDashboardPath(role);
      }
    };

    assignRoleAndRedirect();
  }, [user, isLoaded, searchParams, apiUrl, getToken]);

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
      <p className="text-gray-300 text-sm font-medium">{statusMsg}</p>
    </div>
  );
}
