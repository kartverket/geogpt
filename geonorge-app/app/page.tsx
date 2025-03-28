"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import Demo from "./components/demo";
import { GeoNorgeTour } from "./components/GeoNorgeTour";
import { VersionDisplay } from "./components/VersionDisplay";

export default function Home() {
  return (
    <SidebarProvider>
      <Demo />
      <GeoNorgeTour />
      <VersionDisplay />
    </SidebarProvider>
  );
}
