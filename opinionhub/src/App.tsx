import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Bell, User as UserIcon, LogIn, UserPlus, Edit3, MapPin, Calendar, Link as LinkIcon, Home, TrendingUp, Users, Bookmark, BarChart3, PlusCircle } from "lucide-react";
import { Toaster, toast } from "sonner";
import Sidebar from "./components/Sidebar";
import PollCard from "./components/PollCard";
import CreatePollModal from "./components/CreatePollModal";
import ProfileEditModal from "./components/ProfileEditModal";
import PublicProfileModal from "./components/PublicProfileModal";
import { User, Poll, Community } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [currentView, setCurrentView] = useState("feed");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<any[]>([
    { id: 1, type: 'system', sender: 'System', message: 'Welcome to OpinionHub! Start by creating your first poll.', timestamp: new Date().toISOString(), isRead: false }
  ]);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPolls = async (view = currentView) => {
    setIsLoading(true);
    let url = "/api/polls";
    if (view === "trending") url = "/api/polls/trending";
    if (view === "mypolls") url = "/api/polls/me";
    if (view === "saved") url = "/api/polls/saved";
    
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch polls");
      const data = await res.json();
      setPolls(data);

      if (view === "feed" && user) {
        const readNotifs = JSON.parse(localStorage.getItem(`read_notifs_${user.username}`) || '[]');
        const systemNotif = { 
          id: 0, 
          type: 'system', 
          sender: 'System', 
          message: 'Welcome to OpinionHub! Start by creating your first poll.', 
          timestamp: new Date().toISOString(), 
          isRead: readNotifs.includes(0) 
        };
        
        const historicalNotifs = data
          .filter((p: any) => p.creator_name !== user.username)
          .slice(0, 5)
          .map((p: any) => ({
            id: p.id,
            type: 'poll',
            sender: p.creator_name,
            message: `created a new poll: "${p.title}"`,
            timestamp: p.created_at,
            isRead: readNotifs.includes(p.id)
          }));
          
        setNotifications([systemNotif, ...historicalNotifs]);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const fetchCommunities = async () => {
    try {
      const res = await fetch("/api/communities");
      if (!res.ok) throw new Error("Failed to fetch communities");
      const data = await res.json();
      setCommunities(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUser();
    
    // Setup SSE connection
    const eventSource = new EventSource("/api/notifications/stream");
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_POLL' && (user?.username !== data.username)) {
          
          setNotifications(prev => {
            const exists = prev.find(n => n.id === data.pollId);
            if (exists) return prev;
            return [{
              id: data.pollId,
              type: 'poll',
              sender: data.username,
              message: 'just created a new poll!',
              timestamp: data.timestamp || new Date().toISOString(),
              isRead: false
            }, ...prev];
          });

          toast.info(`${data.username} just created a new poll!`, {
            description: "Check out the social feed",
            icon: <Bell className="w-4 h-4 text-purple-600" />,
            action: {
              label: 'View',
              onClick: () => setCurrentView('feed')
            }
          });
        }
      } catch (err) {
        console.error("Failed to parse SSE data", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [user?.username]);

  useEffect(() => {
    if (currentView === "communities") {
      fetchCommunities();
    } else if (currentView !== "profile") {
      fetchPolls();
    }
  }, [currentView]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUser(data);
      setIsAuthModalOpen(false);
      toast.success(authMode === "login" ? "Welcome back!" : "Account created successfully!");
      fetchPolls();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setCurrentView("feed");
    toast.success("Logged out successfully");
    fetchPolls("feed");
  };

  const handleCreatePoll = async (data: { title: string; description: string; choices: string[] }) => {
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("New poll created successfully!");
      fetchPolls();
    } else {
      toast.error("Failed to create poll");
      throw new Error("Failed to create poll");
    }
  };

  const handleVote = async (pollId: number, choiceId: number) => {
    const res = await fetch(`/api/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choiceId }),
    });
    if (!res.ok) {
      toast.error("Failed to record vote");
      throw new Error("Failed to vote");
    }
    toast.success("Vote recorded!");
  };

  const handleUpdateProfile = async (data: { username: string; bio: string; avatar: string }) => {
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Profile updated successfully!");
      fetchUser();
    } else {
      toast.error("Failed to update profile");
      throw new Error("Failed to update profile");
    }
  };

  const handleViewChange = (view: string) => {
    if (view === "settings") {
      if (user) {
        setCurrentView("settings");
      } else {
        setIsAuthModalOpen(true);
      }
      return;
    }
    
    if (view === "saved" && !user) {
      setIsAuthModalOpen(true);
      return;
    }
    
    setCurrentView(view);
  };

  const renderContent = () => {
    if (currentView === "communities") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {communities.map((community) => (
            <motion.div
              key={community.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-purple-100/50 shadow-sm shadow-purple-500/5 hover:shadow-md hover:shadow-purple-500/10 transition-all group"
            >
              <div className="h-32 overflow-hidden">
                <img src={community.image} alt={community.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-purple-950 mb-2">{community.name}</h3>
                <p className="text-purple-600/70 text-sm mb-4">{community.description}</p>
                <button 
                  onClick={() => toast.success(`Joined ${community.name}!`)}
                  className="px-4 py-2 bg-purple-100/50 text-purple-900 rounded-xl font-semibold hover:bg-purple-200 transition-all"
                >
                  Join Community
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      );
    }
    
    if (currentView === "saved" && polls.length === 0 && !isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 bg-white/40 backdrop-blur-md rounded-2xl border border-dashed border-purple-200">
          <Bookmark className="w-16 h-16 text-purple-300 mb-4" />
          <h3 className="text-xl font-bold text-purple-900 mb-2">No Saved Polls</h3>
          <p className="text-purple-600/70">When you bookmark a poll, it will appear here so you can easily find it later.</p>
        </div>
      );
    }

    if (currentView === "profile" && user) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-purple-100/50 shadow-sm shadow-purple-500/5 overflow-hidden mb-8">
            <div className="h-48 bg-gradient-to-r from-purple-600 to-fuchsia-600" />
            <div className="px-8 pb-8">
              <div className="relative -mt-16 mb-6 flex justify-between items-end">
                <img 
                  src={user.avatar} 
                  alt={user.username} 
                  className="w-32 h-32 rounded-full border-4 border-white shadow-md shadow-purple-500/20"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setIsProfileEditOpen(true)}
                  className="px-6 py-2.5 bg-white/60 backdrop-blur-md border border-purple-200 rounded-xl font-semibold hover:bg-white transition-all flex items-center gap-2 text-purple-900"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Profile
                </button>
              </div>
              <h2 className="text-3xl font-bold text-purple-950 mb-1">{user.username}</h2>
              <p className="text-purple-600/70 mb-4">@{user.username.toLowerCase()}</p>
              <p className="text-purple-900/80 mb-6 max-w-xl">{user.bio || "No bio yet. Tell the world about yourself!"}</p>
              
              <div className="flex flex-wrap gap-6 text-sm text-purple-600/70">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Global Citizen
                </div>
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  insightflow.io/{user.username.toLowerCase()}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Joined March 2026
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-bold text-purple-950 mb-4">My Activity</h3>
            <div className="grid grid-cols-1 gap-6">
              <p className="text-center text-purple-600/70 py-12 bg-white/40 backdrop-blur-md rounded-2xl border border-dashed border-purple-200">
                No recent activity to show.
              </p>
            </div>
          </div>
        </motion.div>
      );
    }

    if (currentView === "settings" && user) {
      return (
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="max-w-2xl mx-auto"
        >
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-purple-100/50 shadow-sm shadow-purple-500/5 overflow-hidden mb-8 p-8">
            <h2 className="text-2xl font-bold text-purple-950 mb-6 border-b border-purple-100 pb-4">Account Settings</h2>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const password = formData.get('password') as string;
              
              const updateData: any = {
                 username: user.username,
                 bio: user.bio,
                 avatar: user.avatar
              };
              if (password) updateData.password = password;
              
              try {
                await handleUpdateProfile(updateData);
                if (password) {
                  const form = e.target as HTMLFormElement;
                  form.reset();
                  toast.success("Password updated successfully!");
                }
              } catch(err) {
                 // error toasted in handleUpdateProfile
              }
            }} className="space-y-6">
              
              <div>
                <label className="block text-sm font-semibold text-purple-900/80 mb-2">Change Password</label>
                <input
                  type="password"
                  name="password"
                  placeholder="Leave blank to keep current password"
                  className="w-full px-4 py-3 bg-white/60 backdrop-blur-md rounded-xl border border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all shadow-sm placeholder:text-purple-400/50"
                />
              </div>

              <div className="pt-4 border-t border-purple-100 flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setIsProfileEditOpen(true)}
                  className="px-6 py-3 bg-purple-50 text-purple-700 rounded-xl font-semibold hover:bg-purple-100 transition-all border border-purple-200/50"
                >
                  Edit Profile Info
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-fuchsia-700 transition-all shadow-md shadow-purple-500/20"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      );
    }

    const filteredPolls = polls.filter(poll => 
      poll.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      poll.creator_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (poll.description && poll.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
      <motion.div 
        layout
        className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6"
      >
        <AnimatePresence mode="popLayout">
          {filteredPolls.length > 0 ? (
            filteredPolls.map((poll) => (
              <div key={poll.id} className="break-inside-avoid">
                <PollCard 
                  poll={poll} 
                  onVote={handleVote} 
                  isLoggedIn={!!user}
                  onProfileClick={setSelectedProfileId}
                />
              </div>
            ))
          ) : (
            <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-12 text-purple-600/70 bg-white/40 backdrop-blur-md rounded-2xl border border-dashed border-purple-200 break-inside-avoid">
              No polls found matching "{searchQuery}"
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 text-slate-900 font-sans selection:bg-purple-200 selection:text-purple-900">
      {/* Decorative background blurs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-300/30 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-300/30 blur-[100px] pointer-events-none" />
      
      <Toaster position="top-center" richColors />
      <Sidebar 
        user={user} 
        onLogout={handleLogout} 
        onCreatePoll={() => user ? setIsCreateModalOpen(true) : setIsAuthModalOpen(true)} 
        currentView={currentView}
        onViewChange={handleViewChange}
      />

      <main className="md:pl-72 pb-20 md:pb-0 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-purple-100/50 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-4 select-none shadow-[0_4px_24px_-8px_rgba(147,51,234,0.15)]">
          {/* Mobile Logo */}
          <div className="md:hidden flex items-center gap-2 flex-shrink-0 cursor-pointer" onClick={() => setCurrentView("feed")}>
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-lg flex items-center justify-center shadow-md shadow-purple-500/20">
              <BarChart3 className="text-white w-5 h-5" />
            </div>
          </div>

          <div className="relative flex-1 md:w-96 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 w-4 h-4 md:w-5 md:h-5" />
            <input 
              type="text" 
              placeholder="Search polls or users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white/60 backdrop-blur-md border border-purple-100/50 focus:bg-white/90 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl outline-none transition-all text-sm placeholder:text-purple-400/70 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 text-purple-600/70 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition-all relative"
              >
                <Bell className="w-6 h-6" />
                {notifications.some(n => !n.isRead) && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-purple-500/10 border border-white/60 overflow-hidden z-50 select-none"
                  >
                    <div className="p-4 border-b border-purple-100/50 flex justify-between items-center bg-white/40">
                      <h3 className="font-bold text-purple-950">Notifications</h3>
                      <button 
                        onClick={() => setIsNotificationsOpen(false)}
                        className="text-xs text-purple-600/70 hover:text-purple-900 font-medium"
                      >
                        Mark all as read
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-purple-600/70 text-sm">No new notifications</div>
                      ) : (
                        notifications.map((notif: any) => (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              // Mark single as read
                              setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
                              const readNotifs = JSON.parse(localStorage.getItem(`read_notifs_${user?.username}`) || '[]');
                              if (!readNotifs.includes(notif.id)) localStorage.setItem(`read_notifs_${user?.username}`, JSON.stringify([...readNotifs, notif.id]));
                              
                              if (notif.type === 'poll') setCurrentView('feed');
                              setIsNotificationsOpen(false);
                            }}
                            className={`p-4 border-b border-white/40 hover:bg-purple-50/50 transition-colors cursor-pointer ${notif.isRead ? 'opacity-70' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${notif.isRead ? 'bg-transparent' : 'bg-purple-500'}`} />
                              <div>
                                <p className="text-sm text-purple-900/80">
                                  <span className="font-semibold text-purple-950">{notif.sender} </span>
                                  {notif.message}
                                </p>
                                <p className="text-xs text-purple-400 mt-1">
                                  {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-3 border-t border-purple-100/50 text-center bg-white/40">
                      <button 
                        onClick={() => {
                          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                          const allIds = notifications.map(n => n.id);
                          localStorage.setItem(`read_notifs_${user?.username}`, JSON.stringify(allIds));
                        }}
                        className="text-sm font-medium text-purple-900/60 hover:text-purple-900"
                      >
                        Mark all as read
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {!user ? (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-fuchsia-700 transition-all shadow-md shadow-purple-500/20 text-sm md:text-base"
              >
                <LogIn className="w-4 h-4 hidden md:block" />
                Sign In
              </button>
            ) : (
              <div 
                className="flex items-center gap-2 px-2 md:px-3 py-1.5 bg-white/70 backdrop-blur-md border border-white/60 rounded-xl shadow-sm cursor-pointer hover:bg-white/90 transition-all shadow-purple-500/5"
                onClick={() => setCurrentView("profile")}
              >
                <img src={user.avatar} className="w-8 h-8 rounded-full border border-purple-100" referrerPolicy="no-referrer" />
                <span className="text-sm font-semibold hidden md:block">{user.username}</span>
              </div>
            )}
          </div>
        </header>

        {/* Feed Content */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <div className="mb-6 md:mb-8 relative z-10">
            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-950 to-purple-700 mb-1 md:mb-2 capitalize">
              {currentView === "feed" ? "Social Feed" : currentView.replace("mypolls", "My Polls")}
            </h1>
            <p className="text-purple-600/80 font-medium text-sm md:text-base">
              {currentView === "feed" && "Discover what the community is thinking about today."}
              {currentView === "trending" && "The most discussed topics right now."}
              {currentView === "communities" && "Find your tribe and join the conversation."}
              {currentView === "mypolls" && "Manage and track your own surveys."}
              {currentView === "saved" && "Polls you've bookmarked to keep track of."}
              {currentView === "profile" && "Your personal space on OpinionHub."}
            </p>
          </div>

          {isLoading && currentView !== "profile" && currentView !== "communities" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-80 bg-white/40 backdrop-blur-md animate-pulse rounded-2xl border border-purple-100/50" />
              ))}
            </div>
          ) : renderContent()}
        </div>
      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-purple-500/20 border border-white p-8 select-none"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-purple-100/50 text-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-purple-200/50 shadow-sm">
                  {authMode === "login" ? <LogIn className="w-8 h-8" /> : <UserPlus className="w-8 h-8" />}
                </div>
                <h2 className="text-2xl font-bold text-purple-950">
                  {authMode === "login" ? "Welcome Back" : "Create Account"}
                </h2>
                <p className="text-purple-600/70 mt-2">
                  {authMode === "login" ? "Sign in to join the conversation" : "Join OpinionHub to start polling"}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-purple-900/80 mb-2">Username</label>
                  <input
                    type="text"
                    required
                    value={authForm.username}
                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                    className="w-full px-4 py-3 bg-white/60 backdrop-blur-md rounded-xl border border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all select-text shadow-sm"
                    placeholder="johndoe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-purple-900/80 mb-2">Password</label>
                  <input
                    type="password"
                    required
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    className="w-full px-4 py-3 bg-white/60 backdrop-blur-md rounded-xl border border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all select-text shadow-sm"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl font-bold shadow-md shadow-purple-500/20 transition-all mt-4"
                >
                  {authMode === "login" ? "Sign In" : "Register"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button 
                  onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                  className="text-sm font-medium text-purple-600/80 hover:text-purple-900"
                >
                  {authMode === "login" ? "Don't have an account? Register" : "Already have an account? Sign In"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CreatePollModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSubmit={handleCreatePoll} 
      />

      {user && (
        <ProfileEditModal
          isOpen={isProfileEditOpen}
          onClose={() => setIsProfileEditOpen(false)}
          user={user}
          onUpdate={handleUpdateProfile}
        />
      )}

      {selectedProfileId && (
        <PublicProfileModal
          isOpen={!!selectedProfileId}
          onClose={() => setSelectedProfileId(null)}
          userId={selectedProfileId}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-purple-100/50 flex items-center justify-around p-3 z-40 pb-safe shadow-[0_-4px_24px_-8px_rgba(147,51,234,0.15)] pb-5">
        <button onClick={() => setCurrentView("feed")} className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all ${currentView === 'feed' ? 'text-purple-700 bg-purple-100/50' : 'text-purple-400 hover:text-purple-600'}`}>
          <Home className="w-6 h-6" />
        </button>
        <button onClick={() => setCurrentView("trending")} className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all ${currentView === 'trending' ? 'text-purple-700 bg-purple-100/50' : 'text-purple-400 hover:text-purple-600'}`}>
          <TrendingUp className="w-6 h-6" />
        </button>
        <button onClick={() => user ? setIsCreateModalOpen(true) : setIsAuthModalOpen(true)} className="p-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-full shadow-lg shadow-purple-500/30 transform -translate-y-4 active:scale-95 transition-transform">
          <PlusCircle className="w-6 h-6" />
        </button>
        <button onClick={() => setCurrentView("communities")} className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all ${currentView === 'communities' ? 'text-purple-700 bg-purple-100/50' : 'text-purple-400 hover:text-purple-600'}`}>
          <Users className="w-6 h-6" />
        </button>
        <button onClick={() => setCurrentView("mypolls")} className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all ${currentView === 'mypolls' ? 'text-purple-700 bg-purple-100/50' : 'text-purple-400 hover:text-purple-600'}`}>
          <BarChart3 className="w-6 h-6" />
        </button>
      </div>

    </div>
  );
}
