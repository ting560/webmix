import React, { useRef, useState } from 'react';
import { AudioClip, Track } from '../types';

interface Props {
  tracks: Track[];
  clips: AudioClip[];
  currentTime: number;
  zoom: number; // pixels per second
  onClipUpdate: (clip: AudioClip) => void;
  onClipSelect: (clipId: string | null) => void;
  selectedClipId: string | null;
  onTimelineClick: (time: number) => void;
}

const HEADER_HEIGHT = 32; // Height of the ruler
const TRACK_HEIGHT = 120; // Matches TrackControl height

const Timeline: React.FC<Props> = ({ 
  tracks, clips, currentTime, zoom, onClipUpdate, onClipSelect, selectedClipId, onTimelineClick 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Drag State
  const [dragState, setDragState] = useState<{ 
    clipId: string; 
    startX: number; 
    startTime: number; 
    startTrackId: string;
  } | null>(null);

  // Helper: Convert time to pixels
  const t2p = (time: number) => time * zoom;

  // Helper: Get Track ID from Y position
  const getTrackIdFromY = (y: number, scrollY: number) => {
    // Calculate relative Y inside the tracks area (excluding ruler)
    const relativeY = y + scrollY - HEADER_HEIGHT;
    if (relativeY < 0) return tracks[0]?.id; // Too high, snap to first
    
    const trackIndex = Math.floor(relativeY / TRACK_HEIGHT);
    
    if (trackIndex < 0) return tracks[0]?.id;
    if (trackIndex >= tracks.length) return tracks[tracks.length - 1]?.id;
    
    return tracks[trackIndex].id;
  };

  const handlePointerDown = (e: React.PointerEvent, clip: AudioClip) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onClipSelect(clip.id);
    setDragState({
      clipId: clip.id,
      startX: e.clientX,
      startTime: clip.startTime,
      startTrackId: clip.trackId
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState || !containerRef.current) return;

    const clip = clips.find(c => c.id === dragState.clipId);
    if (!clip) return;

    // 1. Calculate Horizontal (Time) Change
    const deltaX = e.clientX - dragState.startX;
    const deltaTime = deltaX / zoom;
    const newTime = Math.max(0, dragState.startTime + deltaTime);

    // 2. Calculate Vertical (Track) Change
    const rect = containerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top; // Mouse Y relative to container
    const newTrackId = getTrackIdFromY(relativeY, containerRef.current.scrollTop);

    // Optimistic Update
    if (newTime !== clip.startTime || newTrackId !== clip.trackId) {
       onClipUpdate({ 
           ...clip, 
           startTime: newTime,
           trackId: newTrackId
       });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState) {
        e.currentTarget.releasePointerCapture(e.pointerId);
        setDragState(null);
    }
  };

  return (
    <div 
        className="flex-1 bg-[#121212] overflow-x-auto overflow-y-auto relative touch-none"
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
    >
        {/* Playhead */}
        <div 
            className="absolute top-0 bottom-0 border-l-2 border-red-500 z-30 pointer-events-none"
            style={{ left: t2p(currentTime), height: Math.max(tracks.length * TRACK_HEIGHT + HEADER_HEIGHT, 500) }}
        >
            <div className="w-3 h-3 bg-red-500 -ml-1.5 rotate-45 transform sticky top-0" />
        </div>

        {/* Grid Background */}
        <div 
            className="absolute inset-0 pointer-events-none" 
            style={{ 
                backgroundSize: `${zoom}px 100%`, 
                backgroundImage: 'linear-gradient(to right, #262626 1px, transparent 1px)',
                height: tracks.length * TRACK_HEIGHT + HEADER_HEIGHT,
                minHeight: '100%',
                width: '300%' // Ensure grid covers scrolled area
            }} 
        />

        {/* Ruler */}
        <div 
            className="h-8 border-b border-neutral-700 bg-neutral-900 sticky top-0 z-20 flex items-end text-xs text-neutral-500 select-none min-w-full"
            style={{ height: HEADER_HEIGHT }}
            onClick={(e) => {
                if (!containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left + containerRef.current.scrollLeft;
                onTimelineClick(x / zoom);
            }}
        >
            {Array.from({ length: 100 }).map((_, i) => (
                <div key={i} className="absolute border-l border-neutral-600 pl-1" style={{ left: i * zoom * 5 }}>
                    {i * 5}s
                </div>
            ))}
        </div>

        {/* Tracks Area */}
        <div className="relative min-w-full">
            {tracks.map((track) => {
                // We render slots for tracks, but clips are absolutely positioned globally within the timeline container
                // relative to this structure.
                return (
                    <div 
                        key={track.id} 
                        className="relative border-b border-neutral-800 hover:bg-white/5 transition-colors"
                        style={{ height: TRACK_HEIGHT }}
                    >
                        {/* Background for track (visual only) */}
                    </div>
                );
            })}

            {/* Render Clips Overlay */}
            {clips.map(clip => {
                // Calculate Top position based on track index
                const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
                if (trackIndex === -1) return null; // Should not happen

                const topPos = trackIndex * TRACK_HEIGHT + 10; // +10 for padding inside track

                return (
                    <div
                        key={clip.id}
                        onPointerDown={(e) => handlePointerDown(e, clip)}
                        className={`absolute h-24 rounded-md overflow-hidden text-xs text-white p-2 select-none flex items-center shadow-lg border-2 z-10 touch-manipulation ${selectedClipId === clip.id ? 'border-white' : 'border-transparent'}`}
                        style={{
                            left: t2p(clip.startTime),
                            top: topPos,
                            width: Math.max(2, t2p(clip.duration)), // Minimum width to be visible
                            backgroundColor: clip.color + 'dd',
                            borderLeft: `4px solid ${clip.color}`,
                            cursor: 'grab'
                        }}
                    >
                        <span className="drop-shadow-md font-bold truncate pointer-events-none">{clip.name}</span>
                        {/* Waveform graphic */}
                        <div className="absolute bottom-0 left-0 right-0 h-1/2 opacity-30 flex items-end gap-[1px] pointer-events-none">
                            {Array.from({length: 10}).map((_, i) => (
                                <div key={i} className="bg-black w-full" style={{ height: `${Math.random() * 80 + 20}%`}}></div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default Timeline;