"use client";

import { useEffect, useMemo, useState } from "react";
import {
  App as AntApp,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  ConfigProvider,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Input,
  Layout,
  Menu,
  Progress,
  Row,
  Segmented,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { MenuProps, TableColumnsType } from "antd";
import {
  AreaChartOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  BellOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExclamationCircleFilled,
  FileTextOutlined,
  FireFilled,
  GlobalOutlined,
  LinkOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  MoreOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  RiseOutlined,
  SaveOutlined,
  SendOutlined,
  SettingOutlined,
  ThunderboltFilled,
  UserOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;

type Platform = "Instagram" | "TikTok" | "YouTube";
type ContentType = "Reels" | "Carousel" | "Foto" | "Video" | "Shorts";

type ContentRow = {
  key: string;
  title: string;
  caption: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  type: ContentType;
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  engagement: number;
  tone: string;
  isBest?: boolean;
};

type ApiContent = {
  id: string;
  contentType: "photo" | "carousel" | "reels" | "tiktok_video" | "youtube_video" | "shorts";
  title: string;
  caption?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  engagementRate: number;
  isBest: boolean;
};

type AnalysisSnapshot = {
  account: {
    platform: "instagram" | "tiktok" | "youtube";
    username: string;
    profileUrl?: string;
    followersCount: number;
    totalInteractions: number;
  };
  summary: {
    erAverage: number;
    erMedian: number;
    erWeighted: number;
  };
  contents: ApiContent[];
  dataAvailability: {
    shares: "available" | "partial";
    message: string | null;
  };
  source?: {
    mode: "official" | "public" | "partial" | "mock";
    status: "ready" | "partial" | "preview";
    message: string | null;
  };
};

const contentRows: ContentRow[] = [
  { key: "1", title: "3 cara membangun komunitas yang engaged", caption: "Tiga langkah praktis untuk membangun komunitas yang aktif dan merasa dilibatkan.", url: "https://instagram.com/akirastudio", thumbnailUrl: null, type: "Reels", date: "Hari ini, 09:12", views: 182400, likes: 12480, comments: 684, shares: 2140, engagement: 8.41, tone: "#e9ddff" },
  { key: "2", title: "Behind the scene campaign musim ini", caption: "Cerita di balik proses produksi campaign dan momen yang jarang terlihat.", url: "https://instagram.com/akirastudio", thumbnailUrl: null, type: "Carousel", date: "2 hari lalu", views: 96700, likes: 6140, comments: 318, shares: 980, engagement: 7.68, tone: "#d8efff" },
  { key: "3", title: "Meet the team: cerita di balik brand", caption: "Kenalan dengan orang-orang di balik ide, strategi, dan eksekusi brand.", url: "https://instagram.com/akirastudio", thumbnailUrl: null, type: "Foto", date: "4 hari lalu", views: 48300, likes: 2810, comments: 176, shares: null, engagement: 6.18, tone: "#ffe6d6" },
  { key: "4", title: "Apa yang berubah di industri kreatif?", caption: "Rangkuman perubahan terbaru di industri kreatif dan dampaknya untuk creator.", url: "https://instagram.com/akirastudio", thumbnailUrl: null, type: "Reels", date: "6 hari lalu", views: 134500, likes: 7620, comments: 420, shares: 1320, engagement: 6.96, tone: "#dff4e8" },
  { key: "5", title: "Q&A: strategi konten untuk pemula", caption: "Jawaban singkat untuk pertanyaan yang paling sering muncul dari creator pemula.", url: "https://instagram.com/akirastudio", thumbnailUrl: null, type: "Video", date: "8 hari lalu", views: 72100, likes: 3490, comments: 206, shares: 410, engagement: 5.69, tone: "#fff0bf" },
];

const contentTypeStats = [
  { label: "Reels", count: 8, engagement: 6.82, color: "#635bff" },
  { label: "Carousel", count: 5, engagement: 5.74, color: "#1da1f2" },
  { label: "Foto", count: 4, engagement: 4.12, color: "#f59e0b" },
  { label: "Video", count: 3, engagement: 3.86, color: "#10b981" },
];

type AnalysisHistoryItem = {
  id: string;
  username: string;
  profileUrl: string;
  platform: Platform;
  analyzedAt: string;
  contentCount: number;
  erAverage: number;
  erMedian: number;
  erWeighted: number;
  followersCount: number;
  followersChange: number;
};

type HistorySource = "database" | "mock";

type HistoryApiItem = {
  id: string;
  profile: {
    platform: "instagram" | "tiktok" | "youtube";
    username: string;
    profileUrl: string;
  };
  followersCount: number;
  followersChangePercent: number;
  contentCount: number;
  summary: {
    erAverage: number;
    erMedian: number;
    erWeighted: number;
  };
  analyzedAt: string;
};

type PublicDataSource = {
  platform: Platform;
  sourceName: string;
  status: string;
  capabilities: string[];
  unavailableLabel: string;
  limitation: string;
};

const publicDataSources: PublicDataSource[] = [
  { platform: "Instagram", sourceName: "Halaman profil publik", status: "Crawl publik aktif", capabilities: ["Profil publik", "Konten terbaru", "Likes", "Comments"], unavailableLabel: "Shares parsial", limitation: "Sebagian halaman Instagram tidak membuka shares atau metadata lengkap untuk crawler publik." },
  { platform: "TikTok", sourceName: "Halaman profil publik", status: "Crawl publik aktif", capabilities: ["Profil publik", "Video terbaru", "Views", "Likes"], unavailableLabel: "Metrik parsial", limitation: "TikTok dapat menyajikan HTML tanpa URL video atau angka metrik pada beberapa profil." },
  { platform: "YouTube", sourceName: "Halaman channel publik", status: "Crawl publik aktif", capabilities: ["Channel publik", "Video terbaru", "Views", "Likes"], unavailableLabel: "Metrik parsial", limitation: "Comments dan shares mengikuti metadata yang terlihat pada halaman publik video." },
];

type SmartInsightSummaryItem = {
  icon: React.ReactNode;
  title: string;
  description: string;
  metric: string;
  label: string;
};

type SmartContentRecommendation = {
  icon: React.ReactNode;
  title: string;
  description: string;
  priority: string;
  signal: string;
};

type SmartInsightData = {
  summary: SmartInsightSummaryItem[];
  recommendations: SmartContentRecommendation[];
  provider: "vikey" | "deterministic" | "mock";
};

type InsightChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: "vikey" | "deterministic";
};

const smartInsightSummary: SmartInsightSummaryItem[] = [
  { icon: <FireFilled />, title: "Reels jadi format terkuat", description: "Format ini mencatat ER rata-rata paling tinggi pada analisis terakhir.", metric: "6.82% ER", label: "ER rata-rata" },
  { icon: <ArrowUpOutlined />, title: "Engagement sedang bertumbuh", description: "Interaksi meningkat dibandingkan periode analisis sebelumnya.", metric: "+12.4%", label: "perubahan interaksi" },
  { icon: <ClockCircleOutlined />, title: "Waktu unggah potensial", description: "Aktivitas audiens paling menjanjikan terlihat pada sore hingga malam.", metric: "18.00–21.00", label: "waktu rekomendasi" },
];

const smartContentRecommendations: SmartContentRecommendation[] = [
  { icon: <FireFilled />, title: "Pertahankan porsi Reels", description: "Jadikan Reels sebagai format utama untuk menjangkau audiens baru.", priority: "Prioritas tinggi", signal: "ER 6.82%" },
  { icon: <BarChartOutlined />, title: "Uji carousel edukatif", description: "Kembangkan topik dari konten dengan komentar dan shares yang konsisten.", priority: "Eksperimen", signal: "5 konten" },
  { icon: <ClockCircleOutlined />, title: "Jadwalkan sore hari", description: "Uji jadwal publikasi antara pukul 18.00–21.00 pada analisis berikutnya.", priority: "Uji berikutnya", signal: "18.00–21.00" },
];

const mockSmartInsightData: SmartInsightData = {
  summary: smartInsightSummary,
  recommendations: smartContentRecommendations,
  provider: "mock",
};

function readInsightText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseInsightData(payload: unknown): SmartInsightData | null {
  if (!payload || typeof payload !== "object" || !("data" in payload) || !payload.data || typeof payload.data !== "object") return null;
  const data = payload.data as { summary?: unknown; recommendations?: unknown; source?: unknown };
  if (!Array.isArray(data.summary) || !Array.isArray(data.recommendations)) return null;

  const summary = data.summary.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const title = readInsightText(value.title);
    const description = readInsightText(value.description);
    const metric = readInsightText(value.metric);
    const label = readInsightText(value.label);
    if (!title || !description || !metric || !label) return [];
    const icons = [<FireFilled />, <ArrowUpOutlined />, <ClockCircleOutlined />];
    return [{ icon: icons[index % icons.length], title, description, metric, label }];
  });
  const recommendations = data.recommendations.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const title = readInsightText(value.title);
    const description = readInsightText(value.description);
    const priority = readInsightText(value.priority);
    const signal = readInsightText(value.signal);
    if (!title || !description || !priority || !signal) return [];
    const icons = [<FireFilled />, <BarChartOutlined />, <ClockCircleOutlined />];
    return [{ icon: icons[index % icons.length], title, description, priority, signal }];
  });

  const source = data.source;
  const provider = source && typeof source === "object" && "provider" in source && source.provider === "vikey" ? "vikey" : "deterministic";
  return summary.length > 0 && recommendations.length > 0 ? { summary, recommendations, provider } : null;
}

const analysisHistory: AnalysisHistoryItem[] = [
  { id: "history-1", username: "akirastudio", profileUrl: "https://instagram.com/akirastudio", platform: "Instagram", analyzedAt: "Hari ini, 09:42", contentCount: 20, erAverage: 4.86, erMedian: 4.42, erWeighted: 5.18, followersCount: 128_400, followersChange: 2.4 },
  { id: "history-2", username: "kopikenangan", profileUrl: "https://www.tiktok.com/@kopikenangan", platform: "TikTok", analyzedAt: "Kemarin, 16:18", contentCount: 20, erAverage: 6.24, erMedian: 5.70, erWeighted: 6.61, followersCount: 842_100, followersChange: 1.8 },
  { id: "history-3", username: "designwithme", profileUrl: "https://www.youtube.com/@designwithme", platform: "YouTube", analyzedAt: "28 Agu 2026, 11:05", contentCount: 20, erAverage: 3.91, erMedian: 3.55, erWeighted: 4.22, followersCount: 64_700, followersChange: 3.1 },
  { id: "history-4", username: "ruangvisual", profileUrl: "https://instagram.com/ruangvisual", platform: "Instagram", analyzedAt: "24 Agu 2026, 14:27", contentCount: 20, erAverage: 5.12, erMedian: 4.80, erWeighted: 5.39, followersCount: 91_200, followersChange: 1.2 },
];

