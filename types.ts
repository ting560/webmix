export interface EffectSettings {
  eqLow: number; // dB
  eqMid: number; // dB
  eqHigh: number; // dB
  delayTime: number; // seconds
  delayFeedback: number; // 0-1
  delayMix: number; // 0-1 (dry/wet)
}

export interface AudioClip {
  id: string;
  bufferId: string; // Key to the AudioBuffer map
  name: string;
  startTime: number; // Global timeline position (seconds)
  offset: number; // Start point within the source audio file (seconds)
  duration: number; // Length of the clip (seconds)
  trackId: string;
  color: string;
}

export interface Track {
  id: string;
  name: string;
  volume: number; // 0-1
  isMuted: boolean;
  isSolo: boolean;
  color: string;
  effects: EffectSettings;
}

export interface ProjectState {
  tracks: Track[];
  clips: AudioClip[];
  zoomPixelsPerSec: number;
}

// Structure for the saved JSON file
export interface SavedProject {
  version: number;
  state: {
    tracks: Track[];
    clips: AudioClip[];
    zoom: number;
  };
  assets: {
    [bufferId: string]: string; // Base64 encoded WAV/Audio data
  };
}

export type VoiceName = 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr' | 'Charon';