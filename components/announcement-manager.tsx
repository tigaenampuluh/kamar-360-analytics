"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, Megaphone, Pencil, Power, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Announcement = {
  id: number;
  title: string;
  message: string;
  priority: "info" | "important" | "urgent";
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  recipientCount: number;
  readCount: number;
  createdAt: string;
};

type AnnouncementDraft = Pick<Announcement, "title" | "message" | "priority"> & { endsAt: string };
const emptyDraft: AnnouncementDraft = { title: "", message: "", priority: "info", endsAt: "" };

export function AnnouncementManager() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/announcements", { cache: "no-store" });
      const payload = await response.json() as { data?: Announcement[]; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Pengumuman belum dapat dimuat.");
      setItems(payload.data);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Pengumuman belum dapat dimuat.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setFeedback("");
    try {
      const response = await fetch(editingId ? `/api/admin/announcements/${editingId}` : "/api/admin/announcements", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Pengumuman belum dapat disimpan.");
      setFeedback(editingId ? "Pengumuman berhasil diperbarui." : "Pengumuman diterbitkan ke seluruh anggota.");
      setEditingId(null); setDraft(emptyDraft); await load();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Pengumuman belum dapat disimpan."); }
    finally { setSaving(false); }
  };

  const toggle = async (item: Announcement) => {
    await fetch(`/api/admin/announcements/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !item.active }) });
    await load();
  };

  const edit = (item: Announcement) => {
    setEditingId(item.id);
    setDraft({ title: item.title, message: item.message, priority: item.priority, endsAt: item.endsAt ? new Date(item.endsAt).toISOString().slice(0, 16) : "" });
  };

  return <section className="mt-6 bg-white p-6 md:p-8">
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff1ea] text-[#d45f2c]"><Megaphone size={18} /></span><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#e76f36]">Pengumuman Admin</div><h2 className="mt-1 font-serif text-2xl font-semibold">Kabar untuk seluruh workspace</h2><p className="mt-1 text-sm leading-6 text-[#747d81]">Pengumuman muncul sebagai banner Dashboard dan pada kategori Pengumuman Admin di lonceng.</p></div></div>
    <form onSubmit={submit} className="mt-6 grid gap-4 border border-[#e5e2da] bg-[#faf9f5] p-4 lg:grid-cols-[1fr_180px]">
      <label className="text-xs font-bold text-[#59656c]">Judul<Input className="mt-2 bg-white font-normal" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} maxLength={160} required /></label>
      <label className="text-xs font-bold text-[#59656c]">Prioritas<select className="mt-2 h-10 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm font-normal" value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as typeof current.priority }))}><option value="info">Informasi</option><option value="important">Penting</option><option value="urgent">Mendesak</option></select></label>
      <label className="text-xs font-bold text-[#59656c] lg:col-span-2">Isi<textarea className="mt-2 min-h-24 w-full resize-y rounded-md border border-[#d9d7cf] bg-white p-3 text-sm font-normal outline-none focus:border-[#e76f36]" value={draft.message} onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} maxLength={2000} required /></label>
      <label className="text-xs font-bold text-[#59656c]">Berakhir (opsional)<Input type="datetime-local" className="mt-2 bg-white font-normal" value={draft.endsAt} onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))} /></label>
      <div className="flex items-end justify-end gap-2"><Button type="button" variant="ghost" className={editingId ? "" : "hidden"} onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>Batal</Button><Button type="submit" disabled={saving || draft.title.trim().length < 3 || draft.message.trim().length < 3}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : editingId ? <Check size={15} /> : <Send size={15} />}{saving ? "Menyimpan..." : editingId ? "Simpan perubahan" : "Terbitkan"}</Button></div>
    </form>
    {feedback && <div className="mt-4 border-l-2 border-[#4f826c] bg-[#e5efe9] px-3 py-2 text-xs text-[#356450]">{feedback}</div>}
    <div className="mt-6 divide-y divide-[#ebe8df] border-y border-[#ebe8df]">
      {loading ? <div className="grid min-h-32 place-items-center text-[#e76f36]"><LoaderCircle className="animate-spin" size={22} /></div> : items.map((item) => <article key={item.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-[#183044]">{item.title}</h3><Badge className={item.active ? "bg-[#e5efe9] text-[#356450]" : "bg-[#ecebea] text-[#6f7679]"}>{item.active ? "Aktif" : "Nonaktif"}</Badge><Badge className="bg-[#fff1ea] text-[#b7552d]">{item.priority}</Badge></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#737d82]">{item.message}</p><p className="mt-1 text-[10px] text-[#92989b]">Dibaca {item.readCount} dari {item.recipientCount} penerima · {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(item.createdAt))} WIB</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => edit(item)}><Pencil size={13} /> Edit</Button><Button size="sm" variant="ghost" onClick={() => void toggle(item)}><Power size={13} /> {item.active ? "Nonaktifkan" : "Aktifkan"}</Button></div></article>)}
      {!loading && items.length === 0 && <div className="py-10 text-center text-xs text-[#8a9194]">Belum ada pengumuman.</div>}
    </div>
  </section>;
}
