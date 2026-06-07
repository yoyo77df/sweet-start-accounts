import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Lock, Sparkles, Upload, Trash2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { RESOLUTIONS, RES_PIXEL_RATIO, RES_LABEL, isUnlocked, type Resolution } from "@/lib/resolutions";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Create Point Table — Point Arena" },
      { name: "description", content: "Build live esports point tables: edit team names, kills and positions, then download HD images for your tournament." },
      { property: "og:title", content: "Create Point Table — Point Arena" },
      { property: "og:description", content: "Build live esports point tables and download HD images for your tournament." },
    ],
  }),
  component: Create,
});

type Row = { name: string; kills: number; pos: number; booyah: number; logo?: string | null };
type Template = { id: string; name: string; image_url: string; accent_color: string; premium: boolean; isUser?: boolean; locked?: boolean; storage_path?: string };

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const NONE_BG = "radial-gradient(ellipse at top, #0c1c3e 0%, #050813 70%)";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function Create() {
  const { user, profile, refresh } = useAuth();
  const userMax: Resolution = (profile?.max_resolution ?? "244p") as Resolution;
  const canUpload = !!profile?.can_upload_thumbnails;
  const credits = profile?.credits ?? 0;

  const [tournament, setTournament] = useState("Point Arena Championship");
  const [textColor, setTextColor] = useState("#ffffff");
  const [tagColor, setTagColor] = useState("#f59e0b");
  const [tournamentLogo, setTournamentLogo] = useState<string | null>(null);
  const [tournamentLogoSize, setTournamentLogoSize] = useState(140);
  const [rows, setRows] = useState<Row[]>(
    Array.from({ length: 12 }, (_, i) => ({ name: `Team Name ${i + 1}`, kills: 0, pos: 0, booyah: 0, logo: null })),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [userTpls, setUserTpls] = useState<Template[]>([]);
  const [tplId, setTplId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("templates").select("id,name,image_url,accent_color,premium")
      .eq("active", true).order("created_at", { ascending: false })
      .then(({ data }) => setTemplates((data ?? []) as Template[]));
  }, []);

  const loadUserThumbs = async () => {
    if (!user) return;
    const { data } = await supabase.from("user_thumbnails")
      .select("id,name,image_url,accent_color").eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!data) return;
    const enriched = await Promise.all(data.map(async (t) => {
      const path = t.image_url;
      const { data: signed } = await supabase.storage.from("user-thumbnails").createSignedUrl(path, 3600);
      return {
        id: t.id, name: t.name, accent_color: t.accent_color, premium: false,
        image_url: signed?.signedUrl ?? "",
        storage_path: path,
        isUser: true,
        locked: credits <= 0,
      } as Template;
    }));
    setUserTpls(enriched);
  };

  useEffect(() => { loadUserThumbs(); }, [user?.id, credits]);

  const allTpls = useMemo(() => [...userTpls, ...templates], [userTpls, templates]);
  const tpl = allTpls.find((t) => t.id === tplId) ?? null;
  useEffect(() => {
    if (tpl?.isUser && tpl.locked) setTplId(null);
  }, [tpl]);

  const accent = tpl?.accent_color ?? "#34d399";

  const ranked = useMemo(() => rows.map((r, idx) => ({ ...r, idx, total: r.kills + r.pos + r.booyah }))
    .sort((a, b) => b.total - a.total || b.kills - a.kills), [rows]);
  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!canUpload) return toast.error("You don't have thumbnail upload access.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("user-thumbnails").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("user_thumbnails").insert({
        user_id: user.id, name: file.name.replace(/\.[^.]+$/, "").slice(0, 40), image_url: path,
      });
      if (insErr) throw insErr;
      toast.success("Thumbnail uploaded");
      await loadUserThumbs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteThumb = async (t: Template) => {
    if (!confirm("Delete this thumbnail?")) return;
    if (t.storage_path) await supabase.storage.from("user-thumbnails").remove([t.storage_path]);
    await supabase.from("user_thumbnails").delete().eq("id", t.id);
    if (tplId === t.id) setTplId(null);
    loadUserThumbs();
  };

  const handleTeamLogo = async (i: number, file: File | undefined) => {
    if (!file) return;
    if (!canUpload) return toast.error("Logo upload is a premium feature.");
    if (file.size > 3 * 1024 * 1024) return toast.error("Logo max 3MB");
    try {
      const dataUrl = await fileToDataUrl(file);
      update(i, { logo: dataUrl });
    } catch {
      toast.error("Failed to read logo");
    }
  };

  const handleTournamentLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!canUpload) return toast.error("Logo upload is a premium feature.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Logo max 5MB");
    try {
      const dataUrl = await fileToDataUrl(file);
      setTournamentLogo(dataUrl);
    } catch {
      toast.error("Failed to read logo");
    }
  };

  const fetchAsDataUrl = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url, { mode: "cors", cache: "no-store" });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const renderPng = async (resolution: Resolution): Promise<string> => {
    const node = ref.current!;
    const originalBg = node.style.background;
    // Temporarily strip the green frame border so it doesn't appear in downloads
    const frame = node.querySelector<HTMLElement>("[data-table-frame]");
    const originalBorder = frame?.style.border ?? "";
    if (frame) frame.style.border = "none";
    try {
      if (tpl?.image_url) {
        const dataUrl = await fetchAsDataUrl(tpl.image_url);
        if (dataUrl) {
          node.style.background = `url(${dataUrl}) center/cover no-repeat`;
        }
      }
      const opts = {
        pixelRatio: RES_PIXEL_RATIO[resolution],
        cacheBust: true,
        width: CANVAS_W,
        height: CANVAS_H,
        style: { transform: "none" },
        fetchRequestInit: { mode: "cors" as RequestMode, cache: "no-store" as RequestCache },
      };
      try {
        return await toPng(node, opts);
      } catch (firstErr) {
        node.style.background = NONE_BG;
        try {
          return await toPng(node, opts);
        } catch (secondErr) {
          throw firstErr instanceof Error ? firstErr : secondErr;
        }
      }
    } finally {
      node.style.background = originalBg;
      if (frame) frame.style.border = originalBorder;
    }
  };

  const loadImageSafe = (src: string): Promise<HTMLImageElement | null> => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  const drawFallbackPng = async (resolution: Resolution): Promise<string> => {
    const ratio = RES_PIXEL_RATIO[resolution];
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W * ratio;
    canvas.height = CANVAS_H * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.scale(ratio, ratio);

    const bg = ctx.createRadialGradient(CANVAS_W / 2, 0, 40, CANVAS_W / 2, CANVAS_H / 2, CANVAS_H);
    bg.addColorStop(0, "#0c1c3e");
    bg.addColorStop(1, "#050813");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const bgData = tpl?.image_url ? await fetchAsDataUrl(tpl.image_url) : null;
    const bgImg = bgData ? await loadImageSafe(bgData) : null;
    if (bgImg) ctx.drawImage(bgImg, 0, 0, CANVAS_W, CANVAS_H);

    let y = 112;
    if (tournamentLogo) {
      const logo = await loadImageSafe(tournamentLogo);
      if (logo) {
        const h = tournamentLogoSize;
        const w = Math.min(CANVAS_W - 160, h * (logo.naturalWidth / Math.max(1, logo.naturalHeight)));
        ctx.drawImage(logo, (CANVAS_W - w) / 2, y - 32, w, h);
        y += h + 34;
      }
    }

    ctx.textAlign = "center";
    ctx.fillStyle = accent;
    ctx.shadowColor = `${accent}99`;
    ctx.shadowBlur = 24;
    ctx.font = "900 64px Arial, sans-serif";
    ctx.fillText(tournament.slice(0, 34), CANVAS_W / 2, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.85;
    ctx.font = "700 18px Arial, sans-serif";
    ctx.fillText("OFFICIAL POINT TABLE", CANVAS_W / 2, y + 40);
    ctx.globalAlpha = 1;

    const tableX = 80;
    const tableY = y + 110;
    const tableW = CANVAS_W - 160;
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(tableX, tableY, tableW, 74 + ranked.length * 64);
    ctx.strokeStyle = `${accent}66`;
    ctx.lineWidth = 2;
    ctx.strokeRect(tableX, tableY, tableW, 74 + ranked.length * 64);

    ctx.fillStyle = `${tagColor}26`;
    ctx.fillRect(tableX, tableY, tableW, 74);
    ctx.fillStyle = tagColor;
    ctx.font = "800 16px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("RANK", tableX + 24, tableY + 46);
    ctx.fillText("LOGO", tableX + 110, tableY + 46);
    ctx.fillText("     TEAM NAME", tableX + 188, tableY + 46);
    ctx.textAlign = "center";
    ctx.fillText("KILLS", tableX + tableW - 360, tableY + 46);
    ctx.fillText("POS", tableX + tableW - 260, tableY + 46);
    ctx.fillText("BOOYAH", tableX + tableW - 160, tableY + 46);
    ctx.textAlign = "right";
    ctx.fillText("TOTAL", tableX + tableW - 24, tableY + 46);

    const fitText = (value: string, max: number) => {
      let text = value || "Team NAME";
      while (ctx.measureText(text).width > max && text.length > 4) text = `${text.slice(0, -4)}...`;
      return text;
    };

    for (const [i, row] of ranked.entries()) {
      const rowY = tableY + 74 + i * 64;
      ctx.fillStyle = i === 0 ? `${tagColor}18` : "rgba(255,255,255,0.02)";
      ctx.fillRect(tableX, rowY, tableW, 64);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(tableX, rowY);
      ctx.lineTo(tableX + tableW, rowY);
      ctx.stroke();

      ctx.textBaseline = "middle";
      ctx.fillStyle = i === 0 ? tagColor : textColor;
      ctx.font = "900 24px Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`#${i + 1}`, tableX + 24, rowY + 32);

      if (row.logo) {
        const logo = await loadImageSafe(row.logo);
        if (logo) ctx.drawImage(logo, tableX + 104, rowY + 8, 48, 48);
      }

      ctx.fillStyle = textColor;
      ctx.font = "700 20px Arial, sans-serif";
      ctx.fillText(fitText(row.name, 320), tableX + 188, rowY + 32);
      ctx.textAlign = "center";
      ctx.fillText(String(row.kills), tableX + tableW - 360, rowY + 32);
      ctx.fillText(String(row.pos), tableX + tableW - 260, rowY + 32);
      ctx.fillStyle = "#fb923c";
      ctx.font = "800 20px Arial, sans-serif";
      ctx.fillText(String(row.booyah), tableX + tableW - 160, rowY + 32);
      ctx.textAlign = "right";
      ctx.fillStyle = tagColor;
      ctx.font = "800 22px Arial, sans-serif";
      ctx.fillText(String(row.total), tableX + tableW - 24, rowY + 32);
      ctx.textBaseline = "alphabetic";
    }

    try {
      return canvas.toDataURL("image/png");
    } catch {
      // Canvas tainted — strip background and retry with a clean canvas
      const safeCanvas = document.createElement("canvas");
      safeCanvas.width = canvas.width;
      safeCanvas.height = canvas.height;
      const sctx = safeCanvas.getContext("2d")!;
      sctx.fillStyle = "#0b1224";
      sctx.fillRect(0, 0, safeCanvas.width, safeCanvas.height);
      return safeCanvas.toDataURL("image/png");
    }
  };

  const download = async (resolution: Resolution) => {
    if (!ref.current || !user) return;
    if (!isUnlocked(resolution, userMax)) {
      return toast.error("Upgrade your credits package to unlock this resolution.");
    }
    if (credits <= 0) {
      return toast.error("You need credits to download. Buy a pack from the Credits page.");
    }

    // Render PNG from the actual preview DOM so download === preview exactly.
    let pngDataUrl = "";
    try {
      pngDataUrl = await renderPng(resolution);
    } catch (htiErr) {
      console.warn("html-to-image failed, falling back to canvas:", htiErr);
      try {
        pngDataUrl = await drawFallbackPng(resolution);
      } catch (canvasErr) {
        console.warn("Canvas renderer failed, using minimal canvas:", canvasErr);
        const c = document.createElement("canvas");
        c.width = CANVAS_W; c.height = CANVAS_H;
        const cx = c.getContext("2d");
        if (cx) {
          cx.fillStyle = "#0b1224";
          cx.fillRect(0, 0, CANVAS_W, CANVAS_H);
          cx.fillStyle = accent;
          cx.font = "900 64px Arial, sans-serif";
          cx.textAlign = "center";
          cx.fillText(tournament.slice(0, 34), CANVAS_W / 2, 200);
        }
        try { pngDataUrl = c.toDataURL("image/png"); } catch { /* ignore */ }
      }
    }

    if (!pngDataUrl) {
      // Absolute last resort — should be unreachable.
      console.error("No PNG produced; aborting silently.");
      return;
    }

    // Trigger download immediately so user always gets the file.
    const a = document.createElement("a");
    a.href = pngDataUrl;
    a.download = `${tournament.replace(/\s+/g, "_") || "point_table"}_${resolution}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setPickerOpen(false);

    // Spend credit + save history in the background; never block or fail UX.
    supabase.rpc("spend_credit_for_download", {
      _table_id: null as unknown as string,
      _resolution: resolution,
    }).then(({ data, error }) => {
      if (error) {
        console.warn("spend_credit_for_download:", error.message);
        toast.success("Downloaded!");
      } else {
        toast.success(typeof data === "number" ? `Downloaded! ${data} credits left.` : "Downloaded!");
      }
      refresh();
    });

    const safeRows = ranked.map(({ name, kills, pos, booyah, total, idx }) => ({ name, kills, pos, booyah, total, idx }));
    supabase.from("point_tables").insert({
      user_id: user.id, tournament_name: tournament, data: { rows: safeRows },
    }).then(({ error: saveError }) => {
      if (saveError) console.warn("Point table history save skipped:", saveError.message);
    });
  };

  return (
    <>
      <h1 className="sr-only">Create Point Table</h1>
    <div className="grid gap-8 lg:grid-cols-[420px_1fr]">

      <div className="glass rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">Tournament Name</label>
          <Input value={tournament} onChange={(e) => setTournament(e.target.value)} className="mt-1" />
        </div>

        {/* Tournament logo (premium) */}
        <div>
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            Tournament Logo {!canUpload && <Lock className="h-3 w-3" />}
            <span className="text-[10px] uppercase tracking-wider text-primary">Premium</span>
          </label>
          <div className="mt-1 flex items-center gap-2">
            <label className="flex-1">
              <input
                type="file" accept="image/*" hidden
                disabled={!canUpload}
                onChange={(e) => { handleTournamentLogo(e.target.files?.[0]); e.target.value = ""; }}
              />
              <Button asChild variant="outline" size="sm" className="w-full cursor-pointer" disabled={!canUpload}>
                <span><ImagePlus className="h-4 w-4 mr-1.5" />{tournamentLogo ? "Replace logo" : "Upload logo"}</span>
              </Button>
            </label>
            {tournamentLogo && (
              <Button variant="ghost" size="icon" onClick={() => setTournamentLogo(null)} aria-label="Remove logo">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {tournamentLogo && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10">Size</span>
              <input
                type="range" min={60} max={400} value={tournamentLogoSize}
                onChange={(e) => setTournamentLogoSize(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-xs text-muted-foreground w-10 text-right">{tournamentLogoSize}px</span>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm text-muted-foreground">Text Color (all text)</label>
          <div className="flex gap-2 items-center mt-1">
            <Input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-16 h-10 p-1" />
            <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} placeholder="#ffffff" />
          </div>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Tag Color</label>
          <div className="flex gap-2 items-center mt-1">
            <Input type="color" value={tagColor} onChange={(e) => setTagColor(e.target.value)} className="w-16 h-10 p-1" />
            <Input value={tagColor} onChange={(e) => setTagColor(e.target.value)} placeholder="#f59e0b" />
          </div>
        </div>

        {canUpload && (
          <div>
            <label className="text-sm text-muted-foreground">Your Thumbnails</label>
            <div className="mt-1 flex items-center gap-2">
              <label className="flex-1">
                <input type="file" accept="image/*" hidden onChange={handleUpload} disabled={uploading} />
                <Button asChild variant="outline" size="sm" className="w-full cursor-pointer" disabled={uploading}>
                  <span><Upload className="h-4 w-4 mr-1.5" />{uploading ? "Uploading…" : "Upload your thumbnail"}</span>
                </Button>
              </label>
            </div>
            {credits <= 0 && userTpls.length > 0 && (
              <p className="text-[11px] text-destructive mt-1.5">Out of credits — your thumbnails are locked. Buy a pack to use them.</p>
            )}
          </div>
        )}

        <div>
          <label className="text-sm text-muted-foreground">Template</label>
          <div className="mt-1 grid grid-cols-3 gap-2 max-h-44 overflow-y-auto">
            <button onClick={() => setTplId(null)}
              className={`relative h-16 rounded-lg border-2 text-[10px] font-semibold ${tplId === null ? "border-primary" : "border-border"}`}
              style={{ background: "transparent" }}>
              None
            </button>
            {userTpls.map((t) => (
              <div key={t.id} className="relative group">
                <button
                  onClick={() => t.locked ? toast.error("Locked — buy credits to use your thumbnails.") : setTplId(t.id)}
                  className={`relative h-16 w-full rounded-lg border-2 overflow-hidden ${tplId === t.id ? "border-primary" : "border-primary/40"} ${t.locked ? "opacity-50" : ""}`}
                  title={t.name}>
                  <img src={t.image_url} alt={t.name} className="absolute inset-0 w-full h-full object-cover" />
                  {t.locked && <Lock className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow" />}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] px-1 truncate text-white">★ {t.name}</span>
                </button>
                <button onClick={() => deleteThumb(t)}
                  aria-label={`Delete thumbnail ${t.name}`}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {templates.map((t) => (
              <button key={t.id} onClick={() => setTplId(t.id)}
                className={`relative h-16 rounded-lg border-2 overflow-hidden ${tplId === t.id ? "border-primary" : "border-border"}`}
                title={t.name}>
                <img src={t.image_url} alt={t.name} className="absolute inset-0 w-full h-full object-cover" />
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] px-1 truncate text-white">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[40px_1fr_48px_48px_56px] gap-2 items-center">
              <label
                className={`relative h-10 w-10 rounded border border-border flex items-center justify-center overflow-hidden ${canUpload ? "cursor-pointer hover:border-primary" : "opacity-60 cursor-not-allowed"}`}
                title={canUpload ? "Upload team logo (premium)" : "Premium feature"}
              >
                <input
                  type="file" accept="image/*" hidden disabled={!canUpload}
                  onChange={(e) => { handleTeamLogo(i, e.target.files?.[0]); e.target.value = ""; }}
                />
                {r.logo ? (
                  <>
                    <img src={r.logo} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); update(i, { logo: null }); }}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      aria-label="Remove logo"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </>
                ) : canUpload ? <ImagePlus className="h-4 w-4 text-muted-foreground" /> : <Lock className="h-3 w-3 text-muted-foreground" />}
              </label>
              <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder={`Team NAME ${i + 1}`} />
              <Input type="number" min={0} value={r.kills} onChange={(e) => update(i, { kills: Number(e.target.value) || 0 })} placeholder="K" title="Kills" />
              <Input type="number" min={0} value={r.pos} onChange={(e) => update(i, { pos: Number(e.target.value) || 0 })} placeholder="P" title="Position points" />
              <Input type="number" min={0} value={r.booyah} onChange={(e) => update(i, { booyah: Number(e.target.value) || 0 })} placeholder="B" title="Booyah" className="text-orange-400" />
            </div>
          ))}
        </div>
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogTrigger asChild>
            <Button className="w-full neon-border h-11">
              <Download className="h-4 w-4 mr-2" /> Download (1 credit)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Choose download quality</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground -mt-2">Your plan unlocks up to <span className="neon-text font-bold">{userMax.toUpperCase()}</span>.</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {RESOLUTIONS.map((r) => {
                const unlocked = isUnlocked(r, userMax);
                return (
                  <button
                    key={r}
                    onClick={() => unlocked ? download(r) : toast.error("Upgrade your credits package to unlock this resolution.")}
                    className={`relative glass rounded-xl p-4 text-left transition ${unlocked ? "hover:neon-border cursor-pointer" : "opacity-60 cursor-not-allowed"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{RES_LABEL[r]}</span>
                      {unlocked ? <Sparkles className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    {!unlocked && <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Premium · Upgrade</div>}
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <PreviewArea
        canvasW={CANVAS_W}
        canvasH={CANVAS_H}
        innerRef={ref}
        tpl={tpl}
        textColor={textColor}
      >
        {tournamentLogo && (
          <div className="flex justify-center mb-4">
            <img
              src={tournamentLogo}
              alt="Tournament logo"
              style={{ height: tournamentLogoSize, width: "auto", objectFit: "contain" }}
              crossOrigin="anonymous"
            />
          </div>
        )}
        <h2 className="text-center font-black tracking-tight"
          style={{ color: accent, textShadow: `0 0 24px ${accent}80`, fontSize: 64 }}>
          {tournament}
        </h2>
              <p className="text-center uppercase mt-2" style={{ letterSpacing: 6, fontSize: 18, color: textColor, opacity: 0.85 }}>
                Official Point Table
              </p>
              <div data-table-frame className="mt-10 rounded-2xl overflow-hidden"
                style={{
                  background: tpl ? "rgba(0,0,0,0.35)" : "rgba(15,23,42,0.6)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${accent}40`,
                }}>
                <div className="grid items-center px-6 py-4 font-bold uppercase whitespace-nowrap"
                  style={{ gridTemplateColumns: "80px 64px 1fr 90px 90px 110px 110px", fontSize: 16, color: tagColor, background: `${tagColor}1A`, letterSpacing: 2 }}>
                  <div>Rank</div><div>Logo</div><div>Team NAME</div><div className="text-center">Kills</div><div className="text-center">Pos</div><div className="text-center" style={{ color: "#fb923c" }}>Booyah</div><div className="text-right">Total</div>
                </div>
                {ranked.map((r, i) => (
                  <div key={r.idx} className="grid items-center px-6 py-3 whitespace-nowrap"
                    style={{ gridTemplateColumns: "80px 64px 1fr 90px 90px 110px 110px", fontSize: 20, borderTop: "1px solid rgba(255,255,255,0.08)", background: i === 0 ? `${tagColor}14` : "transparent" }}>
                    <div className="font-black" style={{ fontSize: 24, color: i === 0 ? tagColor : textColor, textShadow: i === 0 ? `0 0 14px ${tagColor}99` : "none" }}>#{i + 1}</div>
                    <div className="flex items-center">
                      {r.logo ? (
                        <img src={r.logo} alt="" style={{ height: 48, width: 48, objectFit: "cover", borderRadius: 8 }} />
                      ) : (
                        <div style={{ height: 48, width: 48 }} />
                      )}
                    </div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-center">{r.kills}</div>
                    <div className="text-center">{r.pos}</div>
                    <div className="text-center font-bold" style={{ color: "#fb923c" }}>{r.booyah}</div>
                    <div className="text-right font-bold" style={{ color: tagColor }}>{r.total}</div>
                  </div>
                ))}
              </div>
      </PreviewArea>
    </div>
    </>

  );
}

function PreviewArea({
  canvasW, canvasH, innerRef, tpl, textColor, children,
}: {
  canvasW: number; canvasH: number;
  innerRef: React.RefObject<HTMLDivElement | null>;
  tpl: Template | null;
  textColor: string;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / canvasW));
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasW]);
  return (
    <div ref={wrapRef} className="mx-auto w-full max-w-[540px]">
      <div className="relative" style={{ aspectRatio: `${canvasW} / ${canvasH}` }}>
        <div
          ref={innerRef}
          style={{
            width: canvasW,
            height: canvasH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: tpl ? `url(${tpl.image_url}) center/cover no-repeat` : NONE_BG,
            padding: 80,
            boxSizing: "border-box",
            color: textColor,
            position: "absolute",
            top: 0, left: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
