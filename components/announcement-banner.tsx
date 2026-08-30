"use client";

import { useEffect, useState } from "react";
import { Bell, Check, CircleAlert, Megaphone, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Announcement = {
  id: number;
  notificationId: number;
  title: string;
  message: string;
  priority: "info" | "important" | "urgent";
  endsAt: string | null;
  readAt: string | null;
};

const priorityStyle = {
  info: { icon: Bell, shell: "border-[#b9d3e5] bg-[#edf6fb] text-[#245d82]", label: "Informasi" },
  important: { icon: Megaphone, shell: "border-[#ead39a] bg-[#fff8e8] text-[#825f16]", label: "Penting" },
  urgent: { icon: CircleAlert, shell: "border-[#e5b7b2] bg-[#fff1ef] text-[#9e3e37]", label: "Mendesak" },
} as const;

export function AnnouncementBanner({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch("/api/announcements", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { data: Announcement[] }) => setItems(payload.data.sort((a, b) => {
        const rank = { urgent: 3, important: 2, info: 1 };
        return rank[b.priority] - rank[a.priority];
      })))
      .catch(() => undefined);
    return () => controller.abort();
  }, [enabled]);

  const announcement = items[0];
  if (!announcement) return null;
  const appearance = priorityStyle[announcement.priority];
  const Icon = appearance.icon;
  const dismiss = async () => {
    setItems((current) => current.filter((item) => item.id !== announcement.id));
    if (!announcement.readAt) await fetch(`/api/notifications/${announcement.notificationId}`, { method: "PATCH" }).catch(() => undefined);
  };
  return <section className={cn("mb-6 flex items-start gap-3 border-l-4 px-4 py-3.5", appearance.shell)} aria-label="Pengumuman admin">
    <Icon size={19} className="mt-0.5 shrink-0" />
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-extrabold uppercase tracking-[.16em]">Pengumuman Admin · {appearance.label}</span>{!announcement.readAt && <span className="rounded-full bg-current px-2 py-0.5 text-[9px] font-bold text-white opacity-80">Baru</span>}</div><h2 className="mt-1 text-sm font-bold text-[#183044]">{announcement.title}</h2><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[#5e6d75]">{announcement.message}</p>{announcement.endsAt && <p className="mt-1.5 text-[10px] opacity-70">Berlaku sampai {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(announcement.endsAt))} WIB</p>}</div>
    <button onClick={() => void dismiss()} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-black/5" aria-label="Tutup dan tandai dibaca">{announcement.readAt ? <X size={16} /> : <Check size={16} />}</button>
  </section>;
}