const platformColors: Record<Platform, string> = {
  Instagram: "#d946ef",
  TikTok: "#111827",
  YouTube: "#ef4444",
};

const platformOptions: Platform[] = ["Instagram", "TikTok", "YouTube"];

const defaultAccount = { platform: "instagram" as const, username: "akirastudio", followersCount: 128_400, totalInteractions: 48_200 };
const defaultSummary = { erAverage: 4.86, erMedian: 4.42, erWeighted: 5.18 };

function displayPlatform(value: AnalysisSnapshot["account"]["platform"]): Platform {
  return value === "instagram" ? "Instagram" : value === "tiktok" ? "TikTok" : "YouTube";
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak diketahui";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date).replace(".", "");
}

function historyItemFromApi(value: unknown): AnalysisHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<HistoryApiItem>;
  const profile = item.profile;
  const summary = item.summary;
  if (!profile || typeof profile !== "object" || !summary || typeof summary !== "object") return null;
  if (typeof item.id !== "string" || typeof profile.username !== "string" || typeof profile.profileUrl !== "string") return null;
  if (profile.platform !== "instagram" && profile.platform !== "tiktok" && profile.platform !== "youtube") return null;
  if (typeof item.followersCount !== "number" || typeof item.followersChangePercent !== "number" || typeof item.contentCount !== "number") return null;
  if (typeof summary.erAverage !== "number" || typeof summary.erMedian !== "number" || typeof summary.erWeighted !== "number") return null;
  if (typeof item.analyzedAt !== "string" || Number.isNaN(new Date(item.analyzedAt).getTime())) return null;

  return {
    id: item.id,
    username: profile.username,
    profileUrl: profile.profileUrl,
    platform: displayPlatform(profile.platform),
    analyzedAt: formatHistoryDate(item.analyzedAt),
    contentCount: item.contentCount,
    erAverage: summary.erAverage,
    erMedian: summary.erMedian,
    erWeighted: summary.erWeighted,
    followersCount: item.followersCount,
    followersChange: item.followersChangePercent,
  };
}

function displayContentType(value: ApiContent["contentType"]): ContentType {
  if (value === "reels") return "Reels";
  if (value === "carousel") return "Carousel";
  if (value === "photo") return "Foto";
  if (value === "shorts") return "Shorts";
  return "Video";
}

function contentTone(type: ContentType) {
  return { Reels: "#e9ddff", Carousel: "#d8efff", Foto: "#ffe6d6", Video: "#dff4e8", Shorts: "#fff0bf" }[type];
}

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(".", "");
}

function rowsFromAnalysis(analysis: AnalysisSnapshot): ContentRow[] {
  return analysis.contents.map((content) => {
    const type = displayContentType(content.contentType);
    return {
      key: content.id,
      title: content.title,
      caption: content.caption ?? null,
      url: content.url ?? analysis.account.profileUrl ?? null,
      thumbnailUrl: content.thumbnailUrl ?? null,
      type,
      date: formatPublishedAt(content.publishedAt),
      views: content.views,
      likes: content.likes,
      comments: content.comments,
      shares: content.shares,
      engagement: content.engagementRate,
      tone: contentTone(type),
      isBest: content.isBest,
    };
  });
}

