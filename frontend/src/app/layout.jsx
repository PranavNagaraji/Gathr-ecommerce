// ✅ NO 'use client' here — root layout MUST be a server component in Next.js App Router.
// usePathname() lives inside ConditionalLayout.jsx (a separate 'use client' component).
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import UIProviders from "@/components/ui/UIProviders";
import ConditionalLayout from "@/components/ConditionalLayout";

export const metadata = {
  title: "Gathr",
  description: "Gathr — Your local marketplace",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Google Fonts */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&family=Playfair+Display:wght@400;600;700;900&display=swap"
            rel="stylesheet"
          />
        </head>

        <body>
          <div id="clerk-captcha" />
          <UIProviders>
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
          </UIProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
