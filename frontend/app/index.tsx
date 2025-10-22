import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FileService } from '../services/fileService';
import { Book } from '../store/audioStore';
import { AudioService } from '../services/audioService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@audiobook_root_folder';

export default function Index() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rootFolder, setRootFolder] = useState<string | null>(null);

  useEffect(() => {
    initAudio();
    loadRootFolder();
  }, []);

  const initAudio = async () => {
    await AudioService.initAudio();
  };

  const loadRootFolder = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setRootFolder(saved);
        await scanFolder(saved);
      }
    } catch (error) {
      console.error('Error loading root folder:', error);
    }
  };

  const handleSelectFolder = async () => {
    setIsLoading(true);
    try {
      const folderUri = await FileService.selectFolder();
      if (folderUri) {
        setRootFolder(folderUri);
        await AsyncStorage.setItem(STORAGE_KEY, folderUri);
        await scanFolder(folderUri);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      Alert.alert('Error', 'Failed to select folder');
    } finally {
      setIsLoading(false);
    }
  };

  const scanFolder = async (folderUri: string) => {
    setIsLoading(true);
    try {
      const scannedBooks = await FileService.scanDirectory(folderUri);
      setBooks(scannedBooks);
    } catch (error) {
      console.error('Error scanning folder:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookPress = async (book: Book) => {
    try {
      // Load progress
      const progress = await AudioService.loadProgress(book.id);
      
      const bookWithProgress = {
        ...book,
        currentFileIndex: progress?.current_file_index || 0,
        currentPosition: progress?.position || 0,
      };

      // Navigate to player
      router.push({
        pathname: '/player',
        params: { bookData: JSON.stringify(bookWithProgress) },
      });
    } catch (error) {
      console.error('Error opening book:', error);
      Alert.alert('Error', 'Failed to open audiobook');
    }
  };

  const handleResetProgress = async (book: Book) => {
    Alert.alert(
      'Reset Progress',
      `Reset progress for "${book.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AudioService.resetProgress(book.id);
            Alert.alert('Success', 'Progress reset successfully');
          },
        },
      ]
    );
  };

  const renderBook = ({ item }: { item: Book }) => (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={() => handleBookPress(item)}
      onLongPress={() => handleResetProgress(item)}
    >
      <View style={styles.bookIcon}>
        <Ionicons name="book" size={32} color="#007AFF" />
      </View>
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.bookMeta}>
          {item.files.length} file{item.files.length !== 1 ? 's' : ''}
        </Text>
        {item.totalDuration > 0 && (
          <Text style={styles.bookDuration}>
            {FileService.formatDuration(item.totalDuration)}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={24} color="#999" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Smart Audiobook Player</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={handleSelectFolder}
          disabled={isLoading}
        >
          <Ionicons name="folder-open" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading audiobooks...</Text>
        </View>
      ) : books.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="folder-open-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No audiobooks found</Text>
          <TouchableOpacity style={styles.selectButton} onPress={handleSelectFolder}>
            <Text style={styles.selectButtonText}>Select Root Folder</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={books}
          renderItem={renderBook}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {rootFolder && books.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText} numberOfLines={1}>
            {books.length} book{books.length !== 1 ? 's' : ''} • Long press to reset progress
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsButton: {
    padding: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: '#999',
    marginBottom: 24,
  },
  selectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bookMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  bookDuration: {
    fontSize: 13,
    color: '#999',
  },
  separator: {
    height: 12,
  },
  footer: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
});
