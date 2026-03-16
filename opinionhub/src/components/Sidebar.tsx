import React from "react";
import { 
  Home, 
  TrendingUp, 
  Users, 
  Bookmark, 
  Settings, 
  LogOut, 
  PlusCircle,
  BarChart3
} from "lucide-react";
import { User } from "../types";

interface SidebarProps {
  user: User | null;
  onLogout: () => void;
  onCreatePoll: () => void;
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ user, onLogout, onCreatePoll, currentView, onViewChange }: SidebarProps) {
  const menuItems = [
    { icon: Home, label: "Feed", id: "feed" },
    { icon: TrendingUp, label: "Trending", id: "trending" },
    { icon: Users, label: "Communities", id: "communities" },
    { icon: Bookmark, label: "Saved", id: "saved" },
    { icon: BarChart3, label: "My Polls", id: "mypolls" },
    { icon: Settings, label: "Settings", id: "settings" },
  ];

  return (
    <div className="hidden md:flex fixed left-0 top-0 h-screen w-72 bg-white/60 backdrop-blur-xl border-r border-purple-100/50 p-6 flex-col z-40 select-none shadow-[2px_0_16px_rgba(147,51,234,0.05)]">
      <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer" onClick={() => onViewChange("feed")}>
        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-md shadow-purple-500/20">
          <BarChart3 className="text-white w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-950 to-purple-700 tracking-tight">
          OpinionHub
        </h1>
      </div>

      <button 
        onClick={onCreatePoll}
        className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-md shadow-purple-500/20 transition-all active:scale-95 mb-8"
      >
        <PlusCircle className="w-5 h-5" />
        Create Poll
      </button>

      <nav className="flex-1 space-y-1.5">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
              currentView === item.id 
                ? "bg-purple-100/60 text-purple-800 font-semibold" 
                : "text-purple-600/70 hover:bg-purple-50/60 hover:text-purple-800 font-medium"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {user && (
        <div className="mt-auto pt-6 border-t border-purple-100/50">
          <div 
            className="flex items-center gap-3 px-2 mb-4 cursor-pointer hover:bg-purple-50/60 p-2 rounded-xl transition-all"
            onClick={() => onViewChange("profile")}
          >
            <img 
              src={user.avatar} 
              alt={user.username} 
              className="w-10 h-10 rounded-full border border-purple-200"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-purple-900 truncate">{user.username}</p>
              <p className="text-xs text-purple-500/80 truncate">{user.bio || "Premium Member"}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-purple-600/70 hover:text-red-600 hover:bg-red-50/80 rounded-xl transition-all font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}
