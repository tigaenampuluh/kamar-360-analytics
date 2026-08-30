"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Archive,
  ArrowUpRight,
  Bell,
  Camera,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  FolderOpen,
  GripVertical,
  History,
  KeyRound,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LogIn,
  MailPlus,
  Megaphone,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import packageInfo from "@/package.json";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { AnnouncementManager } from "@/components/announcement-manager";
import { ProjectVersionHistory } from "@/components/project-version-history";

type View = "dashboard" | "tracker" | "calendar" | "library" | "activity" | "admin" | "profile";
type Status = "On Going" | "Delay" | "Pending" | "Revisi" | "Done";
type Priority = "High" | "Medium" | "Low";
type ProjectMemberRole = "Lead" | "Anggota" | "Viewer";

const WIB_TIME_ZONE = "Asia/Jakarta";
const APP_VERSION = packageInfo.version;
const AUTH_IDLE_TIMEOUT_MS = 10 * 60 * 1_000;
const AUTH_ACTIVITY_STORAGE_KEY = "360-auth-last-activity";
const AUTH_TABS_STORAGE_KEY = "360-auth-open-tabs";
const AUTH_LAST_TAB_CLOSED_KEY = "360-auth-last-tab-closed";
const AUTH_TAB_ID_KEY = "360-auth-tab-id";
const AUTH_TAB_STALE_MS = AUTH_IDLE_TIMEOUT_MS + 2 * 60_000;

type WibDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const wibPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: WIB_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getWibDateParts(date: Date): WibDateParts {
  const parts = Object.fromEntries(
    wibPartsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function useWibClock(intervalMs = 1_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function useIdleLogout(enabled: boolean, onIdle: () => void) {
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;

    const now = Date.now();
    let lastActivity = now;

    type TabRegistry = Record<string, number>;
    const readTabs = () => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(AUTH_TABS_STORAGE_KEY) || "{}") as TabRegistry;
        return Object.fromEntries(Object.entries(parsed).filter(([, heartbeat]) => Date.now() - Number(heartbeat) < AUTH_TAB_STALE_MS));
      } catch {
        return {} as TabRegistry;
      }
    };
    const writeTabs = (tabs: TabRegistry) => {
      try {
        window.localStorage.setItem(AUTH_TABS_STORAGE_KEY, JSON.stringify(tabs));
      } catch {
        // Visibility-based logout still works without the cross-tab registry.
      }
    };
    const navigation = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const existingTabs = readTabs();
    const storedTabId = window.sessionStorage.getItem(AUTH_TAB_ID_KEY);
    const tabId = !storedTabId || (existingTabs[storedTabId] && navigation?.type !== "reload") ? window.crypto.randomUUID() : storedTabId;
    window.sessionStorage.setItem(AUTH_TAB_ID_KEY, tabId);
    let lastTabClosedAt = 0;
    try {
      lastTabClosedAt = Number(window.localStorage.getItem(AUTH_LAST_TAB_CLOSED_KEY));
    } catch {
      // Continue with the visibility timer.
    }
    if (Object.keys(existingTabs).length === 0 && lastTabClosedAt > 0 && navigation?.type !== "reload") {
      onIdleRef.current();
      return;
    }
    writeTabs({ ...existingTabs, [tabId]: now });
    try {
      window.localStorage.removeItem(AUTH_LAST_TAB_CLOSED_KEY);
    } catch {
      // Continue with the visibility timer.
    }

    try {
      const storedActivity = Number(window.localStorage.getItem(AUTH_ACTIVITY_STORAGE_KEY));
      if (Number.isFinite(storedActivity) && storedActivity > 0) {
        lastActivity = storedActivity;
      } else {
        window.localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, String(now));
      }
    } catch {
      // The in-memory timer still works if browser storage is unavailable.
    }

    const checkForIdle = () => {
      try {
        const sharedActivity = Number(window.localStorage.getItem(AUTH_ACTIVITY_STORAGE_KEY));
        if (Number.isFinite(sharedActivity) && sharedActivity > lastActivity) lastActivity = sharedActivity;
      } catch {
        // Keep using the most recent in-memory activity timestamp.
      }

      if (Date.now() - lastActivity < AUTH_IDLE_TIMEOUT_MS) return false;
      onIdleRef.current();
      return true;
    };

    const recordVisibleTab = () => {
      const activityAt = Date.now();
      lastActivity = activityAt;
      try {
        window.localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, String(activityAt));
      } catch {
        // The local tab remains protected by the in-memory timer.
      }
    };

    const handleVisibility = () => {
      if (document.hidden || checkForIdle()) return;
      recordVisibleTab();
    };

    const handleSharedActivity = (event: StorageEvent) => {
      if (event.key !== AUTH_ACTIVITY_STORAGE_KEY) return;
      if (event.newValue === null) {
        onIdleRef.current();
        return;
      }
      const sharedActivity = Number(event.newValue);
      if (Number.isFinite(sharedActivity) && sharedActivity > 0) lastActivity = sharedActivity;
    };

    const heartbeat = () => {
      const tabs = readTabs();
      writeTabs({ ...tabs, [tabId]: Date.now() });
      if (!document.hidden) recordVisibleTab();
      else checkForIdle();
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      const tabs = readTabs();
      delete tabs[tabId];
      writeTabs(tabs);
      if (Object.keys(tabs).length === 0) {
        try {
          window.localStorage.setItem(AUTH_LAST_TAB_CLOSED_KEY, String(Date.now()));
        } catch {
          // Reopening the app is still guarded by the 10-minute visibility timer.
        }
      }
    };

    window.addEventListener("focus", handleVisibility);
    window.addEventListener("storage", handleSharedActivity);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);
    const idleTimer = window.setInterval(heartbeat, 15_000);
    if (!checkForIdle() && !document.hidden) recordVisibleTab();

    return () => {
      window.clearInterval(idleTimer);
      window.removeEventListener("focus", handleVisibility);
      window.removeEventListener("storage", handleSharedActivity);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled]);
}

function greetingForWibHour(hour: number) {
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 18) return "Selamat sore";
  return "Selamat malam";
}

type Project = {
  id: number;
  version?: number;
  title: string;
  status: Status;
  priority: Priority;
  category: string;
  pic: string;
  initials: string;
  deadline: string;
  deadlineIso?: string;
  completedAtIso?: string;
  note: string;
  workingDocLink?: string;
  primaryPicUserId?: string | null;
  members?: ProjectMember[];
  archivedAt?: string | null;
};

type WorkspaceMemberOption = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  workspaceRole: "Admin" | "Anggota";
};

type ProjectMember = {
  userId: string;
  name: string;
  email: string;
  username?: string | null;
  image: string | null;
  role: ProjectMemberRole;
};

type ProjectComment = {
  id: number;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  mentionUserIds: string[];
};

type ProjectApproval = {
  id: number;
  status: "pending" | "approved" | "rejected";
  requestNote: string;
  reviewNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  requestedByName: string;
  reviewedByName: string | null;
};

type ProjectPermissions = {
  role: "Admin" | ProjectMemberRole | null;
  canEdit: boolean;
  canManageMembers: boolean;
  canComment: boolean;
  canRequestCompletion: boolean;
  canApproveCompletion: boolean;
  canDelete: boolean;
};

type ProjectCollaboration = {
  members: ProjectMember[];
  comments: ProjectComment[];
  approval: ProjectApproval | null;
  permissions: ProjectPermissions;
};

type ApiProject = Omit<Project, "deadline" | "note" | "initials" | "completedAtIso" | "workingDocLink"> & {
  deadline: string;
  doneAt: string | null;
  description: string;
  picInitials: string;
  workingDocLink: string | null;
};

function fromApiProject(project: ApiProject): Project {
  return {
    ...project,
    initials: project.picInitials,
    deadline: new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(new Date(project.deadline)).replace(".", ""),
    deadlineIso: project.deadline,
    completedAtIso: project.doneAt || undefined,
    note: project.description,
    workingDocLink: project.workingDocLink || undefined,
  };
}

function toProjectPayload(project: Project) {
  return {
    title: project.title,
    description: project.note,
    pic: project.pic,
    picInitials: project.initials,
    deadline: project.deadlineIso || new Date().toISOString(),
    status: project.status,
    priority: project.priority,
    category: project.category,
    workingDocLink: project.workingDocLink || null,
    primaryPicUserId: project.primaryPicUserId ?? null,
    memberAssignments: (project.members ?? []).map((member) => ({ userId: member.userId, role: member.role })),
    expectedVersion: project.version,
  };
}

const initialProjects: Project[] = [
  { id: 1, title: "Riset Persepsi Publik Q3", status: "On Going", priority: "High", category: "Brand Research", pic: "Nadia Putri", initials: "NP", deadline: "28 Agu", deadlineIso: "2026-08-28T17:00:00+07:00", note: "Finalisasi kuesioner dan koordinasi distribusi dengan tim lapangan." },
  { id: 2, title: "Social Listening — Isu Pangan", status: "On Going", priority: "Medium", category: "Social Listening", pic: "Arga Wibawa", initials: "AW", deadline: "02 Sep", deadlineIso: "2026-09-02T17:00:00+07:00", note: "Analisis percakapan organik dan pemetaan sentimen mingguan." },
  { id: 3, title: "Pemetaan Media Nasional", status: "On Going", priority: "Low", category: "Media Mapping", pic: "Dita Anjani", initials: "DA", deadline: "05 Sep", deadlineIso: "2026-09-05T17:00:00+07:00", note: "Verifikasi profil dan jangkauan 60 media prioritas." },
  { id: 4, title: "Audit Kanal Digital", status: "Delay", priority: "High", category: "Digital Audit", pic: "Fikri Ramadhan", initials: "FR", deadline: "24 Agu", deadlineIso: "2026-08-24T17:00:00+07:00", note: "Menunggu akses data analytics dari pihak klien." },
  { id: 5, title: "FGD Komunitas Urban", status: "Delay", priority: "Medium", category: "Qualitative", pic: "Nadia Putri", initials: "NP", deadline: "26 Agu", deadlineIso: "2026-08-26T15:00:00+07:00", note: "Dua responden utama belum mengonfirmasi kehadiran." },
  { id: 6, title: "Benchmark Industri Energi", status: "Pending", priority: "Medium", category: "Desk Research", pic: "Arga Wibawa", initials: "AW", deadline: "10 Sep", deadlineIso: "2026-09-10T17:00:00+07:00", note: "Brief internal selesai, menunggu material pendukung." },
  { id: 7, title: "Survei Kepuasan Mitra", status: "Pending", priority: "Low", category: "Survey", pic: "Maya Kirana", initials: "MK", deadline: "12 Sep", deadlineIso: "2026-09-12T17:00:00+07:00", note: "Sampling frame sedang disusun." },
  { id: 8, title: "Laporan Tren Gen Z", status: "Revisi", priority: "High", category: "Trend Report", pic: "Dita Anjani", initials: "DA", deadline: "27 Agu", deadlineIso: "2026-08-27T10:00:00+07:00", note: "Perbaiki narasi pada bagian implikasi bisnis dan executive summary." },
  { id: 9, title: "Analisis Kompetitor Fintech", status: "Done", priority: "Medium", category: "Competitor", pic: "Fikri Ramadhan", initials: "FR", deadline: "19 Agu", deadlineIso: "2026-08-19T17:00:00+07:00", completedAtIso: "2026-08-21T15:30:00+07:00", note: "Laporan final sudah diserahkan dan diarsipkan." },
  { id: 10, title: "Profil Audiens Podcast", status: "Done", priority: "Low", category: "Audience", pic: "Maya Kirana", initials: "MK", deadline: "16 Agu", deadlineIso: "2026-08-16T17:00:00+07:00", completedAtIso: "2026-08-18T11:00:00+07:00", note: "Dataset dan visualisasi final tersedia di Drive." },
];

const statusMeta: Record<Status, { dot: string; soft: string; text: string }> = {
  "On Going": { dot: "bg-[#3578a8]", soft: "bg-[#e6f0f7]", text: "text-[#28658f]" },
  Delay: { dot: "bg-[#d8564e]", soft: "bg-[#f9e8e5]", text: "text-[#b9433d]" },
  Pending: { dot: "bg-[#d29b32]", soft: "bg-[#f7efdc]", text: "text-[#996c17]" },
  Revisi: { dot: "bg-[#825a9f]", soft: "bg-[#efe8f4]", text: "text-[#6d468c]" },
  Done: { dot: "bg-[#4f826c]", soft: "bg-[#e5efe9]", text: "text-[#3f6f5b]" },
};

const statusColors: Record<Status, string> = {
  "On Going": "#3578a8",
  Delay: "#d8564e",
  Pending: "#d29b32",
  Revisi: "#825a9f",
  Done: "#4f826c",
};

const priorityMeta: Record<Priority, string> = {
  High: "bg-[#f9e8e5] text-[#b9433d]",
  Medium: "bg-[#f7efdc] text-[#996c17]",
  Low: "bg-[#e7ecef] text-[#66757e]",
};

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tracker", label: "Project Tracker", icon: FolderOpen },
  { id: "calendar", label: "Calendar Planner", icon: CalendarDays },
  { id: "library", label: "Asset & Library", icon: Archive },
  { id: "activity", label: "Activity History", icon: History },
  { id: "admin", label: "Admin Anggota", icon: ShieldCheck },
];

const teamColors: Record<string, string> = {
  NP: "bg-[#dfeae5] text-[#315b4b]",
  AW: "bg-[#e6edf4] text-[#355b7c]",
  DA: "bg-[#f2e7dc] text-[#805a36]",
  FR: "bg-[#ece5ef] text-[#684d76]",
  MK: "bg-[#f5e5e5] text-[#8a5050]",
};

type ActiveMember = {
  id: string;
  name: string;
  image: string | null;
  lastSeenAt: string;
  isCurrentUser: boolean;
};

function memberInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "RR";
}

function MiniAvatar({ initials, image, name, className }: { initials: string; image?: string | null; name?: string; className?: string }) {
  return (
    <Avatar className={cn("h-7 w-7 ring-2 ring-white", className)} title={name}>
      {image && <AvatarImage src={image} alt={name ? `Foto ${name}` : "Foto profil"} />}
      <AvatarFallback className={cn("text-[10px]", teamColors[initials] || "bg-[#dfeae5] text-[#315b4b]")}>{initials}</AvatarFallback>
    </Avatar>
  );
}

function ActiveTeam({ profile, backendEnabled }: { profile: ProfileData; backendEnabled: boolean }) {
  const currentMember = useMemo<ActiveMember>(() => ({
    id: backendEnabled ? profile.email : "demo-user",
    name: profile.name,
    image: profile.image,
    lastSeenAt: new Date().toISOString(),
    isCurrentUser: true,
  }), [backendEnabled, profile.email, profile.image, profile.name]);
  const [members, setMembers] = useState<ActiveMember[]>([currentMember]);

  useEffect(() => {
    if (!backendEnabled) {
      setMembers([currentMember]);
      return;
    }
    const controller = new AbortController();
    const loadPresence = async () => {
      try {
        const response = await fetch("/api/presence", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Gagal memuat anggota aktif");
        const payload = await response.json() as { data: ActiveMember[] };
        setMembers(payload.data.map((member) => member.isCurrentUser ? { ...member, name: profile.name, image: profile.image } : member));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMembers([currentMember]);
      }
    };
    void loadPresence();
    const refresh = window.setInterval(() => void loadPresence(), 60_000);
    return () => {
      controller.abort();
      window.clearInterval(refresh);
    };
  }, [backendEnabled, currentMember, profile.image, profile.name]);

  const visibleMembers = (members.length ? members : [currentMember]).slice(0, 4);
  const remaining = Math.max(0, members.length - visibleMembers.length);
  return (
    <div className="mt-4 flex items-center px-2" aria-label={`${members.length || 1} anggota aktif dalam 5 menit terakhir`}>
      {visibleMembers.map((member, index) => <span key={member.id} className={cn("relative", index > 0 && "-ml-2")} title={`${member.name} · aktif sekarang`}><MiniAvatar initials={memberInitials(member.name)} image={member.image} name={member.name} className="ring-[#193246]" /><i className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[#64c28a] ring-2 ring-[#193246]" /></span>)}
      {remaining > 0 && <span className="ml-3 text-xs text-[#9eb0bc]">+{remaining} lainnya</span>}
      {remaining === 0 && visibleMembers.length === 1 && <span className="ml-3 truncate text-xs text-[#9eb0bc]">{visibleMembers[0].name.split(" ")[0]} aktif</span>}
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  return <span role="img" aria-label="Logo 360 Center of Research" className={cn("block shrink-0 overflow-hidden rounded-lg bg-white shadow-sm", className)} style={{ backgroundImage: "url('/center-of-research-360.png')", backgroundPosition: "50% 43%", backgroundRepeat: "no-repeat", backgroundSize: "260%" }} />;
}

function Sidebar({ active, onChange, open, onClose, profile, projectCount, isAdmin, backendEnabled, onProfile, onLogout }: { active: View; onChange: (v: View) => void; open: boolean; onClose: () => void; profile: ProfileData; projectCount: number; isAdmin: boolean; backendEnabled: boolean; onProfile: () => void; onLogout: () => void }) {
  return (
    <>
      {open && <button className="fixed inset-0 z-30 bg-[#122838]/45 lg:hidden" onClick={onClose} aria-label="Tutup navigasi" />}
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-[#193246] px-4 py-5 text-white transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between px-2">
          <button onClick={() => onChange("dashboard")} className="flex items-center gap-3 text-left">
            <BrandMark className="h-10 w-10" />
            <span>
              <span className="block max-w-[155px] font-serif text-base font-semibold leading-tight">360 - Center of Research</span>
              <span className="mt-1 block text-[9px] uppercase tracking-[0.18em] text-[#9eb0bc]">Project Workspace</span>
            </span>
          </button>
          <button className="text-[#9eb0bc] lg:hidden" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="mt-10 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7790a0]">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navItems.filter((item) => item.id !== "admin" || isAdmin).map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button key={item.id} onClick={() => { onChange(item.id); onClose(); }} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition", selected ? "bg-white/10 font-semibold text-white" : "text-[#b7c4cc] hover:bg-white/[.06] hover:text-white")}>
                <Icon size={18} strokeWidth={selected ? 2.3 : 1.8} />
                {item.label}
                {item.id === "tracker" && <span className="ml-auto rounded-full bg-[#e76f36] px-2 py-0.5 text-[10px] font-bold text-white">{projectCount}</span>}
              </button>
            );
          })}
        </nav>

        <div className="mt-8 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7790a0]">Tim aktif</div>
        <ActiveTeam profile={profile} backendEnabled={backendEnabled} />

        <div className="mt-auto border-t border-white/10 pt-4">
          <button onClick={onProfile} className={cn("flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-white/[.06]", active === "profile" && "bg-white/10")} title="Buka profil">
            <Avatar className="h-9 w-9">{profile.image && <AvatarImage src={profile.image} alt={`Foto ${profile.name}`} />}<AvatarFallback className="bg-[#e76f36] text-white">{memberInitials(profile.name)}</AvatarFallback></Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{profile.name}</span>
              <span className="block text-xs text-[#91a4b0]">Lihat & edit profil</span>
            </span>
            <MoreHorizontal size={17} className="text-[#91a4b0]" />
          </button>
          <button onClick={onLogout} className="mt-1 w-full rounded-md px-3 py-2 text-left text-xs text-[#91a4b0] hover:bg-white/[.06] hover:text-white">Keluar dari workspace</button>
          <div className="mt-3 border-t border-white/10 px-2 pt-3 text-[9px] leading-4 text-[#7790a0]">v{APP_VERSION}<br />© 2026 360 – Center of Research<br />Made by Angga Santa Gideon</div>
        </div>
      </aside>
    </>
  );
}

type NotificationAlert = {
  id: string | number;
  title: string;
  description: string;
  time: string;
  view: View;
  kind: "deadline" | "project" | "agenda" | "activity" | "assignment" | "mention" | "approval" | "announcement";
  read: boolean;
};

const notificationAlerts: NotificationAlert[] = [
  { id: "deadline-audit", title: "Deadline project terlewat", description: "Audit Kanal Digital melewati deadline 24 Agu.", time: "Hari ini", view: "tracker", kind: "deadline", read: false },
  { id: "status-fgd", title: "Status project berubah", description: "Nadia memindahkan FGD Komunitas Urban ke Delay.", time: "12 menit lalu", view: "activity", kind: "activity", read: false },
  { id: "agenda-review", title: "Agenda segera dimulai", description: "Review laporan Gen Z dijadwalkan besok pukul 10.00.", time: "48 menit lalu", view: "calendar", kind: "agenda", read: false },
];

type ApiNotification = {
  id: number;
  kind: NotificationAlert["kind"];
  title: string;
  message: string;
  targetView: View;
  readAt: string | null;
  createdAt: string;
};

const notificationAppearance = {
  deadline: { icon: CircleAlert, tone: "bg-[#f9e8e5] text-[#b9433d]" },
  project: { icon: FolderOpen, tone: "bg-[#e8efe9] text-[#3f7650]" },
  agenda: { icon: CalendarDays, tone: "bg-[#f7efd9] text-[#a87318]" },
  activity: { icon: Activity, tone: "bg-[#e6f0f7] text-[#3578a8]" },
  assignment: { icon: UserPlus, tone: "bg-[#e8efe9] text-[#3f7650]" },
  mention: { icon: Users, tone: "bg-[#eee8f7] text-[#73539a]" },
  approval: { icon: Check, tone: "bg-[#f7efd9] text-[#a87318]" },
  announcement: { icon: Megaphone, tone: "bg-[#fff1ea] text-[#c85a2b]" },
} satisfies Record<NotificationAlert["kind"], { icon: typeof Bell; tone: string }>;

function notificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Baru saja";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 1) return "Baru saja";
  if (elapsedMinutes < 60) return `${elapsedMinutes} menit lalu`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} jam lalu`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays} hari lalu`;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }).format(date).replace(".", "");
}

