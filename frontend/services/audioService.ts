import { Audio, AVPlaybackStatus } from 'expo-av';
import { useAudioStore, Book } from '../store/audioStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export class AudioService {
  private static updateInterval: NodeJS.Timeout | null = null;

  static async initAudio() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error('Error initializing audio:', error);
    }
  }

  static async loadAndPlayAudio(book: Book, startPosition: number = 0) {
    const store = useAudioStore.getState();
    
    try {
      store.setIsLoading(true);
      
      // Cleanup existing sound
      if (store.sound) {
        await store.sound.unloadAsync();
      }

      const currentFile = book.files[book.currentFileIndex];
      if (!currentFile) {
        console.error('No file found at index:', book.currentFileIndex);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: currentFile.uri },
        { shouldPlay: false, positionMillis: startPosition },
        this.onPlaybackStatusUpdate
      );

      store.setSound(sound);
      store.setCurrentBook(book);
      
      await sound.playAsync();
      store.setIsPlaying(true);
      
      // Start auto-save interval
      this.startAutoSave();
    } catch (error) {
      console.error('Error loading audio:', error);
    } finally {
      store.setIsLoading(false);
    }
  }

  static onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    const store = useAudioStore.getState();
    
    if (!status.isLoaded) {
      return;
    }

    store.setCurrentPosition(status.positionMillis);
    store.setDuration(status.durationMillis || 0);
    store.setIsPlaying(status.isPlaying);

    // Handle end of file
    if (status.didJustFinish && !status.isLooping) {
      this.handleTrackEnd();
    }
  };

  static async handleTrackEnd() {
    const store = useAudioStore.getState();
    const { currentBook } = store;

    if (!currentBook) return;

    // Check if there are more files
    if (currentBook.currentFileIndex < currentBook.files.length - 1) {
      // Play next file
      const nextBook = {
        ...currentBook,
        currentFileIndex: currentBook.currentFileIndex + 1,
      };
      await this.loadAndPlayAudio(nextBook, 0);
    } else {
      // Book finished
      store.setIsPlaying(false);
      await this.saveProgress();
    }
  }

  static async playPause() {
    const store = useAudioStore.getState();
    const { sound, isPlaying } = store;

    if (!sound) return;

    if (isPlaying) {
      await sound.pauseAsync();
      await this.saveProgress();
    } else {
      await sound.playAsync();
    }
  }

  static async seek(milliseconds: number) {
    const store = useAudioStore.getState();
    const { sound, currentPosition, duration } = store;

    if (!sound) return;

    const newPosition = Math.max(0, Math.min(currentPosition + milliseconds, duration));
    await sound.setPositionAsync(newPosition);
  }

  static async seekTo(position: number) {
    const store = useAudioStore.getState();
    const { sound } = store;

    if (!sound) return;

    await sound.setPositionAsync(position);
  }

  static async skipForward(seconds: number) {
    await this.seek(seconds * 1000);
  }

  static async skipBackward(seconds: number) {
    await this.seek(-seconds * 1000);
  }

  static async saveProgress() {
    const store = useAudioStore.getState();
    const { currentBook, currentPosition, duration } = store;

    if (!currentBook) return;

    try {
      await axios.post(`${API_URL}/api/progress`, {
        book_id: currentBook.id,
        position: currentPosition,
        duration: duration,
        current_file_index: currentBook.currentFileIndex,
      });

      // Also save locally
      await AsyncStorage.setItem(
        `book_progress_${currentBook.id}`,
        JSON.stringify({
          position: currentPosition,
          fileIndex: currentBook.currentFileIndex,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }

  static async loadProgress(bookId: string) {
    try {
      const response = await axios.get(`${API_URL}/api/progress/${bookId}`);
      return response.data;
    } catch (error) {
      console.error('Error loading progress:', error);
      return null;
    }
  }

  static async resetProgress(bookId: string) {
    try {
      await axios.delete(`${API_URL}/api/progress/${bookId}`);
      await AsyncStorage.removeItem(`book_progress_${bookId}`);
    } catch (error) {
      console.error('Error resetting progress:', error);
    }
  }

  static startAutoSave() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Save progress every 10 seconds
    this.updateInterval = setInterval(() => {
      this.saveProgress();
    }, 10000);
  }

  static stopAutoSave() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  static async cleanup() {
    this.stopAutoSave();
    await this.saveProgress();
    const store = useAudioStore.getState();
    await store.cleanup();
  }

  static startDelayedPlayback(book: Book, delayMinutes: number) {
    const store = useAudioStore.getState();
    
    // Clear any existing timeout
    if (store.delayTimeoutId) {
      clearTimeout(store.delayTimeoutId);
    }

    store.setIsDelayActive(true);
    store.setDelayStartTime(Date.now());

    const timeoutId = setTimeout(() => {
      this.loadAndPlayAudio(book, book.currentPosition);
      store.setIsDelayActive(false);
      store.setDelayStartTime(null);
    }, delayMinutes * 60 * 1000);

    store.setDelayTimeoutId(timeoutId);
  }

  static cancelDelayedPlayback() {
    const store = useAudioStore.getState();
    
    if (store.delayTimeoutId) {
      clearTimeout(store.delayTimeoutId);
      store.setDelayTimeoutId(null);
    }
    
    store.setIsDelayActive(false);
    store.setDelayStartTime(null);
  }
}
