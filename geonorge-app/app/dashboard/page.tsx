import { SidebarProvider } from "@/components/ui/sidebar";
import Demo from "../components/demo";
import { GeoNorgeTour } from "../components/GeoNorgeTour";

export default function Page() {
  return (
    <SidebarProvider>
      <Demo />
      {/* TOUR GUIDE IKKE RØRRRR */}
      <GeoNorgeTour />
    </SidebarProvider>
  );
}