function typeStatsFromAnalysis(analysis: AnalysisSnapshot) {
  const colors: Record<ContentType, string> = { Reels: "#635bff", Carousel: "#1da1f2", Foto: "#f59e0b", Video: "#10b981", Shorts: "#f97316" };
  const grouped = new Map<ContentType, number[]>();
  for (const content of analysis.contents) {
    const type = displayContentType(content.contentType);
    grouped.set(type, [...(grouped.get(type) || []), content.engagementRate]);
  }
  return [...grouped.entries()].map(([label, rates]) => ({
    label,
    count: rates.length,
    engagement: rates.reduce((total, rate) => total + rate, 0) / rates.length,
    color: colors[label],
  })).sort((first, second) => second.engagement - first.engagement);
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(value >= 100_000 ? 0 : 1))}K`;
  return new Intl.NumberFormat("id-ID").format(value);
}

function fullNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatEngagementRate(value: number) {
  return `${value.toFixed(2)}%`;
}

function detectPlatform(value: string): Platform | null {
  const normalized = value.toLowerCase();
  if (normalized.includes("tiktok")) return "TikTok";
  if (normalized.includes("youtube") || normalized.includes("youtu.be")) return "YouTube";
  if (normalized.includes("instagram")) return "Instagram";
  return null;
}

function PlatformPill({ platform }: { platform: Platform }) {
  return (
    <Tag
      variant="filled"
      className="engagement-platform-tag"
      icon={<GlobalOutlined />}
      style={{ color: platformColors[platform], background: `${platformColors[platform]}14` }}
    >
      {platform}
    </Tag>
  );
}

function DataUnavailableLabel({ label, detail }: { label: string; detail: string }) {
  return <Tooltip title={detail}><Tag variant="filled" color="orange" className="engagement-unavailable-label" icon={<ExclamationCircleFilled />}>{label}</Tag></Tooltip>;
}

function AccountAvatar({ size = 48 }: { size?: number }) {
  return (
    <Avatar
      size={size}
      style={{ background: "linear-gradient(135deg, #ff8a65 0%, #635bff 100%)", color: "#fff", fontWeight: 700 }}
    >
      AK
    </Avatar>
  );
}

function TrendChart() {
  return (
    <div className="engagement-chart" role="img" aria-label="Grafik tren engagement rate 30 hari">
      <div className="engagement-chart-y-axis" aria-hidden="true">
        <span>8%</span>
        <span>6%</span>
        <span>4%</span>
        <span>2%</span>
        <span>0%</span>
      </div>
      <div className="engagement-chart-plot">
        <svg viewBox="0 0 720 210" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="engagement-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#635bff" stopOpacity=".2" />
              <stop offset="100%" stopColor="#635bff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[24, 70, 116, 162, 208].map((y) => <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="#eef0f6" strokeWidth="1" />)}
          <path d="M0 143 C36 130, 58 144, 84 125 S132 111, 160 120 S207 104, 240 111 S292 86, 324 96 S371 93, 404 104 S450 72, 486 85 S531 50, 566 72 S614 57, 640 66 S688 30, 720 44 L720 210 L0 210 Z" fill="url(#engagement-area)" />
          <path d="M0 143 C36 130, 58 144, 84 125 S132 111, 160 120 S207 104, 240 111 S292 86, 324 96 S371 93, 404 104 S450 72, 486 85 S531 50, 566 72 S614 57, 640 66 S688 30, 720 44" fill="none" stroke="#635bff" strokeLinecap="round" strokeWidth="3" />
          <circle cx="566" cy="72" r="5" fill="#fff" stroke="#635bff" strokeWidth="3" />
          <circle cx="720" cy="44" r="5" fill="#fff" stroke="#635bff" strokeWidth="3" />
        </svg>
        <div className="engagement-chart-x-axis" aria-hidden="true"><span>1 Agu</span><span>8 Agu</span><span>15 Agu</span><span>22 Agu</span><span>30 Agu</span></div>
      </div>
    </div>
  );
}

const historyTrendSeries = [
  { label: "ER rata-rata", color: "#635bff", path: "M0 132 C42 126, 58 140, 92 121 S145 106, 184 118 S238 92, 274 102 S326 80, 364 94 S416 73, 454 83 S512 58, 548 70 S610 41, 660 52 S694 38, 720 44" },
  { label: "ER median", color: "#1da1f2", path: "M0 151 C40 145, 58 157, 92 141 S145 128, 184 136 S238 116, 274 123 S326 108, 364 115 S416 96, 454 105 S512 84, 548 94 S610 72, 660 82 S694 67, 720 75" },
  { label: "Weighted ER", color: "#f59e0b", path: "M0 113 C42 119, 58 108, 92 111 S145 91, 184 103 S238 74, 274 84 S326 65, 364 75 S416 51, 454 65 S512 42, 548 51 S610 30, 660 41 S694 22, 720 31" },
];

function historyTrendPath(values: number[]) {
  if (values.length === 0) return "";
  const maxIndex = Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const x = (index / maxIndex) * 720;
    const boundedValue = Math.min(8, Math.max(0, value));
    const y = 178 - (boundedValue / 8) * 160;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  if (points.length === 1) return `M0 ${points[0].split(" ")[1]} L720 ${points[0].split(" ")[1]}`;
  return `M${points.join(" L")}`;
}

function HistoryTrendChart({ items }: { items: AnalysisHistoryItem[] }) {
  const chartItems = [...items].reverse().slice(-6);
  const series = chartItems.length > 0
    ? [
        { label: "ER rata-rata", color: "#635bff", path: historyTrendPath(chartItems.map((item) => item.erAverage)) },
        { label: "ER median", color: "#1da1f2", path: historyTrendPath(chartItems.map((item) => item.erMedian)) },
        { label: "Weighted ER", color: "#f59e0b", path: historyTrendPath(chartItems.map((item) => item.erWeighted)) },
      ]
    : historyTrendSeries;
  const labels = chartItems.length > 0 ? chartItems.map((item) => item.analyzedAt) : ["30 Jul", "6 Agu", "13 Agu", "20 Agu", "27 Agu", "2 Sep"];

  return (
    <div className="engagement-history-trend" role="img" aria-label={`Grafik garis tren ER rata-rata, ER median, dan weighted ER selama ${chartItems.length || 6} periode`}>
      <div className="engagement-history-trend-legend">
        {series.map((item) => <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>)}
      </div>
      <div className="engagement-history-chart">
        <div className="engagement-history-chart-y-axis" aria-hidden="true"><span>8%</span><span>6%</span><span>4%</span><span>2%</span><span>0%</span></div>
        <div className="engagement-history-chart-plot">
          <svg viewBox="0 0 720 180" preserveAspectRatio="none" aria-hidden="true">
            {[18, 58, 98, 138, 178].map((y) => <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="#eef0f6" strokeWidth="1" />)}
            {series.map((item) => <path key={item.label} d={item.path} fill="none" stroke={item.color} strokeLinecap="round" strokeWidth="3" />)}
          </svg>
          <div className="engagement-history-chart-x-axis" aria-hidden="true">{labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
        </div>
      </div>
    </div>
  );
}

function ContentThumbnail({ tone, type, thumbnailUrl }: Pick<ContentRow, "tone" | "type" | "thumbnailUrl">) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(thumbnailUrl) && !imageFailed;

  return (
    <div className="engagement-thumbnail" style={{ background: tone }} role="img" aria-label={`Thumbnail ${type}`}>
      {showImage ? (
        <img src={thumbnailUrl || undefined} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
      ) : (
        <>
          <span aria-hidden="true"><PlayCircleOutlined /></span>
          <small aria-hidden="true">{type}</small>
        </>
      )}
    </div>
  );
}

function ContentPreviewLink({ url }: { url: string | null }) {
  if (!url) return <Text type="secondary" className="engagement-content-preview-unavailable">Preview tidak tersedia</Text>;
  return <a href={url} target="_blank" rel="noreferrer" className="engagement-content-preview-link" onClick={(event) => event.stopPropagation()}><LinkOutlined /> Lihat preview</a>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text className="engagement-section-label">{children}</Text>;
}

function ContentCard({ row }: { row: ContentRow }) {
  return (
    <Card variant="borderless" className="engagement-content-card">
      <div className="engagement-content-card-thumbnail">
        <ContentThumbnail tone={row.tone} type={row.type} thumbnailUrl={row.thumbnailUrl} />
        <Tag variant="filled" color="blue">{row.type}</Tag>
        {row.isBest && <span className="engagement-content-card-best"><FireFilled /> ER tertinggi</span>}
      </div>
      <div className="engagement-content-card-copy">
        <Text strong className="engagement-content-card-title">{row.title}</Text>
        <Text type="secondary" className="engagement-content-card-date">{row.date}</Text>
        <Text type="secondary" className="engagement-content-card-caption">{row.caption || "Caption belum tersedia dari sumber publik."}</Text>
        <ContentPreviewLink url={row.url} />
      </div>
      <div className="engagement-content-card-metrics">
        <div><Text type="secondary">Views</Text><strong>{compactNumber(row.views)}</strong></div>
        <div><Text type="secondary">Likes</Text><strong>{compactNumber(row.likes)}</strong></div>
        <div><Text type="secondary">Comments</Text><strong>{compactNumber(row.comments)}</strong></div>
        <div title={row.shares === null ? "Shares tidak tersedia dari platform untuk konten ini." : undefined} className={row.shares === null ? "engagement-content-metric-unavailable" : undefined}><Text type="secondary">Shares</Text><strong>{row.shares === null ? "N/A" : compactNumber(row.shares)}</strong></div>
        <div className="engagement-content-card-er"><Text type="secondary">ER</Text><strong>{formatEngagementRate(row.engagement)}</strong></div>
      </div>
    </Card>
  );
}

type ContentDetailsPageProps = {
  rows: ContentRow[];
  platform: Platform;
  username: string;
  lastAnalyzed: string;
  onBack: () => void;
};

function ContentDetailsPage({ rows, platform, username, lastAnalyzed, onBack }: ContentDetailsPageProps) {
  return (
    <div className="engagement-content-page">
      <div className="engagement-page-heading">
        <div>
          <Text className="engagement-eyebrow">RINCIAN KONTEN</Text>
          <Title level={1}>Rincian konten</Title>
          <Text type="secondary">Lihat semua konten yang menjadi dasar perhitungan engagement rate @{username}.</Text>
        </div>
        <Button icon={<DashboardOutlined />} onClick={onBack}>Kembali ke ringkasan</Button>
      </div>

      <Card
        variant="borderless"
        className="engagement-panel-card engagement-content-list-card"
        title={<div><Title level={4}>Daftar konten terbaru</Title><Text type="secondary">Konten dari link publik atau data preview saat metadata belum terbuka.</Text></div>}
        extra={<PlatformPill platform={platform} />}
      >
        <div className="engagement-content-list-meta">
          <Text type="secondary"><CheckCircleFilled /> {rows.length} konten dianalisis</Text>
          <Text type="secondary"><ClockCircleOutlined /> Diperbarui {lastAnalyzed.toLowerCase()}</Text>
        </div>
        <div className="engagement-content-card-grid">
          {rows.map((row) => <ContentCard key={row.key} row={row} />)}
        </div>
      </Card>
    </div>
  );
}

type ContentTypeComparisonStat = {
  label: string;
  count: number;
  engagement: number;
  color: string;
};

function ContentTypeBarChart({ stats }: { stats: ContentTypeComparisonStat[] }) {
  const maxEngagement = Math.max(...stats.map((item) => item.engagement), 1);

  return (
    <div className="engagement-type-bar-chart" role="img" aria-label="Grafik batang perbandingan engagement rate berdasarkan tipe konten">
      {stats.map((item) => (
        <div key={item.label} className="engagement-type-bar-row">
          <div className="engagement-type-bar-label"><Text strong>{item.label}</Text><Text type="secondary">{formatEngagementRate(item.engagement)}</Text></div>
          <div className="engagement-type-bar-track"><span style={{ width: `${Math.max(4, (item.engagement / maxEngagement) * 100)}%`, background: item.color }} /></div>
        </div>
      ))}
    </div>
  );
}

function ContentTypeRecap({ stats }: { stats: ContentTypeComparisonStat[] }) {
  const best = stats[0];

  return (
    <>
      {best && <div className="engagement-type-comparison-highlight"><div className="engagement-best-icon"><FireFilled /></div><div><Text type="secondary">Format terbaik</Text><Text strong>{best.label} · {formatEngagementRate(best.engagement)}</Text></div></div>}
      <div className="engagement-type-comparison-grid">
        {stats.map((item) => (
          <Card key={item.label} variant="borderless" className="engagement-type-comparison-item">
            <div className="engagement-type-comparison-heading"><Space size={8}><span className="engagement-type-dot" style={{ background: item.color }} /><Text strong>{item.label}</Text></Space><Text type="secondary">{item.count} konten</Text></div>
            <strong className="engagement-type-comparison-value">{formatEngagementRate(item.engagement)}</strong>
            <Progress percent={Math.min(100, Math.round(item.engagement * 10))} showInfo={false} strokeColor={item.color} railColor="#f0f1f6" size="small" />
          </Card>
        ))}
      </div>
      {!best && <Empty description="Belum ada data tipe konten." />}
    </>
  );
}

type ComparisonMode = "types" | "competitors";

type ComparisonPrimaryAccount = {
  profileUrl: string;
  platform: Platform;
  username: string;
  followersCount: number;
  erAverage: number;
  erWeighted: number;
  totalInteractions: number;
  sourceMode?: "public" | "partial" | "mock";
  sourceLabel?: string;
  sourceMessage?: string;
};

type CompetitorAccount = ComparisonPrimaryAccount & {
  key: string;
  isPrimary?: boolean;
};

const competitorMockStats: Record<Platform, Omit<ComparisonPrimaryAccount, "profileUrl" | "username" | "platform">> = {
  Instagram: { followersCount: 91_200, erAverage: 5.12, erWeighted: 5.46, totalInteractions: 52_100 },
  TikTok: { followersCount: 842_100, erAverage: 6.24, erWeighted: 6.72, totalInteractions: 181_300 },
  YouTube: { followersCount: 64_700, erAverage: 3.91, erWeighted: 4.18, totalInteractions: 24_800 },
};

function platformFromApi(value: unknown): Platform | null {
  if (value === "instagram") return "Instagram";
  if (value === "tiktok") return "TikTok";
  if (value === "youtube") return "YouTube";
  return null;
}

function usernameFromProfileUrl(value: string) {
  try {
    const pathname = new URL(value).pathname.split("/").filter(Boolean);
    const handle = pathname[pathname.length - 1] || "akun-pembanding";
    return decodeURIComponent(handle).replace(/^@/, "") || "akun-pembanding";
  } catch {
    return "akun-pembanding";
  }
}

function buildMockCompetitorAccount(profileUrl: string, index: number): CompetitorAccount | null {
  const platform = detectPlatform(profileUrl);
  if (!platform) return null;
  return {
    ...competitorMockStats[platform],
    key: "competitor-" + index + "-" + profileUrl,
    profileUrl,
    platform,
    username: usernameFromProfileUrl(profileUrl),
    sourceMode: "mock",
    sourceLabel: "Data tiruan",
    sourceMessage: "Preview lokal sebelum metadata publik dipindai.",
  };
}

function parseComparisonAccounts(payload: unknown): CompetitorAccount[] | null {
  if (!payload || typeof payload !== "object" || !("data" in payload) || !payload.data || typeof payload.data !== "object") return null;
  const data = payload.data as { accounts?: unknown };
  if (!Array.isArray(data.accounts)) return null;

  const accounts = data.accounts.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const platform = platformFromApi(value.platform);
    const profileUrl = typeof value.profileUrl === "string" ? value.profileUrl : null;
    const username = typeof value.username === "string" ? value.username : null;
    const sourceMode = value.source === "public" || value.source === "partial" || value.source === "mock" ? value.source as "public" | "partial" | "mock" : null;
    const sourceLabel = typeof value.sourceLabel === "string" ? value.sourceLabel : null;
    const sourceMessage = typeof value.sourceMessage === "string" ? value.sourceMessage : null;
    const followersCount = typeof value.followersCount === "number" ? value.followersCount : null;
    const erAverage = typeof value.erAverage === "number" ? value.erAverage : null;
    const erWeighted = typeof value.erWeighted === "number" ? value.erWeighted : null;
    const totalInteractions = typeof value.totalInteractions === "number" ? value.totalInteractions : null;
    if (!platform || !profileUrl || !username || !sourceMode || !sourceLabel || !sourceMessage || followersCount === null || erAverage === null || erWeighted === null || totalInteractions === null) return [];
    return [{ key: "competitor-" + index + "-" + profileUrl, profileUrl, platform, username, followersCount, erAverage, erWeighted, totalInteractions, sourceMode, sourceLabel, sourceMessage }];
  });

  return accounts.length === data.accounts.length ? accounts : null;
}

function CompetitorComparisonPanel({ primary, initialUrls }: { primary: ComparisonPrimaryAccount; initialUrls: string[] }) {
  const [competitorUrls, setCompetitorUrls] = useState(initialUrls);
  const [submittedAccounts, setSubmittedAccounts] = useState<CompetitorAccount[]>(() => initialUrls.flatMap((url, index) => {
    const account = buildMockCompetitorAccount(url, index);
    return account ? [account] : [];
  }));
  const [inputError, setInputError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const comparisonRows = useMemo<CompetitorAccount[]>(() => [{ ...primary, key: "primary", isPrimary: true }, ...submittedAccounts], [primary, submittedAccounts]);

  const bestRow = comparisonRows.reduce((best, row) => row.erAverage > best.erAverage ? row : best, comparisonRows[0]);

  const updateUrl = (index: number, value: string) => {
    setCompetitorUrls((current) => current.map((url, urlIndex) => urlIndex === index ? value : url));
    setInputError("");
  };

  const addCompetitor = () => {
    if (competitorUrls.length < 4) setCompetitorUrls((current) => [...current, ""]);
  };

  const removeCompetitor = (index: number) => {
    setCompetitorUrls((current) => current.filter((_, urlIndex) => urlIndex !== index));
  };

  const compareAccounts = async () => {
    const nextUrls = competitorUrls.map((url) => url.trim()).filter(Boolean);
    if (nextUrls.some((url) => !detectPlatform(url))) {
      setInputError("Gunakan link publik Instagram, TikTok, atau YouTube untuk akun pembanding.");
      return;
    }
    if (nextUrls.length === 0) {
      setInputError("Tambahkan minimal satu link akun pembanding.");
      return;
    }
    setInputError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/engagement/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrls: nextUrls }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload && typeof payload.error === "string" ? payload.error : "Data publik belum dapat dipindai.");
      const accounts = parseComparisonAccounts(payload);
      if (!accounts || accounts.length === 0) throw new Error("Respons pemindaian publik belum sesuai.");
      setSubmittedAccounts(accounts);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : "Data publik belum dapat dipindai.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="engagement-comparison-stack">
      <Card variant="borderless" className="engagement-panel-card engagement-competitor-input-card">
        <div className="engagement-competitor-input-heading">
          <div><Title level={4}>Tambahkan akun pembanding</Title><Text type="secondary">Tempel link profil publik. Tidak perlu menyambungkan akun atau login.</Text></div>
          <Tag variant="filled" color="green"><GlobalOutlined /> Link publik</Tag>
        </div>
        <div className="engagement-competitor-input-list">
          {competitorUrls.map((url, index) => (
            <div key={index} className="engagement-competitor-input-row">
              <Text className="engagement-competitor-input-label">Akun {index + 1}</Text>
              <Input
                value={url}
                prefix={<LinkOutlined />}
                onChange={(event) => updateUrl(index, event.target.value)}
                onPressEnter={() => { void compareAccounts(); }}
                placeholder="https://instagram.com/namaakun"
                aria-label={`Link akun pembanding ${index + 1}`}
              />
              {competitorUrls.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeCompetitor(index)} aria-label={`Hapus akun pembanding ${index + 1}`} />}
            </div>
          ))}
        </div>
        {inputError && <Text type="danger" className="engagement-input-error" role="alert">{inputError}</Text>}
        <div className="engagement-competitor-input-footer">
          <Button type="link" icon={<PlusOutlined />} onClick={addCompetitor} disabled={competitorUrls.length >= 4}>Tambah akun</Button>
          <Button type="primary" icon={<BarChartOutlined />} loading={isLoading} onClick={() => { void compareAccounts(); }}>Bandingkan akun</Button>
        </div>
      </Card>

      <div className="engagement-competitor-result-heading">
        <div><Title level={4}>Perbandingan performa akun</Title><Text type="secondary">{isLoading ? "Sedang mencoba membaca metadata publik dari link yang ditempel..." : "Metadata publik dicoba tanpa koneksi akun; metrik yang tertutup tetap ditandai sebagai preview."}</Text></div>
        <Tag variant="filled" color="gold">{comparisonRows.length} akun</Tag>
      </div>
      <div className="engagement-competitor-grid">
        {comparisonRows.map((row) => (
          <Card key={row.key} variant="borderless" className={`engagement-panel-card engagement-competitor-card${row.isPrimary ? " engagement-competitor-card-primary" : ""}`}>
            <div className="engagement-competitor-card-header">
              <div className="engagement-competitor-avatar" style={{ background: platformColors[row.platform] }}><BarChartOutlined /></div>
              <div className="engagement-competitor-account"><Text strong>@{row.username}</Text><Text type="secondary">{row.profileUrl}</Text></div>
              {row.isPrimary ? <Tag variant="filled" color="purple">Akun utama</Tag> : row.key === bestRow.key ? <Tag variant="filled" color="green">ER tertinggi</Tag> : null}
            </div>
            <div className="engagement-competitor-platform"><PlatformPill platform={row.platform} /><Text type="secondary">20 konten terbaru</Text></div>
            <div className="engagement-competitor-metrics">
              <div><Text type="secondary">Followers</Text><strong title={fullNumber(row.followersCount)}>{compactNumber(row.followersCount)}</strong></div>
              <div><Text type="secondary">ER rata-rata</Text><strong className="engagement-competitor-primary-value">{formatEngagementRate(row.erAverage)}</strong></div>
              <div><Text type="secondary">Weighted ER</Text><strong>{formatEngagementRate(row.erWeighted)}</strong></div>
              <div><Text type="secondary">Total interaksi</Text><strong>{compactNumber(row.totalInteractions)}</strong></div>
            </div>
            <div className="engagement-competitor-card-footer"><Tooltip title={row.sourceMessage || "Sumber data"}><Text type="secondary"><DatabaseOutlined /> {row.sourceLabel || "Data tiruan"}</Text></Tooltip><Text type="secondary">Publik · tanpa koneksi</Text></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ContentTypeComparisonPanel({ stats, allStats, selectedType, onTypeChange }: { stats: ContentTypeComparisonStat[]; allStats: ContentTypeComparisonStat[]; selectedType: string; onTypeChange: (value: string) => void }) {
  return (
    <Card variant="borderless" className="engagement-panel-card engagement-type-comparison-card" title={<div><Title level={4}>Performa berdasarkan format</Title><Text type="secondary">Urutan dari ER rata-rata tertinggi ke terendah.</Text></div>}>
        <div className="engagement-type-filter"><Text strong>Filter tipe konten</Text><Segmented options={["Semua", ...allStats.map((item) => item.label)]} value={selectedType} onChange={(value) => onTypeChange(String(value))} /></div>
        {stats.length > 0 && <ContentTypeBarChart stats={stats} />}
        {stats.length > 0 && <Divider />}
        <ContentTypeRecap stats={stats} />
    </Card>
  );
}

function ComparisonPage({ mode, onModeChange, onBack, typeStats, allTypeStats, selectedType, onTypeChange, primary, initialCompetitorUrls }: {
  mode: ComparisonMode;
  onModeChange: (value: ComparisonMode) => void;
  onBack: () => void;
  typeStats: ContentTypeComparisonStat[];
  allTypeStats: ContentTypeComparisonStat[];
  selectedType: string;
  onTypeChange: (value: string) => void;
  primary: ComparisonPrimaryAccount;
  initialCompetitorUrls: string[];
}) {
  return (
    <div className="engagement-content-page">
      <div className="engagement-page-heading">
        <div>
          <Text className="engagement-eyebrow">PERBANDINGAN</Text>
          <Title level={1}>Perbandingan</Title>
          <Text type="secondary">Bandingkan performa format konten atau akun kompetitor dalam satu tampilan.</Text>
        </div>
        <Button icon={<DashboardOutlined />} onClick={onBack}>Kembali ke ringkasan</Button>
      </div>

      <div className="engagement-comparison-mode-bar">
        <Text strong>Bandingkan berdasarkan</Text>
        <Segmented
          options={[{ label: "Tipe konten", value: "types" }, { label: "Kompetitor", value: "competitors" }]}
          value={mode}
          onChange={(value) => onModeChange(String(value) as ComparisonMode)}
        />
      </div>

      {mode === "types" ? <ContentTypeComparisonPanel stats={typeStats} allStats={allTypeStats} selectedType={selectedType} onTypeChange={onTypeChange} /> : <CompetitorComparisonPanel primary={primary} initialUrls={initialCompetitorUrls} />}
    </div>
  );
}

function AnalysisHistoryPage({ onStart, onReuse, items, loading, source }: { onStart: () => void; onReuse: (item: AnalysisHistoryItem) => void; items: AnalysisHistoryItem[]; loading: boolean; source: HistorySource }) {
  const averageEngagement = items.length > 0 ? items.reduce((total, item) => total + item.erAverage, 0) / items.length : 0;
  const profilesAnalyzed = new Set(items.map((item) => item.profileUrl)).size;
  const sourceLabel = source === "database" ? "Database" : "Preview";

  return (
    <div className="engagement-content-page">
      <div className="engagement-page-heading">
        <div>
          <Text className="engagement-eyebrow">RIWAYAT PROGRES</Text>
          <Title level={1}>Riwayat analisis</Title>
          <Text type="secondary">Lihat kembali analisis profil yang pernah kamu jalankan.</Text>
        </div>
        <Button type="primary" icon={<LinkOutlined />} onClick={onStart}>Analisis baru</Button>
      </div>

      <div className="engagement-history-summary">
        <Card variant="borderless" className="engagement-history-stat-card"><Statistic title="Total analisis" value={items.length} /><Text type="secondary">{source === "database" ? "Profil aktif" : "Data contoh"}</Text></Card>
        <Card variant="borderless" className="engagement-history-stat-card"><Statistic title="Profil dianalisis" value={profilesAnalyzed} /><Text type="secondary">{source === "database" ? "Dari data tersimpan" : "Preview sample"}</Text></Card>
        <Card variant="borderless" className="engagement-history-stat-card engagement-history-stat-primary"><Statistic title="ER rata-rata" value={averageEngagement} precision={2} suffix="%" /><Text type="secondary">Dari riwayat profil aktif</Text></Card>
      </div>

      <Card variant="borderless" className="engagement-panel-card engagement-history-trend-card" title={<div><Title level={4}>Tren engagement rate</Title><Text type="secondary">Perubahan tiga metrik utama dari analisis tersimpan.</Text></div>} extra={<Tag variant="filled" color={source === "database" ? "green" : "gold"}>{sourceLabel} · {items.length || 6} periode</Tag>}>
        <HistoryTrendChart items={items} />
      </Card>

      <Card
        variant="borderless"
        className="engagement-panel-card engagement-history-card"
        title={<div><Title level={4}>Daftar riwayat analisis</Title><Text type="secondary">{source === "database" ? "Hasil yang sudah disimpan untuk profil aktif." : "Database belum tersedia; menampilkan data contoh."}</Text></div>}
        extra={<Tag variant="filled" color={source === "database" ? "green" : "gold"}>{sourceLabel} · {items.length} tersimpan</Tag>}
      >
        <div className="engagement-history-list">
          {loading ? (
            <div className="engagement-history-loading"><Spin size="small" /> Memuat riwayat tersimpan...</div>
          ) : items.length === 0 ? (
            <Empty description="Belum ada analisis tersimpan untuk profil aktif." />
          ) : items.map((item) => (
            <div key={item.id} className="engagement-history-row">
              <div className="engagement-history-profile">
                <div className="engagement-history-avatar" style={{ background: platformColors[item.platform] }} aria-hidden="true"><BarChartOutlined /></div>
                <div className="engagement-history-profile-copy"><Text strong>@{item.username}</Text><Text type="secondary">{item.profileUrl}</Text><PlatformPill platform={item.platform} /></div>
              </div>
              <div className="engagement-history-field"><Text type="secondary">Dianalisis</Text><Text strong>{item.analyzedAt}</Text></div>
              <div className="engagement-history-field"><Text type="secondary">Followers</Text><strong title={`${fullNumber(item.followersCount)} followers`} aria-label={`${fullNumber(item.followersCount)} followers`}>{compactNumber(item.followersCount)}</strong><span className={`engagement-history-change${item.followersChange < 0 ? " is-negative" : ""}`}>{item.followersChange < 0 ? <ArrowDownOutlined /> : <ArrowUpOutlined />} {item.followersChange >= 0 ? "+" : ""}{item.followersChange.toFixed(1)}%</span></div>
              <div className="engagement-history-field"><Text type="secondary">ER rata-rata</Text><strong>{formatEngagementRate(item.erAverage)}</strong></div>
              <div className="engagement-history-actions"><Tag variant="filled" color="green"><CheckCircleFilled /> {item.contentCount} konten</Tag><Button type="link" onClick={() => onReuse(item)}>Gunakan lagi</Button></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PublicDataSourcesPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="engagement-content-page">
      <div className="engagement-page-heading">
        <div>
          <Text className="engagement-eyebrow">SUMBER DATA PUBLIK</Text>
          <Title level={1}>Sumber data</Title>
          <Text type="secondary">Lihat bagaimana data diambil tanpa menyambungkan akun platform.</Text>
        </div>
        <Button icon={<DashboardOutlined />} onClick={onBack}>Kembali ke ringkasan</Button>
      </div>

      <Alert className="engagement-source-preview-alert" type="success" showIcon icon={<LinkOutlined />} title={<span><strong>Mode link-only aktif.</strong> Tempel link profil publik untuk memulai analisis—tidak perlu login, OAuth, atau menyimpan token platform.</span>} />

      <Card variant="borderless" className="engagement-panel-card engagement-source-summary-card" title={<div><Title level={4}>Ringkasan data publik</Title><Text type="secondary">Metrik dihitung lokal dari metadata yang terlihat pada halaman publik.</Text></div>} extra={<Tag variant="filled" color="green">Tanpa koneksi</Tag>}>
        <div className="engagement-source-summary-layout">
          <div>
            <div className="engagement-source-summary-metrics"><div><Text type="secondary">ER rata-rata</Text><strong>4.86%</strong></div><div><Text type="secondary">ER median</Text><strong>4.42%</strong></div><div><Text type="secondary">Weighted ER</Text><strong>5.18%</strong></div></div>
            <div className="engagement-source-summary-note"><DataUnavailableLabel label="Shares parsial" detail="Shares tidak tersedia pada sebagian konten, tetapi tidak menghentikan perhitungan ER." /><Text type="secondary">Metrik yang kosong diabaikan dengan aman.</Text></div>
          </div>
          <TrendChart />
        </div>
      </Card>

      <div className="engagement-source-grid">
        {publicDataSources.map((source) => (
          <Card key={source.platform} variant="borderless" className="engagement-panel-card engagement-source-card">
            <div className="engagement-source-card-header">
              <div className="engagement-source-platform-icon" style={{ color: platformColors[source.platform], background: `${platformColors[source.platform]}14` }}><GlobalOutlined /></div>
              <div className="engagement-source-platform-copy"><Title level={4}>{source.platform}</Title><Text type="secondary">{source.sourceName}</Text></div>
              <Tag variant="filled" color="green">Tanpa koneksi</Tag>
            </div>
            <div className="engagement-source-status"><Badge status="success" /><Text strong>{source.status}</Text></div>
            <div className="engagement-source-fields"><div><Text type="secondary">Aksi pengguna</Text><strong>Tempel link profil</strong></div><div><Text type="secondary">Sumber metrik</Text><strong>Halaman publik</strong></div></div>
            <Divider />
            <Text className="engagement-source-capability-label">Data yang dapat dipindai</Text>
            <div className="engagement-source-capabilities">{source.capabilities.map((capability) => <Tag key={capability} variant="filled" color="green"><CheckCircleFilled /> {capability}</Tag>)}</div>
            <div className="engagement-source-availability"><Text type="secondary">Ketersediaan terbatas</Text><DataUnavailableLabel label={source.unavailableLabel} detail={source.limitation} /></div>
            <Text type="secondary" className="engagement-source-limitation">{source.limitation}</Text>
            <div className="engagement-source-card-footer"><Text type="secondary">Siap dari link publik</Text><Tag variant="filled" color="blue"><LinkOutlined /> Tempel link</Tag></div>
          </Card>
        ))}
      </div>

      <Card variant="borderless" className="engagement-panel-card engagement-source-note-card">
        <div className="engagement-source-note-icon"><CheckCircleFilled /></div>
        <div><Text strong>Perhitungan inti tetap lokal</Text><Text type="secondary">Engagement rate, rata-rata, median, dan weighted ER dihitung oleh aplikasi. Token AI tidak diperlukan untuk metrik utama.</Text></div>
      </Card>
    </div>
  );
}

function SmartInsightSummary({ items, sourceMode }: { items: SmartInsightSummaryItem[]; sourceMode: "vikey" | "deterministic" | "mock" }) {
  return (
    <Card
      variant="borderless"
      className="engagement-panel-card engagement-insight-summary-card"
      title={<div><Title level={4}>Rangkuman wawasan</Title><Text type="secondary">Contoh insight yang akan dirangkum dari pola analisis akun.</Text></div>}
      extra={<Tag variant="filled" color={sourceMode === "vikey" ? "green" : "gold"}>{sourceMode === "vikey" ? "Vikey AI" : sourceMode === "deterministic" ? "Aturan deterministik" : "Data tiruan"}</Tag>}
    >
      <div className="engagement-insight-summary-grid">
        {items.map((insight) => (
          <div key={insight.title} className="engagement-insight-summary-item">
            <div className="engagement-insight-summary-icon">{insight.icon}</div>
            <div className="engagement-insight-summary-copy">
              <Text strong>{insight.title}</Text>
              <Text type="secondary">{insight.description}</Text>
              <div className="engagement-insight-summary-metric"><Tag variant="filled" color="purple">{insight.metric}</Tag><Text type="secondary">{insight.label}</Text></div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SmartContentRecommendations({ items, sourceMode }: { items: SmartContentRecommendation[]; sourceMode: "vikey" | "deterministic" | "mock" }) {
  return (
    <Card
      variant="borderless"
      className="engagement-panel-card engagement-recommendations-card"
      title={<div><Title level={4}>Rekomendasi konten</Title><Text type="secondary">Contoh saran aksi yang dapat dibuat dari pola performa.</Text></div>}
      extra={<Tag variant="filled" color={sourceMode === "vikey" ? "green" : "gold"}>{sourceMode === "vikey" ? "Vikey AI" : sourceMode === "deterministic" ? "Aturan deterministik" : "Data tiruan"}</Tag>}
    >
      <div className="engagement-recommendations-list">
        {items.map((recommendation) => (
          <div key={recommendation.title} className="engagement-recommendation-item">
            <div className="engagement-recommendation-icon">{recommendation.icon}</div>
            <div className="engagement-recommendation-copy">
              <Text strong>{recommendation.title}</Text>
              <Text type="secondary">{recommendation.description}</Text>
              <div className="engagement-recommendation-meta"><Tag variant="filled" color="blue">{recommendation.priority}</Tag><Text type="secondary">{recommendation.signal}</Text></div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InsightChatPanel({ profileUrl }: { profileUrl: string }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<InsightChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [remainingQuestions, setRemainingQuestions] = useState(5);
  const [error, setError] = useState("");
  const quickQuestions = ["Format apa yang paling kuat?", "Konten mana yang paling menonjol?", "Bagaimana membaca weighted ER?"];

  const askQuestion = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isLoading || remainingQuestions <= 0) return;

    setError("");
    setQuestion("");
    setMessages((current) => [...current, { id: "question-" + Date.now(), role: "user", content: trimmedQuestion }]);
    setIsLoading(true);
    try {
      const response = await fetch("/api/engagement/insights/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrl, question: trimmedQuestion }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload && typeof payload.error === "string" ? payload.error : "Jawaban AI belum tersedia.");
      const answer = payload?.data?.answer;
      if (typeof answer !== "string" || !answer.trim()) throw new Error("Jawaban AI belum tersedia.");
      setMessages((current) => [...current, {
        id: "answer-" + Date.now(),
        role: "assistant",
        content: answer.trim(),
        provider: payload.data.provider === "vikey" ? "vikey" : "deterministic",
      }]);
      if (typeof payload.data.remainingQuestions === "number") setRemainingQuestions(payload.data.remainingQuestions);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Jawaban AI belum tersedia.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      variant="borderless"
      className="engagement-panel-card engagement-insight-chat-card"
      title={<div><Title level={4}>Tanya Analisis AI</Title><Text type="secondary">Tanyakan pola dari analisis akun ini tanpa mengirim ulang riwayat percakapan.</Text></div>}
      extra={<Tag variant="filled" color="purple"><MessageOutlined /> Hemat token</Tag>}
    >
      <div className="engagement-insight-chat-meta">
        <Text type="secondary">Konteks diringkas dari metrik dan 3 konten teratas.</Text>
        <Tag variant="filled" color={remainingQuestions > 0 ? "blue" : "orange"}>{remainingQuestions}/5 pertanyaan tersisa</Tag>
      </div>
      {messages.length > 0 && (
        <div className="engagement-insight-chat-messages" aria-live="polite">
          {messages.map((item) => (
            <div key={item.id} className={"engagement-insight-chat-message engagement-insight-chat-message-" + item.role}>
              <div className="engagement-insight-chat-message-icon">{item.role === "assistant" ? <ThunderboltFilled /> : <UserOutlined />}</div>
              <div className="engagement-insight-chat-message-copy">
                <Text strong>{item.role === "assistant" ? item.provider === "vikey" ? "Vikey AI" : "Analisis lokal" : "Kamu"}</Text>
                <Text>{item.content}</Text>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="engagement-insight-chat-quick">
        <Text type="secondary">Coba tanya:</Text>
        <div>{quickQuestions.map((item) => <Button key={item} type="link" size="small" onClick={() => setQuestion(item)} disabled={isLoading || remainingQuestions <= 0}>{item}</Button>)}</div>
      </div>
      <div className="engagement-insight-chat-form">
        <Input.TextArea
          value={question}
          maxLength={500}
          showCount
          autoSize={{ minRows: 2, maxRows: 4 }}
          onChange={(event) => { setQuestion(event.target.value); setError(""); }}
          onPressEnter={(event) => {
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              void askQuestion();
            }
          }}
          placeholder="Contoh: apa yang harus saya perbaiki dari performa akun ini?"
          aria-label="Pertanyaan analisis AI"
          disabled={isLoading || remainingQuestions <= 0}
        />
        <Button type="primary" icon={<SendOutlined />} loading={isLoading} onClick={() => { void askQuestion(); }} disabled={!question.trim() || remainingQuestions <= 0}>Tanya AI</Button>
      </div>
      {error && <Text type="danger" className="engagement-input-error" role="alert">{error}</Text>}
      <Text type="secondary" className="engagement-insight-chat-footnote">Batas hemat: maksimal 5 pertanyaan per 10 menit, jawaban singkat, dan riwayat tidak dikirim ulang.</Text>
    </Card>
  );
}

function SmartInsightsPage({ onBack, profileUrl }: { onBack: () => void; profileUrl: string }) {
  const [insightData, setInsightData] = useState<SmartInsightData>(mockSmartInsightData);
  const [insightSource, setInsightSource] = useState<"vikey" | "deterministic" | "mock">("mock");
  const [insightLoading, setInsightLoading] = useState(true);
  const [insightError, setInsightError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadInsights = async () => {
      if (!profileUrl.trim()) {
        setInsightLoading(false);
        return;
      }

      setInsightLoading(true);
      setInsightError(false);
      try {
        const response = await fetch(`/api/engagement/insights?profileUrl=${encodeURIComponent(profileUrl)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Insight API unavailable");
        const parsed = parseInsightData(await response.json());
        if (!parsed) throw new Error("Insight API response invalid");
        if (!controller.signal.aborted) {
          setInsightData(parsed);
          setInsightSource(parsed.provider);
        }
      } catch {
        if (!controller.signal.aborted) {
          setInsightData(mockSmartInsightData);
          setInsightSource("mock");
          setInsightError(true);
        }
      } finally {
        if (!controller.signal.aborted) setInsightLoading(false);
      }
    };

    void loadInsights();
    return () => controller.abort();
  }, [profileUrl]);

  const insightFeatures = [
    { icon: <BarChartOutlined />, title: "Ringkasan otomatis", description: "Ubah tren ER, followers, dan interaksi menjadi rangkuman yang mudah dipahami." },
    { icon: <FireFilled />, title: "Peluang konten", description: "Temukan format dan topik yang paling berpotensi meningkatkan engagement akun." },
    { icon: <RiseOutlined />, title: "Rekomendasi berikutnya", description: "Dapatkan saran langkah praktis berdasarkan pola dari analisis terbaru." },
  ];

  return (
    <div className="engagement-content-page">
      <div className="engagement-page-heading">
        <div>
          <Text className="engagement-eyebrow">WAWASAN CERDAS</Text>
          <Title level={1}>Wawasan Cerdas</Title>
          <Text type="secondary">Bantu ubah data engagement menjadi keputusan konten yang lebih tajam.</Text>
        </div>
        <Button icon={<DashboardOutlined />} onClick={onBack}>Kembali ke ringkasan</Button>
      </div>

      <Alert
        className="engagement-insights-coming-alert"
        type="info"
        showIcon
        icon={<ThunderboltFilled />}
        title={<span><strong>{insightSource === "vikey" ? "Vikey AI aktif." : "Mode hemat aktif."}</strong> Tanyakan performa akun tanpa mengubah perhitungan metrik utama.</span>}
      />
      <div className="engagement-insights-api-status" role="status" aria-live="polite">
        {insightLoading ? <><Spin size="small" /> Memuat insight dari Vikey AI...</> : insightError ? <><Badge status="warning" /> API belum tersedia, menampilkan contoh data tiruan.</> : insightSource === "vikey" ? <><Badge status="success" /> Insight dirangkum oleh Vikey AI.</> : <><Badge status="warning" /> API aktif, tetapi Vikey AI belum dikonfigurasi; memakai aturan deterministik.</>}
      </div>

      <Card variant="borderless" className="engagement-panel-card engagement-insights-hero-card">
        <div className="engagement-insights-hero-icon"><ThunderboltFilled /></div>
        <div className="engagement-insights-hero-copy">
          <Tag variant="filled" color={insightSource === "vikey" ? "green" : "purple"}>{insightSource === "vikey" ? "VIKEY AI AKTIF" : "ANALISIS AI"}</Tag>
          <Title level={2}>Dari angka menjadi aksi.</Title>
          <Text type="secondary">Tanyakan pola performa dari akun ini dan dapatkan jawaban singkat yang tetap berpijak pada data analisis.</Text>
        </div>
        <div className="engagement-insights-hero-status"><Badge status={insightSource === "vikey" ? "success" : "processing"} /><Text strong>{insightSource === "vikey" ? "Vikey AI terhubung" : "Fallback deterministik siap"}</Text><Text type="secondary">Metrik inti tetap dihitung lokal.</Text></div>
      </Card>

      <SmartInsightSummary items={insightData.summary} sourceMode={insightSource} />
      <SmartContentRecommendations items={insightData.recommendations} sourceMode={insightSource} />
      <InsightChatPanel profileUrl={profileUrl} />

      <Card
        variant="borderless"
        className="engagement-panel-card engagement-insights-features-card"
        title={<div><Title level={4}>Kemampuan Wawasan Cerdas</Title><Text type="secondary">Insight ringkas, rekomendasi, dan tanya-jawab berbasis data analisis.</Text></div>}
        extra={<Tag variant="filled" color="green">3 kemampuan</Tag>}
      >
        <div className="engagement-insights-feature-grid">
          {insightFeatures.map((feature) => (
            <div key={feature.title} className="engagement-insights-feature">
              <div className="engagement-insights-feature-icon">{feature.icon}</div>
              <div><Text strong>{feature.title}</Text><Text type="secondary">{feature.description}</Text></div>
              <Tag variant="filled" color="green"><CheckCircleFilled /> Tersedia</Tag>
            </div>
          ))}
        </div>
      </Card>

      <Card variant="borderless" className="engagement-panel-card engagement-insights-note-card">
        <div className="engagement-insights-note-icon"><CheckCircleFilled /></div>
        <div><Text strong>Transparansi tetap jadi prioritas</Text><Text type="secondary">Wawasan Cerdas hanya akan membantu membaca pola. Engagement rate dan metrik utamanya tetap dihitung secara deterministik oleh aplikasi.</Text></div>
      </Card>
    </div>
  );
}

