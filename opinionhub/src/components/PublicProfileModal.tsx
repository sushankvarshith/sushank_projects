import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Calendar, BarChart3, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface PublicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
}

export default function PublicProfileModal({ isOpen, onClose, userId }: PublicProfileModalProps) {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      setIsLoading(true);
      fetch(`/api/users/${userId}`)
        .then(res => res.json())
        .then(data => {
          setProfile(data);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, [isOpen, userId]);

  return (
    <AnimatePresence>
      {isOpen && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-purple-500/10 border border-white overflow-hidden pt-4 pb-8"
          >
            <div className="p-6 border-b border-purple-100/50 flex flex-row items-center justify-between">
              <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-950 to-purple-700">
                User Profile
              </h2>
              <button onClick={onClose} className="text-purple-400 hover:text-purple-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {isLoading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
              </div>
            ) : (
              <div className="p-6 flex flex-col items-center gap-4 text-center">
                <img 
                  src={profile.avatar} 
                  alt={profile.username} 
                  className="w-28 h-28 rounded-full border-4 border-white shadow-md shadow-purple-500/20 object-cover"
                  referrerPolicy="no-referrer"
                />
                
                <div>
                  <h3 className="text-2xl font-bold text-purple-950">@{profile.username}</h3>
                  <div className="flex items-center justify-center gap-2 mt-2 text-sm text-purple-600/70 font-medium font-sans">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {format(new Date(profile.created_at || new Date()), "MMMM yyyy")}</span>
                  </div>
                </div>

                <div className="w-full bg-white/60 backdrop-blur-md rounded-xl border border-purple-100/50 p-4 mt-2">
                  <p className="text-purple-900/80 italic">
                    {profile.bio || "This user hasn't added a bio yet."}
                  </p>
                </div>

                <div className="w-full mt-4 flex justify-around">
                  <div className="flex flex-col items-center bg-purple-50/50 rounded-xl px-6 py-3 border border-purple-100/50">
                    <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-fuchsia-600">
                      {profile.poll_count || 0}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-500 mt-1">Polls Created</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
