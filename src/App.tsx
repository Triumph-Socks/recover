import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth, useUI } from "./store";
import { RequireRole, Shell } from "./components/layout";
import { CommandPalette } from "./components/command-palette";
import { LoginPage } from "./pages/login";
import { DashboardPage } from "./pages/dashboard";
import { PortfolioPage } from "./pages/portfolio";
import { Customer360Page } from "./pages/customer360";
import { WorklistPage } from "./pages/worklist";
import { CommsPage } from "./pages/comms";
import { AgenciesPage, LegalPage, WriteOffsPage } from "./pages/recovery";
import { SettingsPage } from "./pages/settings";

function Protected({ title, subtitle, roles, children }: { title: string; subtitle?: string; roles: import("./lib/types").Role[]; children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return (
    <RequireRole roles={roles}>
      <Shell title={title} subtitle={subtitle}>
        {children}
      </Shell>
      <CommandPalette />
    </RequireRole>
  );
}

export default function App() {
  const theme = useUI((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Protected title="Executive Dashboard" subtitle="Portfolio health · live recovery activity" roles={["SUPER_ADMIN", "MANAGER", "AGENT", "AGENCY", "LEGAL"]}><DashboardPage /></Protected>} />
        <Route path="/portfolio" element={<Protected title="Unified Portfolio" subtitle="All products · one ledger" roles={["SUPER_ADMIN", "MANAGER", "AGENT", "AGENCY", "LEGAL"]}><PortfolioPage /></Protected>} />
        <Route path="/customers/:cif" element={<Protected title="Customer 360" subtitle="Consolidated exposure per CIF" roles={["SUPER_ADMIN", "MANAGER", "AGENT", "AGENCY", "LEGAL"]}><Customer360Page /></Protected>} />
        <Route path="/worklist" element={<Protected title="AI Work Allocation" subtitle="Propensity engine · dynamic routing" roles={["SUPER_ADMIN", "MANAGER"]}><WorklistPage /></Protected>} />
        <Route path="/comms" element={<Protected title="Communication Hub" subtitle="Dialer · AI voice bot" roles={["SUPER_ADMIN", "MANAGER", "AGENT", "AGENCY"]}><CommsPage /></Protected>} />
        <Route path="/agencies" element={<Protected title="Agency Management" subtitle="External placement & performance" roles={["SUPER_ADMIN", "MANAGER", "AGENCY"]}><AgenciesPage /></Protected>} />
        <Route path="/legal" element={<Protected title="Legal Recovery" subtitle="Case lifecycle tracker" roles={["SUPER_ADMIN", "MANAGER", "LEGAL"]}><LegalPage /></Protected>} />
        <Route path="/writeoffs" element={<Protected title="Write-offs" subtitle="Multi-step approval matrix" roles={["SUPER_ADMIN", "MANAGER", "LEGAL"]}><WriteOffsPage /></Protected>} />
        <Route path="/settings" element={<Protected title="Administration" subtitle="Users · engine parameters" roles={["SUPER_ADMIN"]}><SettingsPage /></Protected>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster
        position="bottom-right"
        gap={8}
        toastOptions={{
          style: {
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            fontSize: "13px",
            borderRadius: "8px",
          },
        }}
      />
    </HashRouter>
  );
}