export default function EngagementDashboard() {
  const [profileUrl, setProfileUrl] = useState("https://instagram.com/akirastudio");
  const [platform, setPlatform] = useState<Platform>("Instagram");
  const [inputError, setInputError] = useState("");
  const [period, setPeriod] = useState("30 hari");
  const [activeMenu, setActiveMenu] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState("Baru saja");
  const [analysis, setAnalysis] = useState<AnalysisSnapshot | null>(null);
  const [resultSaved, setResultSaved] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [historyItems, setHistoryItems] = useState<AnalysisHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySource, setHistorySource] = useState<HistorySource>("mock");
  const [contentTypeFilter, setContentTypeFilter] = useState("Semua");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("types");
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (activeMenu !== "history") return;
    const controller = new AbortController();
    const loadHistory = async () => {
      const trimmedProfileUrl = profileUrl.trim();
      if (!trimmedProfileUrl) {
        setHistoryItems([]);
        setHistorySource("database");
        return;
      }

      setHistoryLoading(true);
      try {
        const response = await fetch(`/api/engagement/history?profileUrl=${encodeURIComponent(trimmedProfileUrl)}&limit=20`, { signal: controller.signal });
        if (!response.ok) throw new Error("History API unavailable");
        const payload = await response.json() as { data?: { history?: unknown[] } };
        const items = Array.isArray(payload.data?.history) ? payload.data.history.flatMap((item) => {
          const parsed = historyItemFromApi(item);
          return parsed ? [parsed] : [];
        }) : [];
        if (!controller.signal.aborted) {
          setHistoryItems(items);
          setHistorySource("database");
        }
      } catch {
        if (!controller.signal.aborted) {
          setHistoryItems(analysisHistory);
          setHistorySource("mock");
        }
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    };

    void loadHistory();
    return () => controller.abort();
  }, [activeMenu, profileUrl]);

  const currentAccount = analysis?.account || defaultAccount;
  const currentSummary = analysis?.summary || defaultSummary;
  const currentPlatform = analysis ? displayPlatform(analysis.account.platform) : platform;
  const rawDisplayedRows = analysis ? rowsFromAnalysis(analysis) : contentRows;
  const highestRowKey = rawDisplayedRows.reduce((best, row) => row.engagement > best.engagement ? row : best, rawDisplayedRows[0]).key;
  const displayedRows = rawDisplayedRows.map((row) => ({ ...row, isBest: row.isBest || row.key === highestRowKey }));
  const visibleRows = displayedRows.slice(0, 5);
  const displayedTypeStats = analysis ? typeStatsFromAnalysis(analysis) : contentTypeStats;
  const filteredTypeStats = contentTypeFilter === "Semua" ? displayedTypeStats : displayedTypeStats.filter((item) => item.label === contentTypeFilter);
  const bestRow = displayedRows.find((row) => row.isBest) || displayedRows.reduce((best, row) => row.engagement > best.engagement ? row : best, displayedRows[0]);
  const bestFormat = displayedTypeStats[0]?.label || bestRow.type;
  const sharesArePartial = analysis?.dataAvailability.shares === "partial" || !analysis;
  const dataAvailabilityMessage = analysis?.dataAvailability.message || "Data yang tidak tersedia tidak memengaruhi metrik lain.";

  const menuItems: MenuProps["items"] = useMemo(() => [
    { key: "overview", icon: <DashboardOutlined />, label: "Ringkasan" },
    { key: "content", icon: <FileTextOutlined />, label: "Rincian konten" },
    { key: "types", icon: <BarChartOutlined />, label: "Perbandingan" },
    { type: "divider" },
    { key: "history", icon: <ClockCircleOutlined />, label: "Riwayat analisis" },
    { key: "sources", icon: <DatabaseOutlined />, label: "Sumber data" },
    { key: "insights", icon: <ThunderboltFilled />, label: "Wawasan Cerdas", danger: false },
  ], []);

  const columns: TableColumnsType<ContentRow> = [
    {
      title: "Konten",
      dataIndex: "title",
      key: "title",
      render: (title: string, row) => (
        <Space size={12}>
          <ContentThumbnail tone={row.tone} type={row.type} thumbnailUrl={row.thumbnailUrl} />
          <div className="engagement-content-title-wrap">
            <Text strong className="engagement-content-title">{title}</Text>
            <Text type="secondary" className="engagement-content-date">{row.date}</Text>
            <Text type="secondary" className="engagement-content-caption">{row.caption || "Caption belum tersedia."}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Tipe",
      dataIndex: "type",
      key: "type",
      responsive: ["md"],
      render: (type: ContentType) => <Tag variant="filled" color="blue">{type}</Tag>,
    },
    { title: "Views", dataIndex: "views", key: "views", align: "right", responsive: ["lg"], render: (value: number) => compactNumber(value) },
    { title: "Interaksi", dataIndex: "likes", key: "likes", align: "right", responsive: ["xl"], render: (value: number, row) => <Space size={5}><span>{compactNumber(value + row.comments + (row.shares || 0))}</span>{row.shares === null && <DataUnavailableLabel label="Shares n/a" detail="Shares tidak tersedia dari platform untuk konten ini." />}</Space> },
    {
      title: "ER",
      dataIndex: "engagement",
      key: "engagement",
      align: "right",
      render: (value: number, row) => <Text strong style={{ color: row.isBest ? "#635bff" : "#263247" }}>{formatEngagementRate(value)}</Text>,
    },
    {
      title: "Preview",
      key: "preview",
      align: "right",
      responsive: ["md"],
      render: (_, row) => <ContentPreviewLink url={row.url} />,
    },
  ];

  const handleAnalyze = async () => {
    const trimmedProfileUrl = profileUrl.trim();
    if (!trimmedProfileUrl) {
      setInputError("Masukkan tautan profil terlebih dahulu.");
      messageApi.warning("Masukkan tautan profil terlebih dahulu.");
      return;
    }
    const detected = detectPlatform(profileUrl);
    if (!detected) {
      setInputError("Gunakan link profil Instagram, TikTok, atau YouTube.");
      messageApi.error("Platform belum dikenali dari link tersebut.");
      return;
    }
    setInputError("");
    setAnalyzing(true);
    try {
      const response = await fetch("/api/engagement/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrl: trimmedProfileUrl }),
      });
      const payload = await response.json() as { data?: AnalysisSnapshot; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Analisis belum dapat diproses.");
      setAnalysis(payload.data);
      setResultSaved(false);
      setPlatform(displayPlatform(payload.data.account.platform));
      setContentTypeFilter("Semua");
      setLastAnalyzed("Baru saja");
      if (payload.data.dataAvailability.shares === "partial") {
        messageApi.warning("Analisis selesai dengan data parsial: shares tidak tersedia untuk sebagian konten.");
      } else {
        messageApi.success("Analisis mock berhasil diperbarui.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analisis belum dapat diproses.";
      setInputError(message);
      messageApi.error(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveAnalysis = async () => {
    if (resultSaved || savingResult) return;
    const trimmedProfileUrl = profileUrl.trim();
    const account = analysis?.account || defaultAccount;
    const contents = analysis
      ? analysis.contents.map((content) => ({
          views: content.views,
          likes: content.likes,
          comments: content.comments,
          shares: content.shares,
          unavailableFields: content.shares === null ? ["shares"] : [],
        }))
      : contentRows.map((row) => ({
          views: row.views,
          likes: row.likes,
          comments: row.comments,
          shares: row.shares,
          unavailableFields: row.shares === null ? ["shares"] : [],
        }));

    setSavingResult(true);
    try {
      const response = await fetch("/api/engagement/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileUrl: trimmedProfileUrl,
          account: {
            platform: account.platform,
            username: account.username,
            profileUrl: analysis?.account.profileUrl || trimmedProfileUrl,
            followersCount: account.followersCount,
            totalInteractions: account.totalInteractions,
          },
          summary: analysis?.summary || defaultSummary,
          contents,
          source: { mode: analysis?.source?.mode || "mock" },
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Riwayat belum dapat disimpan.");
      setResultSaved(true);
      messageApi.success("Hasil analisis disimpan ke riwayat.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Riwayat belum dapat disimpan.";
      messageApi.error(errorMessage);
    } finally {
      setSavingResult(false);
    }
  };

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    setActiveMenu(key);
    setMobileMenuOpen(false);
    if (["content", "types", "history", "sources", "insights"].includes(key)) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const profileMenu: MenuProps["items"] = [
    { key: "profile", icon: <UserOutlined />, label: "Profil saya" },
    { key: "settings", icon: <SettingOutlined />, label: "Pengaturan" },
    { type: "divider" },
    { key: "logout", icon: <LogoutOutlined />, label: "Keluar" },
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#635bff",
          colorInfo: "#635bff",
          colorText: "#263247",
          colorTextSecondary: "#7e879b",
          colorBgLayout: "#f6f7fb",
          colorBorderSecondary: "#edf0f5",
          borderRadius: 12,
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        components: {
          Layout: { headerBg: "#ffffff", siderBg: "#ffffff" },
          Menu: { itemSelectedBg: "#eeedff", itemSelectedColor: "#635bff", itemColor: "#7e879b", itemHoverColor: "#263247", itemHoverBg: "#f7f7fb" },
          Card: { headerFontSize: 16 },
          Table: { headerBg: "#fafbfe", headerColor: "#7e879b", rowHoverBg: "#fafaff" },
        },
      }}
    >
      <AntApp>
        {contextHolder}
        <Layout className="engagement-app-shell">
          <Sider breakpoint="lg" collapsedWidth={0} width={252} className="engagement-sider">
            <div className="engagement-brand">
              <div className="engagement-brand-mark"><AreaChartOutlined /></div>
              <div><Text strong className="engagement-brand-name">PulseCheck</Text><Text className="engagement-brand-subtitle">ENGAGEMENT ANALYTICS</Text></div>
            </div>
            <div className="engagement-sider-label">Workspace</div>
            <Menu mode="inline" selectedKeys={[activeMenu]} items={menuItems} onClick={handleMenuClick} className="engagement-nav" />
            <div className="engagement-sider-footer">
              <Dropdown menu={{ items: profileMenu }} trigger={["click"]}>
                <button className="engagement-profile-button" type="button">
                  <AccountAvatar size={36} />
                  <span><Text strong>Angga K.</Text><Text type="secondary">Workspace owner</Text></span>
                  <MoreOutlined />
                </button>
              </Dropdown>
            </div>
          </Sider>
          <Layout>
            <Header className="engagement-header">
              <div className="engagement-mobile-brand"><Button type="text" icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} aria-label="Buka menu" /><Text strong>PulseCheck</Text></div>
              <div className="engagement-breadcrumb"><Text type="secondary">Workspace</Text><span>/</span><Text strong>{activeMenu === "content" ? "Rincian konten" : activeMenu === "types" ? "Perbandingan" : activeMenu === "history" ? "Riwayat analisis" : activeMenu === "sources" ? "Sumber data" : activeMenu === "insights" ? "Wawasan Cerdas" : "Dashboard analisis"}</Text></div>
              <Space size={18} className="engagement-header-actions">
                <Tooltip title="Notifikasi"><Badge count={3} size="small"><Button type="text" shape="circle" icon={<BellOutlined />} aria-label="Notifikasi" /></Badge></Tooltip>
                <span className="engagement-header-divider" aria-hidden="true" />
                <Dropdown menu={{ items: profileMenu }} trigger={["click"]}>
                  <button className="engagement-header-profile" type="button"><AccountAvatar size={32} /><span><Text strong>Angga K.</Text><Text type="secondary">Owner</Text></span></button>
                </Dropdown>
              </Space>
            </Header>
            <Drawer title="PulseCheck" placement="left" open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} className="engagement-mobile-drawer" size={280}>
              <div className="engagement-sider-label">Workspace</div>
              <Menu mode="inline" selectedKeys={[activeMenu]} items={menuItems} onClick={handleMenuClick} />
            </Drawer>
            <Content className="engagement-content">
              {activeMenu === "insights" ? (
                <SmartInsightsPage profileUrl={profileUrl} onBack={() => { setActiveMenu("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
              ) : activeMenu === "sources" ? (
                <PublicDataSourcesPage onBack={() => { setActiveMenu("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
              ) : activeMenu === "history" ? (
                <AnalysisHistoryPage
                  items={historyItems}
                  loading={historyLoading}
                  source={historySource}
                  onStart={() => { setActiveMenu("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  onReuse={(item) => { setProfileUrl(item.profileUrl); setPlatform(item.platform); setActiveMenu("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); messageApi.success(`Tautan @${item.username} siap dianalisis lagi.`); }}
                />
              ) : activeMenu === "content" ? (
                <ContentDetailsPage
                  rows={displayedRows}
                  platform={currentPlatform}
                  username={currentAccount.username}
                  lastAnalyzed={lastAnalyzed}
                  onBack={() => { setActiveMenu("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                />
              ) : activeMenu === "types" ? (
                <ComparisonPage
                  mode={comparisonMode}
                  onModeChange={setComparisonMode}
                  typeStats={filteredTypeStats}
                  allTypeStats={displayedTypeStats}
                  selectedType={contentTypeFilter}
                  onTypeChange={setContentTypeFilter}
                  primary={{ profileUrl, platform: currentPlatform, username: currentAccount.username, followersCount: currentAccount.followersCount, erAverage: currentSummary.erAverage, erWeighted: currentSummary.erWeighted, totalInteractions: currentAccount.totalInteractions }}
                  initialCompetitorUrls={["https://www.tiktok.com/@kopikenangan", "https://www.youtube.com/@designwithme"]}
                  onBack={() => { setActiveMenu("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                />
              ) : (
                <>
              <div className="engagement-page-heading">
                <div>
                  <Text className="engagement-eyebrow">SELASA, 2 SEPTEMBER 2026</Text>
                  <Title level={1}>Dashboard analisis</Title>
                  <Text type="secondary">Pantau performa konten dan temukan pola engagement akunmu.</Text>
                </div>
                <div className="engagement-page-heading-actions">
                  <Button type={resultSaved ? "default" : "primary"} icon={resultSaved ? <CheckCircleFilled /> : <SaveOutlined />} loading={savingResult} disabled={resultSaved} onClick={() => { void handleSaveAnalysis(); }}>{resultSaved ? "Tersimpan di riwayat" : "Simpan hasil"}</Button>
                </div>
              </div>

              <Card className="engagement-analyze-card" variant="borderless">
                <div className="engagement-analyze-copy">
                  <div className="engagement-analyze-icon"><LinkOutlined /></div>
                  <div><Title level={4}>Mulai analisis baru</Title><Text type="secondary">Masukkan link profil publik untuk melihat performa 20 konten terbaru.</Text></div>
                </div>
                <div className="engagement-analyze-form">
                  <Input
                    size="large"
                    type="url"
                    prefix={<LinkOutlined />}
                    value={profileUrl}
                    status={inputError ? "error" : undefined}
                    onChange={(event) => { const value = event.target.value; setProfileUrl(value); setInputError(""); const detected = detectPlatform(value); if (detected) setPlatform(detected); }}
                    onPressEnter={handleAnalyze}
                    autoComplete="url"
                    placeholder="https://instagram.com/namaakun"
                    aria-label="Link profil akun"
                  />
                  <Button type="primary" size="large" loading={analyzing} onClick={handleAnalyze}>Analisis sekarang</Button>
                </div>
                {inputError && <Text type="danger" className="engagement-input-error" role="alert">{inputError}</Text>}
                <div className="engagement-detected-platform"><Text type="secondary">Platform terdeteksi:</Text><PlatformPill platform={currentPlatform} /><Text type="secondary" className="engagement-last-analyzed">Analisis terakhir {lastAnalyzed}</Text></div>
              </Card>

              <Alert className="engagement-mock-alert" type="info" showIcon icon={<LinkOutlined />} title={<span><strong>Analisis link publik.</strong> Tempel link profil tanpa login; jika metadata halaman tidak terbuka, aplikasi memakai data preview dan menandainya secara transparan.</span>} closable />

              <div className="engagement-stats-grid">
                <Card variant="borderless" className="engagement-stat-card engagement-stat-primary"><Statistic title="ER rata-rata" value={currentSummary.erAverage} precision={2} suffix="%" prefix={<RiseOutlined />} /><Text className="engagement-stat-caption">20 konten terbaru</Text></Card>
                <Card variant="borderless" className="engagement-stat-card"><Statistic title="ER median" value={currentSummary.erMedian} precision={2} suffix="%" /><Text className="engagement-stat-caption">Nilai tengah 20 konten terbaru</Text></Card>
                <Card variant="borderless" className="engagement-stat-card"><Statistic title="Weighted ER" value={currentSummary.erWeighted} precision={2} suffix="%" prefix={<FireFilled />} /><Text className="engagement-stat-caption">Berbobot berdasarkan views</Text></Card>
                <Card variant="borderless" className="engagement-stat-card engagement-account-stat-card">
                  <div className="engagement-account-stat-heading"><div><Text className="engagement-account-label">METRIK AKUN</Text><Text type="secondary">@{currentAccount.username}</Text></div><PlatformPill platform={currentPlatform} /></div>
                  <div className="engagement-account-stat-grid"><div><Text type="secondary">{currentPlatform === "YouTube" ? "Subscribers" : "Followers"}</Text><strong title={fullNumber(currentAccount.followersCount)} aria-label={`${fullNumber(currentAccount.followersCount)} ${currentPlatform === "YouTube" ? "subscribers" : "followers"}`}>{compactNumber(currentAccount.followersCount)}</strong><Text className="engagement-stat-caption">Data terbaru</Text></div><div><Text type="secondary">Total interaksi</Text><strong>{compactNumber(currentAccount.totalInteractions)}</strong><Text className="engagement-stat-caption">20 konten terbaru</Text></div></div>
                </Card>
              </div>

              <Row gutter={[20, 20]} className="engagement-main-grid">
                <Col xs={24} xl={15}>
                  <Card variant="borderless" className="engagement-panel-card" title={<div><Title level={4}>Tren engagement rate</Title><Text type="secondary">Perubahan ER rata-rata dalam periode analisis</Text></div>} extra={<Segmented size="small" options={["7 hari", "30 hari", "90 hari"]} value={period} onChange={(value) => setPeriod(String(value))} />}>
                    <div className="engagement-chart-summary"><div><Text type="secondary">ER rata-rata saat ini</Text><div className="engagement-chart-value">{formatEngagementRate(currentSummary.erAverage)}</div></div><Tag variant="filled" color="green">Dari 20 konten</Tag></div>
                    <TrendChart />
                  </Card>
                </Col>
                <Col xs={24} xl={9}>
                  <Card variant="borderless" className="engagement-panel-card engagement-types-card" id="content-types" title={<div><Title level={4}>Performa tipe konten</Title><Text type="secondary">Rata-rata ER berdasarkan format</Text></div>} extra={<Button type="link" size="small" onClick={() => setActiveMenu("types")}>Lihat semua</Button>}>
                    <div className="engagement-type-list">{displayedTypeStats.map((item) => <div key={item.label} className="engagement-type-row"><div className="engagement-type-heading"><Space size={8}><span className="engagement-type-dot" style={{ background: item.color }} /><Text strong>{item.label}</Text><Text type="secondary">{item.count} konten</Text></Space><Text strong>{formatEngagementRate(item.engagement)}</Text></div><Progress percent={Math.min(100, Math.round(item.engagement * 10))} showInfo={false} strokeColor={item.color} railColor="#f0f1f6" size="small" /></div>)}</div>
                    <Divider />
                    <div className="engagement-best-format"><div className="engagement-best-icon"><FireFilled /></div><div><Text type="secondary">Format terbaik</Text><Text strong>{bestFormat} menghasilkan ER tertinggi</Text></div><ArrowUpOutlined className="engagement-best-arrow" /></div>
                  </Card>
                </Col>
              </Row>

              <Card variant="borderless" className="engagement-panel-card engagement-table-card" id="content-detail" title={<div><Title level={4}>Konten terbaru</Title><Text type="secondary">Preview {visibleRows.length} dari {displayedRows.length} konten <strong>@{currentAccount.username}</strong> yang menjadi dasar perhitungan ER</Text></div>} extra={<Button type="link" onClick={() => messageApi.info("Rincian lengkap akan tersedia di fase berikutnya.")}>Lihat semua <ArrowUpOutlined /></Button>}>
                <Table<ContentRow> columns={columns} dataSource={visibleRows} pagination={false} scroll={{ x: 720 }} />
                <div className="engagement-table-footer"><Text type="secondary"><CheckCircleFilled /> {displayedRows.length} konten berhasil dianalisis</Text><Text type="secondary"><ClockCircleOutlined /> Diperbarui {lastAnalyzed.toLowerCase()}</Text></div>
              </Card>

              <Row gutter={[20, 20]} className="engagement-bottom-grid">
                <Col xs={24} lg={14}><Card variant="borderless" className="engagement-panel-card engagement-best-card"><div className="engagement-best-content"><div className="engagement-best-thumbnail"><ContentThumbnail tone={bestRow.tone} type={bestRow.type} thumbnailUrl={bestRow.thumbnailUrl} /><span className="engagement-best-ribbon"><FireFilled /> Konten terbaik</span></div><div className="engagement-best-details"><SectionLabel>TOP PERFORMER · {bestRow.type.toUpperCase()}</SectionLabel><Title level={3}>{bestRow.title}</Title><Text type="secondary">{bestRow.caption || "Caption belum tersedia dari sumber publik."}</Text><div className="engagement-best-metrics"><div><Text type="secondary">Engagement rate</Text><strong>{formatEngagementRate(bestRow.engagement)}</strong></div><div><Text type="secondary">Total interaksi</Text><strong>{compactNumber(bestRow.likes + bestRow.comments + (bestRow.shares || 0))}</strong></div><div><Text type="secondary">Views</Text><strong>{compactNumber(bestRow.views)}</strong></div></div><ContentPreviewLink url={bestRow.url} /></div></div></Card></Col>
                <Col xs={24} lg={10}><Card variant="borderless" className="engagement-panel-card engagement-data-note-card" title={<div><Title level={4}>Catatan data</Title><Text type="secondary">Informasi tentang ketersediaan metrik</Text></div>}><Space orientation="vertical" size={14} className="engagement-data-notes"><div><Badge status="success" /><span>Views, likes, dan comments tersedia</span></div><div><Badge status="success" /><span>{currentPlatform === "YouTube" ? "Subscribers" : "Followers"} terakhir diperbarui hari ini</span></div><div><Badge status={sharesArePartial ? "warning" : "success"} /><span>{sharesArePartial ? "Shares tidak tersedia di sebagian konten" : "Shares tersedia untuk seluruh konten"}</span></div></Space><Alert type={sharesArePartial ? "warning" : "success"} showIcon title={dataAvailabilityMessage} /></Card></Col>
              </Row>
                </>
              )}
            </Content>
          </Layout>
        </Layout>
      </AntApp>
    </ConfigProvider>
  );
}
