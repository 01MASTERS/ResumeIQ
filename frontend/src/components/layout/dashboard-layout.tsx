"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const isLandingPage = pathname === "/";

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [pathname]);

  // Landing page gets no chrome — full-screen layout
  if (isLandingPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative">
          {/* Ambient background glow */}
          <div className="pointer-events-none fixed top-0 right-0 w-[600px] h-[600px] bg-primary/[0.03] blur-[120px] rounded-full" />
          <div className="pointer-events-none fixed bottom-0 left-0 w-[400px] h-[400px] bg-accent/[0.02] blur-[100px] rounded-full" />
          <div className="relative z-10 p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
