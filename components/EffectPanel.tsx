import React from 'react';
import { Track } from '../types';
import { X } from 'lucide-react';

interface Props {
  track: Track;
  onUpdate: (track: Track) => void;
  onClose: () => void;
}

const EffectPanel: React.FC<Props> = ({ track, onUpdate, onClose }) => {
  const updateFx = (key: string, val: number) => {
    onUpdate({
        ...track,
        effects: { ...track.effects, [key]: val }
    });
  };

  return (
    <div className="w-64 bg-[#1a1a1a] border-l border-neutral-700 p-4 flex flex-col gap-6 overflow-y-auto h-full">
        <div className="flex justify-between items-center border-b border-neutral-700 pb-2">
            <h3 className="font-bold text-neutral-200">FX: {track.name}</h3>
            <button onClick={onClose}><X size={16} /></button>
        </div>

        {/* EQ Section */}
        <div>
            <h4 className="text-xs font-bold text-blue-400 mb-2 uppercase tracking-wider">Equalizer</h4>
            <div className="space-y-4">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-400 flex justify-between">
                        <span>High Shelf</span>
                        <span>{track.effects.eqHigh} dB</span>
                    </label>
                    <input type="range" min="-20" max="20" value={track.effects.eqHigh} onChange={(e) => updateFx('eqHigh', Number(e.target.value))} className="w-full h-1 bg-neutral-700 accent-blue-500 rounded" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-400 flex justify-between">
                        <span>Mid Peaking</span>
                        <span>{track.effects.eqMid} dB</span>
                    </label>
                    <input type="range" min="-20" max="20" value={track.effects.eqMid} onChange={(e) => updateFx('eqMid', Number(e.target.value))} className="w-full h-1 bg-neutral-700 accent-blue-500 rounded" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-400 flex justify-between">
                        <span>Low Shelf</span>
                        <span>{track.effects.eqLow} dB</span>
                    </label>
                    <input type="range" min="-20" max="20" value={track.effects.eqLow} onChange={(e) => updateFx('eqLow', Number(e.target.value))} className="w-full h-1 bg-neutral-700 accent-blue-500 rounded" />
                </div>
            </div>
        </div>

        {/* Delay Section */}
        <div>
            <h4 className="text-xs font-bold text-purple-400 mb-2 uppercase tracking-wider">Delay / Echo</h4>
            <div className="space-y-4">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-400 flex justify-between">
                        <span>Mix (Dry/Wet)</span>
                        <span>{(track.effects.delayMix * 100).toFixed(0)}%</span>
                    </label>
                    <input type="range" min="0" max="1" step="0.05" value={track.effects.delayMix} onChange={(e) => updateFx('delayMix', Number(e.target.value))} className="w-full h-1 bg-neutral-700 accent-purple-500 rounded" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-400 flex justify-between">
                        <span>Feedback</span>
                        <span>{(track.effects.delayFeedback * 100).toFixed(0)}%</span>
                    </label>
                    <input type="range" min="0" max="0.9" step="0.05" value={track.effects.delayFeedback} onChange={(e) => updateFx('delayFeedback', Number(e.target.value))} className="w-full h-1 bg-neutral-700 accent-purple-500 rounded" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-400 flex justify-between">
                        <span>Time</span>
                        <span>{track.effects.delayTime.toFixed(2)}s</span>
                    </label>
                    <input type="range" min="0.05" max="2.0" step="0.05" value={track.effects.delayTime} onChange={(e) => updateFx('delayTime', Number(e.target.value))} className="w-full h-1 bg-neutral-700 accent-purple-500 rounded" />
                </div>
            </div>
        </div>
    </div>
  );
};

export default EffectPanel;