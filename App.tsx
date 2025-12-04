import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Plus, Upload, Wand2, Volume2, VolumeX, Save, Gauge, Scissors, Trash2, Mic, Settings, ShoppingBag, X, Clock, FileAudio } from 'lucide-react';
import { Track, AudioClip, TRACK_HEIGHT, PIXELS_PER_SECOND, ProjectFile } from './types.ts';
import { audioEngine } from './utils/audioEngine.ts';
import { generateSpeechSample } from './services/geminiService.ts';

// --- Helper Functions ---
const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- Helper Components ---

const TrackHeader: React.FC<{ 
  track: Track; 
  onUpdate: (id: string, updates: Partial<Track>) => void;
  isSelected: boolean;
  onClick: () => void;
  onRecord: (id: string) => void;
  isRecording: boolean;
  onOpenFx: (id: string) => void;
}> = ({ 
  track, 
  onUpdate,
  isSelected,
  onClick,
  onRecord,
  isRecording,
  onOpenFx
}) => {
  return (
    <div 
      onClick={onClick}
      className={`flex flex-col p-2 border-r border-gray-700 shrink-0 relative transition-colors ${isSelected ? 'bg-gray-750 border-l-4 border-l-blue-500' : 'bg-gray-800 border-l-4 border-l-transparent'}`}
      style={{ height: TRACK_HEIGHT, width: 260 }}
    >
      <div className="flex items-center justify-between mb-1">
        <input 
          value={track.name}
          onChange={(e) => onUpdate(track.id, { name: e.target.value })}
          className="bg-transparent text-sm font-bold w-20 focus:outline-none focus:border-b border-blue-500 truncate"
        />
        <div className="flex space-x-1">
           <button
            onClick={(e) => { e.stopPropagation(); onRecord(track.id); }}
            className={`flex items-center justify-center w-6 h-6 rounded-full transition-all ${isRecording ? 'bg-red-600 animate-pulse text-white shadow-[0_0_8px_red]' : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'}`}
            title="Record Microphone"
          >
             <Mic size={12} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onUpdate(track.id, { muted: !track.muted }); }}
            className={`text-[10px] w-6 h-6 rounded flex items-center justify-center ${track.muted ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400'}`}
          >
            M
          </button>
          <button 
             onClick={(e) => { e.stopPropagation(); onUpdate(track.id, { soloed: !track.soloed }); }}
             className={`text-[10px] w-6 h-6 rounded flex items-center justify-center ${track.soloed ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-400'}`}
          >
            S
          </button>
          <button
             onClick={(e) => { e.stopPropagation(); onOpenFx(track.id); }}
             className={`text-[10px] w-6 h-6 rounded flex items-center justify-center bg-gray-700 text-blue-300 hover:bg-gray-600 hover:text-blue-200`}
             title="Effects"
          >
             FX
          </button>
        </div>
      </div>
      
      {/* Volume Slider */}
      <div className="flex items-center space-x-2 mb-1" onClick={e => e.stopPropagation()}>
        {track.muted ? <VolumeX size={12} className="text-gray-500"/> : <Volume2 size={12} className="text-gray-400"/>}
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01"
          value={track.volume}
          onChange={(e) => onUpdate(track.id, { volume: parseFloat(e.target.value) })}
          className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Speed Control */}
      <div className="flex items-center space-x-2 mt-auto" onClick={e => e.stopPropagation()}>
        <Gauge size={12} className="text-gray-400" />
        <input 
          type="range" 
          min="0.5" 
          max="2.0" 
          step="0.1"
          value={track.playbackRate || 1.0}
          onChange={(e) => onUpdate(track.id, { playbackRate: parseFloat(e.target.value) })}
          className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500"
        />
        <span className="text-[10px] text-gray-400 w-8 text-right">{(track.playbackRate || 1.0).toFixed(1)}x</span>
      </div>
      
      {/* Track Color Strip */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: track.color }}></div>
    </div>
  );
};

