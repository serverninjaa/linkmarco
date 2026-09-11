import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import PublicPortal from "@/pages/PublicPortal";
import AdminLogin from "@/pages/AdminLogin";
import AdminSites from "@/pages/AdminSites";
import AdminSiteEditor from "@/pages/AdminSiteEditor";
import AdminLibrary from "@/pages/AdminLibrary";
import AdminCloudflare from "@/pages/AdminCloudflare";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<PublicPortal />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminSites />} />
        <Route path="/admin/sites/:siteId" element={<AdminSiteEditor />} />
        <Route path="/admin/library" element={<AdminLibrary />} />
        <Route path="/admin/cloudflare" element={<AdminCloudflare />} />
        <Route path="*" element={<PublicPortal />} />
      </Routes>
      <Toaster richColors />
    </>
  );
}
