import { SidebarProvider } from "@/components/ui/sidebar";
import Demo from "../components/demov3";
export default function Page() {
  return (
    <SidebarProvider>
      <Demo />
    </SidebarProvider>
  );
}