const ClipView: React.FC<{ 
  clip: AudioClip; 
  playbackRate: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}> = ({ clip, playbackRate, isSelected, onMouseDown }) => {
  const effectiveDuration = clip.duration / playbackRate;
  const width = effectiveDuration * PIXELS_PER_SECOND;
  const left = clip.startTime * PIXELS_PER_SECOND;

  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e); }}
      className={`absolute top-1 bottom-1 rounded-md overflow-hidden cursor-move border transition-all select-none group ${isSelected ? 'border-white ring-2 ring-white/50 z-20' : 'border-white border-opacity-30 hover:border-opacity-60 z-10'}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        backgroundColor: clip.color,
      }}
    >
      <div className="bg-black bg-opacity-20 w-full h-full flex items-center px-2 relative">
        <span className="text-xs truncate text-white drop-shadow-md pointer-events-none sticky left-2">{clip.name}</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1/2 flex items-end opacity-40 pointer-events-none">
        {Array.from({ length: Math.min(20, Math.floor(width / 5)) }).map((_, i) => (
          <div 
            key={i} 
            className="flex-1 bg-white mx-px" 
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
    </div>
  );
};

const EffectsPanel: React.FC<{
  track: Track;
  onUpdate: (id: string, updates: Partial<Track>) => void;
  onClose: () => void;
}> = ({ track, onUpdate, onClose }) => {
   
   const updateEffect = (type: 'eq' | 'echo', param: string, value: number) => {
      const newEffects = { ...track.effects };
      // @ts-ignore
      newEffects[type][param] = value;
      onUpdate(track.id, { effects: newEffects });
   };

   return (
     <div className="fixed inset-y-0 right-0 w-80 bg-gray-800 border-l border-gray-700 shadow-2xl z-50 p-4 transform transition-transform overflow-y-auto">
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-700">
           <h2 className="text-lg font-bold text-white">Track Effects</h2>
           <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20}/></button>
        </div>
        
        <div className="mb-2 text-sm text-blue-400 font-mono uppercase tracking-wide">{track.name}</div>

        {/* EQ Section */}
        <div className="mb-8 bg-gray-900 p-4 rounded-lg">
           <div className="flex items-center mb-3">
              <Settings size={16} className="mr-2 text-green-400"/>
              <h3 className="font-bold text-sm text-gray-200">3-Band Equalizer</h3>
           </div>
           <div className="space-y-4">
              <div>
                 <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Low</span>
                    <span>{track.effects.eq.low} dB</span>
                 </div>
                 <input 
                    type="range" min="-20" max="20" step="1" 
                    value={track.effects.eq.low} 
                    onChange={e => updateEffect('eq', 'low', parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                 />
              </div>
              <div>
                 <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Mid</span>
                    <span>{track.effects.eq.mid} dB</span>
                 </div>
                 <input 
                    type="range" min="-20" max="20" step="1" 
                    value={track.effects.eq.mid} 
                    onChange={e => updateEffect('eq', 'mid', parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                 />
              </div>
              <div>
                 <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>High</span>
                    <span>{track.effects.eq.high} dB</span>
                 </div>
                 <input 
                    type="range" min="-20" max="20" step="1" 
                    value={track.effects.eq.high} 
                    onChange={e => updateEffect('eq', 'high', parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                 />
              </div>
           </div>
        </div>

        {/* Echo Section */}
        <div className="mb-8 bg-gray-900 p-4 rounded-lg">
           <div className="flex items-center mb-3">
              <Wand2 size={16} className="mr-2 text-purple-400"/>
              <h3 className="font-bold text-sm text-gray-200">Delay / Echo</h3>
           </div>
           <div className="space-y-4">
              <div>
                 <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Mix (Dry/Wet)</span>
                    <span>{(track.effects.echo.amount * 100).toFixed(0)}%</span>
                 </div>
                 <input 
                    type="range" min="0" max="1" step="0.01" 
                    value={track.effects.echo.amount} 
                    onChange={e => updateEffect('echo', 'amount', parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                 />
              </div>
              <div>
                 <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Time</span>
                    <span>{track.effects.echo.time.toFixed(2)}s</span>
                 </div>
                 <input 
                    type="range" min="0" max="1" step="0.01" 
                    value={track.effects.echo.time} 
                    onChange={e => updateEffect('echo', 'time', parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                 />
              </div>
              <div>
                 <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Feedback</span>
                    <span>{(track.effects.echo.feedback * 100).toFixed(0)}%</span>
                 </div>
                 <input 
                    type="range" min="0" max="0.9" step="0.01" 
                    value={track.effects.echo.feedback} 
                    onChange={e => updateEffect('echo', 'feedback', parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                 />
              </div>
           </div>
        </div>
     </div>
   )
}

// --- Main App ---

export default function App() {
  // --- State ---
  const [tracks, setTracks] = useState<Track[]>([
    { 
      id: '1', name: 'Drums', volume: 0.8, muted: false, soloed: false, playbackRate: 1.0, color: '#10b981',
      effects: { eq: { low: 0, mid: 0, high: 0 }, echo: { amount: 0, time: 0.2, feedback: 0 } }
    },
    { 
      id: '2', name: 'Bass', volume: 0.8, muted: false, soloed: false, playbackRate: 1.0, color: '#3b82f6',
      effects: { eq: { low: 0, mid: 0, high: 0 }, echo: { amount: 0, time: 0.2, feedback: 0 } }
    },
    { 
      id: '3', name: 'Vocal', volume: 1.0, muted: false, soloed: false, playbackRate: 1.0, color: '#ec4899',
      effects: { eq: { low: 0, mid: 0, high: 0 }, echo: { amount: 0.2, time: 0.4, feedback: 0.3 } }
    },
  ]);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 
  const [totalDuration, setTotalDuration] = useState(60); 
  const [selectedTrackId, setSelectedTrackId] = useState<string>('1');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  
  // Custom Commercials
  const [customCommercials, setCustomCommercials] = useState<{name: string, buffer: AudioBuffer}[]>([]);
  
  // Interaction State
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const dragStartRef = useRef<{ startX: number, originalStartTime: number, startY: number, originalTrackId: string } | null>(null);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null);

  // Modals / Panels
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiVoice, setAiVoice] = useState<'Kore' | 'Puck' | 'Fenrir'>('Kore');
  const [isExporting, setIsExporting] = useState(false);
  const [showEffectsForTrack, setShowEffectsForTrack] = useState<string | null>(null);
  const [showCommercials, setShowCommercials] = useState(false);

  const animationFrameRef = useRef<number>();
  const timelineRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);

  // --- Calculate Project End Time ---
  const projectEndTime = clips.reduce((max, clip) => {
    const track = tracks.find(t => t.id === clip.trackId);
    const rate = track?.playbackRate || 1.0;
    const end = clip.startTime + (clip.duration / rate);
    return Math.max(max, end);
  }, 0);

  // --- Audio Engine Sync ---

  useEffect(() => {
    tracks.forEach(t => {
      audioEngine.updateTrackParams(t);
    });
  }, [tracks]);

  // Playback Loop
  const updateTimeline = useCallback(() => {
    if (isPlaying) {
      const time = audioEngine.getCurrentTime();
      setCurrentTime(time);
      if (time > totalDuration - 2) {
        setTotalDuration(d => d + 10);
      }
      animationFrameRef.current = requestAnimationFrame(updateTimeline);
    }
  }, [isPlaying, totalDuration]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTimeline);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, updateTimeline]);

  // --- Handlers ---

  const handlePlayPause = () => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
    } else {
      audioEngine.play(clips, tracks, currentTime);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingClipId) return; 
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = Math.max(0, x / PIXELS_PER_SECOND);
    
    if (isPlaying) {
      audioEngine.stop();
      setCurrentTime(time);
      audioEngine.play(clips, tracks, time);
    } else {
      setCurrentTime(time);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const audioBuffer = await audioEngine.decodeAudioData(buffer);
    addClipToTrack(selectedTrackId, audioBuffer, file.name);
  };

  const handleUploadCommercial = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const audioBuffer = await audioEngine.decodeAudioData(buffer);
    setCustomCommercials(prev => [...prev, { name: file.name, buffer: audioBuffer }]);
  };

  const addClipToTrack = (trackId: string, buffer: AudioBuffer, name: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    const newClip: AudioClip = {
      id: Math.random().toString(36).substr(2, 9),
      trackId,
      name,
      buffer,
      startTime: currentTime,
      duration: buffer.duration,
      offset: 0,
      color: track.color
    };
    setClips(prev => [...prev, newClip]);
    if (currentTime + buffer.duration > totalDuration) {
      setTotalDuration(currentTime + buffer.duration + 5);
    }
  };

  const handleTrackUpdate = (id: string, updates: Partial<Track>) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleAddTrack = () => {
    const newTrack: Track = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Track ${tracks.length + 1}`,
      volume: 0.8,
      muted: false,
      soloed: false,
      playbackRate: 1.0,
      color: ['#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#10b981'][tracks.length % 5],
      effects: { eq: { low: 0, mid: 0, high: 0 }, echo: { amount: 0, time: 0.2, feedback: 0 } }
    };
    setTracks([...tracks, newTrack]);
  };

  const handleRecord = async (trackId: string) => {
    if (isRecording) {
      // Stop Recording
      const buffer = await audioEngine.stopRecording();
      setIsRecording(false);
      setRecordingTrackId(null);
      if (buffer) {
         addClipToTrack(trackId, buffer, "Recording " + new Date().toLocaleTimeString());
      }
    } else {
      // Start Recording
      try {
        await audioEngine.startRecording();
        setIsRecording(true);
        setRecordingTrackId(trackId);
      } catch (e) {
        alert("Microphone access denied or error.");
      }
    }
  };

  // --- Split & Delete ---

  const handleSplitClip = () => {
    if (!selectedClipId) return;
    const clip = clips.find(c => c.id === selectedClipId);
    if (!clip) return;
    const track = tracks.find(t => t.id === clip.trackId);
    const playbackRate = track?.playbackRate || 1.0;
    const visualStart = clip.startTime;
    const visualDuration = clip.duration / playbackRate;
    const visualEnd = visualStart + visualDuration;

    if (currentTime > visualStart && currentTime < visualEnd) {
       const timeIntoClipVisual = currentTime - visualStart;
       const timeIntoClipRaw = timeIntoClipVisual * playbackRate;
       const leftDuration = timeIntoClipRaw;
       const rightDuration = clip.duration - leftDuration;
       const rightOffset = clip.offset + leftDuration;

       const clipLeft: AudioClip = { ...clip, duration: leftDuration };
       const clipRight: AudioClip = {
         ...clip, id: Math.random().toString(36).substr(2, 9),
         startTime: currentTime, offset: rightOffset, duration: rightDuration
       };

       const newClips = clips.map(c => c.id === clip.id ? clipLeft : c).concat(clipRight);
       setClips(newClips);
       setSelectedClipId(clipRight.id);

       if (isPlaying) {
         const now = audioEngine.getCurrentTime();
         audioEngine.stop();
         audioEngine.play(newClips, tracks, now);
       }
    }
  };

  const handleDeleteClip = () => {
    if (selectedClipId) {
      const newClips = clips.filter(c => c.id !== selectedClipId);
      setClips(newClips);
      setSelectedClipId(null);
      if (isPlaying) {
         const now = audioEngine.getCurrentTime();
         audioEngine.stop();
         audioEngine.play(newClips, tracks, now);
      }
    }
  };

  // --- Drag Logic ---
  const handleClipMouseDown = (e: React.MouseEvent, clipId: string) => {
    if (e.button !== 0) return;
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    setDraggingClipId(clipId);
    setSelectedClipId(clipId);
    setSelectedTrackId(clip.trackId);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originalStartTime: clip.startTime,
      originalTrackId: clip.trackId
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingClipId || !dragStartRef.current || !trackContainerRef.current) return;
    const deltaPixels = e.clientX - dragStartRef.current.startX;
    const deltaTime = deltaPixels / PIXELS_PER_SECOND;
    let newStartTime = dragStartRef.current.originalStartTime + deltaTime;
    if (newStartTime < 0) newStartTime = 0;
    const containerRect = trackContainerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - containerRect.top;
    let trackIndex = Math.floor(relativeY / TRACK_HEIGHT);
    if (trackIndex < 0) trackIndex = 0;
    if (trackIndex >= tracks.length) trackIndex = tracks.length - 1;
    const targetTrackId = tracks[trackIndex].id;
    setClips(prev => prev.map(c => c.id === draggingClipId ? { ...c, startTime: newStartTime, trackId: targetTrackId } : c));
    if (selectedTrackId !== targetTrackId) setSelectedTrackId(targetTrackId);
  };

  const handleMouseUp = () => {
    if (draggingClipId) {
      if (isPlaying) {
        audioEngine.stop();
        audioEngine.play(clips, tracks, currentTime);
      }
    }
    setDraggingClipId(null);
    dragStartRef.current = null;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => handleMouseMove(e as any);
    const onUp = () => handleMouseUp();
    if (draggingClipId) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingClipId, isPlaying, clips, tracks, currentTime]);

  // --- Generators & Features ---

  const handleGenerateAI = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const buffer = await generateSpeechSample(aiPrompt, aiVoice);
      if (buffer) {
        const audioBuffer = await audioEngine.decodeAudioData(buffer);
        addClipToTrack(selectedTrackId, audioBuffer, `AI: ${aiPrompt.substring(0, 10)}...`);
        setShowAIModal(false);
        setAiPrompt('');
      }
    } catch (e) { alert("Error generating audio."); } finally { setIsGenerating(false); }
  };

  const addCommercial = async (name: string, buffer?: AudioBuffer) => {
      let finalBuffer = buffer;
      if (!finalBuffer) {
        // Synthesize noise if no buffer (built-in demo ads)
        const ctx = audioEngine.getContext();
        finalBuffer = ctx.createBuffer(2, ctx.sampleRate * 5, ctx.sampleRate);
        for (let channel = 0; channel < finalBuffer.numberOfChannels; channel++) {
          const nowBuffering = finalBuffer.getChannelData(channel);
          for (let i = 0; i < finalBuffer.length; i++) {
            nowBuffering[i] = (Math.random() * 2 - 1) * (1 - i / finalBuffer.length);
          }
        }
      }
      addClipToTrack(selectedTrackId, finalBuffer!, `Ad: ${name}`);
      setShowCommercials(false);
  };

  const handleExportMp3 = async () => {
    setIsExporting(true);
    try {
      const maxTime = clips.reduce((max, clip) => {
        const track = tracks.find(t => t.id === clip.trackId);
        const rate = track?.playbackRate || 1.0;
        return Math.max(max, clip.startTime + (clip.duration / rate));
      }, 0);
      
      const mp3Blob = await audioEngine.renderMp3(clips, tracks, maxTime + 1);
      const url = URL.createObjectURL(mp3Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `webcraft_mix.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); alert("Failed to export MP3."); } finally { setIsExporting(false); }
  };

  const handleSaveProject = async () => {
     setIsExporting(true);
     try {
        // Serialize clips to base64
        const serializedClips = await Promise.all(clips.map(async (c) => {
             const wavBlob = audioEngine.bufferToWav(c.buffer);
             const base64 = await audioEngine.blobToBase64(wavBlob);
             return {
                 id: c.id, trackId: c.trackId, name: c.name,
                 startTime: c.startTime, duration: c.duration, offset: c.offset,
                 color: c.color, dataBase64: base64
             };
        }));

        const projectData: ProjectFile = {
            version: "1.0",
            date: new Date().toISOString(),
            tracks: tracks.map(({ id, name, volume, muted, soloed, playbackRate, color, effects }) => ({ 
                id, name, volume, muted, soloed, playbackRate, color, effects 
            })),
            clips: serializedClips
        };

        const jsonString = JSON.stringify(projectData);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webcraft_project.json`;
        a.click();
        URL.revokeObjectURL(url);
     } catch (e) { console.error(e); alert("Failed to save project."); } finally { setIsExporting(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans select-none relative">
      
      {/* Toolbar */}
      <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center px-4 space-x-4 shadow-md z-20 shrink-0">
        <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400 mr-2">WebCraft</div>
        <div className="flex items-center bg-gray-900 rounded-lg p-1 space-x-1 border border-gray-700">
          <button onClick={handleStop} className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"><Square size={18} fill="currentColor" /></button>
          <button onClick={handlePlayPause} className={`p-2 rounded transition flex items-center space-x-1 w-20 justify-center ${isPlaying ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}><span className="text-xs font-bold uppercase">{isPlaying ? 'Pause' : 'Play'}</span></button>
        </div>
        
        {/* Time Display */}
        <div className="flex flex-col items-center bg-black px-3 py-1 rounded border border-gray-700 min-w-[140px] shadow-inner">
           <div className="text-teal-400 font-mono text-lg leading-none">{formatTime(currentTime)}</div>
           <div className="text-gray-500 text-[10px] font-mono leading-none mt-1">TOTAL {formatTime(Math.max(projectEndTime, 60))}</div>
        </div>

        <div className="h-8 w-px bg-gray-700 mx-2"></div>
        <label className="flex items-center px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded cursor-pointer text-sm font-medium transition shadow-sm"><Upload size={16} className="mr-2" />Add Audio<input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" /></label>
        <button onClick={() => setShowAIModal(true)} className="flex items-center px-3 py-2 bg-gradient-to-r from-purple-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 rounded text-sm font-medium transition shadow-sm"><Wand2 size={16} className="mr-2" />AI</button>
        <button onClick={() => setShowCommercials(true)} className="flex items-center px-3 py-2 bg-yellow-600 hover:bg-yellow-500 rounded text-sm font-medium transition shadow-sm"><ShoppingBag size={16} className="mr-2" />Commercials</button>
        <div className="w-px h-8 bg-gray-700 mx-1"></div>
        <button onClick={handleSplitClip} disabled={!selectedClipId} className={`p-2 rounded transition ${selectedClipId ? 'text-white hover:bg-gray-700' : 'text-gray-600 cursor-not-allowed'}`}><Scissors size={20} /></button>
        <button onClick={handleDeleteClip} disabled={!selectedClipId} className={`p-2 rounded transition ${selectedClipId ? 'text-red-400 hover:bg-gray-700 hover:text-red-500' : 'text-gray-600 cursor-not-allowed'}`}><Trash2 size={20} /></button>
        <div className="flex-1"></div>
        <button onClick={handleSaveProject} disabled={isExporting} className="flex items-center px-3 py-2 bg-indigo-700 hover:bg-indigo-600 rounded text-sm font-medium transition"><Save size={16} className="mr-2" />Save Project</button>
        <button onClick={handleExportMp3} disabled={isExporting} className="flex items-center px-3 py-2 bg-teal-700 hover:bg-teal-600 rounded text-sm font-medium transition ml-2"><FileAudio size={16} className="mr-2"/>Export MP3</button>
        <button onClick={handleAddTrack} className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition ml-2"><Plus size={16} className="mr-2" />Track</button>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden" onClick={() => setSelectedClipId(null)}>
        {/* Tracks List */}
        <div className="w-[260px] bg-gray-800 flex flex-col z-10 shadow-xl overflow-y-auto pb-4 shrink-0 no-scrollbar">
          <div className="h-8 bg-gray-900 border-b border-gray-700 sticky top-0 flex items-center px-2 text-xs text-gray-500 font-bold uppercase tracking-wider z-20">Tracks</div>
          <div>
             {tracks.map(track => (
                <TrackHeader 
                  key={track.id} 
                  track={track} 
                  onUpdate={handleTrackUpdate} 
                  isSelected={selectedTrackId === track.id}
                  onClick={() => setSelectedTrackId(track.id)}
                  onRecord={handleRecord}
                  isRecording={recordingTrackId === track.id}
                  onOpenFx={(id) => setShowEffectsForTrack(id === showEffectsForTrack ? null : id)}
                />
              ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 bg-gray-900 relative overflow-x-auto overflow-y-auto" ref={timelineRef}>
          <div style={{ width: `${totalDuration * PIXELS_PER_SECOND}px`, minWidth: '100%' }}>
            {/* Ruler */}
            <div className="h-8 bg-gray-900 border-b border-gray-700 sticky top-0 z-30 flex items-end cursor-pointer group" onClick={handleTimelineClick}>
              {Array.from({ length: Math.ceil(totalDuration) }).map((_, s) => (
                <div key={s} className="absolute bottom-0 border-l border-gray-600 text-[10px] text-gray-500 pl-1 select-none pointer-events-none" style={{ left: s * PIXELS_PER_SECOND, height: s % 5 === 0 ? '100%' : '30%' }}>{s % 5 === 0 && <span>{formatTime(s)}</span>}</div>
              ))}
            </div>
            {/* Grid & Tracks */}
            <div className="relative" ref={trackContainerRef}>
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: Math.ceil(totalDuration / 5) }).map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-l border-gray-800" style={{ left: i * 5 * PIXELS_PER_SECOND }}/>
                ))}
              </div>
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-40 pointer-events-none shadow-[0_0_5px_rgba(239,68,68,0.8)]" style={{ left: currentTime * PIXELS_PER_SECOND, height: tracks.length * TRACK_HEIGHT }}>
                <div className="w-3 h-3 bg-red-500 -ml-1.5 transform rotate-45 -mt-1.5"></div>
              </div>
              {tracks.map(track => (
                <div key={track.id} className={`relative border-b border-gray-800 transition-colors ${selectedTrackId === track.id ? 'bg-gray-800/40' : ''}`} style={{ height: TRACK_HEIGHT }} onClick={(e) => { e.stopPropagation(); setSelectedTrackId(track.id); }}>
                   {clips.filter(c => c.trackId === track.id).map(clip => (
                     <ClipView key={clip.id} clip={clip} playbackRate={track.playbackRate || 1.0} isSelected={selectedClipId === clip.id} onMouseDown={(e) => handleClipMouseDown(e, clip.id)}/>
                   ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Effects Panel (Sidebar) */}
      {showEffectsForTrack && (
         <EffectsPanel 
            track={tracks.find(t => t.id === showEffectsForTrack)!} 
            onUpdate={handleTrackUpdate} 
            onClose={() => setShowEffectsForTrack(null)}
         />
      )}

      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-96 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-900 to-gray-800 border-b border-gray-700"><h2 className="text-lg font-bold text-white flex items-center"><Wand2 size={18} className="mr-2 text-pink-400" />AI Sample Generator</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-gray-400 uppercase mb-1">Prompt</label><textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Text to speech..." className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white outline-none resize-none h-24"/></div>
              <div><label className="block text-xs font-medium text-gray-400 uppercase mb-1">Voice</label><div className="grid grid-cols-3 gap-2">{(['Kore', 'Puck', 'Fenrir'] as const).map((v) => (<button key={v} onClick={() => setAiVoice(v)} className={`py-2 text-sm rounded border ${aiVoice === v ? 'bg-pink-600 border-pink-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>{v}</button>))}</div></div>
              <div className="flex justify-between pt-2"><button onClick={() => setShowAIModal(false)} className="px-4 py-2 rounded text-gray-400 hover:text-white">Cancel</button><button onClick={handleGenerateAI} disabled={isGenerating || !aiPrompt} className="px-4 py-2 rounded bg-pink-600 text-white">{isGenerating ? 'Generating...' : 'Generate'}</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Commercials Modal */}
      {showCommercials && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-[500px]">
            <div className="p-4 bg-gradient-to-r from-yellow-700 to-gray-800 border-b border-gray-700"><h2 className="text-lg font-bold text-white flex items-center"><ShoppingBag size={18} className="mr-2 text-yellow-400" />Insert Commercial</h2></div>
            
            <div className="p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Built-in</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                 {['Car Dealership', 'Soda Pop', 'Furniture Sale', 'Tech Store', 'Pizza Place', 'Lawyer Ad'].map(ad => (
                    <button key={ad} onClick={() => addCommercial(ad)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs text-center border border-gray-600 hover:border-yellow-500 transition">{ad}</button>
                 ))}
              </div>

              <div className="flex justify-between items-center mb-2">
                 <h3 className="text-xs font-bold text-gray-400 uppercase">My Commercials</h3>
                 <label className="cursor-pointer text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-white flex items-center"><Plus size={12} className="mr-1"/> Add New<input type="file" accept="audio/*" onChange={handleUploadCommercial} className="hidden"/></label>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-900 p-2 rounded border border-gray-700">
                 {customCommercials.length === 0 && <div className="text-gray-500 text-xs text-center py-4">No custom commercials uploaded.</div>}
                 {customCommercials.map((ad, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-800 p-2 rounded hover:bg-gray-750">
                       <span className="text-sm truncate">{ad.name}</span>
                       <div className="flex space-x-2">
                          <button onClick={() => addCommercial(ad.name, ad.buffer)} className="text-xs bg-green-700 hover:bg-green-600 px-2 py-1 rounded text-white">Insert</button>
                          <button onClick={() => setCustomCommercials(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-400"><Trash2 size={14}/></button>
                       </div>
                    </div>
                 ))}
              </div>
            </div>

            <div className="p-2 border-t border-gray-700 text-center"><button onClick={() => setShowCommercials(false)} className="text-gray-400 hover:text-white text-sm">Close</button></div>
          </div>
        </div>
      )}

      {/* Footer Status */}
      <div className="h-6 bg-gray-950 border-t border-gray-800 flex items-center px-4 text-xs text-gray-500 justify-between shrink-0">
         <div className="flex space-x-4">
            <span>{isRecording ? <span className="text-red-500 font-bold animate-pulse">RECORDING...</span> : (selectedClipId ? `Selected: ${clips.find(c => c.id === selectedClipId)?.name}` : 'Ready')}</span>
            <span>{selectedTrackId ? `Track: ${tracks.find(t => t.id === selectedTrackId)?.name}` : ''}</span>
         </div>
         <div className="flex items-center space-x-2">
            <Clock size={12}/>
            <span>Project End: {formatTime(Math.max(projectEndTime, 60))}</span>
         </div>
      </div>
    </div>
  );
}