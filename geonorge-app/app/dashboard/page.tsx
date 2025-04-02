import { SidebarProvider } from "@/components/ui/sidebar";
import Demo from "../components/demo";
export default function Page() {
  return (
    <SidebarProvider>
      <Demo />
    </SidebarProvider>
  );
}
