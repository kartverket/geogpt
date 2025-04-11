import { SidebarProvider } from "@/components/ui/sidebar";
import DemoV4 from "../components/demov4";
import { GeoNorgeTour } from "../components/GeoNorgeTour";

export default function Page() {
  return (
    <SidebarProvider>
      <div className="relative h-screen w-full">
        <DemoV4 />
      </div>
    </SidebarProvider>
  );
}
