export interface AudioClip {
  id: string;
  trackId: string;
  name: string;
  buffer: AudioBuffer;
  startTime: number; // in seconds
  duration: number; // in seconds
  offset: number; // start offset within the file
  color: string;
}

export interface TrackEffects {
  eq: {
    low: number; // -20 to 20 dB
    mid: number;
    high: number;
  };
  echo: {
    amount: number; // 0 to 1 (mix)
    feedback: number; // 0 to 0.9
    time: number; // 0 to 1s
  };
}

export interface Track {
  id: string;
  name: string;
  volume: number; // 0 to 1
  muted: boolean;
  soloed: boolean;
  playbackRate: number; // 0.5 to 2.0 default 1.0
  color: string;
  effects: TrackEffects;
}

export interface AudioEngineState {
  isPlaying: boolean;
  currentTime: number; // in seconds
  duration: number; // total project duration
}

export interface ProjectFile {
  version: string;
  date: string;
  tracks: Omit<Track, 'buffer'>[];
  clips: {
    id: string;
    trackId: string;
    name: string;
    startTime: number;
    duration: number;
    offset: number;
    color: string;
    dataBase64: string; // Serialized audio data
  }[];
}

export const TRACK_HEIGHT = 100;
export const PIXELS_PER_SECOND = 50;