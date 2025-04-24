"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import DemoV4 from "./components/demov4";
import { VersionDisplay } from "./components/VersionDisplay";

export default function Home() {
  return (
    <SidebarProvider>
      <div className="relative h-screen w-full">
        <DemoV4 />
      </div>
      <VersionDisplay />
    </SidebarProvider>
  );
}
