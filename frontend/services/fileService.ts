import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { Book, AudioFile } from '../store/audioStore';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'];

export class FileService {
  static async selectFolder(): Promise<string | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      return result.assets[0].uri;
    } catch (error) {
      console.error('Error selecting folder:', error);
      return null;
    }
  }

  static isAudioFile(fileName: string): boolean {
    return AUDIO_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  static async getAudioDuration(uri: string): Promise<number> {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      const status = await sound.getStatusAsync();
      await sound.unloadAsync();
      
      if (status.isLoaded && status.durationMillis) {
        return status.durationMillis;
      }
      return 0;
    } catch (error) {
      console.error('Error getting audio duration:', error);
      return 0;
    }
  }

  static async scanDirectory(directoryUri: string): Promise<Book[]> {
    const books: Book[] = [];

    try {
      // For Expo, we'll work with the document picker results
      // In a real implementation, you'd scan the actual directory
      // For now, we'll create a single book from the selected file
      
      const info = await FileSystem.getInfoAsync(directoryUri);
      if (!info.exists) {
        return books;
      }

      // Check if it's a file or directory
      const fileName = directoryUri.split('/').pop() || 'Unknown';
      
      if (this.isAudioFile(fileName)) {
        // Single audio file selected
        const duration = await this.getAudioDuration(directoryUri);
        const book: Book = {
          id: `book_${Date.now()}`,
          title: fileName.replace(/\.[^/.]+$/, ''),
          path: directoryUri,
          files: [
            {
              uri: directoryUri,
              name: fileName,
              duration: duration,
            },
          ],
          totalDuration: duration,
          is_series: false,
          currentFileIndex: 0,
          currentPosition: 0,
        };
        books.push(book);
        
        // Save to backend
        await this.saveBookToBackend(book);
      }

      return books;
    } catch (error) {
      console.error('Error scanning directory:', error);
      return books;
    }
  }

  static async saveBookToBackend(book: Book) {
    try {
      await axios.post(`${API_URL}/api/books`, {
        id: book.id,
        title: book.title,
        path: book.path,
        duration: book.totalDuration,
        is_series: book.is_series,
        series_name: book.series_name,
        file_count: book.files.length,
      });
    } catch (error) {
      console.error('Error saving book to backend:', error);
    }
  }

  static async getAllBooks(): Promise<Book[]> {
    try {
      const response = await axios.get(`${API_URL}/api/books`);
      // Convert backend books to full Book objects
      // Note: This is simplified - in production, you'd store file info differently
      return response.data.map((book: any) => ({
        ...book,
        files: [],
        currentFileIndex: 0,
        currentPosition: 0,
      }));
    } catch (error) {
      console.error('Error getting books:', error);
      return [];
    }
  }

  static formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
