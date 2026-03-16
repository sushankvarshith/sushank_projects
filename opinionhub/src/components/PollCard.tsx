import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Poll, Choice, Comment } from "../types";
import { CheckCircle2, User, Clock, Share2, MessageSquare, Send, Bookmark } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PollCardProps {
  poll: Poll;
  onVote: (pollId: number, choiceId: number) => Promise<void>;
  onUnvote?: (pollId: number) => Promise<void>;
  onDelete?: (pollId: number) => Promise<void>;
  isLoggedIn: boolean;
  currentUserId?: number;
  onProfileClick?: (userId: number) => void;
  onSave?: (pollId: number, isSaved: boolean) => Promise<void>;
}

export default function PollCard({ poll, onVote, onUnvote, onDelete, isLoggedIn, currentUserId, onProfileClick, onSave }: PollCardProps) {
  const [localPoll, setLocalPoll] = useState<Poll>(poll);
  const [isVoting, setIsVoting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/polls/${poll.id}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      const data = await res.json();
      setComments(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setLocalPoll(poll);
  }, [poll]);

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments]);

  const handleVote = async (choiceId: number) => {
    if (!isLoggedIn || isVoting) return;

    setIsVoting(true);
    
    // Changing vote or voting for first time
    const prevVoteId = localPoll.userVoteId;
    
    if (prevVoteId === choiceId) {
      if (onUnvote) {
         const updatedChoices = localPoll.choices.map(c => 
            c.id === choiceId ? { ...c, vote_count: c.vote_count - 1 } : c
         );
         setLocalPoll({
            ...localPoll,
            choices: updatedChoices,
            hasVoted: false,
            userVoteId: null,
            totalVotes: localPoll.totalVotes - 1
         });
         try {
            await onUnvote(localPoll.id);
         } catch(err) {
            setLocalPoll(poll);
         }
      }
      setIsVoting(false);
      return;
    }

    // Atomic update in frontend
    const updatedChoices = localPoll.choices.map(c => {
      let change = 0;
      if (c.id === choiceId) change = 1;
      if (c.id === prevVoteId) change = -1;
      return { ...c, vote_count: Math.max(0, c.vote_count + change) };
    });
    
    const voteDelta = prevVoteId ? 0 : 1;
    
    setLocalPoll({
      ...localPoll,
      choices: updatedChoices,
      hasVoted: true,
      userVoteId: choiceId,
      totalVotes: localPoll.totalVotes + voteDelta
    });

    try {
      await onVote(localPoll.id, choiceId);
    } catch (err) {
      // Rollback if failed
      setLocalPoll(poll);
    } finally {
      setIsVoting(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/poll/${poll.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !isLoggedIn || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/polls/${poll.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment }),
      });
      if (res.ok) {
        setNewComment("");
        fetchComments();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to post comment");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to post comment");
    }
    setIsSubmittingComment(false);
  };

  const handleToggleSave = async () => {
    if (!isLoggedIn || isSaving) return;
    setIsSaving(true);
    
    // Optimistic UI update
    const newSaveStatus = !localPoll.isSaved;
    setLocalPoll({ ...localPoll, isSaved: newSaveStatus });
    
    try {
      if (onSave) {
        await onSave(localPoll.id, newSaveStatus);
      } else {
        const res = await fetch(`/api/polls/${poll.id}/save`, { method: "POST" });
        if (!res.ok) throw new Error("Failed to save");
      }
      toast.success(newSaveStatus ? "Poll saved!" : "Removed from saved polls");
    } catch (err) {
      // Rollback
      setLocalPoll({ ...localPoll, isSaved: !newSaveStatus });
      toast.error("Failed to update saved status");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="bg-white/60 backdrop-blur-xl border border-purple-100/50 rounded-2xl p-6 shadow-sm shadow-purple-500/5 hover:shadow-md hover:shadow-purple-500/10 transition-all duration-300 group relative overflow-hidden"
    >
      {/* Header */}
      <div 
        className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-white/40 p-2 rounded-xl transition-colors -ml-2"
        onClick={() => onProfileClick?.(localPoll.creator_id)}
      >
        <img 
          src={localPoll.creator_avatar} 
          alt={localPoll.creator_name} 
          className="w-10 h-10 rounded-full border border-purple-200 shadow-sm"
          referrerPolicy="no-referrer"
        />
        <div className="flex-1">
          <h3 className="font-bold text-purple-950 leading-tight">{localPoll.creator_name}</h3>
          <div className="flex items-center gap-1 text-xs text-purple-600/70">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(localPoll.created_at))} ago
          </div>
        </div>
        {isLoggedIn && currentUserId === localPoll.creator_id && onDelete && (
          <button 
             onClick={(e) => { e.stopPropagation(); onDelete(localPoll.id); }}
             className="text-red-400 hover:text-red-600 p-2 opacity-50 hover:opacity-100 transition-opacity"
             title="Delete Poll"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        )}
      </div>

      {/* Content */}
      <h2 className="text-xl font-bold text-purple-950 mb-2">{localPoll.title}</h2>
      <p className="text-purple-600/80 text-sm mb-6">{localPoll.description}</p>

      {/* Choices */}
      <div className="space-y-3">
        {localPoll.choices.map((choice) => {
          const percentage = localPoll.totalVotes > 0 
            ? Math.round((choice.vote_count / localPoll.totalVotes) * 100) 
            : 0;
          const isSelected = localPoll.userVoteId === choice.id;

          return (
            <button
              key={choice.id}
              onClick={() => handleVote(choice.id)}
              disabled={!isLoggedIn || isVoting}
              className={cn(
                "relative w-full text-left p-4 rounded-xl border transition-all duration-300 overflow-hidden group/choice select-none",
                localPoll.hasVoted 
                  ? "border-transparent bg-white/40 cursor-default" 
                  : "border-purple-200/50 hover:border-purple-400 hover:bg-white/50 cursor-pointer shadow-sm",
                isSelected && "ring-2 ring-purple-500 ring-offset-2 ring-offset-slate-50 border-transparent shadow-md shadow-purple-500/20"
              )}
            >
              {/* Progress Bar */}
              {localPoll.hasVoted && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={cn(
                    "absolute inset-y-0 left-0",
                    isSelected ? "bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20" : "bg-purple-100/50"
                  )}
                />
              )}

              <div className="relative flex justify-between items-center z-10">
                <span className={cn(
                  "font-medium transition-colors",
                  isSelected ? "text-purple-900" : "text-purple-800/80",
                  !localPoll.hasVoted && "group-hover/choice:text-purple-950"
                )}>
                  {choice.text}
                </span>
                
                {localPoll.hasVoted ? (
                  <motion.span 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "text-sm font-bold",
                      isSelected ? "text-purple-900" : "text-purple-500/80"
                    )}
                  >
                    {percentage}%
                  </motion.span>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-purple-300/50 group-hover/choice:border-purple-500 transition-colors" />
                )}
              </div>

              {/* Reveal Blur Effect (if not voted) */}
              {!localPoll.hasVoted && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] opacity-0 group-hover/choice:opacity-100 transition-opacity pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-6 border-t border-purple-100/50 flex items-center justify-between select-none relative z-10">
        <div className="flex items-center gap-4 text-purple-600/70">
          <span className="text-sm flex items-center gap-1">
            <User className="w-4 h-4" />
            {localPoll.totalVotes} votes
          </span>
          <button 
            onClick={() => setShowComments(!showComments)}
            className={cn(
              "flex items-center gap-1 hover:text-purple-900 transition-colors",
              showComments && "text-purple-900"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-medium">{comments.length > 0 ? comments.length : ""}</span>
          </button>
          <button 
            onClick={handleShare}
            className="hover:text-purple-900 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
          {isLoggedIn && (
            <button 
              onClick={handleToggleSave}
              disabled={isSaving}
              className={cn(
                "transition-colors",
                localPoll.isSaved ? "text-purple-600 hover:text-purple-800" : "hover:text-purple-900"
              )}
            >
              <Bookmark className="w-4 h-4" fill={localPoll.isSaved ? "currentColor" : "none"} />
            </button>
          )}
        </div>
        
        {localPoll.hasVoted && (
          <div className="flex items-center gap-1 text-purple-700 text-sm font-medium bg-purple-100/50 px-3 py-1 rounded-full border border-purple-200/50">
            <CheckCircle2 className="w-4 h-4" />
            Voted
          </div>
        )}
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden relative z-10"
          >
            <div className="mt-6 pt-6 border-t border-purple-100/50 space-y-4">
              {isLoggedIn && (
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <input 
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-4 py-2 bg-white/60 backdrop-blur-md border border-purple-200 rounded-xl text-sm focus:bg-white/80 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all shadow-sm placeholder:text-purple-400"
                  />
                  <button 
                    type="submit"
                    disabled={!newComment.trim() || isSubmittingComment}
                    className="p-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-xl hover:from-purple-700 hover:to-fuchsia-700 disabled:opacity-50 transition-all shadow-md shadow-purple-500/20"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}

              <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {comments.length === 0 ? (
                  <p className="text-center text-purple-400/80 text-sm py-4">No comments yet. Be the first!</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <img 
                        src={comment.avatar} 
                        alt={comment.username} 
                        className="w-8 h-8 rounded-full border border-purple-200/50 shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 bg-white/60 backdrop-blur-md rounded-2xl p-3 border border-purple-100/50 shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-purple-950">{comment.username}</span>
                          <span className="text-[10px] text-purple-500/70">{formatDistanceToNow(new Date(comment.created_at))} ago</span>
                        </div>
                        <p className="text-sm text-purple-900/80">{comment.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
