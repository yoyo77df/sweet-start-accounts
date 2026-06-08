import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, CreditCard, Package, BarChart3, Check, X, Plus, Trash2, Coins, Image as ImageIcon, Bell, Video, Sparkles, Wand2, Palette, Search, ImagePlus, Megaphone, Paintbrush } from "lucide-react";
import { RESOLUTIONS, type Resolution } from "@/lib/resolutions";
import { useServerFn } from "@tanstack/react-start";
import { aiExtractBackground, aiGenerateTemplate, aiGenerateBatch, aiGenerateVariants } from "@/lib/ai-template.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Point Arena" }] }),
  component: AdminPage,
});

type Stats = {
  users: number; downloads: number; revenue: number; templates: number;
  credits_sold: number; pending_payments: number; approved_payments: number; tables: number;
};

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !isAdmin) nav({ to: "/dashboard" }); }, [loading, isAdmin, nav]);
  if (loading || !isAdmin) return <div className="text-muted-foreground">Loading…</div>;
  return (
    <div>
      <h1 className="text-3xl font-bold">Admin Panel</h1>
      <p className="text-muted-foreground mt-1">Manage users, payments, packages & analytics.</p>
      <Tabs defaultValue="analytics" className="mt-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-1.5" />Analytics</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="h-4 w-4 mr-1.5" />Payments</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" />Users</TabsTrigger>
          <TabsTrigger value="packages"><Package className="h-4 w-4 mr-1.5" />Packages</TabsTrigger>
          <TabsTrigger value="templates"><ImageIcon className="h-4 w-4 mr-1.5" />Templates</TabsTrigger>
          <TabsTrigger value="aibatch"><Wand2 className="h-4 w-4 mr-1.5" />AI Batch</TabsTrigger>
          <TabsTrigger value="newai"><Palette className="h-4 w-4 mr-1.5" />New AI</TabsTrigger>
          <TabsTrigger value="thumbnails"><ImagePlus className="h-4 w-4 mr-1.5" />Logo Permission</TabsTrigger>
          <TabsTrigger value="notify"><Bell className="h-4 w-4 mr-1.5" />Notify</TabsTrigger>
          <TabsTrigger value="announce"><Megaphone className="h-4 w-4 mr-1.5" />Announcements</TabsTrigger>
          <TabsTrigger value="theme"><Paintbrush className="h-4 w-4 mr-1.5" />Theme</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        <TabsContent value="payments"><PaymentsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="packages"><PackagesTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="aibatch"><AiBatchTab /></TabsContent>
        <TabsContent value="newai"><NewAiTab /></TabsContent>
        <TabsContent value="thumbnails"><ThumbnailAccessTab /></TabsContent>
        <TabsContent value="notify"><NotifyTab /></TabsContent>
        <TabsContent value="announce"><AnnouncementTab /></TabsContent>
        <TabsContent value="theme"><ThemeTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function AnalyticsTab() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    supabase.rpc("admin_stats").then(({ data, error }) => {
      if (error) return toast.error(error.message);
      setS(data as unknown as Stats);
    });
  }, []);
  if (!s) return <div className="mt-6 text-muted-foreground">Loading stats…</div>;
  const cards: { label: string; value: string | number }[] = [
    { label: "Total Users", value: s.users },
    { label: "Revenue (BDT)", value: `৳${Number(s.revenue).toLocaleString()}` },
    { label: "Credits Sold", value: s.credits_sold },
    { label: "Downloads", value: s.downloads },
    { label: "Point Tables", value: s.tables },
    { label: "Templates", value: s.templates },
    { label: "Pending Payments", value: s.pending_payments },
    { label: "Approved Payments", value: s.approved_payments },
  ];
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="glass rounded-2xl p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</div>
          <div className="mt-2 text-3xl font-black neon-text">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

type Payment = {
  id: string; user_id: string; package_name: string; amount: number; credits: number;
  payment_method: string; sender_number: string; transaction_id: string;
  status: "pending" | "approved" | "rejected"; created_at: string; reject_reason: string | null;
  max_resolution: Resolution;
};

