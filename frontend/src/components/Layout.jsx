import Navbar from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col grain">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Toaster position="bottom-right" richColors theme="dark" />
    </div>
  );
}
