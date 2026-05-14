import { useState } from "react";
import {
  AlertCircle, AlertTriangle, Archive, ArrowLeft, ArrowRight, ArrowUpDown, Award,
  BadgeCheck, BarChart3, Bell, BookOpen, Briefcase, Building2, Calendar, CalendarCheck,
  CalendarClock, CalendarOff, CalendarX, Check, CheckCircle, CheckSquare, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, ClipboardList, Clock, Clock3, CloudUpload,
  Copy, CreditCard, Download, Edit, ExternalLink, Eye, EyeOff, FileCheck, FileText,
  Filter, Flag, Globe, Hash, HeartPulse, HelpCircle, History, Home, Hospital,
  Info, Languages, LayoutDashboard, Link, ListChecks, Lock, LogOut, Mail, Map,
  MapPin, MessageCircle, MessageSquare, Mic, Moon, MoreHorizontal, MoreVertical,
  Paperclip, ParkingCircle, Pencil, Phone, PhoneCall, Pin, Plus, Printer,
  RefreshCw, Save, Search, Send, Settings, ShieldCheck, Star, StickyNote, Sun,
  Trash2, Upload, User, UserCheck, UserMinus, UserPlus, UserSquare2, Users,
  Video, XCircle, ZoomIn,
} from "lucide-react";
import { Input } from "../../components/ui/input.js";
import { PageHeader } from "../../components/shared/PageHeader.js";

const IN_USE = [
  { name: "AlertCircle", icon: AlertCircle },
  { name: "AlertTriangle", icon: AlertTriangle },
  { name: "BarChart3", icon: BarChart3 },
  { name: "Building2", icon: Building2 },
  { name: "Calendar", icon: Calendar },
  { name: "CalendarOff", icon: CalendarOff },
  { name: "Check", icon: Check },
  { name: "CheckCircle", icon: CheckCircle },
  { name: "ChevronDown", icon: ChevronDown },
  { name: "ChevronLeft", icon: ChevronLeft },
  { name: "ChevronRight", icon: ChevronRight },
  { name: "ChevronUp", icon: ChevronUp },
  { name: "ClipboardList", icon: ClipboardList },
  { name: "Clock", icon: Clock },
  { name: "Download", icon: Download },
  { name: "ExternalLink", icon: ExternalLink },
  { name: "Eye", icon: Eye },
  { name: "EyeOff", icon: EyeOff },
  { name: "FileText", icon: FileText },
  { name: "LayoutDashboard", icon: LayoutDashboard },
  { name: "LogOut", icon: LogOut },
  { name: "Mail", icon: Mail },
  { name: "MapPin", icon: MapPin },
  { name: "MessageSquare", icon: MessageSquare },
  { name: "ParkingCircle", icon: ParkingCircle },
  { name: "Pencil", icon: Pencil },
  { name: "Plus", icon: Plus },
  { name: "RefreshCw", icon: RefreshCw },
  { name: "Save", icon: Save },
  { name: "Search", icon: Search },
  { name: "Send", icon: Send },
  { name: "Settings", icon: Settings },
  { name: "ShieldCheck", icon: ShieldCheck },
  { name: "StickyNote", icon: StickyNote },
  { name: "Trash2", icon: Trash2 },
  { name: "Upload", icon: Upload },
  { name: "User", icon: User },
  { name: "UserSquare2", icon: UserSquare2 },
  { name: "Users", icon: Users },
  { name: "XCircle", icon: XCircle },
];

const AVAILABLE = [
  { name: "Archive", icon: Archive },
  { name: "ArrowLeft", icon: ArrowLeft },
  { name: "ArrowRight", icon: ArrowRight },
  { name: "ArrowUpDown", icon: ArrowUpDown },
  { name: "Award", icon: Award },
  { name: "BadgeCheck", icon: BadgeCheck },
  { name: "Bell", icon: Bell },
  { name: "BookOpen", icon: BookOpen },
  { name: "Briefcase", icon: Briefcase },
  { name: "CalendarCheck", icon: CalendarCheck },
  { name: "CalendarClock", icon: CalendarClock },
  { name: "CalendarX", icon: CalendarX },
  { name: "CheckSquare", icon: CheckSquare },
  { name: "Clock3", icon: Clock3 },
  { name: "CloudUpload", icon: CloudUpload },
  { name: "Copy", icon: Copy },
  { name: "CreditCard", icon: CreditCard },
  { name: "Edit", icon: Edit },
  { name: "FileCheck", icon: FileCheck },
  { name: "Filter", icon: Filter },
  { name: "Flag", icon: Flag },
  { name: "Globe", icon: Globe },
  { name: "Hash", icon: Hash },
  { name: "HeartPulse", icon: HeartPulse },
  { name: "HelpCircle", icon: HelpCircle },
  { name: "History", icon: History },
  { name: "Home", icon: Home },
  { name: "Hospital", icon: Hospital },
  { name: "Info", icon: Info },
  { name: "Languages", icon: Languages },
  { name: "Link", icon: Link },
  { name: "ListChecks", icon: ListChecks },
  { name: "Lock", icon: Lock },
  { name: "Map", icon: Map },
  { name: "MessageCircle", icon: MessageCircle },
  { name: "Mic", icon: Mic },
  { name: "Moon", icon: Moon },
  { name: "MoreHorizontal", icon: MoreHorizontal },
  { name: "MoreVertical", icon: MoreVertical },
  { name: "Paperclip", icon: Paperclip },
  { name: "Phone", icon: Phone },
  { name: "PhoneCall", icon: PhoneCall },
  { name: "Pin", icon: Pin },
  { name: "Printer", icon: Printer },
  { name: "Star", icon: Star },
  { name: "Sun", icon: Sun },
  { name: "UserCheck", icon: UserCheck },
  { name: "UserMinus", icon: UserMinus },
  { name: "UserPlus", icon: UserPlus },
  { name: "Video", icon: Video },
  { name: "ZoomIn", icon: ZoomIn },
];

function IconGrid({ icons, filter }: { icons: typeof IN_USE; filter: string }) {
  const filtered = filter
    ? icons.filter((i) => i.name.toLowerCase().includes(filter.toLowerCase()))
    : icons;

  if (filtered.length === 0) return <p className="text-sm text-muted-foreground col-span-full">No matches</p>;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
      {filtered.map(({ name, icon: Icon }) => (
        <button
          key={name}
          type="button"
          onClick={() => navigator.clipboard.writeText(name)}
          title={`Copy "${name}"`}
          className="flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center hover:bg-muted transition-colors"
        >
          <Icon className="h-6 w-6 text-foreground" />
          <span className="text-[10px] text-muted-foreground leading-tight break-all">{name}</span>
        </button>
      ))}
    </div>
  );
}

export function IconGalleryPage() {
  const [filter, setFilter] = useState("");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Icon Gallery"
        description="Click any icon to copy its name. All icons are from lucide-react."
      />

      <div className="max-w-sm">
        <Input
          placeholder="Filter icons..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Currently in use ({IN_USE.filter((i) => !filter || i.name.toLowerCase().includes(filter.toLowerCase())).length})
        </h2>
        <IconGrid icons={IN_USE} filter={filter} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Available ({AVAILABLE.filter((i) => !filter || i.name.toLowerCase().includes(filter.toLowerCase())).length})
        </h2>
        <IconGrid icons={AVAILABLE} filter={filter} />
      </section>
    </div>
  );
}
