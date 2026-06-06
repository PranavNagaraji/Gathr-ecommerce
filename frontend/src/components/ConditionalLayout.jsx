'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

/**
 * ConditionalLayout — client component that wraps children with Navbar + Footer.
 * Uses usePathname() to hide nav/footer on auth pages (/sign-in, /sign-up).
 * This MUST be a separate file so the root layout.jsx stays a server component.
 */
export default function ConditionalLayout({ children }) {
  const pathname = usePathname();

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname?.startsWith('/sign-in') ||
    pathname?.startsWith('/sign-up');

  return (
    <>
      {!isAuthPage && <Navbar />}
      {children}
      {!isAuthPage && <Footer />}
    </>
  );
}
