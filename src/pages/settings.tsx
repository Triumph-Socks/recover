import { useState } from "react";
import { Database, KeyRound, RotateCcw, ShieldCheck, Users2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useData } from "../store";
import type { Role, ScoreWeights } from "../lib/types";
import { fmtDateTime } from "../lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, Label, Select, Switch } from "../components/ui";
import { Avatar, PageContainer, ROLE_LABEL } from "../components/layout";

const ROLES: Role[] = ["SUPER_ADMIN", "MANAGER", "AGENT", "AGENCY", "LEGAL"];

const WEIGHT_ROWS: { key: keyof ScoreWeights; label: string }[] = [
  { key: "dpd", label: "Delinquency age weight" },
  { key: "balance", label: "Balance weight" },
  { key: "behavior", label: "Behavior weight" },
  { key: "recency", label: "Recency weight" },
];

export function SettingsPage() {
  const user = useAuth((s) => s.user)!;
  const { users, weights, bands } = useData();
  const { updateUserRole, toggleUserActive, setWeights, setBands, resetData } = useData();
  const [resetOpen, setResetOpen] = useState(false);

  const changeRole = (userId: string, role: Role, name: string) => {
    updateUserRole(userId, role);
    toast.success("Role updated", { description: `${name} is now ${ROLE_LABEL[role]}. RBAC applies on their next navigation.` });
  };

  const flipActive = (userId: string, name: string, active: boolean) => {
    toggleUserActive(userId);
    toast.info(active ? "User deactivated" : "User reactivated", { description: `${name} ${active ? "can no longer sign in" : "can sign in again"}.` });
  };

  return (
    <PageContainer>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* users */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><Users2 className="h-4 w-4 text-primary" /> Users & Roles</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Changes propagate to the RBAC middleware immediately</p>
            </div>
            <Badge variant="outline">{users.length} seats</Badge>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3">User</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Status</th><th className="py-2">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.name} size="sm" />
                          <div>
                            <p className="text-xs font-semibold leading-4">{u.name} {u.id === user.id && <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-primary">you</span>}</p>
                            <p className="text-[10px] text-muted-foreground">{u.email} · {u.title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Select
                          value={u.role}
                          disabled={u.id === user.id}
                          onChange={(e) => changeRole(u.id, e.target.value as Role, u.name)}
                          className="h-7 w-[168px] text-[11px] disabled:opacity-60"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </Select>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={u.active ? "emerald" : "neutral"}>{u.active ? "Active" : "Disabled"}</Badge>
                      </td>
                      <td className="py-2.5">
                        <Switch checked={u.active} onChange={() => flipActive(u.id, u.name, u.active)} label={`Toggle ${u.name}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {/* session */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-muted-foreground" /> Session</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar name={user.name} />
                <div>
                  <p className="text-[13px] font-semibold">{user.name}</p>
                  <p className="text-[11px] text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant="blue" className="ml-auto">{ROLE_LABEL[user.role]}</Badge>
              </div>
              <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
                <p className="flex justify-between"><span>Session started</span><span className="tnum font-medium text-foreground">{fmtDateTime(new Date().toISOString())}</span></p>
                <p className="flex justify-between"><span>MFA</span><span className="flex items-center gap-1 font-medium text-success"><ShieldCheck className="h-3 w-3" /> enforced</span></p>
                <p className="flex justify-between"><span>Audit logging</span><span className="font-medium text-foreground">on · 90 days</span></p>
              </div>
            </CardContent>
          </Card>

          {/* engine defaults */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">Scoring Engine Defaults</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Applies to the next allocation run</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {WEIGHT_ROWS.map((w) => (
                  <div key={w.key}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className="font-medium">{w.label}</span>
                      <span className="tnum font-semibold text-primary">{weights[w.key]}%</span>
                    </div>
                    <input type="range" min={0} max={50} value={weights[w.key]} onChange={(e) => setWeights({ ...weights, [w.key]: Number(e.target.value) })} className="w-full accent-blue-600" aria-label={w.label} />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div>
                    <div className="mb-1 flex justify-between text-[11px]"><span className="font-medium">Top band ≥</span><span className="tnum font-semibold text-success">{bands.top}</span></div>
                    <input type="range" min={55} max={95} value={bands.top} onChange={(e) => setBands({ ...bands, top: Number(e.target.value) })} className="w-full accent-emerald-600" aria-label="Top band" />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px]"><span className="font-medium">Standard ≥</span><span className="tnum font-semibold text-primary">{bands.standard}</span></div>
                    <input type="range" min={20} max={70} value={bands.standard} onChange={(e) => setBands({ ...bands, standard: Number(e.target.value) })} className="w-full accent-blue-600" aria-label="Standard band" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Persisted to the platform store — shared with all managers.</p>
              </div>
            </CardContent>
          </Card>

          {/* danger zone */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive"><Database className="h-4 w-4" /> Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Regenerates the entire demo dataset — accounts, payments, cases, write-offs and activity — from the deterministic seed script.
              </p>
              <Button variant="destructive" size="sm" className="mt-3" onClick={() => setResetOpen(true)}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} title="Reset demo data?" description="All runtime changes (payments, PTPs, allocations, cases) will be discarded.">
        <div className="space-y-3.5">
          <div className="rounded-md border border-rose-600/25 bg-rose-600/5 px-3 py-2.5 text-[11px] leading-relaxed text-rose-700 dark:text-rose-400">
            This mirrors dropping and re-seeding the PostgreSQL schema. Your session and role assignments are preserved; the default demo credentials remain unchanged.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetData();
                setResetOpen(false);
                toast.success("Dataset regenerated", { description: "260 accounts re-seeded from the Prisma seed script." });
              }}
            >
              <RotateCcw className="h-4 w-4" /> Yes, reset everything
            </Button>
          </div>
        </div>
      </Dialog>
    </PageContainer>
  );
}
