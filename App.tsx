import React, { useState, useEffect, useRef } from 'react';
import { Track, AudioClip, SavedProject } from './types';
import { audioEngine } from './services/AudioEngine';
import { generateId, getRandomColor, base64ToArrayBuffer } from './services/audioUtils';
import Timeline from './components/Timeline';
import TrackControl from './components/TrackControl';
import EffectPanel from './components/EffectPanel';
import { 
    Play, Pause, Square, Plus, Scissors, Trash2, 
    Download, FileAudio, Menu, Save, FolderOpen, 
    Undo, Redo, Magnet 
} from 'lucide-react';

const App = () => {
  // --- STATE ---
  const [tracks, setTracks] = useState<Track[]>([]);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(50); // pixels per second
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [activeFxTrackId, setActiveFxTrackId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);

  // History for Undo/Redo
  const [history, setHistory] = useState<{tracks: Track[], clips: AudioClip[]}[]>([]);
  const [future, setFuture] = useState<{tracks: Track[], clips: AudioClip[]}[]>([]);

  // Refs
  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const offsetTimeRef = useRef<number>(0);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Only add default track if empty
    if (tracks.length === 0) {
        addTrack(true); // pass true to skip history on init
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- AUDIO LOOP ---
  useEffect(() => {
    if (isPlaying) {
      const loop = () => {
        const now = audioEngine.ctx.currentTime;
        const diff = now - startTimeRef.current;
        const newTime = offsetTimeRef.current + diff;
        setCurrentTime(newTime);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current!);
    }
    return () => cancelAnimationFrame(rafRef.current!);
  }, [isPlaying]);

  // --- HISTORY MANAGEMENT ---
  const pushHistory = () => {
    setHistory(prev => [...prev, { tracks, clips }]);
    setFuture([]); // Clear redo stack on new action
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture(prev => [{ tracks, clips }, ...prev]);
    
    // Restore
    setTracks(previous.tracks);
    setClips(previous.clips);
    setHistory(prev => prev.slice(0, -1));
    
    // Update Audio Engine
    previous.tracks.forEach(t => audioEngine.updateTrackParams(t));
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory(prev => [...prev, { tracks, clips }]);
    
    // Restore
    setTracks(next.tracks);
    setClips(next.clips);
    setFuture(prev => prev.slice(1));

    // Update Audio Engine
    next.tracks.forEach(t => audioEngine.updateTrackParams(t));
  };

  // --- ACTIONS ---

  const addTrack = (skipHistory = false) => {
    if (!skipHistory) pushHistory();
    const newTrack: Track = {
      id: generateId(),
      name: `Track ${tracks.length + 1}`,
      volume: 0.8,
      isMuted: false,
      isSolo: false,
      color: getRandomColor(),
      effects: {
        eqLow: 0, eqMid: 0, eqHigh: 0,
        delayTime: 0.3, delayFeedback: 0.3, delayMix: 0
      }
    };
    setTracks(prev => [...prev, newTrack]);
    audioEngine.setupTrack(newTrack);
  };

  const handleTrackUpdate = (updatedTrack: Track) => {
      // For slider updates (volume/effects), we generally don't push history on every pixel move.
      // In a full app, we'd push on "mouseUp". For now, we update state directly.
      setTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
      audioEngine.updateTrackParams(updatedTrack);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    pushHistory();

    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioEngine.ctx.decodeAudioData(arrayBuffer);
        const bufferId = generateId();
        audioEngine.addBuffer(bufferId, audioBuffer);

        // Find selected track or first track
        const trackId = tracks[0]?.id;
        if (!trackId) return;
        
        const newClip: AudioClip = {
            id: generateId(),
            bufferId,
            name: file.name,
            startTime: currentTime,
            offset: 0,
            duration: audioBuffer.duration,
            trackId,
            color: tracks.find(t => t.id === trackId)?.color || '#fff'
        };
        setClips(prev => [...prev, newClip]);
    } catch (err) {
        console.error("Error loading file", err);
        alert("Could not load audio file.");
    }
  };

  const handleSaveProject = async () => {
    if (tracks.length === 0) return;
    
    const bufferIds = clips.map(c => c.bufferId);
    const assets = await audioEngine.serializeBuffers(bufferIds);

    const project: SavedProject = {
        version: 1,
        state: { tracks, clips, zoom },
        assets
    };

    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleLoadProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const text = ev.target?.result as string;
              const project: SavedProject = JSON.parse(text);
              
              if (project.version !== 1) {
                  alert("Unknown project version");
                  return;
              }

              // Load Assets
              for (const [id, base64] of Object.entries(project.assets)) {
                  const ab = base64ToArrayBuffer(base64);
                  const audioBuf = await audioEngine.ctx.decodeAudioData(ab);
                  audioEngine.addBuffer(id, audioBuf);
              }

              // Load State
              setTracks(project.state.tracks);
              setClips(project.state.clips);
              setZoom(project.state.zoom || 50);
              
              // Reset History
              setHistory([]);
              setFuture([]);

              // Init Audio Engine
              audioEngine.stopAll();
              project.state.tracks.forEach(t => audioEngine.setupTrack(t));

          } catch (error) {
              console.error(error);
              alert("Failed to load project file.");
          }
      };
      reader.readAsText(file);
  };

  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const play = () => {
    audioEngine.resume();
    startTimeRef.current = audioEngine.ctx.currentTime;
    offsetTimeRef.current = currentTime;
    audioEngine.schedulePlayback(clips, currentTime, tracks);
    setIsPlaying(true);
  };

  const pause = () => {
    audioEngine.stopAll();
    setIsPlaying(false);
  };

  const stop = () => {
    pause();
    setCurrentTime(0);
  };

  const splitClip = () => {
    if (!selectedClipId) return;
    const clip = clips.find(c => c.id === selectedClipId);
    if (!clip) return;

    if (currentTime > clip.startTime && currentTime < clip.startTime + clip.duration) {
        pushHistory();
        const splitPoint = currentTime - clip.startTime;
        
        const updatedFirstHalf = { ...clip, duration: splitPoint };
        const secondHalf: AudioClip = {
            ...clip,
            id: generateId(),
            startTime: currentTime,
            offset: clip.offset + splitPoint,
            duration: clip.duration - splitPoint
        };

        setClips(prev => prev.map(c => c.id === clip.id ? updatedFirstHalf : c).concat(secondHalf));
        setSelectedClipId(null);
    }
  };

  const deleteClip = () => {
      if (selectedClipId) {
          pushHistory();
          setClips(prev => prev.filter(c => c.id !== selectedClipId));
          setSelectedClipId(null);
      }
  };

  const startRecording = async (trackId: string) => {
      if (isPlaying) stop();
      setIsRecording(true);
      try {
          const buffer = await audioEngine.recordAudio(trackId);
          const bufferId = generateId();
          audioEngine.addBuffer(bufferId, buffer);
          
          pushHistory(); // Add to history after recording
          
          const newClip: AudioClip = {
            id: generateId(),
            bufferId,
            name: `Rec ${new Date().toLocaleTimeString()}`,
            startTime: currentTime,
            offset: 0,
            duration: buffer.duration,
            trackId,
            color: '#ef4444'
        };
        setClips(prev => [...prev, newClip]);
      } catch (e) {
          console.error(e);
          alert("Recording failed or permission denied.");
      } finally {
          setIsRecording(false);
      }
  };

  const exportProject = async () => {
      if (clips.length === 0) return;
      const duration = Math.max(...clips.map(c => c.startTime + c.duration)) + 1;
      const blob = await audioEngine.exportProject(clips, tracks, duration);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'webcraft-mix.wav';
      a.click();
  };

  const formatTime = (time: number) => {
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      const ms = Math.floor((time % 1) * 100);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Update Clips (Drag & Drop) - Wrapped to handle snap and history
  const onClipUpdate = (updatedClip: AudioClip) => {
     let finalClip = updatedClip;
     
     if (snapToGrid) {
         // Snap to 1 second grid (can be improved to be dynamic based on zoom)
         const snapVal = 1.0; 
         const snappedStart = Math.round(updatedClip.startTime / snapVal) * snapVal;
         finalClip = { ...updatedClip, startTime: snappedStart };
     }

     setClips(prev => prev.map(c => c.id === finalClip.id ? finalClip : c));
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-neutral-200 font-sans overflow-hidden">
        {/* Top Bar / Transport */}
        <div className="h-14 md:h-16 bg-[#171717] border-b border-black flex items-center px-2 md:px-4 justify-between shadow-lg z-50 shrink-0 gap-2">
            
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
                <button className="md:hidden text-neutral-400" onClick={() => setSidebarOpen(!sidebarOpen)}>
                    <Menu size={20} />
                </button>
                <h1 className="hidden lg:block text-xl font-bold tracking-tighter text-blue-500 mr-2">WebCraft DAW</h1>
                
                {/* Save / Load / Undo Group */}
                <div className="flex items-center gap-1 bg-black/40 rounded p-1 border border-neutral-800">
                    <button onClick={handleSaveProject} className="p-2 hover:text-white text-neutral-400" title="Save Project"><Save size={16} /></button>
                    <label className="p-2 hover:text-white text-neutral-400 cursor-pointer" title="Load Project">
                        <FolderOpen size={16} />
                        <input type="file" accept=".json" onChange={handleLoadProject} className="hidden" />
                    </label>
                    <div className="w-px h-4 bg-neutral-700 mx-1"></div>
                    <button onClick={handleUndo} disabled={history.length === 0} className="p-2 hover:text-white text-neutral-400 disabled:opacity-30"><Undo size={16} /></button>
                    <button onClick={handleRedo} disabled={future.length === 0} className="p-2 hover:text-white text-neutral-400 disabled:opacity-30"><Redo size={16} /></button>
                </div>

                {/* Transport Controls */}
                <div className="flex items-center bg-black/40 rounded p-1 gap-1 border border-neutral-800">
                    <button onClick={stop} className="p-2 hover:bg-white/10 rounded text-neutral-400"><Square size={16} fill="currentColor" /></button>
                    <button onClick={togglePlay} className="p-2 hover:bg-white/10 rounded text-white">
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                    </button>
                    <div className="mx-2 font-mono text-sm md:text-xl text-green-500 bg-black px-2 md:px-3 py-1 rounded border border-neutral-800 shadow-inner min-w-[70px] md:min-w-[100px] text-center">
                        {formatTime(currentTime)}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 shrink-0">
                 <button 
                    onClick={() => setSnapToGrid(!snapToGrid)} 
                    className={`p-2 rounded border ${snapToGrid ? 'bg-blue-900 border-blue-500 text-white' : 'border-transparent text-neutral-500'}`} 
                    title="Snap to Grid"
                >
                    <Magnet size={18} />
                </button>

                <div className="h-6 w-px bg-neutral-700 mx-1 hidden md:block"></div>
                
                <button onClick={splitClip} disabled={!selectedClipId} className="p-2 hover:bg-white/10 rounded disabled:opacity-30" title="Split Clip">
                    <Scissors size={18} />
                </button>
                <button onClick={deleteClip} disabled={!selectedClipId} className="p-2 hover:bg-white/10 rounded disabled:opacity-30 hover:text-red-500" title="Delete Clip">
                    <Trash2 size={18} />
                </button>
                
                <div className="h-6 w-px bg-neutral-700 mx-1 hidden md:block"></div>
                
                <label className="cursor-pointer p-2 hover:bg-white/10 rounded flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white whitespace-nowrap">
                    <FileAudio size={18} />
                    <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                    <span className="hidden md:inline">IMPORT MP3</span>
                </label>
                
                <button onClick={exportProject} className="p-2 hover:bg-white/10 rounded flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-green-400 whitespace-nowrap">
                    <Download size={18} /> <span className="hidden md:inline">EXPORT WAV</span>
                </button>
            </div>
        </div>

        {/* Main Workspace */}
        <div className="flex flex-1 overflow-hidden relative">
            
            {/* Track Headers */}
            <div 
              className={`${sidebarOpen ? 'w-32 md:w-64 translate-x-0' : 'w-0 -translate-x-full opacity-0'} transition-all duration-300 bg-[#141414] border-r border-black flex flex-col overflow-y-auto z-10 shadow-xl shrink-0 absolute md:relative h-full`}
            >
                {tracks.map(track => (
                    <TrackControl 
                        key={track.id} 
                        track={track} 
                        onUpdate={handleTrackUpdate}
                        onOpenFx={(id) => setActiveFxTrackId(id === activeFxTrackId ? null : id)}
                        onRecord={startRecording}
                        isRecording={isRecording}
                    />
                ))}
                <div className="p-2">
                    <button onClick={() => addTrack()} className="w-full py-2 bg-[#202020] hover:bg-[#2a2a2a] text-neutral-400 text-xs font-bold rounded border border-neutral-700 flex items-center justify-center gap-2">
                        <Plus size={14} /> <span className="hidden md:inline">ADD TRACK</span>
                    </button>
                </div>
            </div>

            {/* Timeline */}
            <Timeline 
                tracks={tracks}
                clips={clips}
                currentTime={currentTime}
                zoom={zoom}
                onClipUpdate={onClipUpdate}
                onClipSelect={setSelectedClipId}
                selectedClipId={selectedClipId}
                onTimelineClick={(t) => {
                    setCurrentTime(t);
                    if(!isPlaying) {
                        startTimeRef.current = audioEngine.ctx.currentTime;
                        offsetTimeRef.current = t;
                    }
                }}
            />

            {/* FX Panel Sidebar */}
            {activeFxTrackId && (
                <div className="absolute right-0 top-0 bottom-0 z-40 shadow-2xl bg-[#1a1a1a] h-full">
                    <EffectPanel 
                        track={tracks.find(t => t.id === activeFxTrackId)!}
                        onUpdate={handleTrackUpdate}
                        onClose={() => setActiveFxTrackId(null)}
                    />
                </div>
            )}
        </div>
    </div>
  );
};

export default App;