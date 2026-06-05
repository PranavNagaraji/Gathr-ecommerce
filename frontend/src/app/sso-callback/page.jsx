"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * SSO Callback page.
 * Clerk redirects back to this URL after a successful OAuth handshake.
 * AuthenticateWithRedirectCallback finalises the session and then
 * redirects the user to the `redirectUrlComplete` set in authenticateWithRedirect.
 */
export default function SSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