function fromApiNotification(notification: ApiNotification): NotificationAlert {
  return {
    id: notification.id,
    title: notification.title,
    description: notification.message,
    time: notificationTime(notification.createdAt),
    view: notification.targetView,
    kind: notification.kind,
    read: Boolean(notification.readAt),
  };
}

type GlobalSearchResult = {
  id: number;
  type: "project" | "comment" | "agenda" | "asset";
  view: View;
  title: string;
  description: string;
  category?: string;
  author?: string;
  archivedAt?: string | null;
};

function Header({ active, onMenu, profile, onProfile, onNavigate, backendEnabled }: { active: View; onMenu: () => void; profile: ProfileData; onProfile: () => void; onNavigate: (view: View) => void; backendEnabled: boolean }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [alerts, setAlerts] = useState<NotificationAlert[]>(notificationAlerts);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationTab, setNotificationTab] = useState<"announcement" | "task">("task");
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const title = active === "profile" ? "Profil" : navItems.find((n) => n.id === active)?.label ?? "Dashboard";
  const unreadCount = alerts.filter((alert) => !alert.read).length;
  const announcementUnreadCount = alerts.filter((alert) => alert.kind === "announcement" && !alert.read).length;
  const taskUnreadCount = alerts.filter((alert) => alert.kind !== "announcement" && !alert.read).length;
  const visibleAlerts = alerts.filter((alert) => notificationTab === "announcement" ? alert.kind === "announcement" : alert.kind !== "announcement");

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    if (!backendEnabled) return;
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=20", { signal });
      if (!response.ok) throw new Error("Gagal memuat notifikasi");
      const payload = await response.json() as { data: ApiNotification[] };
      setAlerts(payload.data.map(fromApiNotification));
      setNotificationError("");
    } catch (error) {
      if ((error as Error).name !== "AbortError") setNotificationError("Notifikasi belum dapat dimuat.");
    } finally {
      if (!signal?.aborted) setNotificationsLoading(false);
    }
  }, [backendEnabled]);

  useEffect(() => {
    if (!backendEnabled) {
      setAlerts(notificationAlerts);
      setNotificationError("");
      setNotificationsLoading(false);
      return;
    }
    const controller = new AbortController();
    void loadNotifications(controller.signal);
    const refresh = window.setInterval(() => void loadNotifications(), 60_000);
    return () => {
      controller.abort();
      window.clearInterval(refresh);
    };
  }, [backendEnabled, loadNotifications]);

  useEffect(() => {
    if (notificationsOpen && backendEnabled) void loadNotifications();
  }, [backendEnabled, loadNotifications, notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!searchOpen || globalQuery.trim().length < 2 || !backendEnabled) { setSearchResults([]); setSearching(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void fetch(`/api/search?q=${encodeURIComponent(globalQuery.trim())}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : Promise.reject())
        .then((payload: { data: GlobalSearchResult[] }) => setSearchResults(payload.data))
        .catch((error: Error) => { if (error.name !== "AbortError") setSearchResults([]); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [backendEnabled, globalQuery, searchOpen]);

  const openAlert = async (alert: NotificationAlert) => {
    if (!alert.read) {
      setAlerts((current) => current.map((item) => item.id === alert.id ? { ...item, read: true } : item));
      if (backendEnabled) {
        try {
          const response = await fetch(`/api/notifications/${alert.id}`, { method: "PATCH" });
          if (!response.ok) throw new Error("Gagal menandai notifikasi");
        } catch {
          setAlerts((current) => current.map((item) => item.id === alert.id ? { ...item, read: false } : item));
          setNotificationError("Status notifikasi belum dapat disimpan.");
        }
      }
    }
    setNotificationsOpen(false);
    onNavigate(alert.view);
  };

  const markAllRead = async () => {
    const previous = alerts;
    setAlerts((current) => current.map((alert) => ({ ...alert, read: true })));
    if (!backendEnabled) return;
    try {
      const response = await fetch("/api/notifications", { method: "PATCH" });
      if (!response.ok) throw new Error("Gagal menandai semua notifikasi");
      setNotificationError("");
    } catch {
      setAlerts(previous);
      setNotificationError("Status notifikasi belum dapat disimpan.");
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center border-b border-[#dfddd5] bg-[#f5f3ed]/95 px-5 backdrop-blur md:px-8">
      <button className="mr-3 text-[#183044] lg:hidden" onClick={onMenu}><Menu size={22} /></button>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a9194]">Workspace /</div>
        <div className="font-serif text-lg font-semibold text-[#183044]">{title}</div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <button onClick={() => setSearchOpen((current) => !current)} className={cn("grid h-9 w-9 place-items-center rounded-full text-[#53626b] hover:bg-white", searchOpen && "bg-white text-[#183044]")} aria-label="Pencarian global"><Search size={18} /></button>
          {searchOpen && <div className="absolute right-0 top-12 z-50 w-[min(440px,calc(100vw-2rem))] border border-[#ddd9d0] bg-white p-3 shadow-[0_18px_50px_rgba(24,48,68,.18)]"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8f9699]" /><Input autoFocus value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} className="pl-9 pr-9" placeholder="Cari project, komentar, agenda, atau aset…" /><button onClick={() => { setSearchOpen(false); setGlobalQuery(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8f9699]"><X size={15} /></button></div><div className="mt-2 max-h-80 divide-y divide-[#eeeae2] overflow-y-auto thin-scrollbar">{searching && <div className="grid place-items-center py-8 text-[#e76f36]"><LoaderCircle className="animate-spin" size={20} /></div>}{!searching && globalQuery.trim().length < 2 && <p className="px-3 py-8 text-center text-xs text-[#8a9194]">Ketik minimal 2 karakter.</p>}{!searching && globalQuery.trim().length >= 2 && searchResults.length === 0 && <p className="px-3 py-8 text-center text-xs text-[#8a9194]">Tidak ada hasil yang cocok.</p>}{searchResults.map((result) => <button key={`${result.type}-${result.id}`} onClick={() => { setSearchOpen(false); setGlobalQuery(""); onNavigate(result.view); }} className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-[#f8f6f1]"><span className="mt-0.5 rounded bg-[#eef1f3] px-2 py-1 text-[9px] font-bold uppercase text-[#536873]">{result.type}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold text-[#183044]">{result.title}{result.archivedAt && <Badge className="bg-[#eeeae2] text-[#6e7477]">Arsip</Badge>}</span><span className="mt-1 block truncate text-xs text-[#7b8387]">{result.description || result.category || result.author || "Buka hasil"}</span></span><ChevronRight size={15} className="mt-1 text-[#a0a6a8]" /></button>)}</div></div>}
        </div>
        <div className="relative" ref={notificationRef}>
          <button onClick={() => setNotificationsOpen((open) => !open)} className={cn("relative grid h-9 w-9 place-items-center rounded-full text-[#53626b] hover:bg-white", notificationsOpen && "bg-white text-[#183044]")} aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} belum dibaca` : ""}`} aria-expanded={notificationsOpen} aria-haspopup="dialog">
            <Bell size={19} />
            {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#e76f36] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-[#f5f3ed]">{unreadCount}</span>}
          </button>
          {notificationsOpen && <div role="dialog" aria-label="Daftar notifikasi" className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden border border-[#ddd9d0] bg-white shadow-[0_18px_50px_rgba(24,48,68,.18)]">
            <div className="flex items-center justify-between border-b border-[#ebe8df] px-4 py-3"><div><h2 className="font-serif text-lg font-semibold text-[#183044]">Notifikasi</h2><p className="mt-0.5 text-[11px] text-[#879095]">{notificationsLoading && alerts.length === 0 ? "Memuat..." : unreadCount ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}</p></div>{unreadCount > 0 && <button onClick={() => void markAllRead()} className="text-[11px] font-bold text-[#e76f36] hover:underline">Tandai semua dibaca</button>}</div>
            <div className="grid grid-cols-2 border-b border-[#ebe8df] bg-[#faf9f5] p-1.5 text-[11px] font-bold"><button onClick={() => setNotificationTab("announcement")} className={cn("rounded px-2 py-2", notificationTab === "announcement" ? "bg-white text-[#183044] shadow-sm" : "text-[#788186]")}>Pengumuman Admin{announcementUnreadCount > 0 && <span className="ml-1.5 rounded-full bg-[#e76f36] px-1.5 py-0.5 text-[9px] text-white">{announcementUnreadCount}</span>}</button><button onClick={() => setNotificationTab("task")} className={cn("rounded px-2 py-2", notificationTab === "task" ? "bg-white text-[#183044] shadow-sm" : "text-[#788186]")}>Task Update{taskUnreadCount > 0 && <span className="ml-1.5 rounded-full bg-[#3578a8] px-1.5 py-0.5 text-[9px] text-white">{taskUnreadCount}</span>}</button></div>
            {notificationError && <div className="border-b border-[#f2d5cd] bg-[#fff6f2] px-4 py-2 text-[11px] text-[#a64d34]">{notificationError} <button onClick={() => void loadNotifications()} className="font-bold underline">Coba lagi</button></div>}
            <div className="divide-y divide-[#eeeae2]">
              {notificationsLoading && alerts.length === 0 && <div className="grid place-items-center py-10 text-[#e76f36]"><LoaderCircle className="animate-spin" size={22} /></div>}
              {!notificationsLoading && visibleAlerts.length === 0 && <div className="px-6 py-10 text-center"><Bell className="mx-auto text-[#b3b7b8]" size={24} /><p className="mt-3 text-sm font-semibold text-[#53626b]">Belum ada {notificationTab === "announcement" ? "pengumuman" : "task update"}</p><p className="mt-1 text-xs text-[#8a9194]">{notificationTab === "announcement" ? "Pengumuman dari Admin akan muncul di sini." : "Update project dan agenda akan muncul di sini."}</p></div>}
              {visibleAlerts.map((alert) => { const appearance = notificationAppearance[alert.kind]; const Icon = appearance.icon; return <button key={alert.id} onClick={() => void openAlert(alert)} className={cn("flex w-full gap-3 px-4 py-3.5 text-left transition hover:bg-[#f7f5ef]", !alert.read && "bg-[#fffaf5]")}><span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full", appearance.tone)}><Icon size={16} /></span><span className="min-w-0 flex-1"><span className="flex items-start gap-2"><span className="flex-1 text-sm font-semibold text-[#183044]">{alert.title}</span>{!alert.read && <i className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#e76f36]" />}</span><span className="mt-1 block text-xs leading-5 text-[#687378]">{alert.description}</span><span className="mt-1 block text-[10px] text-[#9a9fa2]">{alert.time}</span></span></button>; })}
            </div>
            <button onClick={() => { setNotificationsOpen(false); onNavigate("activity"); }} className="w-full border-t border-[#ebe8df] px-4 py-3 text-center text-xs font-bold text-[#e76f36] hover:bg-[#faf8f3]">Buka Activity History</button>
          </div>}
        </div>
        <button onClick={onProfile} className="ml-2 hidden items-center gap-2 rounded-full border border-[#dcd9d1] bg-white py-1 pl-1 pr-3 hover:border-[#c9c5ba] sm:flex">
          <MiniAvatar initials={memberInitials(profile.name)} image={profile.image} name={profile.name} />
          <span className="text-xs font-semibold">{profile.name.split(" ")[0]}</span>
          <ChevronDown size={13} className="text-[#8a9194]" />
        </button>
      </div>
    </header>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e76f36]"><span className="h-px w-7 bg-[#e76f36]" />{eyebrow}</div>
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.02em] text-[#183044] md:text-[38px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7377]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, change, icon: Icon, accent }: { label: string; value: string; change: string; icon: typeof Activity; accent: string }) {
  return (
    <article className="border-t-2 bg-white px-5 py-4 shadow-[0_1px_0_rgba(24,48,68,.05)]" style={{ borderTopColor: accent }}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.11em] text-[#7b8387]"><span>{label}</span><Icon size={17} style={{ color: accent }} /></div>
      <div className="mt-4 flex items-end justify-between gap-2"><strong className="font-serif text-4xl font-semibold text-[#183044]">{value}</strong><span className="mb-1 text-[11px] text-[#7b8387]">{change}</span></div>
    </article>
  );
}

type RecentActivityItem = {
  initials: string;
  content: React.ReactNode;
  time: string;
};

const dashboardRecentActivities: RecentActivityItem[] = [
  { initials: "NP", content: <><b>Nadia</b> memindahkan <b>FGD Komunitas Urban</b> ke Delay</>, time: "12 menit lalu" },
  { initials: "DA", content: <><b>Dita</b> menambahkan catatan revisi baru</>, time: "48 menit lalu" },
  { initials: "AW", content: <><b>Arga</b> mengubah deadline Benchmark Industri</>, time: "2 jam lalu" },
];

function RecentActivityList({ items, onViewAll }: { items: RecentActivityItem[]; onViewAll: () => void }) {
  return (
    <section className="bg-white p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold">Aktivitas terbaru</h2>
        <button onClick={onViewAll} className="text-xs font-bold text-[#e76f36] hover:underline">Lihat semua</button>
      </div>
      <div className="space-y-4">
        {items.map((activity, index) => (
          <div className="flex gap-3" key={`${activity.initials}-${index}`}>
            <MiniAvatar initials={activity.initials} />
            <div className="text-xs leading-5 text-[#59656c]">
              <div>{activity.content}</div>
              <div className="text-[10px] text-[#9a9fa2]">{activity.time}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="py-10 text-center text-xs text-[#8a9194]">Belum ada aktivitas workspace.</div>}
      </div>
    </section>
  );
}

type DeadlineReminderItem = {
  day: string;
  month: string;
  title: string;
  meta: string;
  type: "Deadline" | "Agenda";
};

function DeadlineReminder({ items, onOpenCalendar }: { items: DeadlineReminderItem[]; onOpenCalendar: () => void }) {
  return (
    <section className="bg-[#193246] p-5 text-white md:p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#e9a17d]">Deadline & agenda</div>
          <h2 className="mt-2 font-serif text-2xl font-semibold">7 hari ke depan</h2>
        </div>
        <CalendarDays className="text-[#e9a17d]" size={22} />
      </div>
      <div className="mt-6 space-y-1">
        {items.map((item) => (
          <div key={`${item.day}-${item.title}`} className="flex items-center gap-4 border-b border-white/10 py-3 last:border-0">
            <div className="w-9 text-center">
              <div className="font-serif text-2xl font-semibold leading-none">{item.day}</div>
              <div className="mt-1 text-[9px] uppercase tracking-widest text-[#90a4b1]">{item.month}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-semibold">{item.title}</div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide", item.type === "Deadline" ? "bg-[#d8564e]/20 text-[#f0a09b]" : "bg-[#3578a8]/25 text-[#9dcced]")}>{item.type}</span>
              </div>
              <div className="mt-1 text-[11px] text-[#9eb0bc]">{item.meta}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="border border-dashed border-white/15 px-4 py-8 text-center text-xs text-[#9eb0bc]">Belum ada deadline project dalam 7 hari ke depan.</div>}
      </div>
      <button onClick={onOpenCalendar} className="mt-5 flex items-center gap-2 text-xs font-bold text-[#e9a17d] hover:underline">Buka kalender <ArrowUpRight size={14} /></button>
    </section>
  );
}

function Dashboard({ projects, goTo, backendEnabled }: { projects: Project[]; goTo: (v: View) => void; backendEnabled: boolean }) {
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>(backendEnabled ? [] : dashboardRecentActivities);
  const wibClock = useWibClock();
  useEffect(() => {
    if (!backendEnabled) { setRecentActivities(dashboardRecentActivities); return; }
    const controller = new AbortController();
    fetch("/api/activity?limit=3", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load activity")))
      .then((payload: { data: Array<{ actorName: string; actorInitials: string; action: string; details: string; projectTitle: string | null; createdAt: string }> }) => {
        const now = new Date();
        setRecentActivities(payload.data.map((activity) => ({
          initials: activity.actorInitials,
          content: <><b>{activity.actorName}</b> {activity.action}{activity.projectTitle ? <> <b>{activity.projectTitle}</b></> : activity.details ? ` ${activity.details}` : ""}</>,
          time: activityTimeLabel(new Date(activity.createdAt), now),
        })));
      })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setRecentActivities([]); });
    return () => controller.abort();
  }, [backendEnabled]);
  const dashboardProjects = projects;
  const total = dashboardProjects.length;
  const counts = (Object.keys(statusMeta) as Status[]).reduce<Record<Status, number>>((result, status) => {
    result[status] = dashboardProjects.filter((project) => project.status === status).length;
    return result;
  }, { "On Going": 0, Delay: 0, Pending: 0, Revisi: 0, Done: 0 });
  const percentage = (count: number) => total > 0 ? Math.round((count / total) * 100) : 0;
  const attention = dashboardProjects.filter((project) => project.status === "Delay" || project.status === "Revisi");
  const overdue = dashboardProjects.filter((project) => project.status === "Delay" && project.deadlineIso && new Date(project.deadlineIso) < new Date()).length;
  const chartStatuses: Status[] = ["On Going", "Pending", "Delay", "Revisi", "Done"];
  let chartPosition = 0;
  const chartSegments = chartStatuses.map((status) => {
    const start = chartPosition;
    chartPosition += total > 0 ? (counts[status] / total) * 100 : 0;
    return `${statusColors[status]} ${start}% ${chartPosition}%`;
  });
  const chartBackground = total > 0 ? `conic-gradient(${chartSegments.join(", ")})` : "#ebe9e3";
  const today = wibClock || new Date();
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  const deadlineItems: DeadlineReminderItem[] = dashboardProjects
    .filter((project) => project.status !== "Done" && project.deadlineIso && new Date(project.deadlineIso) >= today && new Date(project.deadlineIso) <= nextWeek)
    .sort((a, b) => new Date(a.deadlineIso!).getTime() - new Date(b.deadlineIso!).getTime())
    .slice(0, 4)
    .map((project) => {
      const deadline = new Date(project.deadlineIso!);
      return {
        day: String(deadline.getDate()).padStart(2, "0"),
        month: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(deadline).replace(".", ""),
        title: project.title,
        meta: `${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(deadline)} • ${project.pic}`,
        type: "Deadline" as const,
      };
    });
  const wibParts = getWibDateParts(today);
  const greeting = wibClock ? greetingForWibHour(wibParts.hour) : "Selamat datang";
  const dateLabel = wibClock
    ? `${new Intl.DateTimeFormat("id-ID", { timeZone: WIB_TIME_ZONE, weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(today)} · ${new Intl.DateTimeFormat("id-ID", { timeZone: WIB_TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(today).replaceAll(".", ":")} WIB`
    : "Memuat waktu Indonesia Barat…";
  return (
    <div className="fade-up">
      <SectionHeading eyebrow={dateLabel} title={`${greeting}! Selamat datang di 360 - Center of Research.`} description={attention.length > 0 ? `Ada ${attention.length} project yang perlu ditindaklanjuti.` : total > 0 ? "Semua project sedang berjalan tanpa tanda delay atau revisi." : "Belum ada project. Tambahkan project pertama untuk memulai."} action={<Button onClick={() => goTo("tracker")}><Plus size={17} /> Tambah project</Button>} />

      <AnnouncementBanner enabled={backendEnabled} />

      <div className="grid gap-px overflow-hidden border border-[#ddd9d0] bg-[#ddd9d0] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total project" value={String(total)} change={total > 0 ? "Data aktual" : "Belum ada project"} icon={FolderOpen} accent="#3578a8" />
        <StatCard label="On Going" value={String(counts["On Going"])} change={`${percentage(counts["On Going"])}% dari total`} icon={Activity} accent="#3578a8" />
        <StatCard label="Pending" value={String(counts.Pending)} change="Menunggu mulai" icon={Clock3} accent="#d29b32" />
        <StatCard label="Delay" value={String(counts.Delay)} change={`${overdue} lewat deadline`} icon={CircleAlert} accent="#d8564e" />
        <StatCard label="Revisi" value={String(counts.Revisi)} change="Perlu tindak lanjut" icon={FileText} accent="#825a9f" />
        <StatCard label="Done" value={String(counts.Done)} change={`${percentage(counts.Done)}% dari total`} icon={Check} accent="#4f826c" />
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="bg-white p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-serif text-xl font-semibold">Gambaran project</h2><p className="mt-1 text-xs text-[#7b8387]">Distribusi pekerjaan aktif per status</p></div><button onClick={() => goTo("tracker")} className="text-xs font-bold text-[#e76f36] hover:underline">Lihat board</button></div>
          <div className="grid gap-6 md:grid-cols-[190px_1fr] md:items-center">
            <div className="mx-auto grid h-40 w-40 place-items-center rounded-full" style={{ background: chartBackground }}>
              <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><div className="font-serif text-3xl font-semibold">{total}</div><div className="text-[10px] uppercase tracking-widest text-[#899095]">project</div></div></div>
            </div>
            <div className="space-y-3">
              {chartStatuses.map((status) => <div key={status} className="grid grid-cols-[100px_1fr_24px] items-center gap-3 text-xs"><span className="flex items-center gap-2 font-medium"><i className={cn("h-2 w-2 rounded-full", statusMeta[status].dot)} />{status}</span><span className="h-1.5 overflow-hidden rounded-full bg-[#ebe9e3]"><i className={cn("block h-full rounded-full", statusMeta[status].dot)} style={{ width: `${percentage(counts[status])}%` }} /></span><b className="text-right">{counts[status]}</b></div>)}
            </div>
          </div>
        </section>

        <DeadlineReminder items={deadlineItems} onOpenCalendar={() => goTo("calendar")} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.12fr_.88fr]">
        <section className="bg-white p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold">Perlu perhatian</h2><Badge className="bg-[#f9e8e5] text-[#b9433d]">{attention.length} project</Badge></div>
          <div className="divide-y divide-[#ece9e1]">
            {attention.slice(0, 3).map((p) => <button onClick={() => goTo("tracker")} key={p.id} className="group flex w-full items-center gap-4 py-3.5 text-left"><span className={cn("h-10 w-1 rounded-full", statusMeta[p.status].dot)} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><div className="truncate text-sm font-semibold group-hover:text-[#e76f36]">{p.title}</div><Badge className={cn("shrink-0", statusMeta[p.status].soft, statusMeta[p.status].text)}>{p.status}</Badge></div><div className="mt-1 text-xs text-[#858c90]">{p.category} · {p.deadline}</div></div><MiniAvatar initials={p.initials} /><ChevronRight size={16} className="text-[#a1a6a8]" /></button>)}
            {attention.length === 0 && <div className="py-10 text-center text-xs text-[#8a9194]">Belum ada project berstatus Delay atau Revisi.</div>}
          </div>
        </section>
        <RecentActivityList items={recentActivities} onViewAll={() => goTo("activity")} />
      </div>
    </div>
  );
}

function projectMembersFromAssignments(workspaceMembers: WorkspaceMemberOption[], assignments: Record<string, ProjectMemberRole>) {
  return Object.entries(assignments).flatMap(([userId, role]) => {
    const member = workspaceMembers.find((candidate) => candidate.id === userId);
    return member ? [{ userId, name: member.name, email: member.email, username: member.username, image: member.image, role }] : [];
  });
}

function ProjectPeopleEditor({ workspaceMembers, primaryPicUserId, manualPic, assignments, onPrimaryChange, onManualPicChange, onAssignmentsChange }: {
  workspaceMembers: WorkspaceMemberOption[];
  primaryPicUserId: string | null;
  manualPic: string;
  assignments: Record<string, ProjectMemberRole>;
  onPrimaryChange: (userId: string | null) => void;
  onManualPicChange: (name: string) => void;
  onAssignmentsChange: (assignments: Record<string, ProjectMemberRole>) => void;
}) {
  const selectPrimary = (value: string) => {
    if (value === "manual") {
      onPrimaryChange(null);
      return;
    }
    onPrimaryChange(value);
    onAssignmentsChange({ ...assignments, [value]: "Lead" });
  };
  const toggleMember = (memberId: string, checked: boolean) => {
    const next = { ...assignments };
    if (checked) next[memberId] = memberId === primaryPicUserId ? "Lead" : "Anggota";
    else if (memberId !== primaryPicUserId) delete next[memberId];
    onAssignmentsChange(next);
  };
  return <div className="space-y-4">
    <label className="block text-xs font-bold text-[#59656c]">PIC utama<select value={primaryPicUserId || "manual"} onChange={(event) => selectPrimary(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm font-normal"><option value="manual">Lainnya — isi manual</option>{workspaceMembers.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.workspaceRole}</option>)}</select></label>
    {!primaryPicUserId && <label className="block text-xs font-bold text-[#59656c]">Nama PIC manual<Input className="mt-2 font-normal" value={manualPic} onChange={(event) => onManualPicChange(event.target.value)} placeholder="Nama PIC di luar akun anggota" /></label>}
    <div><div className="text-xs font-bold text-[#59656c]">Anggota project</div><p className="mt-1 text-[11px] text-[#8a9194]">Pilih beberapa akun dan tentukan role per project.</p><div className="mt-2 max-h-48 space-y-2 overflow-y-auto border border-[#e2dfd7] bg-[#faf9f5] p-2 thin-scrollbar">{workspaceMembers.map((member) => { const selected = Boolean(assignments[member.id]); const isPrimary = member.id === primaryPicUserId; return <div key={member.id} className="flex items-center gap-2 bg-white px-2.5 py-2"><input type="checkbox" checked={selected || isPrimary} disabled={isPrimary} onChange={(event) => toggleMember(member.id, event.target.checked)} className="accent-[#e76f36]" /><MiniAvatar initials={memberInitials(member.name)} image={member.image} name={member.name} /><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{member.name}</div><div className="truncate text-[10px] text-[#8a9194]">{member.email}</div></div>{(selected || isPrimary) && <select aria-label={`Role ${member.name}`} value={isPrimary ? "Lead" : assignments[member.id]} disabled={isPrimary} onChange={(event) => onAssignmentsChange({ ...assignments, [member.id]: event.target.value as ProjectMemberRole })} className="h-8 rounded border border-[#d9d7cf] bg-white px-2 text-[11px]"><option>Lead</option><option>Anggota</option><option>Viewer</option></select>}</div>; })}{workspaceMembers.length === 0 && <div className="px-3 py-5 text-center text-xs text-[#8a9194]">Belum ada akun anggota yang dapat dipilih.</div>}</div></div>
  </div>;
}

function AddProjectDialog({ open, defaultDeadline, workspaceMembers, currentUserEmail, onOpenChange, onAdd }: { open: boolean; defaultDeadline: string; workspaceMembers: WorkspaceMemberOption[]; currentUserEmail: string; onOpenChange: (v: boolean) => void; onAdd: (project: Project) => void }) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Status>("On Going");
  const [primaryPicUserId, setPrimaryPicUserId] = useState<string | null>(null);
  const [manualPic, setManualPic] = useState("Angga Ramadhan");
  const [assignments, setAssignments] = useState<Record<string, ProjectMemberRole>>({});
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [priority, setPriority] = useState<Priority>("Medium");
  const [category, setCategory] = useState("Desk Research");
  const [note, setNote] = useState("");
  const [workingDocLink, setWorkingDocLink] = useState("");
  useEffect(() => {
    if (!open) return;
    setDeadline(defaultDeadline);
    const currentMember = workspaceMembers.find((member) => member.email === currentUserEmail);
    if (currentMember) {
      setPrimaryPicUserId(currentMember.id);
      setManualPic(currentMember.name);
      setAssignments({ [currentMember.id]: "Lead" });
    }
  }, [currentUserEmail, defaultDeadline, open, workspaceMembers]);
  const submit = () => {
    const selectedPic = workspaceMembers.find((member) => member.id === primaryPicUserId);
    const pic = selectedPic?.name || manualPic.trim();
    if (!title.trim() || !pic) return;
    const initials = pic.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const deadlineIso = `${deadline}T17:00:00+07:00`;
    const deadlineLabel = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(new Date(deadlineIso)).replace(".", "");
    const normalizedAssignments = primaryPicUserId ? { ...assignments, [primaryPicUserId]: "Lead" as const } : assignments;
    onAdd({ id: Date.now(), title: title.trim(), status, priority, category, pic, initials, primaryPicUserId, members: projectMembersFromAssignments(workspaceMembers, normalizedAssignments), deadline: deadlineLabel, deadlineIso, completedAtIso: status === "Done" ? new Date().toISOString() : undefined, note: note.trim() || "Belum ada catatan project.", workingDocLink: workingDocLink.trim() || undefined });
    setTitle("");
    setStatus("On Going");
    setPrimaryPicUserId(null);
    setManualPic("Angga Ramadhan");
    setAssignments({});
    setDeadline(defaultDeadline);
    setPriority("Medium");
    setCategory("Desk Research");
    setNote("");
    setWorkingDocLink("");
    onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Tambah project baru</DialogTitle><DialogDescription>Lengkapi informasi utama, PIC, dan anggota yang akan berkolaborasi.</DialogDescription></DialogHeader><div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 thin-scrollbar"><label className="block text-xs font-bold text-[#59656c]">Nama project<Input className="mt-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Riset Lanskap Industri 2026" autoFocus /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-[#59656c]">Status<select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="mt-2 h-10 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm font-normal">{Object.keys(statusMeta).map((s) => <option key={s}>{s}</option>)}</select></label><label className="text-xs font-bold text-[#59656c]">Deadline<Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-2 font-normal" required /></label><label className="text-xs font-bold text-[#59656c]">Prioritas<select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="mt-2 h-10 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm font-normal"><option>High</option><option>Medium</option><option>Low</option></select></label><label className="text-xs font-bold text-[#59656c]">Kategori<Input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 font-normal" placeholder="Contoh: Brand Research" required /></label></div><ProjectPeopleEditor workspaceMembers={workspaceMembers} primaryPicUserId={primaryPicUserId} manualPic={manualPic} assignments={assignments} onPrimaryChange={setPrimaryPicUserId} onManualPicChange={setManualPic} onAssignmentsChange={setAssignments} /><label className="block text-xs font-bold text-[#59656c]">Working document<Input type="url" value={workingDocLink} onChange={(e) => setWorkingDocLink(e.target.value)} className="mt-2" placeholder="https://docs.google.com/..." /></label><label className="block text-xs font-bold text-[#59656c]">Catatan<textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-2 min-h-24 w-full resize-none rounded-md border border-[#d9d7cf] bg-white p-3 text-sm outline-none focus:border-[#e76f36]" placeholder="Tambahkan konteks singkat untuk tim..." /></label><div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={submit} disabled={!title.trim() || !deadline || !category.trim() || (!primaryPicUserId && !manualPic.trim())}><Plus size={16} /> Buat project</Button></div></div></DialogContent></Dialog>;
}

function EditProjectDialog({ project, open, workspaceMembers, onOpenChange, onSave }: { project: Project | null; open: boolean; workspaceMembers: WorkspaceMemberOption[]; onOpenChange: (v: boolean) => void; onSave: (project: Project) => void }) {
  const [draft, setDraft] = useState<Project | null>(project);
  const [assignments, setAssignments] = useState<Record<string, ProjectMemberRole>>({});
  useEffect(() => {
    if (!project || !open) return;
    setDraft(project);
    setAssignments(Object.fromEntries((project.members ?? []).map((member) => [member.userId, member.role])));
  }, [project, open]);
  if (!draft) return null;
  const update = <K extends keyof Project>(key: K, value: Project[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);
  const changePrimaryPic = (userId: string | null) => {
    update("primaryPicUserId", userId);
    if (!userId) return;
    const member = workspaceMembers.find((candidate) => candidate.id === userId);
    if (!member) return;
    update("pic", member.name);
    update("initials", memberInitials(member.name));
    setAssignments((current) => ({ ...current, [userId]: "Lead" }));
  };
  const save = () => {
    if (!draft.title.trim() || !draft.category.trim()) return;
    const deadlineIso = draft.deadlineIso || "2026-09-15T17:00:00+07:00";
    const deadline = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(new Date(deadlineIso)).replace(".", "");
    const normalizedAssignments = draft.primaryPicUserId ? { ...assignments, [draft.primaryPicUserId]: "Lead" as const } : assignments;
    onSave({ ...draft, title: draft.title.trim(), category: draft.category.trim(), deadline, members: projectMembersFromAssignments(workspaceMembers, normalizedAssignments) });
    onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Edit project</DialogTitle><DialogDescription>Perbarui informasi, PIC, anggota, dan role kolaborasi project.</DialogDescription></DialogHeader><div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 thin-scrollbar"><label className="block text-xs font-bold text-[#59656c]">Nama project<Input className="mt-2" value={draft.title} onChange={(e) => update("title", e.target.value)} autoFocus /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-[#59656c]">Status<select value={draft.status} onChange={(e) => update("status", e.target.value as Status)} className="mt-2 h-10 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm font-normal">{Object.keys(statusMeta).map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-xs font-bold text-[#59656c]">Deadline<Input type="date" value={(draft.deadlineIso || "2026-09-15").slice(0, 10)} onChange={(e) => update("deadlineIso", `${e.target.value}T17:00:00+07:00`)} className="mt-2 font-normal" /></label><label className="text-xs font-bold text-[#59656c]">Prioritas<select value={draft.priority} onChange={(e) => update("priority", e.target.value as Priority)} className="mt-2 h-10 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm font-normal"><option>High</option><option>Medium</option><option>Low</option></select></label><label className="text-xs font-bold text-[#59656c]">Kategori<Input className="mt-2 font-normal" value={draft.category} onChange={(e) => update("category", e.target.value)} /></label></div><ProjectPeopleEditor workspaceMembers={workspaceMembers} primaryPicUserId={draft.primaryPicUserId ?? null} manualPic={draft.pic} assignments={assignments} onPrimaryChange={changePrimaryPic} onManualPicChange={(name) => { update("pic", name); update("initials", memberInitials(name)); }} onAssignmentsChange={setAssignments} /><label className="block text-xs font-bold text-[#59656c]">Working document<Input type="url" className="mt-2" value={draft.workingDocLink || ""} onChange={(e) => update("workingDocLink", e.target.value)} placeholder="https://docs.google.com/..." /></label><label className="block text-xs font-bold text-[#59656c]">Catatan<textarea value={draft.note} onChange={(e) => update("note", e.target.value)} className="mt-2 min-h-24 w-full resize-none rounded-md border border-[#d9d7cf] bg-white p-3 text-sm outline-none focus:border-[#e76f36]" /></label><div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={save} disabled={!draft.title.trim() || !draft.category.trim() || !draft.pic.trim()}><Check size={16} /> Simpan perubahan</Button></div></div></DialogContent></Dialog>;
}

function DeleteProjectDialog({ project, open, onOpenChange, onConfirm }: { project: Project | null; open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void }) {
  if (!project) return null;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#f9e8e5] text-[#b9433d]"><Trash2 size={20} /></div><DialogTitle>Hapus project ini?</DialogTitle><DialogDescription><b className="text-[#183044]">{project.title}</b> akan dihapus dari board. Tindakan ini tidak dapat dibatalkan.</DialogDescription></DialogHeader><div className="flex justify-end gap-2 pt-3"><Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button><Button className="bg-[#c84942] hover:bg-[#ae3d37]" onClick={onConfirm}><Trash2 size={16} /> Hapus project</Button></div></DialogContent></Dialog>;
}

function ProjectDetail({ project, open, backendEnabled, fallbackPermissions, onOpenChange, onEdit, onDelete, onArchive, onProjectUpdated }: { project: Project | null; open: boolean; backendEnabled: boolean; fallbackPermissions: ProjectPermissions; onOpenChange: (v: boolean) => void; onEdit: () => void; onDelete: () => void; onArchive: () => void; onProjectUpdated: (project: Project) => void }) {
  const [collaboration, setCollaboration] = useState<ProjectCollaboration | null>(null);
  const [comment, setComment] = useState("");
  const [mentionUserIds, setMentionUserIds] = useState<string[]>([]);
  const [approvalNote, setApprovalNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const loadCollaboration = useCallback(async () => {
    if (!project || !backendEnabled) return;
    const response = await fetch(`/api/projects/${project.id}/collaboration`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { data: ProjectCollaboration };
    setCollaboration(payload.data);
  }, [backendEnabled, project]);
  useEffect(() => {
    if (!open || !project) return;
    setFeedback(""); setComment(""); setMentionUserIds([]); setApprovalNote("");
    if (backendEnabled) void loadCollaboration();
    else setCollaboration({ members: project.members ?? [], comments: [], approval: null, permissions: fallbackPermissions });
  }, [backendEnabled, fallbackPermissions, loadCollaboration, open, project]);
  if (!project) return null;
  const detail = collaboration ?? { members: project.members ?? [], comments: [], approval: null, permissions: fallbackPermissions };
  const submitComment = async () => {
    if (!comment.trim() || !detail.permissions.canComment) return;
    if (!backendEnabled) { setComment(""); setMentionUserIds([]); setFeedback("Komentar demo tersimpan sementara."); return; }
    setBusy(true); setFeedback("");
    try {
      const response = await fetch(`/api/projects/${project.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: comment.trim(), mentionUserIds }) });
      if (!response.ok) throw new Error();
      const payload = await response.json() as { data: ProjectComment[] };
      setCollaboration((current) => current ? { ...current, comments: payload.data } : current);
      setComment(""); setMentionUserIds([]);
    } catch { setFeedback("Komentar belum dapat dikirim."); } finally { setBusy(false); }
  };
  const requestApproval = async () => {
    if (!backendEnabled) { setFeedback("Permintaan approval disimulasikan dalam mode demo."); return; }
    setBusy(true); setFeedback("");
    try {
      const response = await fetch(`/api/projects/${project.id}/approval`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: approvalNote }) });
      const payload = await response.json() as { data?: ProjectApproval; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Gagal meminta approval");
      setCollaboration((current) => current ? { ...current, approval: payload.data! } : current);
      setApprovalNote(""); setFeedback("Permintaan penyelesaian dikirim ke Lead/Admin.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Permintaan approval gagal."); } finally { setBusy(false); }
  };
  const reviewApproval = async (decision: "approved" | "rejected") => {
    if (!detail.approval || !backendEnabled) return;
    setBusy(true); setFeedback("");
    try {
      const response = await fetch(`/api/projects/${project.id}/approval/${detail.approval.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note: approvalNote }) });
      const payload = await response.json() as { data?: ProjectApproval; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Review approval gagal");
      setCollaboration((current) => current ? { ...current, approval: payload.data! } : current);
      if (decision === "approved") {
        const refreshed = await fetch(`/api/projects/${project.id}`);
        if (refreshed.ok) { const projectPayload = await refreshed.json() as { data: ApiProject }; onProjectUpdated(fromApiProject(projectPayload.data)); }
      }
      setApprovalNote(""); setFeedback(decision === "approved" ? "Project disetujui dan dipindahkan ke Done." : "Permintaan penyelesaian ditolak.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Review approval gagal."); } finally { setBusy(false); }
  };
  const approvalPending = detail.approval?.status === "pending";
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto thin-scrollbar"><DialogHeader><div className="mb-3 flex flex-wrap items-center gap-2"><Badge className={cn(statusMeta[project.status].soft, statusMeta[project.status].text)}>{project.status}</Badge><Badge className={priorityMeta[project.priority]}>{project.priority}</Badge>{detail.permissions.role && <Badge className="bg-[#e8eef2] text-[#36566c]">Akses: {detail.permissions.role}</Badge>}</div><DialogTitle>{project.title}</DialogTitle><DialogDescription>{project.category}</DialogDescription></DialogHeader>
    <div className="grid grid-cols-2 gap-4 border-y border-[#e5e2da] py-4"><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#92989b]">PIC</div><div className="mt-2 flex items-center gap-2 text-sm font-semibold"><MiniAvatar initials={project.initials} />{project.pic}</div></div><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#92989b]">Deadline</div><div className="mt-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays size={15} className="text-[#e76f36]" />{project.deadline}</div></div></div>
    <div className="space-y-4 py-4"><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#92989b]">Catatan project</div><p className="mt-2 text-sm leading-6 text-[#59656c]">{project.note}</p></div><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#92989b]">Working document</div><div className="mt-2 flex items-center gap-2 text-xs text-[#68747a]"><Link2 size={14} className="text-[#e76f36]" /><span className="truncate">{project.workingDocLink || "Belum ditambahkan"}</span></div></div></div>
    <section className="border-t border-[#e5e2da] pt-4"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#92989b]"><Users size={13} />Anggota project</div><div className="grid gap-2 sm:grid-cols-2">{detail.members.map((member) => <div key={member.userId} className="flex items-center gap-2 border border-[#e5e2da] bg-[#faf9f5] p-2.5"><MiniAvatar initials={memberInitials(member.name)} image={member.image} name={member.name} /><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{member.name}</div><div className="truncate text-[10px] text-[#8a9194]">{member.email}</div></div><Badge className="bg-white text-[#50616b]">{member.role}</Badge></div>)}{detail.members.length === 0 && <div className="text-xs text-[#8a9194]">Belum ada akun anggota di project ini.</div>}</div></section>
    <section className="border-t border-[#e5e2da] pt-4"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#92989b]"><MessageSquare size={13} />Komentar & mention</div><div className="max-h-44 space-y-2 overflow-y-auto thin-scrollbar">{detail.comments.map((item) => <div key={item.id} className="flex gap-2 bg-[#faf9f5] p-3"><MiniAvatar initials={memberInitials(item.authorName)} image={item.authorImage} name={item.authorName} /><div><div className="text-xs font-bold">{item.authorName}<span className="ml-2 font-normal text-[#9a9fa1]">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</span></div><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[#59656c]">{item.body}</p></div></div>)}{detail.comments.length === 0 && <div className="py-3 text-center text-xs text-[#92989b]">Belum ada komentar.</div>}</div>{detail.permissions.canComment && !project.archivedAt && <div className="mt-3"><textarea value={comment} onChange={(event) => setComment(event.target.value)} className="min-h-20 w-full resize-none rounded-md border border-[#d9d7cf] bg-white p-3 text-sm outline-none focus:border-[#e76f36]" placeholder="Tulis komentar untuk tim…" /><div className="mt-2 flex flex-wrap gap-1">{detail.members.map((member) => { const active = mentionUserIds.includes(member.userId); const mention = member.username || member.name.split(" ")[0]; return <button key={member.userId} type="button" onClick={() => { setMentionUserIds((current) => active ? current.filter((id) => id !== member.userId) : [...current, member.userId]); if (!active && !comment.includes(`@${mention}`)) setComment((current) => `${current}${current ? " " : ""}@${mention} `); }} className={cn("rounded-full border px-2 py-1 text-[10px]", active ? "border-[#e76f36] bg-[#fff1ea] text-[#bf5425]" : "border-[#dedbd3] text-[#68747a]")}>@{mention}</button>; })}<Button size="sm" className="ml-auto" onClick={() => void submitComment()} disabled={busy || !comment.trim()}><Send size={13} /> Kirim</Button></div></div>}</section>
    {!project.archivedAt && project.status !== "Done" && detail.permissions.canRequestCompletion && <section className="border-t border-[#e5e2da] pt-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#92989b]">Approval penyelesaian</div>{approvalPending ? <div className="bg-[#fff7e6] p-3 text-xs text-[#7b5a1b]"><b>Menunggu review</b> · diajukan oleh {detail.approval?.requestedByName}{detail.permissions.canApproveCompletion && <div className="mt-3 flex gap-2"><Input value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Catatan review (opsional)" /><Button size="sm" onClick={() => void reviewApproval("approved")} disabled={busy}><Check size={14} /> Setujui</Button><Button size="sm" variant="outline" onClick={() => void reviewApproval("rejected")} disabled={busy}><X size={14} /> Tolak</Button></div>}</div> : !detail.permissions.canApproveCompletion ? <div className="flex gap-2"><Input value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Catatan penyelesaian (opsional)" /><Button onClick={() => void requestApproval()} disabled={busy}>Minta approval Done</Button></div> : <p className="text-xs text-[#7b8387]">Sebagai {detail.permissions.role}, Anda dapat memindahkan project langsung ke Done.</p>}</section>}
    {backendEnabled && detail.permissions.canEdit && <ProjectVersionHistory projectId={project.id} currentVersion={project.version ?? 1} onRestored={async () => { const response = await fetch(`/api/projects/${project.id}`, { cache: "no-store" }); if (response.ok) { const payload = await response.json() as { data: ApiProject }; onProjectUpdated(fromApiProject(payload.data)); } }} />}
    {feedback && <div className="border-l-2 border-[#e76f36] bg-[#fff4ee] px-3 py-2 text-xs text-[#96502f]">{feedback}</div>}
    <div className="flex flex-col gap-2 border-t border-[#e5e2da] pt-4 sm:flex-row"><Button className="flex-1" disabled={!project.workingDocLink} onClick={() => project.workingDocLink && window.open(project.workingDocLink, "_blank", "noopener,noreferrer")}><FileText size={16} /> Buka working document</Button>{detail.permissions.canEdit && !project.archivedAt && <Button variant="outline" onClick={onEdit}><MoreHorizontal size={16} /> Edit</Button>}{detail.permissions.canEdit && <Button variant="outline" onClick={onArchive}><Archive size={16} />{project.archivedAt ? "Pulihkan" : "Arsipkan"}</Button>}{detail.permissions.canDelete && <Button variant="outline" className="border-[#e2b9b5] text-[#b9433d] hover:bg-[#f9e8e5]" onClick={onDelete}><Trash2 size={16} /> Hapus</Button>}</div></DialogContent></Dialog>;
}

function ProjectQuickEditDialog({ project, open, workspaceMembers, canEdit, canRequestCompletion, busy, onOpenChange, onSave }: { project: Project | null; open: boolean; workspaceMembers: WorkspaceMemberOption[]; canEdit: boolean; canRequestCompletion: boolean; busy: boolean; onOpenChange: (open: boolean) => void; onSave: (project: Project) => void }) {
  const [draft, setDraft] = useState<Project | null>(project);
  const [manualPic, setManualPic] = useState("");
  useEffect(() => {
    if (!project || !open) return;
    setDraft(project);
    setManualPic(project.primaryPicUserId ? "" : project.pic);
  }, [open, project]);
  if (!draft) return null;
  const update = <K extends keyof Project>(key: K, value: Project[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);
  const dateValue = draft.deadlineIso?.slice(0, 10) || "";
  const picValue = draft.primaryPicUserId || "manual";
  const choosePic = (value: string) => {
    if (value === "manual") {
      update("primaryPicUserId", null);
      if (manualPic.trim()) {
        update("pic", manualPic.trim());
        update("initials", memberInitials(manualPic));
      }
      return;
    }
    const member = workspaceMembers.find((candidate) => candidate.id === value);
    if (!member) return;
    setDraft((current) => current ? { ...current, primaryPicUserId: member.id, pic: member.name, initials: memberInitials(member.name) } : current);
  };
  const submit = () => {
    const normalizedPic = draft.primaryPicUserId ? draft.pic : manualPic.trim();
    if (!normalizedPic || !draft.deadlineIso) return;
    onSave({ ...draft, pic: normalizedPic, initials: memberInitials(normalizedPic) });
  };
  return <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}><DialogContent><DialogHeader><DialogTitle>Pindahkan status & edit cepat</DialogTitle><DialogDescription>Perbarui informasi utama tanpa membuka form project lengkap.</DialogDescription></DialogHeader><div className="space-y-4">
    <label className="block text-xs font-bold text-[#59656c]">Status<select value={draft.status} onChange={(event) => update("status", event.target.value as Status)} className="mt-2 h-11 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm font-normal" disabled={!canEdit && !canRequestCompletion}>{(Object.keys(statusMeta) as Status[]).filter((status) => canEdit || status === draft.status || status === "Done").map((status) => <option key={status} value={status}>{status === "Done" && !canEdit ? "Done — minta approval" : status}</option>)}</select></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-[#59656c]">PIC<select value={picValue} onChange={(event) => choosePic(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm font-normal" disabled={!canEdit}>{workspaceMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}<option value="manual">Lainnya (manual)</option></select></label><label className="text-xs font-bold text-[#59656c]">Deadline<Input type="date" value={dateValue} onChange={(event) => update("deadlineIso", `${event.target.value}T17:00:00+07:00`)} className="mt-2 font-normal" disabled={!canEdit} /></label></div>
    {!draft.primaryPicUserId && <label className="block text-xs font-bold text-[#59656c]">Nama PIC manual<Input value={manualPic} onChange={(event) => { setManualPic(event.target.value); update("pic", event.target.value); }} className="mt-2 font-normal" disabled={!canEdit} /></label>}
    <label className="block text-xs font-bold text-[#59656c]">Prioritas<select value={draft.priority} onChange={(event) => update("priority", event.target.value as Priority)} className="mt-2 h-11 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm font-normal" disabled={!canEdit}><option>High</option><option>Medium</option><option>Low</option></select></label>
    {!canEdit && canRequestCompletion && <p className="bg-[#fff7e6] px-3 py-2 text-xs leading-5 text-[#7b5a1b]">Anda dapat meminta approval untuk memindahkan project ke Done. Field lainnya hanya dapat diubah oleh Lead atau Admin.</p>}
    <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Batal</Button><Button onClick={submit} disabled={busy || (!canEdit && draft.status !== "Done")}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}{!canEdit && draft.status === "Done" ? "Minta approval" : "Simpan perubahan"}</Button></div>
  </div></DialogContent></Dialog>;
}

function ProjectCard({ project, canDrag, canQuickEdit, onClick, onQuickEdit }: { project: Project; canDrag: boolean; canQuickEdit: boolean; onClick: () => void; onQuickEdit: () => void }) {
  return (
    <article draggable={canDrag} onDragStart={(e) => { if (canDrag) e.dataTransfer.setData("projectId", String(project.id)); }} onClick={onClick} className={cn("group border border-[#e1ded5] bg-white p-2.5 shadow-[0_1px_1px_rgba(24,48,68,.04)] transition hover:-translate-y-0.5 hover:border-[#c9c5ba] hover:shadow-[0_5px_16px_rgba(24,48,68,.08)]", canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")}>
      <div className="flex items-start gap-1.5"><GripVertical size={12} className="mt-0.5 hidden shrink-0 text-[#c0c2c1] opacity-0 transition group-hover:opacity-100 2xl:block" /><div className="min-w-0 flex-1"><div className="line-clamp-2 text-xs font-semibold leading-[1.15rem] text-[#20394b]">{project.title}</div><div className="mt-1 truncate text-[10px] text-[#8a9194]">{project.category}</div></div>{canQuickEdit && <button type="button" aria-label={`Edit cepat ${project.title}`} className="hidden h-7 w-7 shrink-0 place-items-center rounded text-[#899195] hover:bg-[#f2f0ea] hover:text-[#20394b] sm:grid" onClick={(event) => { event.stopPropagation(); onQuickEdit(); }}><MoreHorizontal size={15} /></button>}</div>
      <div className="mt-2.5 border-t border-[#efede7] pt-2.5"><div className="flex items-center justify-between gap-1"><div className="flex items-center">{(project.members ?? []).slice(0, 3).map((member, index) => <span key={member.userId} className={index ? "-ml-2" : ""} title={`${member.name} · ${member.role}`}><MiniAvatar initials={memberInitials(member.name)} image={member.image} name={member.name} className="h-6 w-6 ring-white" /></span>)}{(project.members?.length ?? 0) === 0 && <MiniAvatar initials={project.initials} className="h-6 w-6" />}{(project.members?.length ?? 0) > 3 && <span className="ml-1 text-[9px] text-[#7f888d]">+{project.members!.length - 3}</span>}</div><Badge className={cn("shrink-0 px-1.5 py-0.5 text-[9px]", priorityMeta[project.priority])}>{project.priority}</Badge></div><div className={cn("mt-2 flex items-center gap-1 text-[9px]", project.status === "Delay" ? "font-bold text-[#b9433d]" : "text-[#7f888d]")}>{project.status === "Delay" ? <CircleAlert size={10} /> : <Clock3 size={10} />}<span className="truncate">{project.status === "Delay" ? "Terlambat · " : "Deadline · "}{project.deadline}</span></div>{canQuickEdit && <button type="button" className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 border border-[#ddd9cf] bg-[#faf9f5] px-2 text-[10px] font-bold text-[#445965] hover:border-[#c7c2b7] hover:bg-white sm:hidden" onClick={(event) => { event.stopPropagation(); onQuickEdit(); }}><MoreHorizontal size={14} /> Pindahkan status / edit cepat</button>}</div>
    </article>
  );
}

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function MonthYearPicker({ month, year, mode, onChange }: { month: number; year: number; mode: "month" | "year"; onChange: (period: { month: number; year: number }) => void }) {
  const years = Array.from({ length: 9 }, (_, index) => year - 4 + index);
  const move = (step: number) => {
    if (mode === "year") onChange({ month, year: year + step });
    else {
      const next = new Date(year, month + step, 1);
      onChange({ month: next.getMonth(), year: next.getFullYear() });
    }
  };
  return <div className="inline-flex items-center gap-1 rounded-md border border-[#d9d7cf] bg-white p-1.5 shadow-[0_1px_1px_rgba(24,48,68,.03)]"><button type="button" aria-label="Periode sebelumnya" onClick={() => move(-1)} className="grid h-8 w-8 place-items-center rounded hover:bg-[#f3f1eb]"><ChevronLeft size={15} /></button><CalendarDays size={16} className="ml-1 text-[#e76f36]" />{mode === "month" && <><label className="sr-only" htmlFor="project-period-month">Bulan project</label><select id="project-period-month" aria-label={`Periode aktif ${monthNames[month]} ${year}`} value={month} onChange={(event) => onChange({ month: Number(event.target.value), year })} className="h-8 bg-transparent px-1 text-xs font-bold text-[#314754] outline-none">{monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</select><span className="h-5 w-px bg-[#dedbd3]" /></>}<label className="sr-only" htmlFor="project-period-year">Tahun project</label><select id="project-period-year" aria-label={`Tahun aktif ${year}`} value={year} onChange={(event) => onChange({ month, year: Number(event.target.value) })} className="h-8 bg-transparent px-1 text-xs font-bold text-[#314754] outline-none">{years.map((option) => <option key={option}>{option}</option>)}</select><button type="button" aria-label="Periode berikutnya" onClick={() => move(1)} className="grid h-8 w-8 place-items-center rounded hover:bg-[#f3f1eb]"><ChevronRight size={15} /></button></div>;
}

function ProjectTracker({ projects, setProjects, backendEnabled, profile, isAdmin }: { projects: Project[]; setProjects: React.Dispatch<React.SetStateAction<Project[]>>; backendEnabled: boolean; profile: ProfileData; isAdmin: boolean }) {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState(() => { const today = new Date(); return { month: today.getMonth(), year: today.getFullYear() }; });
  const [periodMode, setPeriodMode] = useState<"month" | "year">("month");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [picFilter, setPicFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"deadline" | "priority" | "title">("deadline");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberOption[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [quickEditing, setQuickEditing] = useState<Project | null>(null);
  const [quickEditBusy, setQuickEditBusy] = useState(false);
  const [touchKanban, setTouchKanban] = useState(false);
  const [undoChange, setUndoChange] = useState<{ previous: Project; current: Project; message: string } | null>(null);
  const boardProjects = showArchived ? archivedProjects : projects;
  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setTouchKanban(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!undoChange) return;
    const timer = window.setTimeout(() => setUndoChange(null), 7_000);
    return () => window.clearTimeout(timer);
  }, [undoChange]);
  useEffect(() => {
    if (!backendEnabled) {
      const names = Array.from(new Set([profile.name, ...projects.map((project) => project.pic)]));
      setWorkspaceMembers(names.map((name, index) => ({ id: `demo-${index}`, name, email: index === 0 ? profile.email : `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@demo.local`, username: index === 0 ? profile.username : name.toLowerCase().replace(/[^a-z0-9]+/g, "."), image: index === 0 ? profile.image : null, workspaceRole: index === 0 ? "Admin" : "Anggota" })));
      return;
    }
    void fetch("/api/members", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject()).then((payload: { data: WorkspaceMemberOption[] }) => setWorkspaceMembers(payload.data)).catch(() => setProjectError("Daftar anggota belum dapat dimuat."));
  }, [backendEnabled, profile.email, profile.image, profile.name, profile.username, projects]);
  useEffect(() => {
    if (!showArchived || !backendEnabled) return;
    void fetch("/api/projects?archived=true", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { data: ApiProject[] }) => setArchivedProjects(payload.data.map(fromApiProject)))
      .catch(() => setProjectError("Arsip project belum dapat dimuat."));
  }, [backendEnabled, showArchived]);
  const permissionsFor = useCallback((project: Project): ProjectPermissions => {
    if (!backendEnabled || isAdmin) return { role: "Admin", canEdit: true, canManageMembers: true, canComment: true, canRequestCompletion: true, canApproveCompletion: true, canDelete: true };
    const role = project.members?.find((member) => member.email.toLowerCase() === profile.email.toLowerCase())?.role ?? null;
    return { role, canEdit: role === "Lead", canManageMembers: role === "Lead", canComment: role === "Lead" || role === "Anggota", canRequestCompletion: role === "Lead" || role === "Anggota", canApproveCompletion: role === "Lead", canDelete: role === "Lead" };
  }, [backendEnabled, isAdmin, profile.email]);
  const pics = Array.from(new Set(boardProjects.map((project) => project.pic))).sort();
  const categories = Array.from(new Set(boardProjects.map((project) => project.category))).sort();
  const priorityRank: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
  const filtered = boardProjects.filter((project) => {
    const periodIso = project.status === "Done" ? project.completedAtIso || project.deadlineIso : project.deadlineIso;
    const periodDate = periodIso ? new Date(periodIso) : null;
    const matchesPeriod = !!periodDate && periodDate.getFullYear() === period.year && (periodMode === "year" || periodDate.getMonth() === period.month);
    const matchesSearch = `${project.title} ${project.pic} ${project.category}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    const matchesPic = picFilter === "all" || project.pic === picFilter;
    const matchesCategory = categoryFilter === "all" || project.category === categoryFilter;
    return matchesPeriod && matchesSearch && matchesStatus && matchesPic && matchesCategory;
  }).sort((a, b) => {
    if (sortOrder === "priority") return priorityRank[a.priority] - priorityRank[b.priority] || a.title.localeCompare(b.title, "id");
    if (sortOrder === "title") return a.title.localeCompare(b.title, "id");
    return new Date(a.deadlineIso || "9999-12-31").getTime() - new Date(b.deadlineIso || "9999-12-31").getTime();
  });
  const revealProject = (project: Project) => {
    const relevantDate = project.status === "Done" ? project.completedAtIso || project.deadlineIso : project.deadlineIso;
    if (relevantDate) {
      const target = new Date(relevantDate);
      setPeriod({ month: target.getMonth(), year: target.getFullYear() });
      setPeriodMode("month");
    }
    setSearch("");
    setStatusFilter("all");
    setPicFilter("all");
    setCategoryFilter("all");
  };
  const createProject = async (project: Project) => {
    setProjectError("");
    revealProject(project);
    setProjects((current) => [project, ...current]);
    if (!backendEnabled) {
      return;
    }
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toProjectPayload(project)) });
      if (!response.ok) throw new Error("Project gagal disimpan");
      const payload = await response.json() as { data: ApiProject };
      const saved = fromApiProject(payload.data);
      setProjects((current) => current.map((item) => item.id === project.id ? saved : item));
      revealProject(saved);
    } catch {
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setProjectError("Project belum dapat disimpan. Silakan periksa koneksi lalu coba lagi.");
    }
  };
  const replaceProject = useCallback((project: Project) => {
    setProjects((current) => current.map((item) => item.id === project.id ? project : item));
    setSelected((current) => current?.id === project.id ? project : current);
  }, [setProjects]);
  const loadLatestProject = async (id: number, payload?: { data?: ApiProject; current?: ApiProject; latest?: ApiProject }) => {
    const embedded = payload?.data || payload?.current || payload?.latest;
    if (embedded) return fromApiProject(embedded);
    try {
      const response = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      if (!response.ok) return null;
      const latestPayload = await response.json() as { data?: ApiProject };
      return latestPayload.data ? fromApiProject(latestPayload.data) : null;
    } catch {
      return null;
    }
  };
  const patchProject = async (previous: Project, next: Project, message: string, allowUndo = true) => {
    const displayDeadline = next.deadlineIso ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(new Date(next.deadlineIso)).replace(".", "") : next.deadline;
    const optimistic = { ...next, deadline: displayDeadline };
    setProjectError("");
    replaceProject(optimistic);
    if (!backendEnabled) {
      if (allowUndo) setUndoChange({ previous, current: optimistic, message });
      return true;
    }
    try {
      const response = await fetch(`/api/projects/${next.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toProjectPayload(next)) });
      const payload = await response.json() as { data?: ApiProject; current?: ApiProject; latest?: ApiProject; error?: string };
      if (response.status === 409) {
        const latest = await loadLatestProject(next.id, payload);
        if (latest) replaceProject(latest); else replaceProject(previous);
        setProjectError("Project telah diperbarui oleh anggota lain. Data terbaru sudah dimuat; silakan periksa lalu ulangi perubahan.");
        return false;
      }
      if (!response.ok || !payload.data) throw new Error(payload.error || "Perubahan project gagal disimpan");
      const saved = fromApiProject(payload.data);
      replaceProject(saved);
      if (allowUndo) setUndoChange({ previous, current: saved, message });
      return true;
    } catch (error) {
      replaceProject(previous);
      setProjectError(error instanceof Error ? error.message : "Perubahan project gagal disimpan.");
      return false;
    }
  };
  const undoProjectChange = async () => {
    const change = undoChange;
    if (!change) return;
    setUndoChange(null);
    const rollback = { ...change.previous, version: change.current.version };
    const restored = await patchProject(change.current, rollback, "Perubahan dibatalkan", false);
    if (restored) setProjectError("Perubahan berhasil dibatalkan.");
  };
  const saveProject = async (project: Project) => {
    const previous = projects.find((item) => item.id === project.id);
    if (!previous) return;
    await patchProject(previous, project, "Project berhasil diperbarui.");
  };
  const deleteProject = async (project: Project) => {
    if (backendEnabled) {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE", headers: { "If-Match": String(project.version ?? "") } });
      if (response.status === 409) {
        const payload = await response.json() as { data?: ApiProject; error?: string };
        if (payload.data) replaceProject(fromApiProject(payload.data));
        setDeleting(false);
        setProjectError(payload.error || "Project telah berubah dan belum dihapus. Data terbaru sudah dimuat.");
        return;
      }
      if (!response.ok) { setProjectError("Project belum dapat dihapus."); return; }
    }
    setProjects((current) => current.filter((item) => item.id !== project.id));
    setDeleting(false);
    setSelected(null);
  };
  const toggleArchive = async (project: Project) => {
    const restoring = Boolean(project.archivedAt);
    if (!window.confirm(restoring ? `Pulihkan ${project.title} ke board aktif?` : `Arsipkan ${project.title}? Project tetap dapat dipulihkan.`)) return;
    if (!backendEnabled) {
      if (restoring) { setArchivedProjects((current) => current.filter((item) => item.id !== project.id)); setProjects((current) => [{ ...project, archivedAt: null }, ...current]); }
      else { setProjects((current) => current.filter((item) => item.id !== project.id)); setArchivedProjects((current) => [{ ...project, archivedAt: new Date().toISOString() }, ...current]); }
      setSelected(null); return;
    }
    const response = await fetch(`/api/projects/${project.id}/archive`, { method: restoring ? "DELETE" : "POST", headers: { "If-Match": String(project.version ?? "") } });
    if (response.status === 409) {
      const conflict = await response.json() as { data?: ApiProject; error?: string };
      if (conflict.data) {
        const latest = fromApiProject({ ...conflict.data, members: project.members });
        if (restoring) setArchivedProjects((current) => current.map((item) => item.id === latest.id ? latest : item));
        else replaceProject(latest);
        setSelected(latest);
      }
      setProjectError(conflict.error || "Project telah berubah. Status arsip belum diubah.");
      return;
    }
    if (!response.ok) { setProjectError("Status arsip belum dapat diperbarui."); return; }
    const payload = await response.json() as { data: ApiProject };
    const updated = fromApiProject({ ...payload.data, members: project.members });
    if (restoring) { setArchivedProjects((current) => current.filter((item) => item.id !== project.id)); setProjects((current) => [updated, ...current]); }
    else { setProjects((current) => current.filter((item) => item.id !== project.id)); setArchivedProjects((current) => [updated, ...current]); }
    setSelected(null);
  };
  const requestDoneApproval = async (project: Project) => {
    if (!backendEnabled) { setProjectError("Mode demo: permintaan approval Done disimulasikan."); return true; }
    try {
      const response = await fetch(`/api/projects/${project.id}/approval`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: "Diajukan melalui Kanban" }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Permintaan approval gagal");
      setProjectError("Permintaan pindah ke Done sudah dikirim ke Lead/Admin.");
      return true;
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Permintaan approval gagal.");
      return false;
    }
  };
  const changeProjectStatus = async (project: Project, status: Status) => {
    if (project.status === status) return true;
    const permissions = permissionsFor(project);
    if (!permissions.canEdit) {
      if (status === "Done" && permissions.canRequestCompletion) return requestDoneApproval(project);
      setProjectError("Role Anda tidak memiliki izin untuk mengubah status project ini.");
      return false;
    }
    const changed = { ...project, status, completedAtIso: status === "Done" ? project.completedAtIso || new Date().toISOString() : undefined };
    return patchProject(project, changed, `${project.title} dipindahkan ke ${status}.`);
  };
  const saveQuickEdit = async (project: Project) => {
    const previous = projects.find((item) => item.id === project.id);
    if (!previous) return;
    const permissions = permissionsFor(previous);
    setQuickEditBusy(true);
    try {
      if (!permissions.canEdit) {
        if (project.status === "Done" && permissions.canRequestCompletion) {
          const requested = await requestDoneApproval(previous);
          if (requested) setQuickEditing(null);
        } else setProjectError("Role Anda tidak memiliki izin untuk mengubah project ini.");
        return;
      }
      const changed = { ...project, completedAtIso: project.status === "Done" ? project.completedAtIso || new Date().toISOString() : undefined };
      const saved = await patchProject(previous, changed, `${project.title} berhasil diperbarui.`);
      if (saved) setQuickEditing(null);
    } finally {
      setQuickEditBusy(false);
    }
  };
  const drop = (event: React.DragEvent, status: Status) => {
    event.preventDefault();
    const id = Number(event.dataTransfer.getData("projectId"));
    if (!id) return;
    const project = projects.find((item) => item.id === id);
    if (project) void changeProjectStatus(project, status);
  };
  return <div className="fade-up">
    <SectionHeading eyebrow="Track" title={showArchived ? "Arsip Project" : "Project Tracker"} description={showArchived ? "Project yang selesai disimpan tanpa menghapus riwayat, komentar, maupun asetnya." : "Pantau alur kerja tim. Di desktop tarik kartu; di HP gunakan Pindahkan status / edit cepat."} action={<div className="flex gap-2"><Button variant="outline" onClick={() => { setShowArchived((current) => !current); setSelected(null); }}><Archive size={17} />{showArchived ? "Kembali ke board" : "Buka arsip"}</Button>{!showArchived && <Button onClick={() => setAdding(true)}><Plus size={17} /> Tambah project</Button>}</div>} />
    <div className="mb-3 flex flex-wrap items-center gap-2"><div className="inline-flex rounded-md border border-[#d9d7cf] bg-white p-1"><button type="button" onClick={() => setPeriodMode("month")} className={cn("rounded px-3 py-1.5 text-xs font-bold", periodMode === "month" ? "bg-[#193246] text-white" : "text-[#667278] hover:bg-[#f3f1eb]")}>Bulanan</button><button type="button" onClick={() => setPeriodMode("year")} className={cn("rounded px-3 py-1.5 text-xs font-bold", periodMode === "year" ? "bg-[#193246] text-white" : "text-[#667278] hover:bg-[#f3f1eb]")}>Tahunan</button></div><MonthYearPicker month={period.month} year={period.year} mode={periodMode} onChange={setPeriod} /><Button type="button" size="sm" variant="outline" onClick={() => { const today = new Date(); setPeriod({ month: today.getMonth(), year: today.getFullYear() }); setPeriodMode("month"); }}>Hari ini</Button><span className="ml-auto text-[11px] text-[#8a9194]">{periodMode === "month" ? `Board ${monthNames[period.month]} ${period.year}` : `Board tahun ${period.year}`}</span></div>
    {projectError && <div className="mb-4 border-l-2 border-[#d8564e] bg-[#f9e8e5] px-3 py-2 text-xs text-[#a43d37]">{projectError}</div>}
    <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center"><div className="relative min-w-64 max-w-md flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8f9699]" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Cari project, PIC, atau kategori..." /></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><label className="sr-only" htmlFor="status-filter">Filter status</label><select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status | "all")} className="h-10 rounded-md border border-[#d9d7cf] bg-white px-3 text-xs font-semibold text-[#59656c]"><option value="all">Semua status</option>{Object.keys(statusMeta).map((status) => <option key={status} value={status}>{status}</option>)}</select><label className="sr-only" htmlFor="pic-filter">Filter PIC</label><select id="pic-filter" value={picFilter} onChange={(e) => setPicFilter(e.target.value)} className="h-10 rounded-md border border-[#d9d7cf] bg-white px-3 text-xs font-semibold text-[#59656c]"><option value="all">Semua PIC</option>{pics.map((pic) => <option key={pic} value={pic}>{pic}</option>)}</select><label className="sr-only" htmlFor="category-filter">Filter kategori</label><select id="category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-10 rounded-md border border-[#d9d7cf] bg-white px-3 text-xs font-semibold text-[#59656c]"><option value="all">Semua kategori</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><label className="sr-only" htmlFor="sort-projects">Urutkan project</label><select id="sort-projects" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)} className="h-10 rounded-md border border-[#d9d7cf] bg-white px-3 text-xs font-semibold text-[#59656c]"><option value="deadline">Deadline terdekat</option><option value="priority">Prioritas tertinggi</option><option value="title">Nama A–Z</option></select></div><div className="xl:ml-auto text-xs text-[#7d8589]"><b className="text-[#183044]">{filtered.length}</b> project ditampilkan</div></div>
    <div className="thin-scrollbar -mx-5 overflow-x-auto px-5 pb-4 md:-mx-8 md:px-8 xl:mx-0 xl:overflow-visible xl:px-0"><div className="grid min-w-[1080px] grid-cols-5 gap-2 xl:min-w-0">
      {(Object.keys(statusMeta) as Status[]).map((status) => { const list = filtered.filter((p) => p.status === status); return <section key={status} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { if (!showArchived && !touchKanban) drop(e, status); }} className="min-h-[540px] min-w-0 bg-[#eeece6] p-2"><div className="mb-2 flex items-center px-0.5 py-1"><i className={cn("mr-1.5 h-2 w-2 shrink-0 rounded-full", statusMeta[status].dot)} /><h2 className="truncate text-[10px] font-bold uppercase tracking-[0.08em]">{status}</h2><span className="ml-auto rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#7e878b]">{list.length}</span></div><div className="space-y-2">{list.map((p) => { const permissions = permissionsFor(p); const canRequestDone = permissions.canRequestCompletion && p.status !== "Done"; return <ProjectCard key={p.id} project={p} canDrag={!touchKanban && !showArchived && (permissions.canEdit || canRequestDone)} canQuickEdit={!showArchived && (permissions.canEdit || canRequestDone)} onClick={() => setSelected(p)} onQuickEdit={() => setQuickEditing(p)} />; })}{list.length === 0 && <div className="grid h-20 place-items-center border border-dashed border-[#cbc7bd] px-2 text-center text-[10px] text-[#9a9c9a]">{showArchived ? "Tidak ada project arsip" : touchKanban ? "Belum ada project" : "Tarik project ke sini"}</div>}</div></section>; })}
    </div></div>
    <AddProjectDialog open={adding} defaultDeadline={`${period.year}-${String(period.month + 1).padStart(2, "0")}-15`} workspaceMembers={workspaceMembers} currentUserEmail={profile.email} onOpenChange={setAdding} onAdd={(project) => { void createProject(project); }} />
    <ProjectDetail project={selected} open={!!selected && !editing && !deleting} backendEnabled={backendEnabled} fallbackPermissions={selected ? permissionsFor(selected) : { role: null, canEdit: false, canManageMembers: false, canComment: false, canRequestCompletion: false, canApproveCompletion: false, canDelete: false }} onOpenChange={(v) => !v && setSelected(null)} onEdit={() => setEditing(true)} onDelete={() => setDeleting(true)} onArchive={() => { if (selected) void toggleArchive(selected); }} onProjectUpdated={(updated) => { setProjects((current) => current.map((item) => item.id === updated.id ? updated : item)); setSelected(updated); }} />
    <EditProjectDialog project={selected} open={editing} workspaceMembers={workspaceMembers} onOpenChange={setEditing} onSave={(project) => { void saveProject(project); }} />
    <ProjectQuickEditDialog project={quickEditing} open={!!quickEditing} workspaceMembers={workspaceMembers} canEdit={quickEditing ? permissionsFor(quickEditing).canEdit : false} canRequestCompletion={quickEditing ? permissionsFor(quickEditing).canRequestCompletion : false} busy={quickEditBusy} onOpenChange={(open) => !open && setQuickEditing(null)} onSave={(project) => { void saveQuickEdit(project); }} />
    <DeleteProjectDialog project={selected} open={deleting} onOpenChange={setDeleting} onConfirm={() => { if (selected) void deleteProject(selected); }} />
    {undoChange && <div role="status" className="fixed bottom-5 left-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-md bg-[#193246] px-4 py-3 text-xs text-white shadow-[0_12px_36px_rgba(16,38,54,.28)]"><Check size={16} className="shrink-0 text-[#7fc4a5]" /><span className="min-w-0 flex-1">{undoChange.message}</span><button type="button" onClick={() => void undoProjectChange()} className="min-h-9 shrink-0 rounded px-2 font-bold text-[#f2b889] hover:bg-white/10">Batalkan</button><button type="button" aria-label="Tutup notifikasi" onClick={() => setUndoChange(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded hover:bg-white/10"><X size={15} /></button></div>}
  </div>;
}

type AgendaItem = { id: number; title: string; pic: string; category: string; startTime: string; endTime: string; note: string; projectId?: number | null };
type CalendarEvent = { label: string; type: "deadline" | "meeting" | "publish"; agendaId?: number };

const initialAgendas: AgendaItem[] = [
  { id: 1, title: "FGD Komunitas Urban", pic: "Nadia Putri", category: "Meeting", startTime: "2026-08-26T13:00:00+07:00", endTime: "2026-08-26T15:00:00+07:00", note: "Sesi diskusi bersama responden utama.", projectId: 5 },
  { id: 2, title: "Sync editorial mingguan", pic: "Tim riset", category: "Meeting", startTime: "2026-08-26T16:30:00+07:00", endTime: "2026-08-26T17:00:00+07:00", note: "Sinkronisasi progres dan kebutuhan publikasi." },
  { id: 3, title: "Review laporan Gen Z", pic: "Dita Anjani", category: "Review", startTime: "2026-08-27T10:00:00+07:00", endTime: "2026-08-27T11:00:00+07:00", note: "Review executive summary bersama lead.", projectId: 8 },
  { id: 4, title: "Publikasi insight bulanan", pic: "Maya Kirana", category: "Publikasi", startTime: "2026-09-06T09:00:00+07:00", endTime: "2026-09-06T10:00:00+07:00", note: "Publikasi rangkuman insight bulanan." },
];

function AgendaDialog({ open, agenda, projects, onOpenChange, onSave, onDelete }: { open: boolean; agenda: AgendaItem | null; projects: Project[]; onOpenChange: (value: boolean) => void; onSave: (agenda: AgendaItem) => void; onDelete: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const [pic, setPic] = useState("Nadia Putri");
  const [category, setCategory] = useState("Meeting");
  const [startTime, setStartTime] = useState("2026-08-27T09:00");
  const [endTime, setEndTime] = useState("2026-08-27T10:00");
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!open) return;
    setTitle(agenda?.title || ""); setPic(agenda?.pic || "Nadia Putri"); setCategory(agenda?.category || "Meeting");
    setStartTime(agenda?.startTime.slice(0, 16) || "2026-08-27T09:00"); setEndTime(agenda?.endTime.slice(0, 16) || "2026-08-27T10:00");
    setProjectId(agenda?.projectId ? String(agenda.projectId) : ""); setNote(agenda?.note || "");
  }, [agenda, open]);
  const submit = () => {
    if (!title.trim() || !startTime || !endTime || new Date(endTime) < new Date(startTime)) return;
    onSave({ id: agenda?.id || Date.now(), title: title.trim(), pic, category, startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString(), note: note.trim(), projectId: projectId ? Number(projectId) : null });
    onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{agenda ? "Edit agenda" : "Tambah agenda"}</DialogTitle><DialogDescription>Atur meeting, publikasi, atau jadwal pekerjaan tim.</DialogDescription></DialogHeader><div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 thin-scrollbar"><label className="block text-xs font-bold text-[#59656c]">Nama agenda<Input className="mt-2" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-[#59656c]">Mulai<Input type="datetime-local" className="mt-2 font-normal" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label className="text-xs font-bold text-[#59656c]">Selesai<Input type="datetime-local" className="mt-2 font-normal" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label><label className="text-xs font-bold text-[#59656c]">PIC<Input className="mt-2 font-normal" value={pic} onChange={(event) => setPic(event.target.value)} /></label><label className="text-xs font-bold text-[#59656c]">Kategori<select className="mt-2 h-10 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm font-normal" value={category} onChange={(event) => setCategory(event.target.value)}><option>Meeting</option><option>Review</option><option>Publikasi</option><option>Schedule</option></select></label></div><label className="block text-xs font-bold text-[#59656c]">Project terkait<select className="mt-2 h-10 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm font-normal" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Tidak terkait project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label><label className="block text-xs font-bold text-[#59656c]">Catatan<textarea className="mt-2 min-h-20 w-full resize-none rounded-md border border-[#d9d7cf] bg-white p-3 text-sm" value={note} onChange={(event) => setNote(event.target.value)} /></label><div className="flex items-center gap-2">{agenda && <Button variant="outline" className="mr-auto border-[#e2b9b5] text-[#b9433d] hover:bg-[#f9e8e5]" onClick={() => { onDelete(agenda.id); onOpenChange(false); }}><Trash2 size={15} /> Hapus</Button>}<Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={submit} disabled={!title.trim() || !startTime || !endTime || new Date(endTime) < new Date(startTime)}><Check size={16} />{agenda ? "Simpan perubahan" : "Tambah agenda"}</Button></div></div></DialogContent></Dialog>;
}

function CalendarPlanner({ projects, backendEnabled }: { projects: Project[]; backendEnabled: boolean }) {
  const initialWibDate = getWibDateParts(new Date());
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [period, setPeriod] = useState({ year: initialWibDate.year, month: initialWibDate.month });
  const [selectedDay, setSelectedDay] = useState(initialWibDate.day);
  const [agendaRows, setAgendaRows] = useState<AgendaItem[]>(initialAgendas);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [selectedAgenda, setSelectedAgenda] = useState<AgendaItem | null>(null);
  const wibClock = useWibClock(60_000);
  const todayWib = getWibDateParts(wibClock || new Date());
  useEffect(() => {
    if (!backendEnabled) return;
    fetch("/api/agendas").then((response) => response.ok ? response.json() : Promise.reject()).then((payload: { data: AgendaItem[] }) => setAgendaRows(payload.data)).catch(() => undefined);
  }, [backendEnabled]);
  const saveAgenda = async (agenda: AgendaItem) => {
    if (!backendEnabled) {
      setAgendaRows((current) => current.some((item) => item.id === agenda.id) ? current.map((item) => item.id === agenda.id ? agenda : item) : [...current, agenda]);
      return;
    }
    const editing = selectedAgenda !== null;
    const response = await fetch(editing ? `/api/agendas/${selectedAgenda.id}` : "/api/agendas", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: agenda.title, pic: agenda.pic, category: agenda.category, startTime: agenda.startTime, endTime: agenda.endTime, note: agenda.note, projectId: agenda.projectId ?? null }),
    });
    if (!response.ok) return;
    const payload = await response.json() as { data: AgendaItem };
    setAgendaRows((current) => current.some((item) => item.id === payload.data.id) ? current.map((item) => item.id === payload.data.id ? payload.data : item) : [...current, payload.data]);
    setSelectedAgenda(payload.data);
  };
  const deleteAgenda = async (id: number) => {
    if (backendEnabled) {
      const response = await fetch(`/api/agendas/${id}`, { method: "DELETE" });
      if (!response.ok) return;
    }
    setAgendaRows((current) => current.filter((agenda) => agenda.id !== id));
    setSelectedAgenda(null);
  };
  const label = viewMode === "year" ? String(period.year) : `${monthNames[period.month]} ${period.year}`;
  const startPad = (new Date(period.year, period.month, 1).getDay() + 6) % 7;
  const days = new Date(period.year, period.month + 1, 0).getDate();
  useEffect(() => { if (selectedDay > days) setSelectedDay(days); }, [days, selectedDay]);
  const eventsByDay: Record<number, CalendarEvent[]> = {};
  const addEvent = (date: Date, event: CalendarEvent) => {
    const dateParts = getWibDateParts(date);
    if (dateParts.year !== period.year || dateParts.month !== period.month) return;
    (eventsByDay[dateParts.day] ||= []).push(event);
  };
  projects.forEach((project) => { if (project.deadlineIso) addEvent(new Date(project.deadlineIso), { label: project.title, type: "deadline" }); });
  agendaRows.forEach((agenda) => addEvent(new Date(agenda.startTime), { label: agenda.title, type: agenda.category.toLowerCase().includes("publikasi") ? "publish" : "meeting", agendaId: agenda.id }));
  const selectedDate = new Date(Date.UTC(period.year, period.month, selectedDay, 12));
  const selectedAgendas = agendaRows.filter((agenda) => {
    const dateParts = getWibDateParts(new Date(agenda.startTime));
    return dateParts.year === period.year && dateParts.month === period.month && dateParts.day === selectedDay;
  });
  const selectedDateLabel = new Intl.DateTimeFormat("id-ID", { timeZone: WIB_TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(selectedDate);
  const selectedWeekday = new Intl.DateTimeFormat("id-ID", { timeZone: WIB_TIME_ZONE, weekday: "long" }).format(selectedDate);
  const monthEventCounts = monthNames.map((_, month) => {
    const projectCount = projects.filter((project) => project.deadlineIso && (() => {
      const dateParts = getWibDateParts(new Date(project.deadlineIso));
      return dateParts.year === period.year && dateParts.month === month;
    })()).length;
    const agendaCount = agendaRows.filter((agenda) => {
      const dateParts = getWibDateParts(new Date(agenda.startTime));
      return dateParts.year === period.year && dateParts.month === month;
    }).length;
    return projectCount + agendaCount;
  });
  const movePeriod = (step: number) => {
    if (viewMode === "year") {
      setPeriod((current) => ({ ...current, year: current.year + step }));
      return;
    }
    setPeriod((current) => {
      const next = new Date(current.year, current.month + step, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };
  const goToToday = () => {
    const current = getWibDateParts(new Date());
    setPeriod({ year: current.year, month: current.month });
    setSelectedDay(current.day);
    setViewMode("month");
  };
  return <div className="fade-up"><SectionHeading eyebrow="Schedule" title="Calendar Planner" description="Satukan deadline project, agenda meeting, dan jadwal publikasi dalam satu kalender." action={<Button onClick={() => { setSelectedAgenda(null); setAgendaOpen(true); }}><Plus size={17} /> Tambah agenda</Button>} />
    <div className="grid gap-6 xl:grid-cols-[1fr_290px]"><section className="bg-white p-4 md:p-6"><div className="mb-5 flex flex-wrap items-center gap-3"><div className="flex items-center gap-2"><button type="button" aria-label={viewMode === "year" ? "Tahun sebelumnya" : "Bulan sebelumnya"} onClick={() => movePeriod(-1)} className="grid h-8 w-8 place-items-center rounded-md border border-[#dedbd3] hover:bg-[#f5f3ed]"><ChevronLeft size={16} /></button><button type="button" aria-label={viewMode === "year" ? "Tahun berikutnya" : "Bulan berikutnya"} onClick={() => movePeriod(1)} className="grid h-8 w-8 place-items-center rounded-md border border-[#dedbd3] hover:bg-[#f5f3ed]"><ChevronRight size={16} /></button><h2 className="ml-2 min-w-36 font-serif text-xl font-semibold">{label}</h2></div><div role="group" aria-label="Tampilan kalender" className="ml-auto inline-flex rounded-md border border-[#d9d7cf] bg-white p-1"><button type="button" aria-pressed={viewMode === "month"} onClick={() => setViewMode("month")} className={cn("rounded px-3 py-1.5 text-xs font-bold", viewMode === "month" ? "bg-[#193246] text-white" : "text-[#667278] hover:bg-[#f3f1eb]")}>Bulanan</button><button type="button" aria-pressed={viewMode === "year"} onClick={() => setViewMode("year")} className={cn("rounded px-3 py-1.5 text-xs font-bold", viewMode === "year" ? "bg-[#193246] text-white" : "text-[#667278] hover:bg-[#f3f1eb]")}>Tahunan</button></div><Button type="button" size="sm" variant="outline" onClick={goToToday}>Hari ini</Button></div>
      {viewMode === "month" ? <div className="grid grid-cols-7 border-l border-t border-[#e2dfd7]">{["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => <div key={d} className="border-b border-r border-[#e2dfd7] py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[#8c9295]">{d}</div>)}{Array.from({ length: startPad }).map((_, i) => <div key={`p-${i}`} className="min-h-24 border-b border-r border-[#e2dfd7] bg-[#f8f7f3] md:min-h-28" />)}{Array.from({ length: days }).map((_, i) => { const day = i + 1; const dayEvents = eventsByDay[day] || []; const isToday = period.year === todayWib.year && period.month === todayWib.month && day === todayWib.day; const chosen = selectedDay === day; return <div key={day} className={cn("min-h-24 border-b border-r border-[#e2dfd7] p-1.5 md:min-h-28 md:p-2", isToday && "bg-[#fff8f4]")}><button aria-current={isToday ? "date" : undefined} aria-label={`Lihat agenda ${day} ${label}${isToday ? ", hari ini" : ""}`} onClick={() => setSelectedDay(day)} className={cn("mb-1 grid h-6 w-6 place-items-center text-xs hover:bg-[#f0eee8]", chosen && "rounded-full bg-[#e76f36] font-bold text-white hover:bg-[#cf5d27]")}>{day}</button><div className="space-y-1">{dayEvents.slice(0, 2).map((event, index) => <button key={`${event.label}-${index}`} onClick={() => { setSelectedDay(day); if (!event.agendaId) return; setSelectedAgenda(agendaRows.find((agenda) => agenda.id === event.agendaId) || null); setAgendaOpen(true); }} className={cn("block w-full truncate border-l-2 px-1.5 py-1 text-left text-[9px] font-semibold md:text-[10px]", event.type === "deadline" ? "cursor-default border-[#d8564e] bg-[#f9e8e5] text-[#a43d37]" : event.type === "publish" ? "border-[#4f826c] bg-[#e5efe9] text-[#3f6f5b]" : "border-[#3578a8] bg-[#e6f0f7] text-[#28658f]")}>{event.label}</button>)}</div></div>; })}</div> : <div aria-label={`Ringkasan kalender tahun ${period.year}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{monthNames.map((monthName, month) => { const isCurrentMonth = period.year === todayWib.year && month === todayWib.month; return <button type="button" key={monthName} onClick={() => { setPeriod((current) => ({ ...current, month })); setSelectedDay(isCurrentMonth ? todayWib.day : 1); setViewMode("month"); }} className={cn("border border-[#e2dfd7] p-4 text-left transition hover:border-[#e76f36] hover:bg-[#fff8f4]", isCurrentMonth && "border-[#e9a17d] bg-[#fff8f4]")}><div className="flex items-center justify-between"><span className="font-serif text-lg font-semibold">{monthName}</span>{isCurrentMonth && <Badge className="bg-[#f7e2d5] text-[#b9572c]">Bulan ini</Badge>}</div><div className="mt-5 text-2xl font-semibold text-[#193246]">{monthEventCounts[month]}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#8a9194]">agenda & deadline</div></button>; })}</div>}</section>
    <aside className="space-y-4"><div className="bg-[#193246] p-5 text-white"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#e9a17d]">Agenda tanggal</div><div className="mt-2 font-serif text-3xl font-semibold">{selectedDateLabel}</div><div className="mt-1 capitalize text-xs text-[#a9b7c0]">{selectedWeekday} · {selectedAgendas.length} agenda</div><div className="mt-6 space-y-4">{selectedAgendas.map((agenda) => <button key={agenda.id} onClick={() => { setSelectedAgenda(agenda); setAgendaOpen(true); }} className="block w-full border-l-2 border-[#6e9bc0] pl-3 text-left"><div className="text-sm font-semibold">{agenda.title}</div><div className="mt-1 text-[11px] text-[#a9b7c0]">{new Intl.DateTimeFormat("id-ID", { timeZone: WIB_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(agenda.startTime)).replace(":", ".")} · {agenda.pic}</div></button>)}{selectedAgendas.length === 0 && <p className="text-xs leading-5 text-[#a9b7c0]">Belum ada agenda pada tanggal ini.</p>}</div></div><div className="bg-white p-5"><h3 className="text-sm font-bold">Keterangan</h3><div className="mt-4 space-y-3 text-xs text-[#657177]"><div className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#d8564e]" />Deadline project</div><div className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#3578a8]" />Meeting / agenda</div><div className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#4f826c]" />Jadwal publikasi</div></div></div></aside></div>
    <AgendaDialog open={agendaOpen} agenda={selectedAgenda} projects={projects} onOpenChange={setAgendaOpen} onSave={(agenda) => { void saveAgenda(agenda); }} onDelete={(id) => { void deleteAgenda(id); }} />
  </div>;
}

type AssetRecord = {
  id: number;
  title: string;
  category: string;
  pic: string;
  i: string;
  date: string;
  dateIso: string;
  tags: string[];
  desc: string;
  link?: string | null;
  documentLink?: string | null;
};

const initialAssets: AssetRecord[] = [
  { id: 1, title: "Analisis Kompetitor Fintech", category: "Competitor Research", pic: "Fikri Ramadhan", i: "FR", date: "19 Agu 2026", dateIso: "2026-08-19", tags: ["fintech", "market", "benchmark"], desc: "Pemetaan positioning dan komunikasi tujuh pemain fintech nasional.", link: "https://drive.google.com/", documentLink: "https://docs.google.com/" },
  { id: 2, title: "Profil Audiens Podcast", category: "Audience Research", pic: "Maya Kirana", i: "MK", date: "16 Agu 2026", dateIso: "2026-08-16", tags: ["podcast", "audience", "survey"], desc: "Profil demografis, motivasi dengar, dan kebiasaan konsumsi audiens.", link: "https://docs.google.com/" },
  { id: 3, title: "Landscape Sustainability", category: "Desk Research", pic: "Arga Wibawa", i: "AW", date: "08 Agu 2026", dateIso: "2026-08-08", tags: ["ESG", "sustainability"], desc: "Ringkasan isu dan percakapan keberlanjutan di sektor FMCG.", link: "https://www.canva.com/" },
  { id: 4, title: "Persepsi Layanan Publik", category: "Brand Research", pic: "Nadia Putri", i: "NP", date: "31 Jul 2026", dateIso: "2026-07-31", tags: ["public", "perception"], desc: "Studi persepsi masyarakat pada layanan digital pemerintahan.", link: "https://drive.google.com/" },
  { id: 5, title: "Media Mapping Teknologi", category: "Media Mapping", pic: "Dita Anjani", i: "DA", date: "25 Jul 2026", dateIso: "2026-07-25", tags: ["media", "technology"], desc: "Database media dan jurnalis teknologi prioritas 2026.", link: "https://docs.google.com/" },
  { id: 6, title: "Retail Trend Snapshot", category: "Trend Report", pic: "Fikri Ramadhan", i: "FR", date: "18 Jul 2026", dateIso: "2026-07-18", tags: ["retail", "trend", "consumer"], desc: "Snapshot perubahan perilaku belanja dan kanal retail utama.", link: "https://www.canva.com/" },
];

type ApiAsset = { id: number; projectName: string; category: string; pic: string; picInitials: string; completedDate: string; tags: string[]; description: string; assetLink: string | null; docLink: string | null };

function fromApiAsset(asset: ApiAsset): AssetRecord {
  return {
    id: asset.id,
    title: asset.projectName,
    category: asset.category,
    pic: asset.pic,
    i: asset.picInitials,
    date: new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(asset.completedDate)).replace(".", ""),
    dateIso: asset.completedDate.slice(0, 10),
    tags: asset.tags,
    desc: asset.description,
    link: asset.assetLink,
    documentLink: asset.docLink,
  };
}

function AssetDialog({ open, asset, onOpenChange, onSave, onDelete }: { open: boolean; asset: AssetRecord | null; onOpenChange: (value: boolean) => void; onSave: (asset: AssetRecord) => void; onDelete: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [pic, setPic] = useState("");
  const [dateIso, setDateIso] = useState("2026-08-27");
  const [tags, setTags] = useState("");
  const [desc, setDesc] = useState("");
  const [link, setLink] = useState("");
  const [documentLink, setDocumentLink] = useState("");
  useEffect(() => {
    if (!open) return;
    setTitle(asset?.title || ""); setCategory(asset?.category || ""); setPic(asset?.pic || ""); setDateIso(asset?.dateIso || "2026-08-27");
    setTags(asset?.tags.join(", ") || ""); setDesc(asset?.desc || ""); setLink(asset?.link || ""); setDocumentLink(asset?.documentLink || "");
  }, [asset, open]);
  const save = () => {
    const cleanTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    const initials = pic.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const date = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${dateIso}T12:00:00+07:00`)).replace(".", "");
    onSave({ id: asset?.id || Date.now(), title: title.trim(), category: category.trim(), pic: pic.trim(), i: initials, date, dateIso, tags: cleanTags, desc: desc.trim(), link: link.trim() || null, documentLink: documentLink.trim() || null });
    onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{asset ? "Edit aset" : "Tambah aset"}</DialogTitle><DialogDescription>Simpan hasil project beserta tautan kerja agar mudah ditemukan kembali.</DialogDescription></DialogHeader><div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 thin-scrollbar"><label className="block text-xs font-bold text-[#59656c]">Nama project<Input className="mt-2" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-[#59656c]">Kategori<Input className="mt-2 font-normal" value={category} onChange={(event) => setCategory(event.target.value)} /></label><label className="text-xs font-bold text-[#59656c]">PIC<Input className="mt-2 font-normal" value={pic} onChange={(event) => setPic(event.target.value)} /></label><label className="text-xs font-bold text-[#59656c]">Tanggal selesai<Input type="date" className="mt-2 font-normal" value={dateIso} onChange={(event) => setDateIso(event.target.value)} /></label><label className="text-xs font-bold text-[#59656c]">Tag<Input className="mt-2 font-normal" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="riset, laporan, 2026" /></label></div><label className="block text-xs font-bold text-[#59656c]">Link aset<Input type="url" className="mt-2 font-normal" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://drive.google.com/..." /></label><label className="block text-xs font-bold text-[#59656c]">Link dokumen<Input type="url" className="mt-2 font-normal" value={documentLink} onChange={(event) => setDocumentLink(event.target.value)} placeholder="https://docs.google.com/..." /></label><label className="block text-xs font-bold text-[#59656c]">Deskripsi<textarea className="mt-2 min-h-24 w-full resize-none rounded-md border border-[#d9d7cf] bg-white p-3 text-sm" value={desc} onChange={(event) => setDesc(event.target.value)} /></label><div className="flex items-center gap-2">{asset && <Button variant="outline" className="mr-auto border-[#e2b9b5] text-[#b9433d] hover:bg-[#f9e8e5]" onClick={() => { onDelete(asset.id); onOpenChange(false); }}><Trash2 size={15} /> Hapus</Button>}<Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={save} disabled={!title.trim() || !category.trim() || !pic.trim() || !dateIso}><Check size={16} />{asset ? "Simpan perubahan" : "Tambah aset"}</Button></div></div></DialogContent></Dialog>;
}

function AssetLibrary({ backendEnabled }: { backendEnabled: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua kategori");
  const [picFilter, setPicFilter] = useState("Semua PIC");
  const [tagFilter, setTagFilter] = useState("Semua tag");
  const [records, setRecords] = useState<AssetRecord[]>(initialAssets);
  const [selectedAsset, setSelectedAsset] = useState<AssetRecord | null>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  useEffect(() => {
    if (!backendEnabled) return;
    fetch("/api/assets").then((response) => response.ok ? response.json() : Promise.reject()).then((payload: { data: ApiAsset[] }) => setRecords(payload.data.map(fromApiAsset))).catch(() => undefined);
  }, [backendEnabled]);
  const saveAsset = async (asset: AssetRecord) => {
    if (!backendEnabled) {
      setRecords((current) => current.some((item) => item.id === asset.id) ? current.map((item) => item.id === asset.id ? asset : item) : [asset, ...current]);
      return;
    }
    const editing = selectedAsset !== null;
    const response = await fetch(editing ? `/api/assets/${selectedAsset.id}` : "/api/assets", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName: asset.title, category: asset.category, pic: asset.pic, picInitials: asset.i, completedDate: `${asset.dateIso}T12:00:00+07:00`, description: asset.desc, assetLink: asset.link || null, docLink: asset.documentLink || null, tags: asset.tags }),
    });
    if (!response.ok) return;
    const payload = await response.json() as { data: ApiAsset };
    const saved = fromApiAsset(payload.data);
    setRecords((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
    setSelectedAsset(saved);
  };
  const deleteAsset = async (id: number) => {
    if (backendEnabled) {
      const response = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!response.ok) return;
    }
    setRecords((current) => current.filter((asset) => asset.id !== id));
    setSelectedAsset(null);
  };
  const categories = ["Semua kategori", ...Array.from(new Set(records.map((asset) => asset.category)))];
  const pics = ["Semua PIC", ...Array.from(new Set(records.map((asset) => asset.pic)))];
  const tags = ["Semua tag", ...Array.from(new Set(records.flatMap((asset) => asset.tags)))];
  const query = search.trim().toLowerCase();
  const filtered = records.filter((asset) => {
    const matchesSearch = `${asset.title} ${asset.category} ${asset.pic} ${asset.tags.join(" ")} ${asset.desc}`.toLowerCase().includes(query);
    const matchesCategory = category === "Semua kategori" || asset.category === category;
    const matchesPic = picFilter === "Semua PIC" || asset.pic === picFilter;
    const matchesTag = tagFilter === "Semua tag" || asset.tags.includes(tagFilter);
    return matchesSearch && matchesCategory && matchesPic && matchesTag;
  });
  return <div className="fade-up"><SectionHeading eyebrow="Archive" title="Asset & Library" description="Temukan kembali output, working document, dan pengetahuan dari project yang telah selesai." action={<Button onClick={() => { setSelectedAsset(null); setAssetOpen(true); }}><Plus size={17} /> Tambah aset</Button>} />
    <div className="mb-6 flex flex-col flex-wrap gap-3 sm:flex-row"><div className="relative min-w-56 max-w-md flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8f9699]" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Cari asset, tag, PIC..." /></div><label className="relative flex h-10 items-center rounded-md border border-[#d9d7cf] bg-white px-3 text-sm"><Filter size={15} className="mr-2 text-[#727b80]" /><select aria-label="Filter kategori aset" value={category} onChange={(event) => setCategory(event.target.value)} className="appearance-none bg-transparent pr-6 outline-none">{categories.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 text-[#727b80]" /></label><label className="relative flex h-10 items-center rounded-md border border-[#d9d7cf] bg-white px-3 text-sm"><Users size={15} className="mr-2 text-[#727b80]" /><select aria-label="Filter PIC aset" value={picFilter} onChange={(event) => setPicFilter(event.target.value)} className="appearance-none bg-transparent pr-6 outline-none">{pics.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 text-[#727b80]" /></label><label className="relative flex h-10 items-center rounded-md border border-[#d9d7cf] bg-white px-3 text-sm"><select aria-label="Filter tag aset" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="appearance-none bg-transparent pr-6 outline-none">{tags.map((option) => <option key={option}>{option === "Semua tag" ? option : `#${option}`}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 text-[#727b80]" /></label><div className="flex items-center gap-2 text-xs text-[#7d8589] sm:ml-auto"><Archive size={14} /> {filtered.length} arsip</div></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((asset, index) => <article key={asset.id} onClick={() => { setSelectedAsset(asset); setAssetOpen(true); }} className="group flex min-h-[260px] cursor-pointer flex-col border border-[#dfdcd3] bg-white p-5 transition hover:border-[#bfbab0] hover:shadow-[0_8px_24px_rgba(24,48,68,.07)]"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-md bg-[#edf1ee] text-[#4f826c]"><FileText size={19} /></span><span className="font-serif text-sm italic text-[#9ca1a3]">{String(index + 1).padStart(2, "0")}</span></div><div className="mt-5 text-[10px] font-bold uppercase tracking-[.15em] text-[#e76f36]">{asset.category}</div><h2 className="mt-2 font-serif text-xl font-semibold leading-snug group-hover:text-[#cf5d27]">{asset.title}</h2><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#6f787d]">{asset.desc}</p><div className="mt-3 flex flex-wrap gap-1.5">{asset.tags.map((tag) => <Badge key={tag} className="bg-[#f0eee8] font-medium text-[#697278]">#{tag}</Badge>)}</div><div className="mt-auto flex items-end justify-between border-t border-[#ece9e2] pt-4"><div className="flex items-center gap-2"><MiniAvatar initials={asset.i} /><div><div className="text-[11px] font-semibold">{asset.pic}</div><div className="text-[10px] text-[#959b9e]">{asset.date}</div></div></div><div className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); setSelectedAsset(asset); setAssetOpen(true); }}>Edit</Button><Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); const url = asset.link || asset.documentLink; if (url) window.open(url, "_blank", "noopener,noreferrer"); }} disabled={!asset.link && !asset.documentLink}>Open Asset <ExternalLink size={13} /></Button></div></div></article>)}</div>
    {filtered.length === 0 && <div className="grid min-h-64 place-items-center border border-dashed border-[#d8d4ca] bg-white px-6 text-center"><div><Archive className="mx-auto text-[#a3aaad]" size={30} /><h2 className="mt-4 font-serif text-xl font-semibold">Arsip tidak ditemukan</h2><p className="mt-2 text-sm text-[#747d81]">Coba kata kunci lain atau reset filter yang sedang aktif.</p><Button variant="outline" className="mt-4" onClick={() => { setSearch(""); setCategory("Semua kategori"); setPicFilter("Semua PIC"); setTagFilter("Semua tag"); }}>Reset pencarian & filter</Button></div></div>}
    <AssetDialog open={assetOpen} asset={selectedAsset} onOpenChange={setAssetOpen} onSave={(asset) => { void saveAsset(asset); }} onDelete={(id) => { void deleteAsset(id); }} />
  </div>;
}

function activityTimeLabel(date: Date, now = new Date()) {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (elapsedSeconds < 60) return "Baru saja";
  if (elapsedSeconds < 60 * 60) return `${Math.floor(elapsedSeconds / 60)} menit lalu`;
  if (elapsedSeconds < 24 * 60 * 60) return `${Math.floor(elapsedSeconds / 3600)} jam lalu`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const clock = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(":", ".");
  if (date.toDateString() === yesterday.toDateString()) return `Kemarin, ${clock}`;
  const calendarDate = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(date).replace(".", "");
  return `${calendarDate}, ${clock}`;
}

function ActivityHistory({ isAdmin }: { isAdmin: boolean }) {
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [logs, setLogs] = useState(isAdmin ? [
    { day: "Hari ini", time: "12 menit lalu", user: "Nadia Putri", i: "NP", action: "memindahkan project", target: "FGD Komunitas Urban", detail: "On Going → Delay", type: "status" },
    { day: "Hari ini", time: "48 menit lalu", user: "Dita Anjani", i: "DA", action: "menambahkan catatan revisi pada", target: "Laporan Tren Gen Z", detail: "Executive summary perlu dipadatkan", type: "note" },
    { day: "Hari ini", time: "3 jam lalu", user: "Arga Wibawa", i: "AW", action: "mengubah deadline", target: "Benchmark Industri Energi", detail: "08 Sep → 10 Sep", type: "date" },
    { day: "Kemarin", time: "Kemarin, 16.24", user: "Fikri Ramadhan", i: "FR", action: "menyelesaikan project", target: "Analisis Kompetitor Fintech", detail: "Dipindahkan ke Asset & Library", type: "done" },
    { day: "Kemarin", time: "Kemarin, 14.03", user: "Maya Kirana", i: "MK", action: "menambahkan agenda", target: "Town hall riset", detail: "31 Agu, 15.00", type: "date" },
    { day: "25 Agustus", time: "25 Agu, 10.15", user: "Nadia Putri", i: "NP", action: "mengubah PIC", target: "Riset Persepsi Publik Q3", detail: "Angga → Nadia", type: "user" },
  ] : [
    { day: "Hari ini", time: "20 menit lalu", user: "Nadia Putri", i: "NP", action: "menambahkan project", target: "Riset Persepsi Publik Q3", detail: "", type: "status" },
    { day: "Kemarin", time: "Kemarin, 16.24", user: "Fikri Ramadhan", i: "FR", action: "menyelesaikan project", target: "Analisis Kompetitor Fintech", detail: "", type: "done" },
    { day: "25 Agustus", time: "25 Agu, 10.15", user: "Dita Anjani", i: "DA", action: "mengirim project untuk revisi", target: "Laporan Tren Gen Z", detail: "", type: "note" },
  ]);
  useEffect(() => {
    fetch("/api/activity?limit=50")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { scope: "detailed" | "summary"; data: Array<{ actorName: string; actorInitials: string; action: string; details: string; projectTitle: string | null; createdAt: string }> }) => {
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        setLogs(payload.data.map((log) => {
          const date = new Date(log.createdAt);
          const day = date.toDateString() === today.toDateString() ? "Hari ini" : date.toDateString() === yesterday.toDateString() ? "Kemarin" : new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long" }).format(date);
          return {
            day,
            time: activityTimeLabel(date, today),
            user: log.actorName,
            i: log.actorInitials,
            action: log.action,
            target: log.projectTitle || log.details,
            detail: log.projectTitle ? log.details : "Aktivitas workspace",
            type: log.action.includes("agenda") || log.action.includes("deadline") ? "date" : log.action.includes("selesai") ? "done" : log.action.includes("catatan") ? "note" : "status",
          };
        }));
      })
      .catch(() => undefined);
  }, []);
  const iconFor = (type: string) => type === "date" ? CalendarDays : type === "done" ? Check : type === "user" ? Users : type === "note" ? FileText : Activity;
  const users = Array.from(new Set(logs.map((log) => log.user))).sort((a, b) => a.localeCompare(b, "id"));
  const projects = Array.from(new Set(logs.map((log) => log.target))).sort((a, b) => a.localeCompare(b, "id"));
  const query = search.trim().toLowerCase();
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = `${log.user} ${log.action} ${log.target} ${log.detail}`.toLowerCase().includes(query);
    const matchesUser = userFilter === "all" || log.user === userFilter;
    const matchesProject = projectFilter === "all" || log.target === projectFilter;
    return matchesSearch && matchesUser && matchesProject;
  });
  const hasFilters = !!query || userFilter !== "all" || projectFilter !== "all";
  const resetFilters = () => { setSearch(""); setUserFilter("all"); setProjectFilter("all"); };
  return <div className="fade-up"><SectionHeading eyebrow="History" title="Activity History" description={isAdmin ? "Detail perubahan project, agenda, aset, dan backup hanya terlihat oleh Admin." : "Ringkasan milestone project: project baru, selesai, atau masuk revisi."} />
    <div className="mb-6 flex flex-col gap-3 lg:flex-row"><div className="relative min-w-60 max-w-md flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8f9699]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Cari aktivitas atau project..." /></div><label className="relative flex h-10 min-w-48 items-center rounded-md border border-[#d9d7cf] bg-white px-3 text-sm"><Users size={15} className="mr-2 text-[#727b80]" /><select aria-label="Filter pengguna aktivitas" value={userFilter} onChange={(event) => setUserFilter(event.target.value)} className="w-full appearance-none bg-transparent pr-6 outline-none"><option value="all">Semua anggota</option>{users.map((user) => <option key={user} value={user}>{user}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 text-[#727b80]" /></label><label className="relative flex h-10 min-w-52 items-center rounded-md border border-[#d9d7cf] bg-white px-3 text-sm"><FolderOpen size={15} className="mr-2 text-[#727b80]" /><select aria-label="Filter project aktivitas" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="w-full appearance-none bg-transparent pr-6 outline-none"><option value="all">Semua project</option>{projects.map((project) => <option key={project} value={project}>{project}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 text-[#727b80]" /></label>{hasFilters && <Button variant="ghost" onClick={resetFilters}><X size={15} /> Reset</Button>}</div>
    <section className="bg-white px-5 py-2 md:px-7">{filteredLogs.map((log, i) => { const Icon = iconFor(log.type); const showDay = i === 0 || filteredLogs[i - 1].day !== log.day; return <div key={`${log.time}-${log.target}`}>{showDay && <div className="border-b border-[#e7e4dc] pb-2 pt-5 text-[10px] font-bold uppercase tracking-[.18em] text-[#8b9295]">{log.day}</div>}<div className={cn("grid grid-cols-[42px_1fr] gap-3 py-4 md:items-center", isAdmin ? "md:grid-cols-[90px_42px_1fr_auto]" : "md:grid-cols-[90px_42px_1fr]")}><div className="hidden text-xs text-[#8d9497] md:block">{log.time}</div><div className="relative"><MiniAvatar initials={log.i} className="h-9 w-9" /><span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[#f1efe9] ring-2 ring-white"><Icon size={9} /></span></div><div className="text-sm leading-6 text-[#5b666c]"><b className="text-[#183044]">{log.user}</b> {log.action} <b className="text-[#183044]">{log.target}</b><div className="text-xs text-[#92989b] md:hidden">{log.time}</div></div>{isAdmin && <Badge className="hidden bg-[#f2f0ea] font-medium text-[#677279] md:inline-flex">{log.detail || "Aktivitas workspace"}</Badge>}</div></div>; })}{filteredLogs.length === 0 && <div className="grid min-h-64 place-items-center text-center"><div><History size={30} className="mx-auto text-[#a3aaad]" /><h2 className="mt-4 font-serif text-xl font-semibold">Belum ada aktivitas kerja</h2><p className="mt-2 text-sm text-[#747d81]">{isAdmin ? "Perubahan project, agenda, aset, dan backup akan muncul di sini." : "Project baru, selesai, atau masuk revisi akan muncul di sini."}</p>{hasFilters && <Button variant="outline" className="mt-4" onClick={resetFilters}>Reset filter</Button>}</div></div>}</section>
  </div>;
}

type ProfileData = { name: string; email: string; username: string | null; role: string; image: string | null };
type ActiveSession = { id: string; token: string; createdAt: string | Date; updatedAt: string | Date; expiresAt: string | Date; ipAddress?: string | null; userAgent?: string | null };

function ProfilePage({ profile, backendEnabled, onSave, onLogout }: { profile: ProfileData; backendEnabled: boolean; onSave: (profile: ProfileData) => void | Promise<void>; onLogout: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadSessions = useCallback(async () => {
    if (!backendEnabled) return;
    setSessionsLoading(true);
    const result = await authClient.listSessions();
    if (!result.error && result.data) setActiveSessions(result.data as ActiveSession[]);
    setSessionsLoading(false);
  }, [backendEnabled]);
  useEffect(() => { void loadSessions(); }, [loadSessions]);
  useEffect(() => { if (!editing) setDraft(profile); }, [profile, editing]);
  const initials = profile.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const previewImage = editing ? draft.image : profile.image;
  const selectPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Gunakan foto berformat JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("Ukuran foto maksimal 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((current) => ({ ...current, image: String(reader.result) }));
      setEditing(true);
    };
    reader.onerror = () => setError("Foto tidak dapat dibaca. Silakan pilih file lain.");
    reader.readAsDataURL(file);
  };
  const save = async () => {
    if (!draft.name.trim() || !draft.email.trim() || !draft.username?.trim() || !draft.role.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ name: draft.name.trim(), email: draft.email.trim(), username: draft.username.trim().toLowerCase(), role: draft.role.trim(), image: draft.image });
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Perubahan profil belum tersimpan. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  };
  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordNotice("");
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password baru belum sama.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("Password baru harus berbeda dari password saat ini.");
      return;
    }
    setPasswordSaving(true);
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions });
      if (result.error) {
        if (result.error.code === "INVALID_PASSWORD") throw new Error("Password saat ini tidak sesuai.");
        if (result.error.code === "PASSWORD_TOO_SHORT") throw new Error("Password baru minimal 8 karakter.");
        throw new Error(result.error.message || "Password belum dapat diubah.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice(revokeOtherSessions ? "Password berhasil diubah. Sesi pada perangkat lain telah dicabut." : "Password berhasil diubah.");
    } catch (changeError) {
      setPasswordError(changeError instanceof Error ? changeError.message : "Password belum dapat diubah.");
    } finally {
      setPasswordSaving(false);
    }
  };
  const revokeSession = async (token: string) => {
    const result = await authClient.revokeSession({ token });
    if (result.error) { setPasswordError("Sesi belum dapat dicabut."); return; }
    setActiveSessions((current) => current.filter((item) => item.token !== token));
  };
  return <div className="fade-up"><SectionHeading eyebrow="Account" title="Profil anggota" description="Kelola identitas yang tampil pada kolaborasi dan riwayat aktivitas workspace." />
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside className="bg-[#193246] p-6 text-white"><Avatar className="h-20 w-20 ring-4 ring-white/10">{previewImage && <AvatarImage src={previewImage} alt={`Foto ${profile.name}`} className="object-cover" />}<AvatarFallback className="bg-[#e76f36] font-serif text-2xl text-white">{initials}</AvatarFallback></Avatar><h2 className="mt-5 font-serif text-2xl font-semibold">{profile.name}</h2><p className="mt-1 text-sm text-[#a9b7c0]">{profile.email}</p><Badge className="mt-4 bg-white/10 text-[#d9e1e6]">{profile.role}</Badge><div className="mt-8 border-t border-white/10 pt-5"><div className="flex items-center gap-2 text-xs text-[#a9b7c0]"><ShieldCheck size={15} className="text-[#e9a17d]" />Akun anggota workspace</div><button onClick={onLogout} className="mt-5 text-xs font-semibold text-[#e9a17d] hover:text-white">Keluar dari workspace</button></div></aside>
      <section className="bg-white p-6 md:p-8"><div className="flex items-start justify-between gap-4"><div><h2 className="font-serif text-2xl font-semibold">Informasi profil</h2><p className="mt-1 text-sm text-[#747d81]">Informasi ini terlihat oleh seluruh anggota tim.</p></div>{!editing && <Button variant="outline" onClick={() => setEditing(true)}><MoreHorizontal size={16} /> Edit profil</Button>}</div>
        <div className="mt-8 max-w-2xl space-y-5">
          <div className="border border-[#e3e0d8] bg-[#faf9f5] p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><Avatar className="h-16 w-16 shrink-0">{previewImage && <AvatarImage src={previewImage} alt="Preview foto profil" className="object-cover" />}<AvatarFallback className="bg-[#e76f36] font-serif text-xl text-white">{initials}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-[#183044]">Foto profil</div><p className="mt-1 text-xs leading-5 text-[#7b8387]">JPG, PNG, atau WebP. Ukuran maksimal 1 MB.</p><div className="mt-3 flex flex-wrap gap-2"><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} className="hidden" /><Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Camera size={15} />{previewImage ? "Ganti foto" : "Unggah foto"}</Button>{previewImage && <Button type="button" size="sm" variant="ghost" onClick={() => { setDraft((current) => ({ ...current, image: null })); setEditing(true); }}>Hapus foto</Button>}</div></div></div></div>
          {error && <div className="border-l-2 border-[#d8564e] bg-[#f9e8e5] px-3 py-2 text-xs text-[#a43d37]">{error}</div>}
          <label className="block text-xs font-bold text-[#59656c]">Nama lengkap<Input className="mt-2 font-normal" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} disabled={!editing} /></label><label className="block text-xs font-bold text-[#59656c]">Username<Input className="mt-2 font-normal" value={draft.username || ""} onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value.toLowerCase() }))} disabled={!editing} placeholder="contoh: angga.gideon" /></label><label className="block text-xs font-bold text-[#59656c]">Email<Input type="email" className="mt-2 font-normal" value={draft.email} disabled /></label><label className="block text-xs font-bold text-[#59656c]">Peran di tim<Input className="mt-2 font-normal" value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))} disabled={!editing} /></label>{editing && <div className="flex justify-end gap-2 pt-3"><Button variant="ghost" onClick={() => { setDraft(profile); setError(""); setEditing(false); }} disabled={saving}>Batal</Button><Button onClick={() => { void save(); }} disabled={saving || !draft.name.trim() || !draft.username?.trim() || !draft.role.trim()}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}{saving ? "Menyimpan..." : "Simpan profil"}</Button></div>}
        </div>
      </section>
    </div>
    <section className="mt-6 bg-white p-6 md:p-8">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f7efdc] text-[#996c17]"><KeyRound size={18} /></span><div><h2 className="font-serif text-2xl font-semibold">Keamanan akun</h2><p className="mt-1 text-sm leading-6 text-[#747d81]">Ubah password secara mandiri dengan memverifikasi password yang sedang digunakan.</p></div></div>
      {backendEnabled ? <form onSubmit={changePassword} className="mt-7 max-w-2xl space-y-5">
        <PasswordField label="Password saat ini" value={currentPassword} onChange={setCurrentPassword} placeholder="Masukkan password saat ini" autoComplete="current-password" />
        <div className="grid gap-5 sm:grid-cols-2"><PasswordField label="Password baru" value={newPassword} onChange={setNewPassword} placeholder="Minimal 8 karakter" autoComplete="new-password" /><PasswordField label="Konfirmasi password baru" value={confirmPassword} onChange={setConfirmPassword} placeholder="Ulangi password baru" autoComplete="new-password" /></div>
        <label className="flex cursor-pointer items-start gap-3 border border-[#e3e0d8] bg-[#faf9f5] p-4"><input type="checkbox" checked={revokeOtherSessions} onChange={(event) => setRevokeOtherSessions(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#e76f36]" /><span><span className="block text-sm font-semibold text-[#183044]">Keluar dari perangkat lain</span><span className="mt-1 block text-xs leading-5 text-[#7b8387]">Direkomendasikan agar sesi lama pada browser atau perangkat lain tidak tetap aktif.</span></span></label>
        {passwordError && <div role="alert" className="border-l-2 border-[#d8564e] bg-[#f9e8e5] px-4 py-3 text-xs text-[#a43d37]">{passwordError}</div>}
        {passwordNotice && <div role="status" aria-live="polite" className="border-l-2 border-[#4f826c] bg-[#e5efe9] px-4 py-3 text-xs font-semibold text-[#356450]"><span className="flex items-center gap-2"><Check size={15} />{passwordNotice}</span></div>}
        <div className="flex justify-end"><Button type="submit" disabled={passwordSaving || currentPassword.length < 8 || newPassword.length < 8 || confirmPassword.length < 8}>{passwordSaving ? <LoaderCircle size={16} className="animate-spin" /> : <KeyRound size={16} />}{passwordSaving ? "Mengubah password..." : "Ubah password"}</Button></div>
      </form> : <div className="mt-6 border-l-2 border-[#d29b32] bg-[#f7efdc] px-4 py-3 text-xs leading-5 text-[#77581e]">Fitur ubah password tersedia setelah masuk menggunakan akun workspace, bukan dalam mode demo.</div>}
      {backendEnabled && <div className="mt-9 border-t border-[#e5e2da] pt-6"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-[#183044]">Sesi aktif</h3><p className="mt-1 text-xs text-[#7b8387]">Cabut akses browser atau perangkat yang tidak dikenali.</p></div><Button size="sm" variant="outline" onClick={() => void loadSessions()} disabled={sessionsLoading}>{sessionsLoading ? <LoaderCircle size={14} className="animate-spin" /> : <History size={14} />}Muat ulang</Button></div><div className="mt-4 divide-y divide-[#ebe8df] border-y border-[#ebe8df]">{activeSessions.map((item) => <div key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"><ShieldCheck size={17} className="shrink-0 text-[#4f826c]" /><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-[#183044]">{item.userAgent || "Browser tidak dikenal"}</div><div className="mt-1 text-[10px] text-[#8a9194]">{item.ipAddress || "IP tidak tersedia"} · aktif {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.updatedAt))}</div></div><Button size="sm" variant="outline" className="border-[#e2b9b5] text-[#b9433d]" onClick={() => void revokeSession(item.token)}>Cabut sesi</Button></div>)}{!sessionsLoading && activeSessions.length === 0 && <div className="py-8 text-center text-xs text-[#8a9194]">Tidak ada sesi aktif lain.</div>}</div></div>}
    </section>
  </div>;
}

type AdminInvite = {
  id: number | string;
  email: string;
  createdAt: string | null;
  source: "database" | "environment";
  removable: boolean;
  registered: boolean;
  memberName: string | null;
};

type AdminPasswordReset = {
  id: number;
  userId: string;
  email: string;
  name: string;
  requestedAt: string;
};

type AdminBackup = {
  id: number;
  label: string;
  schemaVersion: number;
  summary: Record<string, number>;
  createdByName: string | null;
  createdAt: string;
  restoredAt: string | null;
};

function AdminMembersPage() {
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [passwordResets, setPasswordResets] = useState<AdminPasswordReset[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetLoading, setResetLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [selectedReset, setSelectedReset] = useState<AdminPasswordReset | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [backups, setBackups] = useState<AdminBackup[]>([]);
  const [backupLabel, setBackupLabel] = useState("");
  const [backupLoading, setBackupLoading] = useState(true);
  const [backupSaving, setBackupSaving] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<AdminBackup | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [restoreSaving, setRestoreSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/invites");
      const payload = await response.json() as { data?: AdminInvite[]; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Gagal memuat undangan");
      setInvites(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Daftar anggota belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPasswordResets = useCallback(async () => {
    setResetLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/password-resets");
      const payload = await response.json() as { data?: AdminPasswordReset[]; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Gagal memuat permintaan reset password");
      setPasswordResets(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Permintaan reset password belum dapat dimuat.");
    } finally {
      setResetLoading(false);
    }
  }, []);

  const loadBackups = useCallback(async () => {
    setBackupLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/backups", { cache: "no-store" });
      const payload = await response.json() as { data?: AdminBackup[]; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Gagal memuat backup");
      setBackups(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Daftar backup belum dapat dimuat.");
    } finally {
      setBackupLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.all([loadInvites(), loadPasswordResets(), loadBackups()]); }, [loadBackups, loadInvites, loadPasswordResets]);

  const addInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setError("Masukkan alamat email yang valid."); return; }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal menambahkan email");
      setEmail("");
      setNotice(`${normalizedEmail} sekarang boleh membuat akun.`);
      await loadInvites();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Email belum dapat ditambahkan.");
    } finally {
      setSaving(false);
    }
  };

  const revokeInvite = async (invite: AdminInvite) => {
    if (typeof invite.id !== "number") return;
    if (!window.confirm(`Nonaktifkan izin pendaftaran untuk ${invite.email}? Akun yang sudah aktif tidak akan dihapus.`)) return;
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/invites/${invite.id}`, { method: "DELETE" });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { setError(payload.error || "Undangan belum dapat dinonaktifkan."); return; }
    setNotice(`Izin pendaftaran ${invite.email} dinonaktifkan.`);
    setInvites((current) => current.filter((item) => item.id !== invite.id));
  };

  const generateTemporaryPassword = () => {
    const generated = `RR-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}!7`;
    setTemporaryPassword(generated);
  };

  const completePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedReset || temporaryPassword.length < 8) return;
    setResetSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/password-resets/${selectedReset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: temporaryPassword }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Password sementara belum dapat disimpan.");
      setNotice(`Password sementara untuk ${selectedReset.email} berhasil ditetapkan. Semua sesi lamanya sudah dicabut.`);
      setSelectedReset(null);
      setTemporaryPassword("");
      await loadPasswordResets();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Password sementara belum dapat disimpan.");
    } finally {
      setResetSaving(false);
    }
  };

  const createBackup = async (event: React.FormEvent) => {
    event.preventDefault();
    setBackupSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: backupLabel.trim() || undefined }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Backup belum dapat dibuat.");
      setBackupLabel("");
      setNotice("Backup data operasional berhasil dibuat dan siap diunduh.");
      await loadBackups();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Backup belum dapat dibuat.");
    } finally {
      setBackupSaving(false);
    }
  };

  const restoreBackup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBackup || restoreConfirmation !== "PULIHKAN") return;
    setRestoreSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/backups/${selectedBackup.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: restoreConfirmation }),
      });
      const payload = await response.json() as { data?: { safetyBackupId: number }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Pemulihan data gagal.");
      setSelectedBackup(null);
      setRestoreConfirmation("");
      setNotice(`Data berhasil dipulihkan. Safety backup #${payload.data.safetyBackupId} dibuat sebelum perubahan.`);
      await loadBackups();
      window.setTimeout(() => window.location.reload(), 1500);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Pemulihan data gagal tanpa mengubah data saat ini.");
    } finally {
      setRestoreSaving(false);
    }
  };

  return <div className="fade-up">
    <SectionHeading eyebrow="Administration" title="Anggota & undangan" description="Tentukan email yang boleh membuat akun dan pantau siapa yang sudah bergabung." />
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <section className="bg-[#193246] p-6 text-white">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white/10"><UserPlus size={20} className="text-[#e9a17d]" /></div>
        <h2 className="mt-5 font-serif text-2xl font-semibold">Undang anggota</h2>
        <p className="mt-2 text-sm leading-6 text-[#b6c3cb]">Tambahkan email sebelum anggota membuka formulir pendaftaran. Perubahan berlaku langsung tanpa redeploy.</p>
        <form onSubmit={addInvite} className="mt-6 space-y-3">
          <label className="block text-xs font-bold text-[#c6d0d6]">Email anggota<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 border-white/15 bg-white text-[#183044]" placeholder="nama@perusahaan.com" required /></label>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <MailPlus size={16} />}{saving ? "Menambahkan..." : "Izinkan pendaftaran"}</Button>
        </form>
        <p className="mt-4 text-[11px] leading-5 text-[#91a4b0]">Menonaktifkan undangan tidak menghapus akun anggota yang sudah terdaftar.</p>
      </section>
      <section className="bg-white p-6 md:p-8">
        <div className="flex items-start justify-between gap-4"><div><h2 className="font-serif text-2xl font-semibold">Daftar akses</h2><p className="mt-1 text-sm text-[#747d81]">{invites.length} email memiliki akses pendaftaran.</p></div><Button variant="outline" size="sm" onClick={() => void loadInvites()} disabled={loading}>Muat ulang</Button></div>
        {error && <div className="mt-5 border-l-2 border-[#d8564e] bg-[#f9e8e5] px-3 py-2 text-xs text-[#a43d37]">{error}</div>}
        {notice && <div className="mt-5 border-l-2 border-[#4f826c] bg-[#e5efe9] px-3 py-2 text-xs text-[#356450]">{notice}</div>}
        {loading ? <div className="grid min-h-52 place-items-center text-[#e76f36]"><LoaderCircle className="animate-spin" size={24} /></div> : <div className="mt-6 divide-y divide-[#ebe8df] border-y border-[#ebe8df]">
          {invites.map((invite) => <div key={invite.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eef1f2] text-[#53626b]"><Users size={16} /></div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#183044]">{invite.email}</div><div className="mt-1 text-[11px] text-[#879095]">{invite.registered ? `${invite.memberName || "Anggota"} · Akun aktif` : "Menunggu pendaftaran"}{invite.source === "environment" ? " · Admin awal" : ""}</div></div>
            <Badge className={invite.registered ? "bg-[#e5efe9] text-[#3f6f5b]" : "bg-[#f7efdc] text-[#996c17]"}>{invite.registered ? "Terdaftar" : "Diundang"}</Badge>
            {invite.removable && <Button type="button" variant="ghost" size="sm" onClick={() => void revokeInvite(invite)}><Trash2 size={14} /> Nonaktifkan</Button>}
          </div>)}
          {invites.length === 0 && <div className="py-12 text-center text-sm text-[#7b8387]">Belum ada email yang diizinkan.</div>}
        </div>}
      </section>
    </div>
    <AnnouncementManager />
    <section className="mt-6 bg-white p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#e76f36]"><KeyRound size={14} /> Pemulihan akun</div><h2 className="mt-2 font-serif text-2xl font-semibold">Permintaan reset password</h2><p className="mt-1 text-sm text-[#747d81]">Tetapkan password sementara, lalu sampaikan langsung kepada anggota melalui kanal internal yang aman.</p></div><Button variant="outline" size="sm" onClick={() => void loadPasswordResets()} disabled={resetLoading}>Muat ulang</Button></div>
      <div className="mt-6 divide-y divide-[#ebe8df] border-y border-[#ebe8df]">
        {resetLoading ? <div className="grid min-h-40 place-items-center text-[#e76f36]"><LoaderCircle className="animate-spin" size={24} /></div> : passwordResets.map((recovery) => <div key={recovery.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f7efdc] text-[#996c17]"><KeyRound size={16} /></div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#183044]">{recovery.name}</div><div className="mt-1 text-[11px] text-[#879095]">{recovery.email} · {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(recovery.requestedAt))}</div></div>
          <Badge className="bg-[#f7efdc] text-[#996c17]">Menunggu admin</Badge>
          <Button size="sm" onClick={() => { setSelectedReset(recovery); setTemporaryPassword(""); setError(""); }}><KeyRound size={14} /> Tetapkan password</Button>
        </div>)}
        {!resetLoading && passwordResets.length === 0 && <div className="py-12 text-center text-sm text-[#7b8387]">Tidak ada permintaan reset password yang menunggu.</div>}
      </div>
    </section>
    <section className="mt-6 bg-white p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#e76f36]"><Archive size={14} /> Perlindungan data</div><h2 className="mt-2 font-serif text-2xl font-semibold">Backup & pemulihan</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#747d81]">Snapshot mencakup project, anggota project, komentar, approval, agenda, aset, dan Activity History. Password, akun login, serta sesi tidak pernah dimasukkan.</p></div><Button variant="outline" size="sm" onClick={() => void loadBackups()} disabled={backupLoading}>{backupLoading ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}Muat ulang</Button></div>
      <form onSubmit={createBackup} className="mt-6 flex flex-col gap-3 border border-[#e5e2da] bg-[#faf9f5] p-4 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-xs font-bold text-[#59656c]">Nama backup (opsional)<Input value={backupLabel} onChange={(event) => setBackupLabel(event.target.value)} className="mt-2 bg-white font-normal" maxLength={120} placeholder="Contoh: Sebelum perubahan struktur project" /></label><Button type="submit" disabled={backupSaving}>{backupSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Archive size={16} />}{backupSaving ? "Membuat backup..." : "Buat backup sekarang"}</Button></form>
      <div className="mt-6 divide-y divide-[#ebe8df] border-y border-[#ebe8df]">
        {backupLoading ? <div className="grid min-h-40 place-items-center text-[#e76f36]"><LoaderCircle className="animate-spin" size={24} /></div> : backups.map((backup) => <div key={backup.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eef1f2] text-[#53626b]"><Archive size={16} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#183044]">{backup.label}</div><div className="mt-1 text-[11px] leading-5 text-[#879095]">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(backup.createdAt))} · {backup.createdByName || "Admin sebelumnya"} · {backup.summary.projects ?? 0} project · {backup.summary.comments ?? 0} komentar · {backup.summary.assets ?? 0} aset{backup.restoredAt ? " · Pernah dipulihkan" : ""}</div></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><a href={`/api/admin/backups/${backup.id}`} download><Download size={14} /> Unduh JSON</a></Button><Button type="button" variant="outline" size="sm" className="border-[#e2b9b5] text-[#b9433d]" onClick={() => { setSelectedBackup(backup); setRestoreConfirmation(""); setError(""); }}><RotateCcw size={14} /> Pulihkan</Button></div></div>)}
        {!backupLoading && backups.length === 0 && <div className="py-12 text-center text-sm text-[#7b8387]">Belum ada backup. Buat snapshot pertama sebelum perubahan besar.</div>}
      </div>
    </section>
    <Dialog open={Boolean(selectedBackup)} onOpenChange={(open) => { if (!open && !restoreSaving) { setSelectedBackup(null); setRestoreConfirmation(""); } }}>
      <DialogContent><DialogHeader><div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#f9e8e5] text-[#b9433d]"><RotateCcw size={20} /></div><DialogTitle>Pulihkan backup ini?</DialogTitle><DialogDescription>{selectedBackup ? `Seluruh data operasional akan dikembalikan ke snapshot “${selectedBackup.label}”.` : ""} Sistem otomatis membuat safety backup dari kondisi saat ini sebelum pemulihan.</DialogDescription></DialogHeader><form onSubmit={restoreBackup} className="mt-2 space-y-4"><label className="block text-xs font-bold text-[#59656c]">Ketik PULIHKAN untuk melanjutkan<Input value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value.toUpperCase())} className="mt-2 font-normal" autoComplete="off" /></label><div className="border-l-2 border-[#d8564e] bg-[#f9e8e5] px-4 py-3 text-xs leading-5 text-[#8f3833]">Pengguna lain sebaiknya tidak mengubah project selama proses pemulihan berlangsung.</div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => { setSelectedBackup(null); setRestoreConfirmation(""); }} disabled={restoreSaving}>Batal</Button><Button type="submit" className="bg-[#c84942] hover:bg-[#ae3d37]" disabled={restoreSaving || restoreConfirmation !== "PULIHKAN"}>{restoreSaving ? <LoaderCircle size={16} className="animate-spin" /> : <RotateCcw size={16} />}{restoreSaving ? "Memulihkan..." : "Pulihkan data"}</Button></div></form></DialogContent>
    </Dialog>
    <Dialog open={Boolean(selectedReset)} onOpenChange={(open) => { if (!open && !resetSaving) { setSelectedReset(null); setTemporaryPassword(""); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Tetapkan password sementara</DialogTitle><DialogDescription>{selectedReset ? `Untuk ${selectedReset.name} (${selectedReset.email}).` : ""} Setelah disimpan, seluruh sesi lama anggota akan dicabut.</DialogDescription></DialogHeader>
        <form onSubmit={completePasswordReset} className="mt-2 space-y-4">
          <PasswordField label="Password sementara" value={temporaryPassword} onChange={setTemporaryPassword} placeholder="Minimal 8 karakter" autoComplete="new-password" action={<button type="button" onClick={generateTemporaryPassword} className="font-semibold text-[#e76f36] hover:underline">Buat otomatis</button>} />
          <div className="rounded-md bg-[#f7efdc] p-3 text-xs leading-5 text-[#77581e]">Salin password sebelum menyimpan, lalu kirimkan secara pribadi. Sistem tidak akan menampilkan password ini lagi.</div>
          {temporaryPassword && <Button type="button" variant="outline" className="w-full" onClick={() => void navigator.clipboard.writeText(temporaryPassword)}><Copy size={15} /> Salin password</Button>}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => { setSelectedReset(null); setTemporaryPassword(""); }} disabled={resetSaving}>Batal</Button><Button type="submit" disabled={resetSaving || temporaryPassword.length < 8}>{resetSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}{resetSaving ? "Menyimpan..." : "Simpan & cabut sesi"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}

function PasswordField({ label, value, onChange, placeholder, autoComplete, action }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; autoComplete: string; action?: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return <label className="block text-xs font-bold text-[#59656c]"><span className="flex items-center justify-between gap-3"><span>{label}</span>{action}</span><span className="relative mt-2 block"><Input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} className="pr-11" placeholder={placeholder} autoComplete={autoComplete} minLength={8} required /><button type="button" onClick={() => setVisible((current) => !current)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-[#7c8589] hover:text-[#183044]" aria-label={visible ? "Sembunyikan password" : "Lihat password"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>;
}

type AuthMode = "login" | "register" | "forgot";

function AuthScreen({ onEnterDemo, demoEnabled }: { onEnterDemo: () => void; demoEnabled: boolean }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
    setPassword("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const identifier = email.trim().toLowerCase();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const normalizedUsername = username.trim().toLowerCase();
    if (mode !== "login" && !emailValid) { setError("Masukkan alamat email yang valid."); return; }
    if (mode === "login" && !emailValid && !/^[a-z0-9._]{3,30}$/.test(identifier)) { setError("Masukkan email atau username yang valid."); return; }
    if (mode !== "forgot" && password.length < 8) { setError("Password harus terdiri dari minimal 8 karakter."); return; }
    if (mode === "register" && name.trim().length < 2) { setError("Nama lengkap harus terdiri dari minimal 2 karakter."); return; }
    if (mode === "register" && !/^[a-z0-9._]{3,30}$/.test(normalizedUsername)) { setError("Username harus 3–30 karakter dan hanya memakai huruf, angka, titik, atau underscore."); return; }
    setLoading(true);
    try {
      if (mode === "forgot") {
        const response = await fetch("/api/password-recovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: identifier }),
        });
        const result = await response.json() as { message?: string; error?: string };
        if (!response.ok) throw new Error(result.error || "Permintaan belum dapat dikirim.");
        setNotice(result.message || "Permintaan berhasil dikirim. Jika email terdaftar, admin akan menerima permintaan Anda.");
        return;
      }
      if (mode === "login") {
        const result = emailValid
          ? await authClient.signIn.email({ email: identifier, password, rememberMe: false })
          : await authClient.signIn.username({ username: identifier, password });
        if (result.error) throw new Error("Email/username atau password tidak sesuai.");
      } else {
        const registration = await authClient.signUp.email({ email: identifier, password, name: name.trim(), username: normalizedUsername });
        if (registration.error) throw new Error(registration.error.message || "Pendaftaran gagal. Periksa data Anda.");
        await authClient.signOut();
        const browserSession = await authClient.signIn.email({ email: identifier, password, rememberMe: false });
        if (browserSession.error) throw new Error(browserSession.error.message || "Akun berhasil dibuat, tetapi sesi belum dapat dimulai.");
      }
      window.localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, String(Date.now()));
      window.localStorage.removeItem(AUTH_TABS_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_LAST_TAB_CLOSED_KEY);
      window.location.reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Permintaan belum dapat diproses.");
    } finally {
      setLoading(false);
    }
  };

  const headings: Record<AuthMode, { title: string; description: string }> = {
    login: { title: "Selamat datang kembali.", description: "Masuk menggunakan email atau username untuk melanjutkan pekerjaan tim riset." },
    register: { title: "Buat akun anggota.", description: "Gunakan email yang sudah diizinkan admin, username unik, dan password minimal 8 karakter." },
    forgot: { title: "Lupa password?", description: "Masukkan email akun Anda. Admin akan menerima permintaan dan memberikan password sementara secara manual." },
  };

  return (
    <main className="grid min-h-screen bg-[#f5f3ed] lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#193246] p-14 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 grid-paper opacity-[.035]" />
        <div className="relative flex items-center gap-4"><BrandMark className="h-14 w-14" /><div><div className="font-serif text-2xl font-semibold">360 - Center of Research</div><div className="mt-1 text-[10px] uppercase tracking-[.2em] text-[#9eb0bc]">Project Workspace</div></div></div>
        <div className="relative my-auto max-w-xl"><div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-[#e9a17d]"><span className="h-px w-8 bg-[#e9a17d]" />Track · Schedule · Complete · Archive</div><h1 className="font-serif text-5xl font-semibold leading-[1.08] tracking-[-.03em]">Satu ruang untuk setiap proses riset yang berarti.</h1><p className="mt-6 max-w-lg text-base leading-7 text-[#b6c3cb]">Jaga project, agenda, aset, dan keputusan tim tetap tersambung—dari brief pertama hingga laporan final.</p></div>
        <div className="relative flex items-center gap-3 text-xs text-[#8499a7]"><ShieldCheck size={16} className="text-[#e9a17d]" />Sesi berakhir setelah tab 360 terakhir ditutup atau tidak dibuka selama 10 menit</div>
      </section>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><BrandMark className="h-11 w-11" /><span className="font-serif text-lg font-semibold">360 - Center of Research</span></div>
          <div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#e76f36]">Workspace tim</div>
          <h2 className="mt-3 font-serif text-4xl font-semibold tracking-[-.025em]">{headings[mode].title}</h2>
          <p className="mt-3 text-sm leading-6 text-[#6d767a]">{headings[mode].description}</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "register" && <label className="block text-xs font-bold text-[#59656c]">Nama lengkap<Input value={name} onChange={(event) => setName(event.target.value)} className="mt-2" placeholder="Nama anggota tim" autoComplete="name" required /></label>}
            <label className="block text-xs font-bold text-[#59656c]">{mode === "login" ? "Email atau username" : "Email"}<Input type={mode === "login" ? "text" : "email"} value={email} onChange={(event) => { const value = event.target.value; setEmail(value); if (mode === "register" && !username) setUsername(value.split("@")[0].toLowerCase().replace(/[^a-z0-9._]/g, ".").slice(0, 30)); }} className="mt-2" placeholder={mode === "login" ? "email atau username" : "nama@perusahaan.com"} autoComplete={mode === "login" ? "username" : "email"} required /></label>
            {mode === "register" && <label className="block text-xs font-bold text-[#59656c]">Username<Input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} className="mt-2" placeholder="contoh: angga.gideon" autoComplete="username" minLength={3} maxLength={30} required /><span className="mt-1.5 block text-[10px] font-normal leading-4 text-[#8a9194]">Dipakai untuk login dan @mention. Huruf kecil, angka, titik, atau underscore.</span></label>}
            {(mode === "login" || mode === "register") && <PasswordField label="Password" value={password} onChange={setPassword} placeholder="Minimal 8 karakter" autoComplete={mode === "login" ? "current-password" : "new-password"} action={mode === "login" ? <button type="button" onClick={() => switchMode("forgot")} className="font-semibold text-[#e76f36] hover:underline">Lupa password?</button> : undefined} />}
            {error && <div className="border-l-2 border-[#d8564e] bg-[#f9e8e5] px-3 py-2 text-xs text-[#a43d37]">{error}</div>}
            {notice && <div role="status" aria-live="polite" data-testid="password-recovery-success" className="border-l-2 border-[#4f826c] bg-[#e5efe9] px-4 py-3 text-xs text-[#356450]"><div className="flex items-center gap-2 font-bold"><Check size={16} />Permintaan berhasil dikirim</div><p className="mt-1.5 leading-5">{notice}</p></div>}
            <Button type="submit" className="mt-2 w-full" disabled={loading}>{loading ? <LoaderCircle size={17} className="animate-spin" /> : mode === "forgot" ? <MailPlus size={17} /> : <LogIn size={17} />}{loading ? "Memproses..." : mode === "login" ? "Masuk ke workspace" : mode === "register" ? "Daftar dan masuk" : "Kirim permintaan ke admin"}</Button>
          </form>
          {mode === "login" && demoEnabled && <><div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#9a9fa2]"><span className="h-px flex-1 bg-[#dedbd3]" />atau<span className="h-px flex-1 bg-[#dedbd3]" /></div><Button type="button" variant="outline" className="w-full" onClick={onEnterDemo}><LayoutDashboard size={17} /> Masuk mode demo</Button><p className="mt-2 text-center text-[11px] leading-5 text-[#8a9194]">Gunakan data mock untuk mengecek Dashboard dan Kanban tanpa backend.</p></>}
          {(mode === "login" || mode === "register") ? <div className="mt-6 border-t border-[#dedbd3] pt-5 text-center text-xs text-[#717a7e]">{mode === "login" ? "Belum memiliki akun?" : "Sudah memiliki akun?"} <button onClick={() => switchMode(mode === "login" ? "register" : "login")} className="font-bold text-[#e76f36] hover:underline">{mode === "login" ? "Daftar sekarang" : "Masuk di sini"}</button></div> : <div className="mt-6 border-t border-[#dedbd3] pt-5 text-center text-xs"><button onClick={() => switchMode("login")} className="font-bold text-[#e76f36] hover:underline">Kembali ke halaman masuk</button></div>}
          <div className="mt-8 text-center text-[10px] leading-5 text-[#92989b]">© 2026 360 – Center of Research<br />Made by Angga Santa Gideon</div>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const { data: session, isPending } = authClient.useSession();
  const [demoMode, setDemoMode] = useState(false);
  const [demoReady, setDemoReady] = useState(false);
  const [active, setActive] = useState<View>("dashboard");
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<ProfileData>({ name: "Angga Demo", email: "angga.demo@ruangriset.id", username: "angga.demo", role: "Research Lead", image: null });
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const idleLogoutStarted = useRef(false);

  useEffect(() => {
    const storedDemoMode = window.sessionStorage.getItem("ruang-riset-demo") === "true";
    setDemoMode(storedDemoMode);
    if (storedDemoMode) setProjects(initialProjects);
    setDemoReady(true);
  }, []);

  useEffect(() => {
    if (session?.user) setProfile((current) => ({ ...current, name: session.user.name, email: session.user.email, image: session.user.image ?? null }));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/profile")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load profile")))
      .then((payload: { data: { name: string; email: string; username: string | null; image: string | null; isAdmin: boolean } }) => {
        if (!cancelled) {
          setProfile((current) => ({ ...current, name: payload.data.name, email: payload.data.email, username: payload.data.username, image: payload.data.image, role: payload.data.isAdmin ? "Administrator" : current.role }));
          setIsAdmin(payload.data.isAdmin);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/projects")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load projects")))
      .then((payload: { data: ApiProject[] }) => { if (!cancelled) setProjects(payload.data.map(fromApiProject)); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [session]);

  const logoutAfterIdle = useCallback(() => {
    if (idleLogoutStarted.current) return;
    idleLogoutStarted.current = true;
    try {
      window.localStorage.removeItem(AUTH_ACTIVITY_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_TABS_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_LAST_TAB_CLOSED_KEY);
    } catch {
      // Continue signing out when storage is unavailable.
    }
    if (session) {
      void authClient.signOut().finally(() => window.location.reload());
      return;
    }
    window.sessionStorage.removeItem("ruang-riset-demo");
    window.location.reload();
  }, [session]);

  useIdleLogout(Boolean(session) || demoMode, logoutAfterIdle);

  useEffect(() => {
    if (!session && !demoMode) idleLogoutStarted.current = false;
  }, [session, demoMode]);

  if (isPending || !demoReady) return <div className="grid min-h-screen place-items-center bg-[#f5f3ed] text-[#e76f36]"><LoaderCircle className="animate-spin" size={28} /></div>;
  if (!session && !demoMode) return <AuthScreen demoEnabled={process.env.NEXT_PUBLIC_ENABLE_DEMO !== "false"} onEnterDemo={() => { window.sessionStorage.setItem("ruang-riset-demo", "true"); window.localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, String(Date.now())); window.localStorage.removeItem(AUTH_LAST_TAB_CLOSED_KEY); setProjects(initialProjects); setDemoMode(true); }} />;

  const logout = () => {
    try {
      window.localStorage.removeItem(AUTH_ACTIVITY_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_TABS_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_LAST_TAB_CLOSED_KEY);
    } catch {
      // Continue signing out when storage is unavailable.
    }
    if (!session) {
      window.sessionStorage.removeItem("ruang-riset-demo");
      setProjects([]);
      setDemoMode(false);
      setActive("dashboard");
      return;
    }
    void authClient.signOut().then(() => window.location.reload());
  };
  const saveProfile = async (nextProfile: ProfileData) => {
    if (!session) {
      setProfile(nextProfile);
      return;
    }
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextProfile.name, username: nextProfile.username, image: nextProfile.image }),
    });
    const payload = await response.json() as { data?: { name: string; email: string; username: string | null; image: string | null }; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error || "Perubahan profil belum tersimpan.");
    setProfile({ ...nextProfile, name: payload.data.name, email: payload.data.email, username: payload.data.username, image: payload.data.image });
  };

  let page: React.ReactNode;
  if (active === "dashboard") page = <Dashboard projects={projects} goTo={setActive} backendEnabled={!!session} />;
  else if (active === "tracker") page = <ProjectTracker projects={projects} setProjects={setProjects} backendEnabled={!!session} profile={profile} isAdmin={isAdmin} />;
  else if (active === "calendar") page = <CalendarPlanner projects={projects} backendEnabled={!!session} />;
  else if (active === "library") page = <AssetLibrary backendEnabled={!!session} />;
  else if (active === "activity") page = <ActivityHistory isAdmin={isAdmin} />;
  else if (active === "admin" && isAdmin) page = <AdminMembersPage />;
  else page = <ProfilePage profile={profile} backendEnabled={!!session} onSave={saveProfile} onLogout={logout} />;

  return (
    <div className="min-h-screen bg-[#f5f3ed]">
      <Sidebar active={active} onChange={setActive} open={menuOpen} onClose={() => setMenuOpen(false)} profile={profile} projectCount={projects.length} isAdmin={isAdmin} backendEnabled={!!session} onProfile={() => { setActive("profile"); setMenuOpen(false); }} onLogout={logout} />
      <div className="lg:pl-[252px]">
        <Header active={active} onMenu={() => setMenuOpen(true)} profile={profile} onProfile={() => setActive("profile")} onNavigate={setActive} backendEnabled={!!session} />
        <main className="mx-auto max-w-[1600px] px-5 py-7 md:px-8 md:py-9">{page}</main>
        <footer className="mx-5 flex flex-col gap-2 border-t border-[#ddd9d0] py-5 text-[10px] tracking-[.08em] text-[#989d9f] sm:flex-row sm:items-center sm:justify-between md:mx-8"><span>© 2026 360 – Center of Research · Made by Angga Santa Gideon</span><span className="flex items-center gap-1.5 uppercase tracking-[.14em]"><Sparkles size={11} /> v{APP_VERSION} · Keep curiosity alive</span></footer>
      </div>
    </div>
  );
}
