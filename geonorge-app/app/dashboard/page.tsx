import { SidebarProvider } from "@/components/ui/sidebar";
import DemoV3 from "../components/DemoV3";

export default function Page() {
  return (
    <SidebarProvider>
      <DemoV3 />
    </SidebarProvider>
  );
}
