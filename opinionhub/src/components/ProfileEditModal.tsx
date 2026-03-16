import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Camera, Save } from "lucide-react";
import { toast } from "sonner";
import { User } from "../types";

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdate: (data: { username: string; bio: string; avatar: string }) => Promise<void>;
}

export default function ProfileEditModal({ isOpen, onClose, user, onUpdate }: ProfileEditModalProps) {
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio || "");
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdate({ username, bio, avatar });
      onClose();
    } catch (err) {
      // Error is handled in App.tsx
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-purple-500/10 border border-white overflow-hidden select-none pt-4"
          >
            <div className="p-6 border-b border-purple-100/50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-950 to-purple-700">Edit Profile</h2>
              <button onClick={onClose} className="text-purple-400 hover:text-purple-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <label className="cursor-pointer block relative">
                    <img 
                      src={avatar} 
                      alt="Avatar" 
                      className="w-24 h-24 rounded-full border-4 border-white shadow-md shadow-purple-500/20 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-purple-900/40 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white">
                      <Camera className="w-6 h-6" />
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs text-purple-600/70">Click image to upload new picture</p>
                  <button 
                    type="button"
                    onClick={() => setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`)}
                    className="text-[10px] text-purple-400 hover:text-purple-600 transition-colors"
                  >
                    or generate random avatar
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-purple-900/80 mb-2">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-white/60 backdrop-blur-md rounded-xl border border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all select-text shadow-sm placeholder:text-purple-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-purple-900/80 mb-2">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="w-full px-4 py-3 bg-white/60 backdrop-blur-md rounded-xl border border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all resize-none h-24 select-text shadow-sm placeholder:text-purple-400"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl font-bold shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
              >
                {isSubmitting ? "Saving..." : <><Save className="w-5 h-5" /> Save Changes</>}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