function PaymentsTab() {
  const [list, setList] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [emails, setEmails] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    let q = supabase.from("payment_requests").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    const items = (data ?? []) as Payment[];
    setList(items);
    const uids = [...new Set(items.map((p) => p.user_id))];
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,email,username").in("id", uids);
      const m: Record<string, string> = {};
      profs?.forEach((p) => { m[p.id] = p.email ?? p.username ?? p.id.slice(0, 8); });
      setEmails(m);
    }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    const { error } = await supabase.rpc("approve_payment", { _request_id: id });
    if (error) return toast.error(error.message);
    toast.success("Payment approved & credits added");
    load();
  };
  const reject = async (id: string) => {
    const reason = prompt("Rejection reason:") || "Invalid transaction";
    const { error } = await supabase.rpc("reject_payment", { _request_id: id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Payment rejected");
    load();
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>
      {list.length === 0 && <div className="glass rounded-xl p-8 text-center text-muted-foreground">No payments</div>}
      <div className="space-y-3">
        {list.map((p) => (
          <div key={p.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold">{p.package_name} · <span className="neon-text">{p.credits} credits</span></div>
              <div className="text-xs text-muted-foreground">{emails[p.user_id] ?? p.user_id.slice(0, 8)} · {new Date(p.created_at).toLocaleString()}</div>
            </div>
            <div className="text-sm">
              <div><b>৳{p.amount}</b> via {p.payment_method.toUpperCase()}</div>
              <div className="text-xs text-muted-foreground">From: {p.sender_number} · TxID: {p.transaction_id} · Quality: <b className="text-primary">{p.max_resolution?.toUpperCase()}</b></div>
            </div>
            <Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>
              {p.status}
            </Badge>
            {p.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve(p.id)}><Check className="h-4 w-4 mr-1" />Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => reject(p.id)}><X className="h-4 w-4 mr-1" />Reject</Button>
              </div>
            )}
            {p.reject_reason && <div className="basis-full text-xs text-destructive">Reason: {p.reject_reason}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

type Profile = { id: string; email: string | null; username: string | null; credits: number; banned: boolean; created_at: string; max_resolution: Resolution };

function UsersTab() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    let q = supabase.from("profiles").select("id,email,username,credits,banned,created_at,max_resolution").order("created_at", { ascending: false }).limit(200);
    if (search.trim()) q = q.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    setUsers((data ?? []) as Profile[]);
  }, [search]);
  useEffect(() => { load(); }, [load]);

  const adjust = async (uid: string) => {
    const raw = prompt("Credit adjustment (e.g. 10 or -5):");
    if (!raw) return;
    const delta = parseInt(raw, 10);
    if (isNaN(delta)) return toast.error("Invalid number");
    const reason = prompt("Reason:") || "admin_adjustment";
    const { error } = await supabase.rpc("admin_adjust_credits", { _user_id: uid, _delta: delta, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Credits updated");
    load();
  };
  const toggleBan = async (u: Profile) => {
    const { error } = await supabase.from("profiles").update({ banned: !u.banned }).eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success(u.banned ? "User unbanned" : "User banned");
    load();
  };
  const setQuality = async (uid: string, q: Resolution) => {
    const { error } = await supabase.rpc("admin_set_user_quality", { _user_id: uid, _quality: q });
    if (error) return toast.error(error.message);
    toast.success(`Max quality set to ${q.toUpperCase()}`);
    load();
  };

  return (
    <div className="mt-6 space-y-4">
      <Input placeholder="Search by email or username…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold">{u.username ?? "—"} {u.banned && <Badge variant="destructive" className="ml-2">Banned</Badge>}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </div>
            <div className="text-sm"><span className="neon-text font-bold">{u.credits}</span> credits</div>
            <div className="w-32">
              <Select value={u.max_resolution} onValueChange={(v) => setQuality(u.id, v as Resolution)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESOLUTIONS.map((r) => <SelectItem key={r} value={r}>Max {r.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={() => adjust(u.id)}><Coins className="h-4 w-4 mr-1" />Adjust</Button>
            <Button size="sm" variant={u.banned ? "default" : "destructive"} onClick={() => toggleBan(u)}>
              {u.banned ? "Unban" : "Ban"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

type Pkg = {
  id: string; title: string; price: number; credits: number; popular: boolean;
  active: boolean; sort_order: number; features: string[]; max_resolution: Resolution;
  allow_thumbnail: boolean;
};

function PackagesTab() {
  const [list, setList] = useState<Pkg[]>([]);
  const [form, setForm] = useState<{ title: string; price: number; credits: number; popular: boolean; sort_order: number; features: string; max_resolution: Resolution; allow_thumbnail: boolean }>(
    { title: "", price: 100, credits: 10, popular: false, sort_order: 0, features: "", max_resolution: "480p", allow_thumbnail: false }
  );

  const load = async () => {
    const { data, error } = await supabase.from("credit_packages").select("*").order("sort_order");
    if (error) return toast.error(error.message);
    setList((data ?? []).map((p) => ({ ...p, features: Array.isArray(p.features) ? p.features as string[] : [] })) as Pkg[]);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title) return toast.error("Title required");
    const features = form.features.split("\n").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("credit_packages").insert({
      title: form.title, price: form.price, credits: form.credits,
      popular: form.popular, sort_order: form.sort_order, features,
      max_resolution: form.max_resolution, allow_thumbnail: form.allow_thumbnail,
    });
    if (error) return toast.error(error.message);
    toast.success("Package created");
    setForm({ title: "", price: 100, credits: 10, popular: false, sort_order: 0, features: "", max_resolution: "480p", allow_thumbnail: false });
    load();
  };
  const toggleActive = async (p: Pkg) => {
    await supabase.from("credit_packages").update({ active: !p.active }).eq("id", p.id);
    load();
  };
  const toggleThumb = async (p: Pkg) => {
    await supabase.from("credit_packages").update({ allow_thumbnail: !p.allow_thumbnail }).eq("id", p.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this package?")) return;
    await supabase.from("credit_packages").delete().eq("id", id);
    load();
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="glass rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-lg flex items-center gap-2"><Plus className="h-5 w-5" />New Package</h3>
        <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Starter Pack" /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Price ৳</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} /></div>
          <div><Label>Credits</Label><Input type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: +e.target.value })} /></div>
          <div><Label>Sort</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })} /></div>
        </div>
        <div>
          <Label>Max Download Quality</Label>
          <Select value={form.max_resolution} onValueChange={(v) => setForm({ ...form, max_resolution: v as Resolution })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => <SelectItem key={r} value={r}>Up to {r.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Features (one per line)</Label><Textarea rows={3} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} /></div>
        <div className="flex items-center gap-2"><Switch checked={form.popular} onCheckedChange={(v) => setForm({ ...form, popular: v })} /><Label>Mark as Popular</Label></div>
        <div className="flex items-center gap-2"><Switch checked={form.allow_thumbnail} onCheckedChange={(v) => setForm({ ...form, allow_thumbnail: v })} /><Label>Allow Logo Upload</Label></div>
        <Button onClick={create} className="w-full">Create Package</Button>
      </div>
      <div className="space-y-3">
        {list.map((p) => (
          <div key={p.id} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold">{p.title} {p.popular && <Badge className="ml-1">Popular</Badge>} {!p.active && <Badge variant="secondary" className="ml-1">Inactive</Badge>} {p.allow_thumbnail && <Badge variant="outline" className="ml-1 border-primary text-primary">Logo Upload</Badge>}</div>
                <div className="text-sm text-muted-foreground">৳{p.price} · <span className="neon-text">{p.credits} credits</span> · <span className="text-primary"><Video className="h-3 w-3 inline" /> {p.max_resolution?.toUpperCase()}</span></div>
                {p.features.length > 0 && <ul className="mt-2 text-xs text-muted-foreground list-disc pl-4">{p.features.map((f, i) => <li key={i}>{f}</li>)}</ul>}
              </div>
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleActive(p)}>{p.active ? "Disable" : "Enable"}</Button>
                <Button size="sm" variant="outline" onClick={() => toggleThumb(p)}>{p.allow_thumbnail ? "Logo: ON" : "Logo: OFF"}</Button>
                <Button size="sm" variant="destructive" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="glass rounded-xl p-8 text-center text-muted-foreground">No packages yet</div>}
      </div>
    </div>
  );
}

type Template = { id: string; name: string; image_url: string; active: boolean; premium: boolean; created_at: string; accent_color: string; storage_path?: string };
const TEMPLATE_SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

function templateStoragePath(value: string): string | null {
  if (!value || value.startsWith("data:")) return null;
  if (!value.startsWith("http")) return value.replace(/^\/+/, "").replace(/^templates\//, "");
  try {
    const path = new URL(value).pathname;
    const match = path.match(/\/storage\/v1\/object\/(?:public|sign)\/templates\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function TemplatesTab() {
  const [list, setList] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [premium, setPremium] = useState(false);
  const [accent, setAccent] = useState("#34d399");
  const [busy, setBusy] = useState(false);

  // AI extractor state
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiName, setAiName] = useState("");
  const [aiAccent, setAiAccent] = useState("#ef4444");
  const [aiPremium, setAiPremium] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const extract = useServerFn(aiExtractBackground);
  const genOne = useServerFn(aiGenerateTemplate);
  const [genBusy, setGenBusy] = useState(false);
  const [genPreview, setGenPreview] = useState<string | null>(null);
  const [genName, setGenName] = useState("");
  const [genAccent, setGenAccent] = useState("#f59e0b");
  const [genPremium, setGenPremium] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("templates").select("*").order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    const signed = await Promise.all(((data ?? []) as Template[]).map(async (t) => {
      const path = templateStoragePath(t.image_url);
      if (!path) return t;
      const { data: url } = await supabase.storage.from("templates").createSignedUrl(path, TEMPLATE_SIGNED_URL_SECONDS);
      return { ...t, image_url: url?.signedUrl ?? t.image_url, storage_path: path };
    }));
    setList(signed);
  };
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!name || !file) return toast.error("Name and image required");
    setBusy(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("templates").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("templates").insert({ name, image_url: path, premium, accent_color: accent });
      if (insErr) throw insErr;
      toast.success("Template uploaded");
      setName(""); setFile(null); setPremium(false); setAccent("#34d399");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); }
  };
  const toggle = async (t: Template, field: "active" | "premium") => {
    const patch = field === "active" ? { active: !t.active } : { premium: !t.premium };
    await supabase.from("templates").update(patch).eq("id", t.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete template?")) return;
    await supabase.from("templates").delete().eq("id", id);
    load();
  };
  const updateAccent = async (t: Template, color: string) => {
    await supabase.from("templates").update({ accent_color: color }).eq("id", t.id);
    load();
  };

  const runAiExtract = async () => {
    if (!aiFile) return toast.error("Pick a point-table image first");
    setAiBusy(true);
    setAiPreview(null);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(aiFile);
      });
      const out = await extract({ data: { image_data_url: dataUrl } });
      setAiPreview(out.image_data_url);
      toast.success("Background extracted — review and save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI extract failed");
    } finally { setAiBusy(false); }
  };

  const saveAiTemplate = async () => {
    if (!aiPreview || !aiName) return toast.error("Name + extracted image required");
    setAiBusy(true);
    try {
      const blob = await (await fetch(aiPreview)).blob();
      const path = `ai-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("templates").upload(path, blob, { upsert: false, contentType: blob.type || "image/png" });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("templates").insert({
        name: aiName, image_url: path, premium: aiPremium, accent_color: aiAccent,
      });
      if (insErr) throw insErr;
      toast.success("AI template saved");
      setAiFile(null); setAiName(""); setAiPreview(null); setAiPremium(false); setAiAccent("#ef4444");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setAiBusy(false); }
  };

  const runGenerate = async () => {
    setGenBusy(true); setGenPreview(null);
    try {
      const out = await genOne({ data: undefined as unknown as never });
      setGenPreview(out.image_data_url);
      if (!genName) setGenName(`FF ${out.theme.split(" ").slice(0, 3).join(" ")}`);
      toast.success("Background generated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Generate failed"); }
    finally { setGenBusy(false); }
  };
  const saveGenerated = async () => {
    if (!genPreview || !genName) return toast.error("Name required");
    setGenBusy(true);
    try {
      const blob = await (await fetch(genPreview)).blob();
      const path = `gen-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("templates").upload(path, blob, { contentType: blob.type || "image/png" });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("templates").insert({ name: genName, image_url: path, premium: genPremium, accent_color: genAccent });
      if (insErr) throw insErr;
      toast.success("Saved");
      setGenPreview(null); setGenName(""); setGenPremium(false); setGenAccent("#f59e0b");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setGenBusy(false); }
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="glass rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-lg flex items-center gap-2"><Plus className="h-5 w-5" />Upload Template</h3>
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="PUBG Neon Table" /></div>
        <div><Label>Image (PNG/JPG/WEBP)</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <div>
          <Label>Accent / Text Color</Label>
          <div className="flex gap-2 items-center mt-1">
            <Input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-16 h-10 p-1" />
            <Input value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#34d399" />
          </div>
        </div>
        <div className="flex items-center gap-2"><Switch checked={premium} onCheckedChange={setPremium} /><Label>Premium template</Label></div>
        <Button onClick={upload} disabled={busy} className="w-full">{busy ? "Uploading…" : "Upload"}</Button>

        <div className="border-t border-border/40 pt-4 mt-4 space-y-3">
          <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />AI Background Extractor</h3>
          <p className="text-xs text-muted-foreground -mt-2">Upload any point-table image. AI removes rows, text & lines, keeps only the background as a reusable template.</p>
          <div><Label>Template Name</Label><Input value={aiName} onChange={(e) => setAiName(e.target.value)} placeholder="Red Esports BG" /></div>
          <div><Label>Source Image</Label><Input type="file" accept="image/*" onChange={(e) => { setAiFile(e.target.files?.[0] ?? null); setAiPreview(null); }} /></div>
          <div>
            <Label>Accent / Text Color</Label>
            <div className="flex gap-2 items-center mt-1">
              <Input type="color" value={aiAccent} onChange={(e) => setAiAccent(e.target.value)} className="w-16 h-10 p-1" />
              <Input value={aiAccent} onChange={(e) => setAiAccent(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={aiPremium} onCheckedChange={setAiPremium} /><Label>Premium template</Label></div>
          <Button onClick={runAiExtract} disabled={aiBusy || !aiFile} className="w-full neon-border">
            {aiBusy ? "Processing…" : "Extract Background with AI"}
          </Button>
          {aiPreview && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">AI Result Preview:</div>
              <img src={aiPreview} alt="extracted bg" className="w-full rounded-lg border border-border" />
              <Button onClick={saveAiTemplate} disabled={aiBusy} className="w-full">Save as Template</Button>
            </div>
          )}
        </div>

        <div className="border-t border-border/40 pt-4 mt-4 space-y-3">
          <h3 className="font-bold text-lg flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" />AI Random FF Background</h3>
          <p className="text-xs text-muted-foreground -mt-2">AI generates a brand-new Free Fire esports point-table background from scratch.</p>
          <Button onClick={runGenerate} disabled={genBusy} className="w-full neon-border">
            {genBusy ? "Generating…" : "Generate Random Background"}
          </Button>
          {genPreview && (
            <div className="space-y-2">
              <img src={genPreview} alt="generated" className="w-full rounded-lg border border-border" />
              <div><Label>Name</Label><Input value={genName} onChange={(e) => setGenName(e.target.value)} /></div>
              <div>
                <Label>Accent Color</Label>
                <div className="flex gap-2 items-center mt-1">
                  <Input type="color" value={genAccent} onChange={(e) => setGenAccent(e.target.value)} className="w-16 h-10 p-1" />
                  <Input value={genAccent} onChange={(e) => setGenAccent(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={genPremium} onCheckedChange={setGenPremium} /><Label>Premium</Label></div>
              <Button onClick={saveGenerated} disabled={genBusy} className="w-full">Save as Template</Button>
            </div>
          )}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((t) => (
          <div key={t.id} className="glass rounded-xl overflow-hidden">
            <img src={t.image_url} alt={t.name} className="w-full h-40 object-cover bg-muted" />
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold truncate">{t.name}</div>
                <div className="flex gap-1">
                  {t.premium && <Badge>Premium</Badge>}
                  {!t.active && <Badge variant="secondary">Off</Badge>}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Accent</Label>
                <Input type="color" value={t.accent_color ?? "#34d399"} onChange={(e) => updateAccent(t, e.target.value)} className="w-12 h-8 p-1" />
                <span className="text-xs font-mono">{t.accent_color}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => toggle(t, "active")}>{t.active ? "Disable" : "Enable"}</Button>
                <Button size="sm" variant="outline" onClick={() => toggle(t, "premium")}>{t.premium ? "★" : "☆"}</Button>
                <Button size="sm" variant="destructive" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="glass rounded-xl p-8 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">No templates yet</div>}
      </div>
    </div>
  );
}

function NotifyTab() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!title || !message) return toast.error("Title and message required");
    setBusy(true);
    // user_id NULL = global announcement
    const { error } = await supabase.from("notifications").insert({ title, message, user_id: null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Announcement sent to all users");
    setTitle(""); setMessage("");
  };

  return (
    <div className="mt-6 max-w-xl glass rounded-2xl p-5 space-y-3">
      <h3 className="font-bold text-lg flex items-center gap-2"><Bell className="h-5 w-5" />Broadcast Notification</h3>
      <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New feature released!" /></div>
      <div><Label>Message</Label><Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell your users…" /></div>
      <Button onClick={send} disabled={busy} className="w-full neon-border">{busy ? "Sending…" : "Send to all users"}</Button>
    </div>
  );
}

type GenItem = { image_data_url: string; theme: string; name: string; accent: string; premium: boolean; saved?: boolean };

function AiBatchTab() {
  const genBatch = useServerFn(aiGenerateBatch);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<GenItem[]>([]);

  const run = async () => {
    setBusy(true); setItems([]);
    try {
      const out = await genBatch({ data: undefined as unknown as never });
      setItems(out.items.map((it, i) => ({
        ...it, name: `FF Pack ${Date.now().toString().slice(-5)}-${i + 1}`,
        accent: ["#f59e0b", "#34d399", "#ef4444", "#a855f7", "#3b82f6"][i % 5],
        premium: false,
      })));
      toast.success(`Generated ${out.items.length} backgrounds`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Batch failed"); }
    finally { setBusy(false); }
  };

  const saveOne = async (idx: number) => {
    const it = items[idx];
    if (!it || it.saved) return;
    try {
      const blob = await (await fetch(it.image_data_url)).blob();
      const path = `batch-${Date.now()}-${idx}.png`;
      const { error: upErr } = await supabase.storage.from("templates").upload(path, blob, { contentType: blob.type || "image/png" });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("templates").insert({ name: it.name, image_url: path, premium: it.premium, accent_color: it.accent });
      if (insErr) throw insErr;
      setItems((xs) => xs.map((x, i) => i === idx ? { ...x, saved: true } : x));
      toast.success("Saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
  };

  const saveAll = async () => {
    for (let i = 0; i < items.length; i++) if (!items[i].saved) await saveOne(i);
  };

  const update = (i: number, patch: Partial<GenItem>) =>
    setItems((xs) => xs.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  return (
    <div className="mt-6 space-y-4">
      <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h3 className="font-bold text-lg flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" />AI Batch Generator</h3>
          <p className="text-xs text-muted-foreground">One click → 5 random Free Fire esports point-table backgrounds.</p>
        </div>
        <Button onClick={run} disabled={busy} className="neon-border">
          {busy ? "Generating 5…" : "Generate 5 Templates"}
        </Button>
        {items.length > 0 && <Button variant="outline" onClick={saveAll}>Save All</Button>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <div key={i} className="glass rounded-xl overflow-hidden">
            <img src={it.image_data_url} alt={it.theme} className="w-full h-48 object-cover" />
            <div className="p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{it.theme}</div>
              <Input value={it.name} onChange={(e) => update(i, { name: e.target.value })} className="h-8 text-sm" />
              <div className="flex items-center gap-2">
                <Input type="color" value={it.accent} onChange={(e) => update(i, { accent: e.target.value })} className="w-10 h-8 p-1" />
                <div className="flex items-center gap-1 text-xs"><Switch checked={it.premium} onCheckedChange={(v) => update(i, { premium: v })} /> Premium</div>
              </div>
              <Button size="sm" disabled={it.saved} onClick={() => saveOne(i)} className="w-full">
                {it.saved ? "✓ Saved" : "Save"}
              </Button>
            </div>
          </div>
        ))}
        {items.length === 0 && !busy && (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">
            Click "Generate 5 Templates" to start.
          </div>
        )}
      </div>
    </div>
  );
}
type VariantItem = { image_data_url: string; color_name: string; accent: string; name: string; premium: boolean; saved?: boolean };

function NewAiTab() {
  const genVariants = useServerFn(aiGenerateVariants);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<VariantItem[]>([]);

  const run = async () => {
    setBusy(true); setItems([]);
    try {
      const out = await genVariants({ data: undefined as unknown as never });
      setItems(out.items.map((it) => ({
        ...it,
        name: `Clean ${it.color_name} Table`,
        premium: false,
      })));
      toast.success(`Generated ${out.items.length} color variants`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Generation failed"); }
    finally { setBusy(false); }
  };

  const saveOne = async (idx: number) => {
    const it = items[idx];
    if (!it || it.saved) return;
    try {
      const blob = await (await fetch(it.image_data_url)).blob();
      const path = `variant-${Date.now()}-${idx}.png`;
      const { error: upErr } = await supabase.storage.from("templates").upload(path, blob, { contentType: blob.type || "image/png" });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("templates").insert({ name: it.name, image_url: path, premium: it.premium, accent_color: it.accent });
      if (insErr) throw insErr;
      setItems((xs) => xs.map((x, i) => i === idx ? { ...x, saved: true } : x));
      toast.success("Saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
  };
  const saveAll = async () => { for (let i = 0; i < items.length; i++) if (!items[i].saved) await saveOne(i); };
  const update = (i: number, patch: Partial<VariantItem>) =>
    setItems((xs) => xs.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  return (
    <div className="mt-6 space-y-4">
      <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h3 className="font-bold text-lg flex items-center gap-2"><Palette className="h-5 w-5 text-primary" />New AI — Clean Color Variants</h3>
          <p className="text-xs text-muted-foreground">Click Generate → AI makes minimal "None"-style point-table backgrounds in 6 different colors.</p>
        </div>
        <Button onClick={run} disabled={busy} className="neon-border">
          {busy ? "Generating 6 variants…" : "Generate Color Variants"}
        </Button>
        {items.length > 0 && <Button variant="outline" onClick={saveAll}>Save All</Button>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <div key={i} className="glass rounded-xl overflow-hidden">
            <img src={it.image_data_url} alt={it.color_name} className="w-full h-48 object-cover" />
            <div className="p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.color_name}</div>
              <Input value={it.name} onChange={(e) => update(i, { name: e.target.value })} className="h-8 text-sm" />
              <div className="flex items-center gap-2">
                <Input type="color" value={it.accent} onChange={(e) => update(i, { accent: e.target.value })} className="w-10 h-8 p-1" />
                <div className="flex items-center gap-1 text-xs"><Switch checked={it.premium} onCheckedChange={(v) => update(i, { premium: v })} /> Premium</div>
              </div>
              <Button size="sm" disabled={it.saved} onClick={() => saveOne(i)} className="w-full">
                {it.saved ? "✓ Saved" : "Save"}
              </Button>
            </div>
          </div>
        ))}
        {items.length === 0 && !busy && (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">
            Click "Generate Color Variants" to start.
          </div>
        )}
      </div>
    </div>
  );
}

function ThumbnailAccessTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; email: string | null; username: string | null; can_upload_thumbnails: boolean; credits: number }>>([]);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    const q = query.trim();
    if (!q) return toast.error("Enter a user ID, email, or username");
    setSearching(true);
    // Try ID exact match first, otherwise email/username ilike
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(q);
    let req = supabase.from("profiles").select("id,email,username,can_upload_thumbnails,credits").limit(20);
    req = looksLikeUuid ? req.eq("id", q) : req.or(`email.ilike.%${q}%,username.ilike.%${q}%,id.eq.${q}`);
    const { data, error } = await req;
    setSearching(false);
    if (error) return toast.error(error.message);
    setResults((data ?? []) as typeof results);
    if (!data?.length) toast.message("No users found");
  };

  const setAccess = async (uid: string, allow: boolean) => {
    const { error } = await supabase.rpc("admin_set_thumbnail_access", { _user_id: uid, _allow: allow });
    if (error) return toast.error(error.message);
    toast.success(allow ? "Access granted" : "Access revoked");
    setResults((r) => r.map((u) => u.id === uid ? { ...u, can_upload_thumbnails: allow } : u));
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="glass rounded-2xl p-5">
        <h3 className="font-bold text-lg flex items-center gap-2"><ImagePlus className="h-5 w-5 text-primary" />Logo Upload Permission</h3>
        <p className="text-sm text-muted-foreground mt-1">Search by user ID (UID), email, or username and grant permission so the user can upload their own tournament/team logos.</p>
        <div className="mt-4 flex gap-2">
          <Input placeholder="UID / email / username…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <Button onClick={search} disabled={searching}><Search className="h-4 w-4 mr-1.5" />Search</Button>
        </div>
      </div>
      <div className="space-y-2">
        {results.map((u) => (
          <div key={u.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px]">
              <div className="font-semibold">{u.username ?? "—"} <Badge variant="secondary" className="ml-2 text-[10px]">{u.credits} credits</Badge></div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
              <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">{u.id}</div>
            </div>
            {u.can_upload_thumbnails ? (
              <>
                <Badge className="bg-primary">Access: ON</Badge>
                <Button size="sm" variant="destructive" onClick={() => setAccess(u.id, false)}>Revoke</Button>
              </>
            ) : (
              <>
                <Badge variant="secondary">Access: OFF</Badge>
                <Button size="sm" onClick={() => setAccess(u.id, true)}><Check className="h-4 w-4 mr-1" />Grant Access</Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type Ann = {
  id: string;
  title: string;
  body: string;
  bg_color: string;
  text_color: string;
  audience: "all" | "admin" | "user";
  active: boolean;
  created_at: string;
};

function AnnouncementTab() {
  const [list, setList] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    body: "",
    bg_color: "#0c1c3e",
    text_color: "#ffffff",
    audience: "all" as Ann["audience"],
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("announcements").select("*").order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setList((data ?? []) as Ann[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!draft.title.trim() || !draft.body.trim()) return toast.error("Title & body required");
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({
      title: draft.title.trim(), body: draft.body.trim(),
      bg_color: draft.bg_color, text_color: draft.text_color, audience: draft.audience, active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setDraft({ title: "", body: "", bg_color: "#0c1c3e", text_color: "#ffffff", audience: "all" });
    toast.success("Announcement published");
    load();
  };
  const toggle = async (a: Ann) => {
    const { error } = await supabase.from("announcements").update({ active: !a.active }).eq("id", a.id);
    if (error) return toast.error(error.message);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className="glass rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-lg flex items-center gap-2"><Megaphone className="h-5 w-5" />New Announcement</h3>
        <div>
          <Label>Title</Label>
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Important update" />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea rows={5} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Your message…" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Background</Label>
            <div className="flex gap-2 items-center">
              <Input type="color" value={draft.bg_color} onChange={(e) => setDraft({ ...draft, bg_color: e.target.value })} className="w-14 h-10 p-1" />
              <Input value={draft.bg_color} onChange={(e) => setDraft({ ...draft, bg_color: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Text Color</Label>
            <div className="flex gap-2 items-center">
              <Input type="color" value={draft.text_color} onChange={(e) => setDraft({ ...draft, text_color: e.target.value })} className="w-14 h-10 p-1" />
              <Input value={draft.text_color} onChange={(e) => setDraft({ ...draft, text_color: e.target.value })} />
            </div>
          </div>
        </div>
        <div>
          <Label>Audience</Label>
          <Select value={draft.audience} onValueChange={(v) => setDraft({ ...draft, audience: v as Ann["audience"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="user">Regular users only</SelectItem>
              <SelectItem value="admin">Admins only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg p-4 border" style={{ background: draft.bg_color, color: draft.text_color }}>
          <div className="font-bold flex items-center gap-2"><Megaphone className="h-4 w-4" />{draft.title || "Preview title"}</div>
          <div className="text-sm mt-1 whitespace-pre-wrap opacity-95">{draft.body || "Preview body…"}</div>
        </div>
        <Button onClick={create} disabled={busy} className="w-full neon-border">{busy ? "Publishing…" : "Publish"}</Button>
      </div>

      <div className="space-y-3">
        <h3 className="font-bold text-lg">Published</h3>
        {loading ? <div className="text-muted-foreground">Loading…</div> :
          list.length === 0 ? <div className="text-muted-foreground text-sm">No announcements yet.</div> :
          list.map((a) => (
            <div key={a.id} className="glass rounded-xl p-4 flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{a.title}</span>
                  <Badge variant="outline" className="capitalize">{a.audience}</Badge>
                  {a.active ? <Badge>Active</Badge> : <Badge variant="secondary">Off</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">{a.body}</div>
                <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 rounded text-[11px]" style={{ background: a.bg_color, color: a.text_color }}>
                  swatch preview
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggle(a)}>{a.active ? "Disable" : "Enable"}</Button>
                <Button size="sm" variant="destructive" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

type ThemeVals = {
  background?: string; foreground?: string; primary?: string; primary_foreground?: string;
  accent?: string; card?: string; border?: string;
};

const THEME_FIELDS: { key: keyof ThemeVals; label: string; placeholder: string }[] = [
  { key: "background", label: "Background", placeholder: "#0a0f1e or oklch(0.16 0.03 250)" },
  { key: "foreground", label: "Foreground / Text", placeholder: "#ffffff" },
  { key: "primary", label: "Primary (accent green)", placeholder: "#34d399" },
  { key: "primary_foreground", label: "Primary text", placeholder: "#0a0f1e" },
  { key: "accent", label: "Accent", placeholder: "#a78bfa" },
  { key: "card", label: "Card surface", placeholder: "#15203a" },
  { key: "border", label: "Border", placeholder: "#1f2a44" },
];

function ThemeTab() {
  const [vals, setVals] = useState<ThemeVals>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "site_theme").maybeSingle()
      .then(({ data }) => {
        setVals((data?.value ?? {}) as ThemeVals);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setBusy(true);
    const cleaned: ThemeVals = {};
    (Object.keys(vals) as (keyof ThemeVals)[]).forEach((k) => {
      const v = vals[k]?.trim();
      if (v) cleaned[k] = v;
    });
    const { error } = await supabase.from("app_settings")
      .upsert({ key: "site_theme", value: cleaned, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Theme applied site-wide");
  };
  const reset = async () => {
    if (!confirm("Reset theme to defaults?")) return;
    setBusy(true);
    const { error } = await supabase.from("app_settings")
      .upsert({ key: "site_theme", value: {}, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setVals({});
    toast.success("Theme reset");
  };

  if (loading) return <div className="mt-6 text-muted-foreground">Loading…</div>;
  return (
    <div className="mt-6 max-w-2xl glass rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="font-bold text-lg flex items-center gap-2"><Paintbrush className="h-5 w-5" />Site Theme</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Override the site-wide colors. Accepts hex (#0a0f1e), rgb(), or oklch(). Leave a field blank to use the default.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {THEME_FIELDS.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <div className="flex gap-2 items-center mt-1">
              <Input
                type="color"
                value={(vals[f.key] && /^#[0-9a-fA-F]{6}$/.test(vals[f.key]!)) ? vals[f.key] : "#000000"}
                onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                className="w-14 h-10 p-1"
              />
              <Input
                value={vals[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy} className="flex-1 neon-border">{busy ? "Saving…" : "Apply theme"}</Button>
        <Button onClick={reset} disabled={busy} variant="outline">Reset</Button>
      </div>
    </div>
  );
}
