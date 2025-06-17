/**
 * Task 6 Integration Tests: Database Integration
 * 
 * Tests database interactions and state persistence for the Whisper transcription feature.
 * Since this is an architecture experiment running standalone without a traditional database,
 * these tests focus on:
 * 
 * - Local storage persistence for experiment state
 * - Session storage for temporary processing data
 * - Browser storage APIs for cost tracking and timing data
 * - State recovery and data integrity
 * - Performance implications of state storage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock browser storage APIs
const mockLocalStorage = {
  store: new Map<string, string>(),
  getItem: vi.fn((key: string) => mockLocalStorage.store.get(key) || null),
  setItem: vi.fn((key: string, value: string) => mockLocalStorage.store.set(key, value)),
  removeItem: vi.fn((key: string) => mockLocalStorage.store.delete(key)),
  clear: vi.fn(() => mockLocalStorage.store.clear()),
  get length() { return mockLocalStorage.store.size; },
  key: vi.fn((index: number) => Array.from(mockLocalStorage.store.keys())[index] || null)
};

const mockSessionStorage = {
  store: new Map<string, string>(),
  getItem: vi.fn((key: string) => mockSessionStorage.store.get(key) || null),
  setItem: vi.fn((key: string, value: string) => mockSessionStorage.store.set(key, value)),
  removeItem: vi.fn((key: string) => mockSessionStorage.store.delete(key)),
  clear: vi.fn(() => mockSessionStorage.store.clear()),
  get length() { return mockSessionStorage.store.size; },
  key: vi.fn((index: number) => Array.from(mockSessionStorage.store.keys())[index] || null)
};

// Define the experiment state interface
interface ExperimentState {
  videoFile: File | null;
  videoUrl: string | null;
  uploadProgress: number;
  processingStep: 'idle' | 'processing' | 'complete' | 'error';
  fullTranscript: string | null;
  segmentedTranscript: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    confidence?: number;
  }> | null;
  extractedFrames: Array<{
    url: string;
    timestamp: number;
  }> | null;
  errors: Array<{
    section: string;
    message: string;
    timestamp: number;
  }>;
  timings: {
    uploadStart?: number;
    transcriptionStart?: number;
    transcriptionEnd?: number;
    frameExtractionStart?: number;
    frameExtractionEnd?: number;
    totalProcessingTime?: number;
  };
  costs: {
    vercelBlob: number;
    openaiWhisper: number;
    rendiApi: number;
    total?: number;
  };
}

describe('Task 6: Database Integration Tests', () => {
  
  beforeEach(() => {
    // Setup storage mocks
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    
    Object.defineProperty(global, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    });

    // Clear storage
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
  });

  describe('State Persistence', () => {
    
    it('should persist experiment state to localStorage', () => {
      const testState: ExperimentState = {
        videoFile: null,
        videoUrl: 'blob:test-video-url',
        uploadProgress: 100,
        processingStep: 'processing',
        fullTranscript: 'Hello everyone, welcome to our presentation.',
        segmentedTranscript: [
          { id: 1, start: 0, end: 5, text: 'Hello everyone, welcome to our presentation.', confidence: 0.95 }
        ],
        extractedFrames: [
          { url: 'frame-0.jpg', timestamp: 5 }
        ],
        errors: [],
        timings: {
          uploadStart: Date.now() - 10000,
          transcriptionStart: Date.now() - 8000,
          transcriptionEnd: Date.now() - 5000,
          totalProcessingTime: 3000
        },
        costs: {
          vercelBlob: 0.01,
          openaiWhisper: 0.03,
          rendiApi: 1.25,
          total: 1.29
        }
      };

      // Function to save state (simulating the actual app logic)
      const saveExperimentState = (state: ExperimentState) => {
        const serializedState = JSON.stringify({
          ...state,
          videoFile: null // Don't persist File objects
        });
        localStorage.setItem('pitch-perfect-experiment-state', serializedState);
      };

      saveExperimentState(testState);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'pitch-perfect-experiment-state',
        expect.stringContaining('"videoUrl":"blob:test-video-url"')
      );

      const storedData = mockLocalStorage.getItem('pitch-perfect-experiment-state');
      const parsedState = JSON.parse(storedData!);
      
      expect(parsedState.videoUrl).toBe('blob:test-video-url');
      expect(parsedState.processingStep).toBe('processing');
      expect(parsedState.costs.total).toBe(1.29);
    });

    it('should restore experiment state from localStorage', () => {
      const savedState = {
        videoFile: null,
        videoUrl: 'blob:restored-video-url',
        uploadProgress: 100,
        processingStep: 'complete',
        fullTranscript: 'Restored transcript text',
        segmentedTranscript: [
          { id: 1, start: 0, end: 5, text: 'Restored segment', confidence: 0.92 }
        ],
        extractedFrames: [
          { url: 'restored-frame.jpg', timestamp: 5 }
        ],
        errors: [],
        timings: {
          totalProcessingTime: 2500
        },
        costs: {
          vercelBlob: 0.02,
          openaiWhisper: 0.04,
          rendiApi: 1.30,
          total: 1.36
        }
      };

      mockLocalStorage.setItem('pitch-perfect-experiment-state', JSON.stringify(savedState));

      // Function to restore state (simulating the actual app logic)
      const restoreExperimentState = (): ExperimentState | null => {
        const storedData = localStorage.getItem('pitch-perfect-experiment-state');
        if (!storedData) return null;
        
        try {
          return JSON.parse(storedData) as ExperimentState;
        } catch (error) {
          console.error('Failed to parse stored state:', error);
          return null;
        }
      };

      const restoredState = restoreExperimentState();

      expect(restoredState).not.toBeNull();
      expect(restoredState!.videoUrl).toBe('blob:restored-video-url');
      expect(restoredState!.processingStep).toBe('complete');
      expect(restoredState!.fullTranscript).toBe('Restored transcript text');
      expect(restoredState!.costs.total).toBe(1.36);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      // Store corrupted JSON
      mockLocalStorage.setItem('pitch-perfect-experiment-state', '{"invalid": json}');

      const restoreExperimentState = (): ExperimentState | null => {
        const storedData = localStorage.getItem('pitch-perfect-experiment-state');
        if (!storedData) return null;
        
        try {
          return JSON.parse(storedData) as ExperimentState;
        } catch (error) {
          console.error('Failed to parse stored state:', error);
          localStorage.removeItem('pitch-perfect-experiment-state');
          return null;
        }
      };

      const restoredState = restoreExperimentState();

      expect(restoredState).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('pitch-perfect-experiment-state');
    });
  });

  describe('Temporary Data Management', () => {
    
    it('should store processing progress in sessionStorage', () => {
      const processingData = {
        transcriptionProgress: 65,
        segmentationProgress: 30,
        frameExtractionProgress: 80,
        currentStage: 'transcription',
        estimatedTimeRemaining: 45000
      };

      // Function to save processing data
      const saveProcessingProgress = (data: any) => {
        sessionStorage.setItem('pitch-perfect-processing-progress', JSON.stringify(data));
      };

      saveProcessingProgress(processingData);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'pitch-perfect-processing-progress',
        JSON.stringify(processingData)
      );

      const storedData = mockSessionStorage.getItem('pitch-perfect-processing-progress');
      const parsedData = JSON.parse(storedData!);
      
      expect(parsedData.transcriptionProgress).toBe(65);
      expect(parsedData.currentStage).toBe('transcription');
    });

    it('should clear temporary data after processing completion', () => {
      // Store some temporary processing data
      const tempData = {
        whisperIntermediateResults: ['partial', 'transcript', 'segments'],
        processingLogs: ['Started Whisper', 'Received response', 'Starting segmentation'],
        retryAttempts: 2
      };

      sessionStorage.setItem('pitch-perfect-temp-processing', JSON.stringify(tempData));
      sessionStorage.setItem('pitch-perfect-processing-progress', JSON.stringify({ progress: 100 }));

      // Function to clear temporary data
      const clearTemporaryData = () => {
        sessionStorage.removeItem('pitch-perfect-temp-processing');
        sessionStorage.removeItem('pitch-perfect-processing-progress');
      };

      clearTemporaryData();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('pitch-perfect-temp-processing');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('pitch-perfect-processing-progress');
    });
  });

  describe('Cost Tracking Persistence', () => {
    
    it('should persist cost tracking data across sessions', () => {
      const costHistory = [
        {
          timestamp: Date.now() - 86400000, // 1 day ago
          videoId: 'video-1',
          costs: { vercelBlob: 0.01, openaiWhisper: 0.03, rendiApi: 1.20, total: 1.24 },
          duration: 120
        },
        {
          timestamp: Date.now() - 43200000, // 12 hours ago
          videoId: 'video-2',
          costs: { vercelBlob: 0.02, openaiWhisper: 0.04, rendiApi: 1.30, total: 1.36 },
          duration: 180
        }
      ];

      // Function to save cost history
      const saveCostHistory = (history: any[]) => {
        localStorage.setItem('pitch-perfect-cost-history', JSON.stringify(history));
      };

      saveCostHistory(costHistory);

      const storedHistory = mockLocalStorage.getItem('pitch-perfect-cost-history');
      const parsedHistory = JSON.parse(storedHistory!);

      expect(parsedHistory).toHaveLength(2);
      expect(parsedHistory[0].costs.total).toBe(1.24);
      expect(parsedHistory[1].costs.total).toBe(1.36);
    });

    it('should calculate cumulative costs from stored history', () => {
      const costHistory = [
        { costs: { total: 1.24 } },
        { costs: { total: 1.36 } },
        { costs: { total: 0.98 } }
      ];

      localStorage.setItem('pitch-perfect-cost-history', JSON.stringify(costHistory));

      // Function to calculate cumulative costs
      const calculateCumulativeCosts = () => {
        const storedHistory = localStorage.getItem('pitch-perfect-cost-history');
        if (!storedHistory) return 0;

        const history = JSON.parse(storedHistory);
        return history.reduce((total: number, entry: any) => total + entry.costs.total, 0);
      };

      const totalCosts = calculateCumulativeCosts();
      expect(totalCosts).toBe(3.58); // 1.24 + 1.36 + 0.98
    });

    it('should limit cost history size to prevent storage bloat', () => {
      const maxHistoryEntries = 50;
      const existingHistory = Array.from({ length: 55 }, (_, i) => ({
        timestamp: Date.now() - (i * 3600000), // Hourly entries
        costs: { total: 1.00 + i * 0.01 }
      }));

      // Function to manage cost history size
      const addCostEntry = (newEntry: any) => {
        const storedHistory = localStorage.getItem('pitch-perfect-cost-history');
        let history = storedHistory ? JSON.parse(storedHistory) : [];
        
        history.unshift(newEntry); // Add to beginning
        
        // Keep only the most recent entries
        if (history.length > maxHistoryEntries) {
          history = history.slice(0, maxHistoryEntries);
        }
        
        localStorage.setItem('pitch-perfect-cost-history', JSON.stringify(history));
        return history.length;
      };

      // Setup existing history
      localStorage.setItem('pitch-perfect-cost-history', JSON.stringify(existingHistory));

      const newEntry = { timestamp: Date.now(), costs: { total: 2.00 } };
      const finalLength = addCostEntry(newEntry);

      expect(finalLength).toBe(maxHistoryEntries);
      
      const storedHistory = JSON.parse(mockLocalStorage.getItem('pitch-perfect-cost-history')!);
      expect(storedHistory).toHaveLength(maxHistoryEntries);
      expect(storedHistory[0].costs.total).toBe(2.00); // New entry at the beginning
    });
  });

  describe('Performance and Storage Optimization', () => {
    
    it('should handle large transcript data efficiently', () => {
      const largeTranscript = Array.from({ length: 10000 }, (_, i) => `Word${i}`).join(' ');
      const largeSegmentedData = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        start: i * 5,
        end: (i + 1) * 5,
        text: `This is segment ${i + 1} with some test content that is reasonably long.`,
        confidence: 0.85 + Math.random() * 0.15
      }));

      const largeState: ExperimentState = {
        videoFile: null,
        videoUrl: 'blob:large-video-url',
        uploadProgress: 100,
        processingStep: 'complete',
        fullTranscript: largeTranscript,
        segmentedTranscript: largeSegmentedData,
        extractedFrames: Array.from({ length: 200 }, (_, i) => ({
          url: `frame-${i}.jpg`,
          timestamp: i * 5
        })),
        errors: [],
        timings: { totalProcessingTime: 5000 },
        costs: { vercelBlob: 0.05, openaiWhisper: 0.15, rendiApi: 2.50, total: 2.70 }
      };

      const startTime = performance.now();
      
      // Test serialization performance
      const serialized = JSON.stringify(largeState);
      localStorage.setItem('pitch-perfect-large-state', serialized);
      
      const serializeTime = performance.now() - startTime;

      const retrieveStartTime = performance.now();
      
      // Test deserialization performance
      const retrieved = localStorage.getItem('pitch-perfect-large-state');
      const parsed = JSON.parse(retrieved!);
      
      const retrieveTime = performance.now() - retrieveStartTime;

      // Performance should be reasonable even for large datasets
      expect(serializeTime).toBeLessThan(100); // Less than 100ms to serialize
      expect(retrieveTime).toBeLessThan(50); // Less than 50ms to retrieve and parse
      expect(parsed.segmentedTranscript).toHaveLength(1000);
      expect(parsed.fullTranscript.length).toBeGreaterThan(50000);
    });

    it('should implement storage quota management', () => {
      // Mock storage quota exceeded scenario
      mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
        if (value.length > 1000000) { // Simulate 1MB limit
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }
        mockLocalStorage.store.set(key, value);
      });

      const hugeData = 'x'.repeat(1500000); // 1.5MB of data
      
      // Function to handle storage quota exceeded
      const safeStorageSet = (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
          return { success: true };
        } catch (error) {
          if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            // Clear old data and retry
            const historyKey = 'pitch-perfect-cost-history';
            localStorage.removeItem(historyKey);
            
            try {
              localStorage.setItem(key, value);
              return { success: true, clearedHistory: true };
            } catch (retryError) {
              return { success: false, error: 'Storage quota exceeded even after cleanup' };
            }
          }
          return { success: false, error: error.message };
        }
      };

      const result = safeStorageSet('test-key', hugeData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage quota exceeded');
    });

    it('should compress state data for storage efficiency', () => {
      const testState: ExperimentState = {
        videoFile: null,
        videoUrl: 'blob:test-video-url',
        uploadProgress: 100,
        processingStep: 'complete',
        fullTranscript: 'This is a sample transcript that will be compressed for storage efficiency testing.',
        segmentedTranscript: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          start: i * 5,
          end: (i + 1) * 5,
          text: `This is segment ${i + 1} with some test content.`,
          confidence: 0.9
        })),
        extractedFrames: Array.from({ length: 20 }, (_, i) => ({
          url: `frame-${i}.jpg`,
          timestamp: i * 5
        })),
        errors: [],
        timings: { totalProcessingTime: 3000 },
        costs: { vercelBlob: 0.01, openaiWhisper: 0.03, rendiApi: 1.25, total: 1.29 }
      };

      // Simple compression simulation (in real app, might use pako or similar)
      const compressState = (state: ExperimentState) => {
        const json = JSON.stringify(state);
        // Simulate compression by removing whitespace and common patterns
        const compressed = json
          .replace(/\s+/g, ' ')
          .replace(/"id":/g, '"i":')
          .replace(/"start":/g, '"s":')
          .replace(/"end":/g, '"e":')
          .replace(/"text":/g, '"t":')
          .replace(/"confidence":/g, '"c":');
        
        return compressed;
      };

      const decompressState = (compressed: string): ExperimentState => {
        const decompressed = compressed
          .replace(/"i":/g, '"id":')
          .replace(/"s":/g, '"start":')
          .replace(/"e":/g, '"end":')
          .replace(/"t":/g, '"text":')
          .replace(/"c":/g, '"confidence":');
        
        return JSON.parse(decompressed);
      };

      const originalSize = JSON.stringify(testState).length;
      const compressed = compressState(testState);
      const compressedSize = compressed.length;
      const decompressed = decompressState(compressed);

      expect(compressedSize).toBeLessThan(originalSize);
      expect(decompressed.processingStep).toBe(testState.processingStep);
      expect(decompressed.segmentedTranscript).toHaveLength(10);
      expect(decompressed.costs.total).toBe(1.29);
    });
  });

  describe('Error Recovery and Data Integrity', () => {
    
    it('should recover from storage corruption', () => {
      // Simulate partially written data
      mockLocalStorage.setItem('pitch-perfect-experiment-state', '{"videoUrl":"blob:test","processing');

      const recoverState = () => {
        try {
          const stored = localStorage.getItem('pitch-perfect-experiment-state');
          if (!stored) return null;
          
          return JSON.parse(stored);
        } catch (error) {
          console.warn('State corruption detected, initializing fresh state');
          localStorage.removeItem('pitch-perfect-experiment-state');
          
          // Return default state
          return {
            videoFile: null,
            videoUrl: null,
            uploadProgress: 0,
            processingStep: 'idle',
            fullTranscript: null,
            segmentedTranscript: null,
            extractedFrames: null,
            errors: [],
            timings: {},
            costs: { vercelBlob: 0, openaiWhisper: 0, rendiApi: 0, total: 0 }
          };
        }
      };

      const recoveredState = recoverState();

      expect(recoveredState).toBeDefined();
      expect(recoveredState.processingStep).toBe('idle');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('pitch-perfect-experiment-state');
    });

    it('should validate state integrity before use', () => {
      const validateState = (state: any): state is ExperimentState => {
        if (!state || typeof state !== 'object') return false;
        
        // Check required properties
        const requiredProps = ['processingStep', 'errors', 'timings', 'costs'];
        if (!requiredProps.every(prop => prop in state)) return false;
        
        // Validate specific types
        if (!['idle', 'processing', 'complete', 'error'].includes(state.processingStep)) return false;
        if (!Array.isArray(state.errors)) return false;
        if (typeof state.costs !== 'object') return false;
        
        return true;
      };

      // Test valid state
      const validState = {
        processingStep: 'complete',
        errors: [],
        timings: { totalProcessingTime: 5000 },
        costs: { vercelBlob: 0.01, openaiWhisper: 0.03, rendiApi: 1.25 }
      };

      expect(validateState(validState)).toBe(true);

      // Test invalid states
      expect(validateState(null)).toBe(false);
      expect(validateState({})).toBe(false);
      expect(validateState({ processingStep: 'invalid' })).toBe(false);
      expect(validateState({ processingStep: 'idle', errors: 'not-array' })).toBe(false);
    });

    it('should backup critical data before major operations', () => {
      const criticalState: ExperimentState = {
        videoFile: null,
        videoUrl: 'blob:critical-video',
        uploadProgress: 100,
        processingStep: 'complete',
        fullTranscript: 'Important transcript that should not be lost',
        segmentedTranscript: [
          { id: 1, start: 0, end: 5, text: 'Critical segment data', confidence: 0.95 }
        ],
        extractedFrames: [{ url: 'important-frame.jpg', timestamp: 5 }],
        errors: [],
        timings: { totalProcessingTime: 8000 },
        costs: { vercelBlob: 0.02, openaiWhisper: 0.05, rendiApi: 1.50, total: 1.57 }
      };

      // Function to create backup before major operations
      const createBackup = (state: ExperimentState) => {
        const backupKey = `pitch-perfect-backup-${Date.now()}`;
        const backupData = {
          timestamp: Date.now(),
          state: state
        };
        
        localStorage.setItem(backupKey, JSON.stringify(backupData));
        
        // Keep only the 3 most recent backups
        const allKeys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!)
          .filter(key => key.startsWith('pitch-perfect-backup-'));
        
        if (allKeys.length > 3) {
          const sortedKeys = allKeys.sort();
          const keysToRemove = sortedKeys.slice(0, sortedKeys.length - 3);
          keysToRemove.forEach(key => localStorage.removeItem(key));
        }
        
        return backupKey;
      };

      const backupKey = createBackup(criticalState);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        backupKey,
        expect.stringContaining('"fullTranscript":"Important transcript that should not be lost"')
      );

      // Verify backup can be restored
      const backupData = JSON.parse(mockLocalStorage.getItem(backupKey)!);
      expect(backupData.state.fullTranscript).toBe('Important transcript that should not be lost');
      expect(backupData.state.costs.total).toBe(1.57);
    });
  });
});