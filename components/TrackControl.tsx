import React from 'react';
import { Track } from '../types';
import { Mic, Volume2, Settings } from 'lucide-react';

interface Props {
  track: Track;
  onUpdate: (track: Track) => void;
  onOpenFx: (trackId: string) => void;
  onRecord: (trackId: string) => void;
  isRecording: boolean;
}

const TrackControl: React.FC<Props> = ({ track, onUpdate, onOpenFx, onRecord, isRecording }) => {
  return (
    <div 
      className="flex flex-col p-1 md:p-2 border-b border-neutral-800 relative select-none shrink-0"
      style={{ borderLeft: `4px solid ${track.color}`, backgroundColor: '#1e1e1e', height: '120px' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-1 md:mb-2">
        <input 
          value={track.name}
          onChange={(e) => onUpdate({ ...track, name: e.target.value })}
          className="bg-transparent text-xs md:text-sm font-bold text-neutral-300 w-16 md:w-24 outline-none border-b border-transparent focus:border-blue-500 truncate"
        />
        <button onClick={() => onOpenFx(track.id)} className="text-neutral-400 hover:text-white p-1">
            <Settings size={14} />
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-1 mb-1 md:mb-2">
         <button 
           onClick={() => onUpdate({ ...track, isMuted: !track.isMuted })}
           className={`w-6 h-6 text-[10px] md:text-xs font-bold rounded flex items-center justify-center border border-neutral-700 ${track.isMuted ? 'bg-red-900 text-white' : 'bg-neutral-800 text-neutral-400'}`}
           title="Mute"
         >
           M
         </button>
         <button 
           onClick={() => onUpdate({ ...track, isSolo: !track.isSolo })}
           className={`w-6 h-6 text-[10px] md:text-xs font-bold rounded flex items-center justify-center border border-neutral-700 ${track.isSolo ? 'bg-yellow-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
           title="Solo"
         >
           S
         </button>
         <button 
            onClick={() => onRecord(track.id)}
            className={`w-6 h-6 text-xs rounded flex items-center justify-center border border-neutral-700 ${isRecording ? 'bg-red-600 animate-pulse text-white' : 'bg-neutral-800 text-red-500'}`}
            title="Record"
         >
            <Mic size={12} />
         </button>
      </div>

      {/* Volume Slider */}
      <div className="flex items-center gap-1 md:gap-2 mt-auto">
         <Volume2 size={14} className="text-neutral-500 hidden md:block" />
         <input 
            type="range" 
            min="0" max="1.5" step="0.01" 
            value={track.volume}
            onChange={(e) => onUpdate({ ...track, volume: parseFloat(e.target.value) })}
            className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
         />
      </div>
    </div>
  );
};

export default TrackControl;