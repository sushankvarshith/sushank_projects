import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; choices: string[] }) => Promise<void>;
}

export default function CreatePollModal({ isOpen, onClose, onSubmit }: CreatePollModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [choices, setChoices] = useState(["", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddChoice = () => {
    if (choices.length < 5) {
      setChoices([...choices, ""]);
    }
  };

  const handleRemoveChoice = (index: number) => {
    if (choices.length > 2) {
      setChoices(choices.filter((_, i) => i !== index));
    }
  };

  const handleChoiceChange = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || choices.some(c => !c)) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ title, description, choices });
      setTitle("");
      setDescription("");
      setChoices(["", ""]);
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
            className="relative w-full max-w-lg bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-purple-500/10 border border-white overflow-hidden select-none pt-4"
          >
            <div className="p-6 border-b border-purple-100/50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-950 to-purple-700">Create New Poll</h2>
              <button onClick={onClose} className="text-purple-400 hover:text-purple-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-purple-900/80 mb-2">Poll Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full px-4 py-3 bg-white/60 backdrop-blur-md rounded-xl border border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all select-text shadow-sm placeholder:text-purple-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-purple-900/80 mb-2">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add some context..."
                  className="w-full px-4 py-3 bg-white/60 backdrop-blur-md rounded-xl border border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all resize-none h-24 select-text shadow-sm placeholder:text-purple-400"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-purple-900/80 mb-2">Choices</label>
                {choices.map((choice, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={choice}
                      onChange={(e) => handleChoiceChange(index, e.target.value)}
                      placeholder={`Choice ${index + 1}`}
                      className="flex-1 px-4 py-2 bg-white/60 backdrop-blur-md rounded-lg border border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all select-text shadow-sm placeholder:text-purple-400/70"
                    />
                    {choices.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveChoice(index)}
                        className="p-2 text-purple-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                {choices.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddChoice}
                    className="flex items-center gap-2 text-sm font-medium text-purple-600/80 hover:text-purple-950 transition-colors mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Choice
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl font-bold shadow-md shadow-purple-500/20 transition-all disabled:opacity-50 mt-6"
              >
                {isSubmitting ? "Creating..." : "Launch Poll"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
