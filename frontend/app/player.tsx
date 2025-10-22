import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAudioStore, Book } from '../store/audioStore';
import { AudioService } from '../services/audioService';
import { FileService } from '../services/fileService';
import Slider from '@react-native-community/slider';

export default function Player() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [book, setBook] = useState<Book | null>(null);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayInput, setDelayInput] = useState('5');
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  const {
    isPlaying,
    currentPosition,
    duration,
    isLoading,
    isDelayActive,
    delayStartTime,
    delayMinutes,
  } = useAudioStore();

  useEffect(() => {
    if (params.bookData && typeof params.bookData === 'string') {
      const parsedBook = JSON.parse(params.bookData) as Book;
      setBook(parsedBook);
      loadBook(parsedBook);
    }

    return () => {
      AudioService.cleanup();
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isDelayActive && delayStartTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - delayStartTime;
        const remaining = (delayMinutes * 60 * 1000) - elapsed;
        
        if (remaining <= 0) {
          setRemainingTime(null);
        } else {
          setRemainingTime(remaining);
        }
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDelayActive, delayStartTime, delayMinutes]);

  const loadBook = async (bookToLoad: Book) => {
    try {
      await AudioService.loadAndPlayAudio(bookToLoad, bookToLoad.currentPosition);
    } catch (error) {
      console.error('Error loading book:', error);
      Alert.alert('Error', 'Failed to load audiobook');
    }
  };

  const handlePlayPause = async () => {
    if (isDelayActive) {
      AudioService.cancelDelayedPlayback();
      return;
    }
    await AudioService.playPause();
  };

  const handleSkipForward = async (seconds: number) => {
    await AudioService.skipForward(seconds);
  };

  const handleSkipBackward = async (seconds: number) => {
    await AudioService.skipBackward(seconds);
  };

  const handleSliderChange = async (value: number) => {
    await AudioService.seekTo(value);
  };

  const handleDelayPlay = () => {
    setShowDelayModal(true);
  };

  const startDelayedPlayback = () => {
    const minutes = parseInt(delayInput, 10);
    if (isNaN(minutes) || minutes <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of minutes');
      return;
    }

    if (book) {
      AudioService.startDelayedPlayback(book, minutes);
      setShowDelayModal(false);
      Alert.alert('Delay Set', `Playback will start in ${minutes} minute${minutes !== 1 ? 's' : ''}`);
    }
  };

  const cancelDelay = () => {
    AudioService.cancelDelayedPlayback();
    setRemainingTime(null);
  };

  const formatTime = (ms: number) => {
    return FileService.formatDuration(ms);
  };

  const formatDelayTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!book) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  const progress = duration > 0 ? currentPosition / duration : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {book.title}
        </Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <View style={styles.albumArt}>
          <Ionicons name="musical-notes" size={80} color="#007AFF" />
        </View>

        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>

        {book.files.length > 1 && (
          <Text style={styles.fileInfo}>
            File {book.currentFileIndex + 1} of {book.files.length}
          </Text>
        )}

        {isDelayActive && remainingTime !== null && (
          <View style={styles.delayInfo}>
            <Ionicons name="timer-outline" size={20} color="#FF9500" />
            <Text style={styles.delayText}>
              Starting in {formatDelayTime(remainingTime)}
            </Text>
          </View>
        )}

        <View style={styles.progressContainer}>
          <Slider
            style={styles.slider}
            value={currentPosition}
            minimumValue={0}
            maximumValue={duration || 1}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#d3d3d3"
            thumbTintColor="#007AFF"
            onSlidingComplete={handleSliderChange}
            disabled={isDelayActive}
          />
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(currentPosition)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => handleSkipBackward(60)}
            disabled={isDelayActive}
          >
            <Ionicons name="play-back" size={32} color={isDelayActive ? '#ccc' : '#333'} />
            <Text style={[styles.controlLabel, isDelayActive && styles.disabledText]}>-1m</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => handleSkipBackward(10)}
            disabled={isDelayActive}
          >
            <Ionicons name="play-skip-back" size={28} color={isDelayActive ? '#ccc' : '#333'} />
            <Text style={[styles.controlLabel, isDelayActive && styles.disabledText]}>-10s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : isDelayActive ? (
              <Ionicons name="close" size={48} color="#fff" />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={48}
                color="#fff"
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => handleSkipForward(10)}
            disabled={isDelayActive}
          >
            <Ionicons name="play-skip-forward" size={28} color={isDelayActive ? '#ccc' : '#333'} />
            <Text style={[styles.controlLabel, isDelayActive && styles.disabledText]}>+10s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => handleSkipForward(60)}
            disabled={isDelayActive}
          >
            <Ionicons name="play-forward" size={32} color={isDelayActive ? '#ccc' : '#333'} />
            <Text style={[styles.controlLabel, isDelayActive && styles.disabledText]}>+1m</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.additionalControls}>
          {isDelayActive ? (
            <TouchableOpacity style={styles.delayButton} onPress={cancelDelay}>
              <Ionicons name="close-circle" size={24} color="#FF3B30" />
              <Text style={styles.delayButtonText}>Cancel Delay</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.delayButton} onPress={handleDelayPlay}>
              <Ionicons name="timer" size={24} color="#007AFF" />
              <Text style={styles.delayButtonText}>Delay Play</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        visible={showDelayModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDelayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Delay Timer</Text>
            <Text style={styles.modalSubtitle}>Minutes until playback starts</Text>
            
            <TextInput
              style={styles.input}
              value={delayInput}
              onChangeText={setDelayInput}
              keyboardType="number-pad"
              placeholder="Enter minutes"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDelayModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={startDelayedPlayback}
              >
                <Text style={styles.confirmButtonText}>Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumArt: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#e8f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  bookTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  fileInfo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  delayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5E6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  delayText: {
    fontSize: 16,
    color: '#FF9500',
    fontWeight: '600',
    marginLeft: 8,
  },
  progressContainer: {
    marginVertical: 24,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 13,
    color: '#666',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 24,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
  },
  controlLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  disabledText: {
    color: '#ccc',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  additionalControls: {
    alignItems: 'center',
    marginTop: 16,
  },
  delayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  delayButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
