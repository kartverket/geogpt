"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import DemoV3 from "./components/demo";
import DemoV2 from "./dashboard/page";

export default function Home() {
  return (
    <SidebarProvider>
      <div className="relative h-screen w-full">
        <DemoV3 />
      </div>
    </SidebarProvider>
  );
}
