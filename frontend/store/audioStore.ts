import { create } from 'zustand';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export interface AudioFile {
  uri: string;
  name: string;
  duration: number;
}

export interface Book {
  id: string;
  title: string;
  path: string;
  files: AudioFile[];
  totalDuration: number;
  is_series: boolean;
  series_name?: string;
  currentFileIndex: number;
  currentPosition: number;
}

interface AudioState {
  sound: Audio.Sound | null;
  isPlaying: boolean;
  currentBook: Book | null;
  currentPosition: number;
  duration: number;
  isLoading: boolean;
  delayMinutes: number;
  delayTimeoutId: NodeJS.Timeout | null;
  isDelayActive: boolean;
  delayStartTime: number | null;
  
  // Actions
  setSound: (sound: Audio.Sound | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentBook: (book: Book | null) => void;
  setCurrentPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setIsLoading: (loading: boolean) => void;
  setDelayMinutes: (minutes: number) => void;
  setDelayTimeoutId: (id: NodeJS.Timeout | null) => void;
  setIsDelayActive: (active: boolean) => void;
  setDelayStartTime: (time: number | null) => void;
  updateCurrentFileIndex: (index: number) => void;
  cleanup: () => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  sound: null,
  isPlaying: false,
  currentBook: null,
  currentPosition: 0,
  duration: 0,
  isLoading: false,
  delayMinutes: 5,
  delayTimeoutId: null,
  isDelayActive: false,
  delayStartTime: null,

  setSound: (sound) => set({ sound }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentBook: (book) => set({ currentBook: book }),
  setCurrentPosition: (position) => set({ currentPosition: position }),
  setDuration: (duration) => set({ duration: duration }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setDelayMinutes: (minutes) => set({ delayMinutes: minutes }),
  setDelayTimeoutId: (id) => set({ delayTimeoutId: id }),
  setIsDelayActive: (active) => set({ isDelayActive: active }),
  setDelayStartTime: (time) => set({ delayStartTime: time }),
  
  updateCurrentFileIndex: (index) => {
    const { currentBook } = get();
    if (currentBook) {
      set({
        currentBook: {
          ...currentBook,
          currentFileIndex: index,
        },
      });
    }
  },

  cleanup: async () => {
    const { sound, delayTimeoutId } = get();
    if (sound) {
      await sound.unloadAsync();
    }
    if (delayTimeoutId) {
      clearTimeout(delayTimeoutId);
    }
    set({
      sound: null,
      isPlaying: false,
      delayTimeoutId: null,
      isDelayActive: false,
      delayStartTime: null,
    });
  },
}));
