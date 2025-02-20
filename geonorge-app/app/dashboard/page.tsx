import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import DemoV3 from "../components/demov3";

export default function Page() {
  return (
    <SidebarProvider>
      <DemoV3 />
    </SidebarProvider>
  );
}
