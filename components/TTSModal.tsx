import React, { useState } from 'react';
import { generateSpeech } from '../services/geminiService';
import { VoiceName } from '../types';
import { X, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
  onGenerate: (text: string, voice: VoiceName) => Promise<void>;
}

const TTSModal: React.FC<Props> = ({ onClose, onGenerate }) => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<VoiceName>('Kore');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onGenerate(text, voice);
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to generate audio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#202020] border border-neutral-700 rounded-lg shadow-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="text-yellow-400" size={20} />
                AI Voice Generator
            </h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-white"><X /></button>
        </div>

        {error && <div className="bg-red-900/50 text-red-200 p-2 rounded text-sm mb-4">{error}</div>}

        <div className="space-y-4">
            <div>
                <label className="block text-sm text-neutral-400 mb-1">Prompt</label>
                <textarea 
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full bg-[#151515] border border-neutral-700 rounded p-2 text-white h-24 focus:border-blue-500 outline-none resize-none"
                    placeholder="Enter text to speak..."
                />
            </div>

            <div>
                <label className="block text-sm text-neutral-400 mb-1">Voice Personality</label>
                <select 
                    value={voice}
                    onChange={(e) => setVoice(e.target.value as VoiceName)}
                    className="w-full bg-[#151515] border border-neutral-700 rounded p-2 text-white outline-none"
                >
                    <option value="Kore">Kore (Balanced)</option>
                    <option value="Puck">Puck (Energetic)</option>
                    <option value="Fenrir">Fenrir (Deep)</option>
                    <option value="Zephyr">Zephyr (Soft)</option>
                    <option value="Charon">Charon (Authoritative)</option>
                </select>
            </div>

            <button 
                onClick={handleGenerate}
                disabled={loading || !text}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors"
            >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Generate Clip'}
            </button>
        </div>
        
        <p className="text-xs text-neutral-500 mt-4 text-center">Powered by Google Gemini 2.5 Flash TTS</p>
      </div>
    </div>
  );
};

export default TTSModal;
