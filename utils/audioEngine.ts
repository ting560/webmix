import { AudioClip, Track, TrackEffects } from '../types.ts';

interface TrackChain {
  input: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  delayNode: DelayNode;
  delayFeedback: GainNode;
  delayWet: GainNode;
  volume: GainNode;
}

class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private trackChains: Map<string, TrackChain> = new Map();
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  
  // Playback state
  private startTime: number = 0;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;

  // Recording state
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  constructor() {
    // Lazy initialization handled in init()
  }

  init() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  getContext(): AudioContext {
    this.init();
    return this.context!;
  }

  async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.getContext();
    // DecodeAudioData detaches the buffer, so we copy it if we need to reuse the original arrayBuffer later
    const bufferCopy = arrayBuffer.slice(0);
    return await ctx.decodeAudioData(bufferCopy);
  }

  // --- Effects Chain Management ---

  private createTrackChain(trackId: string): TrackChain {
    if (!this.context || !this.masterGain) throw new Error("AudioContext not initialized");

    // Create Nodes
    const input = this.context.createGain();
    
    // EQ (3-band)
    const eqLow = this.context.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;

    const eqMid = this.context.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1.0;

    const eqHigh = this.context.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;

    // Delay / Echo
    const delayNode = this.context.createDelay(2.0); // Max 2s delay
    const delayFeedback = this.context.createGain();
    const delayWet = this.context.createGain();

    const volume = this.context.createGain();

    // Wiring:
    // Input -> EQ Low -> EQ Mid -> EQ High -> Volume -> Master
    //                                     |-> Delay -> Wet -> Volume
    //                                     |<- Feedback <-|
    
    // Main Path
    input.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(volume); // Dry signal effectively goes to volume
    
    // Delay Path (Send style from after EQ)
    eqHigh.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode); // Feedback loop
    delayNode.connect(delayWet);
    delayWet.connect(volume); // Mix wet signal back into track volume

    // Master connection
    volume.connect(this.masterGain);

    const chain: TrackChain = {
      input,
      eqLow,
      eqMid,
      eqHigh,
      delayNode,
      delayFeedback,
      delayWet,
      volume
    };

    this.trackChains.set(trackId, chain);
    return chain;
  }

  updateTrackParams(track: Track) {
    if (!this.context) return;
    
    let chain = this.trackChains.get(track.id);
    if (!chain) {
      chain = this.createTrackChain(track.id);
    }

    const currentTime = this.context.currentTime;

    // Volume & Mute
    const targetVol = track.muted ? 0 : track.volume;
    chain.volume.gain.cancelScheduledValues(currentTime);
    chain.volume.gain.linearRampToValueAtTime(targetVol, currentTime + 0.05);

    // EQ
    chain.eqLow.gain.value = track.effects.eq.low;
    chain.eqMid.gain.value = track.effects.eq.mid;
    chain.eqHigh.gain.value = track.effects.eq.high;

    // Echo
    chain.delayNode.delayTime.value = track.effects.echo.time;
    chain.delayFeedback.gain.value = track.effects.echo.feedback;
    chain.delayWet.gain.value = track.effects.echo.amount;
  }

  // --- Playback ---

  play(clips: AudioClip[], tracks: Track[], startOffset: number) {
    if (this.isPlaying) this.stop();
    this.init();
    
    if (!this.context) return;

    this.isPlaying = true;
    this.startTime = this.context.currentTime - startOffset;
    this.pausedAt = startOffset;

    // Ensure all tracks have chains initialized
    tracks.forEach(t => this.updateTrackParams(t));

    // Schedule all clips
    clips.forEach(clip => {
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track || track.muted) return; 

      const playbackRate = track.playbackRate || 1.0;
      const effectiveDuration = clip.duration / playbackRate;
      const absoluteStartTime = clip.startTime;
      const absoluteEndTime = clip.startTime + effectiveDuration;

      if (absoluteEndTime < startOffset) return;

      const source = this.context!.createBufferSource();
      source.buffer = clip.buffer;
      source.playbackRate.value = playbackRate;

      // Connect to the Track Chain Input instead of Volume directly
      const chain = this.trackChains.get(clip.trackId);
      if (chain) {
        source.connect(chain.input);
      } else {
        // Fallback (shouldn't happen if updateTrackParams called)
        source.connect(this.masterGain!);
      }

      // Calculation logic (same as before)
      let whenToStart = 0;
      let offsetInBuffer = 0;
      let durationOfBufferToPlay = 0;

      if (absoluteStartTime >= startOffset) {
        whenToStart = this.context!.currentTime + (absoluteStartTime - startOffset);
        offsetInBuffer = clip.offset;
        durationOfBufferToPlay = clip.duration;
      } else {
        whenToStart = this.context!.currentTime;
        const timePassedOnTimeline = startOffset - absoluteStartTime;
        const timePassedInBuffer = timePassedOnTimeline * playbackRate;
        offsetInBuffer = clip.offset + timePassedInBuffer;
        durationOfBufferToPlay = clip.duration - timePassedInBuffer;
      }

      if (durationOfBufferToPlay > 0 && offsetInBuffer < clip.buffer.duration) {
         try {
            source.start(whenToStart, offsetInBuffer, durationOfBufferToPlay);
            this.activeSources.add(source);
            source.onended = () => {
              this.activeSources.delete(source);
            };
         } catch (e) {
            console.error("Error scheduling clip", e);
         }
      }
    });
  }

  stop() {
    this.activeSources.forEach(source => {
      try {
        source.stop();
      } catch (e) { }
    });
    this.activeSources.clear();
    this.isPlaying = false;
  }

  getCurrentTime(): number {
    if (!this.isPlaying || !this.context) return this.pausedAt;
    return this.context.currentTime - this.startTime;
  }

  // --- Recording ---

  async startRecording(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.recordedChunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start();
  }

  async stopRecording(): Promise<AudioBuffer | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        try {
           const audioBuffer = await this.decodeAudioData(arrayBuffer);
           resolve(audioBuffer);
        } catch (e) {
           console.error("Error decoding recording", e);
           resolve(null);
        }
        
        // Stop stream tracks to release microphone
        this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
        this.mediaRecorder = null;
      };

      this.mediaRecorder.stop();
    });
  }

  // --- Offline Rendering (Export) ---

  async renderOffline(clips: AudioClip[], tracks: Track[], totalDuration: number): Promise<AudioBuffer> {
    const sampleRate = 44100;
    const lengthInSamples = Math.ceil(totalDuration * sampleRate);
    const offlineCtx = new OfflineAudioContext(2, lengthInSamples, sampleRate);

    // Master
    const masterGain = offlineCtx.createGain();
    masterGain.connect(offlineCtx.destination);

    // Recreate Effect Chains for Offline Context
    const offlineTrackInputs = new Map<string, GainNode>();

    tracks.forEach(track => {
       const input = offlineCtx.createGain();
       const eqLow = offlineCtx.createBiquadFilter();
       eqLow.type = 'lowshelf'; eqLow.frequency.value = 320; eqLow.gain.value = track.effects.eq.low;
       
       const eqMid = offlineCtx.createBiquadFilter();
       eqMid.type = 'peaking'; eqMid.frequency.value = 1000; eqMid.Q.value = 1.0; eqMid.gain.value = track.effects.eq.mid;

       const eqHigh = offlineCtx.createBiquadFilter();
       eqHigh.type = 'highshelf'; eqHigh.frequency.value = 3200; eqHigh.gain.value = track.effects.eq.high;

       const delayNode = offlineCtx.createDelay(2.0);
       delayNode.delayTime.value = track.effects.echo.time;
       
       const delayFeedback = offlineCtx.createGain();
       delayFeedback.gain.value = track.effects.echo.feedback;
       
       const delayWet = offlineCtx.createGain();
       delayWet.gain.value = track.effects.echo.amount;

       const volume = offlineCtx.createGain();
       volume.gain.value = track.muted ? 0 : track.volume;

       input.connect(eqLow);
       eqLow.connect(eqMid);
       eqMid.connect(eqHigh);
       eqHigh.connect(volume);

       eqHigh.connect(delayNode);
       delayNode.connect(delayFeedback);
       delayFeedback.connect(delayNode);
       delayNode.connect(delayWet);
       delayWet.connect(volume);

       volume.connect(masterGain);
       offlineTrackInputs.set(track.id, input);
    });

    clips.forEach(clip => {
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track || track.muted) return;

      const trackInput = offlineTrackInputs.get(clip.trackId);
      if (!trackInput) return;

      const source = offlineCtx.createBufferSource();
      source.buffer = clip.buffer;
      source.playbackRate.value = track.playbackRate || 1.0;
      source.connect(trackInput);
      source.start(clip.startTime, clip.offset, clip.duration);
    });

    return await offlineCtx.startRendering();
  }

  async renderMp3(clips: AudioClip[], tracks: Track[], totalDuration: number): Promise<Blob> {
      const audioBuffer = await this.renderOffline(clips, tracks, totalDuration);
      
      // @ts-ignore
      if (typeof lamejs === 'undefined') {
          console.warn("lamejs not loaded. Falling back to WAV.");
          return this.bufferToWav(audioBuffer);
      }

      // @ts-ignore
      const mp3encoder = new lamejs.Mp3Encoder(audioBuffer.numberOfChannels, audioBuffer.sampleRate, 128); // 128kbps
      const mp3Data = [];

      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;

      const length = left.length;
      // Process in chunks to prevent freezing (simplistic approach for demo)
      const leftInt16 = new Int16Array(length);
      const rightInt16 = new Int16Array(length);

      for(let i=0; i<length; i++) {
        // Convert float32 to int16
        const l = Math.max(-1, Math.min(1, left[i]));
        leftInt16[i] = (l < 0 ? l * 0x8000 : l * 0x7FFF);
        
        const r = Math.max(-1, Math.min(1, right[i]));
        rightInt16[i] = (r < 0 ? r * 0x8000 : r * 0x7FFF);
      }

      const mp3buf = mp3encoder.encodeBuffer(leftInt16, rightInt16);
      if (mp3buf.length > 0) mp3Data.push(mp3buf);
      
      const mp3bufFlush = mp3encoder.flush();
      if (mp3bufFlush.length > 0) mp3Data.push(mp3bufFlush);

      return new Blob(mp3Data, { type: 'audio/mp3' });
  }

  // --- Utils for Saving ---

  async blobToBase64(blob: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
  }

  // Create simple WAV blob from AudioBuffer
  bufferToWav(abuffer: AudioBuffer): Blob {
    const numOfChan = abuffer.numberOfChannels;
    const length = abuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (i = 0; i < abuffer.numberOfChannels; i++)
      channels.push(abuffer.getChannelData(i));

    while (pos < abuffer.length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][pos]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        view.setInt16(44 + offset, sample, true);
        offset += 2;
      }
      pos++;
    }

    return new Blob([buffer], { type: 'audio/wav' });

    function setUint16(data: any) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data: any) { view.setUint32(pos, data, true); pos += 4; }
  }
}

export const audioEngine = new AudioEngine();