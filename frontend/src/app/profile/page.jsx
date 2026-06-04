"use client";

import { UserProfile } from "@clerk/nextjs";
import ProfileShell from "@/components/profile/ProfileShell";
import AddressManager from "@/components/profile/AddressManager";

function DotIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" className="h-3 w-3">
      <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z" />
    </svg>
  );
}

export default function ProfilePage() {
  return (
    <ProfileShell>
      <div className="flex flex-col items-stretch w-full">
        <UserProfile
          appearance={{
            variables: {
              colorPrimary: "var(--primary)",
              colorText: "var(--foreground)",
              colorBackground: "var(--card)",
              colorInputBackground: "var(--background)",
              colorInputText: "var(--foreground)",
              colorDanger: "var(--destructive)",
            },
            elements: {
              rootBox: "w-full",
              card: "w-full max-w-none bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] shadow-none rounded-xl",
              navbar: "bg-[var(--card)] flex flex-wrap justify-between items-center",
              headerTitle: "text-[var(--foreground)] text-lg sm:text-xl font-semibold",
              profileSection: "bg-[var(--card)] w-full",
              formButtonPrimary:
                "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity duration-200",
              input: "bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)] w-full",
            },
          }}
          routing="hash"
        >
          <UserProfile.Page label="Addresses" labelIcon={<DotIcon />} url="addresses">
            <AddressManager />
          </UserProfile.Page>
        </UserProfile>
      </div>
    </ProfileShell>
  );
}
