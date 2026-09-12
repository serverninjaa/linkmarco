import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { HostGate, AdminOnlyHost } from "@/components/HostGate";
import PublicPortal from "@/pages/PublicPortal";
import AdminLogin from "@/pages/AdminLogin";
import AdminSites from "@/pages/AdminSites";
import AdminSiteEditor from "@/pages/AdminSiteEditor";
import AdminLibrary from "@/pages/AdminLibrary";
import AdminTemplates from "@/pages/AdminTemplates";
import AdminDomains from "@/pages/AdminDomains";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
// Kök adres Host'a göre dallanır (HostGate); /admin yalnızca panel domaininde açılır.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HostGate />} />
        <Route
          path="/admin/login"
          element={
            <AdminOnlyHost>
              <AdminLogin />
            </AdminOnlyHost>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminOnlyHost>
              <AdminSites />
            </AdminOnlyHost>
          }
        />
        <Route
          path="/admin/sites/:siteId"
          element={
            <AdminOnlyHost>
              <AdminSiteEditor />
            </AdminOnlyHost>
          }
        />
        <Route
          path="/admin/templates"
          element={
            <AdminOnlyHost>
              <AdminTemplates />
            </AdminOnlyHost>
          }
        />
        <Route
          path="/admin/library"
          element={
            <AdminOnlyHost>
              <AdminLibrary />
            </AdminOnlyHost>
          }
        />
        <Route
          path="/admin/domains"
          element={
            <AdminOnlyHost>
              <AdminDomains />
            </AdminOnlyHost>
          }
        />
        {/* Eski Cloudflare sayfası kaldırıldı — yeni sayfaya yönlendirilir */}
        <Route path="/admin/cloudflare" element={<Navigate to="/admin/domains" replace />} />
        <Route path="*" element={<PublicPortal />} />
      </Routes>
      <Toaster richColors />
    </>
  );
}
