"use client";

import { useCallback, useEffect, useState } from "react";
import { History, LoaderCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type VersionItem = {
  id: number;
  version: number;
  changes: string[];
  action: "create" | "update" | "archive" | "restore";
  createdByName: string;
  createdAt: string;
};

export function ProjectVersionHistory({ projectId, currentVersion, onRestored }: { projectId: number; currentVersion: number; onRestored: () => Promise<void> | void }) {
  const [items, setItems] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/versions`, { cache: "no-store" });
      const payload = await response.json() as { data?: VersionItem[]; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Riwayat versi belum dapat dimuat.");
      setItems(payload.data); setError("");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Riwayat versi belum dapat dimuat."); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load, currentVersion]);

  const restore = async (item: VersionItem) => {
    if (!window.confirm(`Pulihkan project dari versi ${item.version}? Kondisi saat ini tetap disimpan sebagai riwayat.`)) return;
    setRestoring(item.id); setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/versions/${item.id}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: currentVersion }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Versi belum dapat dipulihkan.");
      await onRestored(); await load();
    } catch (restoreError) { setError(restoreError instanceof Error ? restoreError.message : "Versi belum dapat dipulihkan."); }
    finally { setRestoring(null); }
  };

  return <section className="border-t border-[#e5e2da] pt-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#92989b]"><History size={13} />Version History</div><span className="text-[10px] text-[#9a9fa2]">Maks. 100 versi</span></div>
    {error && <div className="mb-3 border-l-2 border-[#d8564e] bg-[#f9e8e5] px-3 py-2 text-xs text-[#a43d37]">{error}</div>}
    {loading ? <div className="grid min-h-20 place-items-center text-[#e76f36]"><LoaderCircle size={18} className="animate-spin" /></div> : <div className="max-h-56 space-y-2 overflow-y-auto pr-1 thin-scrollbar">{items.map((item) => <article key={item.id} className="flex items-start gap-3 border border-[#e5e2da] bg-[#faf9f5] p-3"><Badge className="shrink-0 bg-white text-[#36566c]">v{item.version}</Badge><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-[#183044]">{item.action === "restore" ? "Pemulihan versi" : item.action === "create" ? "Project dibuat" : item.action === "archive" ? "Perubahan arsip" : "Project diperbarui"}</div><div className="mt-1 text-[10px] leading-4 text-[#727d82]">{item.changes.join(" · ")} · {item.createdByName}</div><div className="mt-1 text-[10px] text-[#9a9fa2]">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(item.createdAt))} WIB</div></div>{item.version !== currentVersion && <Button size="sm" variant="ghost" onClick={() => void restore(item)} disabled={restoring !== null}>{restoring === item.id ? <LoaderCircle size={13} className="animate-spin" /> : <RotateCcw size={13} />} Pulihkan</Button>}</article>)}</div>}
  </section>;
}
