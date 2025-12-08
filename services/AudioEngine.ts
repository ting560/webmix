import { AudioClip, Track } from "../types";
import { audioBufferToWav, arrayBufferToBase64 } from "./audioUtils";

class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  bufferMap: Map<string, AudioBuffer>;
  activeSources: Set<AudioBufferSourceNode>;
  
  // Track specific nodes [trackId] -> Nodes
  trackNodes: Map<string, {
    input: GainNode;
    eqLow: BiquadFilterNode;
    eqMid: BiquadFilterNode;
    eqHigh: BiquadFilterNode;
    delay: DelayNode;
    delayFeedback: GainNode;
    delayWet: GainNode; 
    volume: GainNode;
  }>;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.bufferMap = new Map();
    this.activeSources = new Set();
    this.trackNodes = new Map();
  }

  get currentTime() {
    return this.ctx.currentTime;
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  addBuffer(id: string, buffer: AudioBuffer) {
    this.bufferMap.set(id, buffer);
  }

  getBuffer(id: string) {
    return this.bufferMap.get(id);
  }

  setupTrack(track: Track) {
    if (this.trackNodes.has(track.id)) {
      this.updateTrackParams(track);
      return;
    }

    // Audio Graph:
    // Source -> Input Gain -> EQ -> Split -> [Dry -> Volume]
    //                                     -> [Delay -> FeedbackLoop -> DelayWet -> Volume]
    
    const input = this.ctx.createGain();
    
    // EQ
    const eqLow = this.ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;

    const eqMid = this.ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1.0;

    const eqHigh = this.ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;

    // Delay Setup
    const delay = this.ctx.createDelay(2.0); // Max delay 2s
    const delayFeedback = this.ctx.createGain();
    const delayWet = this.ctx.createGain();

    // Volume/Mute
    const volume = this.ctx.createGain();

    // Wiring
    input.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);

    // Dry Signal
    eqHigh.connect(volume);

    // Wet Signal (Echo)
    eqHigh.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay); // Loop back
    delay.connect(delayWet);
    delayWet.connect(volume);

    // Master
    volume.connect(this.masterGain);

    this.trackNodes.set(track.id, {
      input, eqLow, eqMid, eqHigh, delay, delayFeedback, delayWet, volume
    });

    this.updateTrackParams(track);
  }

  updateTrackParams(track: Track) {
    const nodes = this.trackNodes.get(track.id);
    if (!nodes) return;

    const vol = track.isMuted ? 0 : track.volume;
    nodes.volume.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);

    // EQ
    nodes.eqLow.gain.setTargetAtTime(track.effects.eqLow, this.ctx.currentTime, 0.1);
    nodes.eqMid.gain.setTargetAtTime(track.effects.eqMid, this.ctx.currentTime, 0.1);
    nodes.eqHigh.gain.setTargetAtTime(track.effects.eqHigh, this.ctx.currentTime, 0.1);

    // Delay
    // Clamp time to avoid glitches if 0
    const dTime = Math.max(0.01, track.effects.delayTime);
    nodes.delay.delayTime.setTargetAtTime(dTime, this.ctx.currentTime, 0.1);
    nodes.delayFeedback.gain.setTargetAtTime(track.effects.delayFeedback, this.ctx.currentTime, 0.1);
    nodes.delayWet.gain.setTargetAtTime(track.effects.delayMix, this.ctx.currentTime, 0.1);
  }

  stopAll() {
    this.activeSources.forEach(s => {
        try { s.stop(); } catch(e) {}
    });
    this.activeSources.clear();
  }

  schedulePlayback(clips: AudioClip[], startOffset: number, tracks: Track[]) {
    this.stopAll();
    this.resume();
    
    tracks.forEach(t => this.setupTrack(t));

    const startTime = this.ctx.currentTime; 

    clips.forEach(clip => {
        const buffer = this.bufferMap.get(clip.bufferId);
        const nodes = this.trackNodes.get(clip.trackId);
        
        if (!buffer || !nodes) return;

        if (clip.startTime >= startOffset) {
            const whenToPlay = startTime + (clip.startTime - startOffset);
            this.playSource(buffer, nodes.input, whenToPlay, clip.offset, clip.duration);
        } 
        else if (clip.startTime + clip.duration > startOffset) {
            const timeAlreadyPassed = startOffset - clip.startTime;
            const newOffset = clip.offset + timeAlreadyPassed;
            const remainingDur = clip.duration - timeAlreadyPassed;
            
            this.playSource(buffer, nodes.input, startTime, newOffset, remainingDur);
        }
    });
  }

  private playSource(buffer: AudioBuffer, destination: AudioNode, when: number, offset: number, duration: number) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(destination);
      source.start(when, offset, duration);
      this.activeSources.add(source);
      source.onended = () => this.activeSources.delete(source);
  }

  async recordAudio(trackId: string): Promise<AudioBuffer> {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      return new Promise((resolve, reject) => {
          mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
          mediaRecorder.onstop = async () => {
              const blob = new Blob(chunks, { type: 'audio/webm' });
              const arrayBuffer = await blob.arrayBuffer();
              const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
              stream.getTracks().forEach(t => t.stop());
              resolve(audioBuffer);
          };
          mediaRecorder.start();
      });
  }

  async exportProject(clips: AudioClip[], tracks: Track[], totalDuration: number): Promise<Blob> {
    // Offline Context logic is similar but mirrors the new Delay structure
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * 44100), 44100);
    const offlineTrackNodes = new Map();
    const offlineMaster = offlineCtx.createGain();
    offlineMaster.connect(offlineCtx.destination);

    tracks.forEach(track => {
         const input = offlineCtx.createGain();
         const eqLow = offlineCtx.createBiquadFilter(); eqLow.type = 'lowshelf'; eqLow.frequency.value = 320;
         const eqMid = offlineCtx.createBiquadFilter(); eqMid.type = 'peaking'; eqMid.frequency.value = 1000;
         const eqHigh = offlineCtx.createBiquadFilter(); eqHigh.type = 'highshelf'; eqHigh.frequency.value = 3200;
         
         const delay = offlineCtx.createDelay(2.0);
         const delayFeedback = offlineCtx.createGain();
         const delayWet = offlineCtx.createGain();
         
         const volume = offlineCtx.createGain();

         // Set Values
         const vol = track.isMuted ? 0 : track.volume;
         volume.gain.value = vol;
         eqLow.gain.value = track.effects.eqLow;
         eqMid.gain.value = track.effects.eqMid;
         eqHigh.gain.value = track.effects.eqHigh;
         
         const dTime = Math.max(0.01, track.effects.delayTime);
         delay.delayTime.value = dTime;
         delayFeedback.gain.value = track.effects.delayFeedback;
         delayWet.gain.value = track.effects.delayMix;

         // Connect Offline Graph
         input.connect(eqLow); eqLow.connect(eqMid); eqMid.connect(eqHigh);
         
         // Dry
         eqHigh.connect(volume);
         
         // Wet
         eqHigh.connect(delay);
         delay.connect(delayFeedback);
         delayFeedback.connect(delay);
         delay.connect(delayWet);
         delayWet.connect(volume);

         volume.connect(offlineMaster);

         offlineTrackNodes.set(track.id, input);
    });

    clips.forEach(clip => {
        const buffer = this.bufferMap.get(clip.bufferId);
        const dest = offlineTrackNodes.get(clip.trackId);
        if(!buffer || !dest) return;

        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(dest);
        source.start(clip.startTime, clip.offset, clip.duration);
    });

    const renderedBuffer = await offlineCtx.startRendering();
    const wavData = audioBufferToWav(renderedBuffer); 
    return new Blob([wavData], { type: 'audio/wav' });
  }

  // Helper for Saving: Convert all buffers in map to Base64 WAVs
  async serializeBuffers(activeClipBufferIds: string[]): Promise<{[key: string]: string}> {
    const assets: {[key: string]: string} = {};
    
    // De-dupe ids
    const uniqueIds = Array.from(new Set(activeClipBufferIds));

    for (const id of uniqueIds) {
      const buffer = this.bufferMap.get(id);
      if (buffer) {
        // Convert to WAV Dataview
        const wavView = audioBufferToWav(buffer);
        // Convert to Base64 string
        assets[id] = arrayBufferToBase64(wavView.buffer);
      }
    }
    return assets;
  }
}

export const audioEngine = new AudioEngine();