"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import Demo from "./components/demo";

export default function Home() {
  return (
    <SidebarProvider>
      <div className="relative h-screen w-full">
        <Demo />
      </div>
    </SidebarProvider>
  );
}
