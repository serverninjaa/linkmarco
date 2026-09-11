import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost, ApiError } from "@/lib/api";
import type { AdminUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Globe } from "lucide-react";

export default function AdminLogin() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const login = useMutation({
    mutationFn: () => apiPost<AdminUser>("/auth/login", { username, password }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Giriş başarılı");
      navigate("/admin", { replace: true });
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? "Kullanıcı adı veya şifre hatalı" : "Bağlantı hatası";
      toast.error(msg);
    },
  });

  return (
    <div className="flex min-h-screen bg-[#090B10] text-slate-100">
      <div className="hidden flex-1 flex-col justify-between border-r border-[#1E293B] bg-[#0B0E17] p-12 lg:flex">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-amber-500" />
          <span className="font-heading text-xl font-extrabold tracking-tight">AdCore Backoffice</span>
        </div>
        <div className="space-y-5">
          <h1 className="font-heading text-4xl font-black leading-tight tracking-tight">
            Sınırsız domain,
            <br />
            <span className="text-amber-500">tek kontrol paneli.</span>
          </h1>
          <p className="max-w-md text-sm text-slate-400">
            Her domain için ayrı tema, ayrı reklam alanları ve ayrı karşılama pop-up'ı. Tümü bu panelden.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" /> httpOnly oturum çerezi ile korunur
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <form
          className="w-full max-w-sm space-y-5 rounded-2xl border border-[#1E293B] bg-[#121620] p-8"
          data-testid="admin-login-form"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
        >
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight">Yönetim Girişi</h2>
            <p className="mt-1 text-sm text-slate-400">Devam etmek için giriş yapın.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Kullanıcı Adı</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              data-testid="login-username-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="login-password-input"
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full bg-amber-500 font-bold text-black hover:bg-amber-400"
            disabled={login.isPending}
            data-testid="login-submit-button"
          >
            {login.isPending ? "Giriş yapılıyor..." : "GİRİŞ YAP"}
          </Button>
        </form>
      </div>
    </div>
  );
}
