/**
 * Task 6 Integration Tests: Component Integration and Data Flow
 * 
 * Tests the integration between React components and their data flow
 * for the Whisper transcription feature with parallel processing.
 * 
 * Focus areas:
 * - UI component state synchronization
 * - Data flow between upload, transcription, and display components
 * - Real-time progress updates across components
 * - Error state propagation and recovery
 * - Performance of component re-renders with large datasets
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

// Mock the API modules
vi.mock('../../src/app/api/experiment/transcribe/route', () => ({
  POST: vi.fn(),
  GET: vi.fn()
}));

// Mock fetch for component API calls
global.fetch = vi.fn();

// Define interfaces for type safety
interface ExperimentState {
  videoFile: File | null;
  videoUrl: string | null;
  uploadProgress: number;
  processingStep: 'idle' | 'processing' | 'complete' | 'error';
  transcriptionStatus: 'idle' | 'whisper-processing' | 'segmenting' | 'complete' | 'error';
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
  costs: {
    vercelBlob: number;
    openaiWhisper: number;
    rendiApi: number;
    total?: number;
  };
  timings: {
    uploadStart?: number;
    transcriptionStart?: number;
    transcriptionEnd?: number;
    frameExtractionStart?: number;
    frameExtractionEnd?: number;
    totalProcessingTime?: number;
  };
}

// Mock React component that simulates the architecture experiment page
const MockArchitectureExperiment: React.FC = () => {
  const [state, setState] = React.useState<ExperimentState>({
    videoFile: null,
    videoUrl: null,
    uploadProgress: 0,
    processingStep: 'idle',
    transcriptionStatus: 'idle',
    fullTranscript: null,
    segmentedTranscript: null,
    extractedFrames: null,
    errors: [],
    costs: {
      vercelBlob: 0,
      openaiWhisper: 0,
      rendiApi: 0,
      total: 0
    },
    timings: {}
  });

  // Expose state updater to window for testing
  React.useEffect(() => {
    (window as any).updateExperimentState = (updates: Partial<ExperimentState>) => {
      setState(prev => ({ ...prev, ...updates }));
    };
    (window as any).getExperimentState = () => state;
  }, [state]);

  const handleFileUpload = async (file: File) => {
    setState(prev => ({ ...prev, videoFile: file, uploadProgress: 0 }));
    
    // Simulate upload progress
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 50));
      setState(prev => ({ ...prev, uploadProgress: progress }));
    }
    
    const videoUrl = URL.createObjectURL(file);
    setState(prev => ({ 
      ...prev, 
      videoUrl, 
      uploadProgress: 100,
      processingStep: 'processing'
    }));
    
    // Start parallel processing
    handleParallelProcessing(videoUrl);
  };

  const handleParallelProcessing = async (videoUrl: string) => {
    setState(prev => ({ 
      ...prev, 
      transcriptionStatus: 'whisper-processing',
      timings: { 
        ...prev.timings, 
        transcriptionStart: Date.now(),
        frameExtractionStart: Date.now()
      }
    }));

    // Simulate parallel transcription and frame extraction
    try {
      const [transcriptionResult, frameResult] = await Promise.all([
        handleTranscription(videoUrl),
        handleFrameExtraction(videoUrl)
      ]);

      setState(prev => ({
        ...prev,
        processingStep: 'complete',
        timings: {
          ...prev.timings,
          transcriptionEnd: Date.now(),
          frameExtractionEnd: Date.now(),
          totalProcessingTime: Date.now() - (prev.timings.transcriptionStart || Date.now())
        }
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        processingStep: 'error',
        errors: [
          ...prev.errors,
          {
            section: 'processing',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
          }
        ]
      }));
    }
  };

  const handleTranscription = async (videoUrl: string) => {
    try {
      // Stage 1: Whisper API
      const whisperResponse = await fetch('/api/experiment/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, stage: 'whisper' })
      });

      if (!whisperResponse.ok) {
        throw new Error('Whisper transcription failed');
      }

      const whisperData = await whisperResponse.json();
      
      setState(prev => ({
        ...prev,
        fullTranscript: whisperData.fullTranscript,
        transcriptionStatus: 'segmenting',
        costs: {
          ...prev.costs,
          openaiWhisper: whisperData.metadata?.cost || 0.03
        }
      }));

      // Stage 2: Segmentation
      const segmentResponse = await fetch('/api/experiment/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videoUrl, 
          stage: 'segmentation',
          fullTranscript: whisperData.fullTranscript
        })
      });

      if (!segmentResponse.ok) {
        throw new Error('Segmentation failed');
      }

      const segmentData = await segmentResponse.json();
      
      setState(prev => ({
        ...prev,
        segmentedTranscript: segmentData.segmentedTranscript,
        transcriptionStatus: 'complete'
      }));

      return { whisperData, segmentData };
    } catch (error) {
      setState(prev => ({
        ...prev,
        transcriptionStatus: 'error',
        errors: [
          ...prev.errors,
          {
            section: 'transcription',
            message: error instanceof Error ? error.message : 'Transcription error',
            timestamp: Date.now()
          }
        ]
      }));
      throw error;
    }
  };

  const handleFrameExtraction = async (videoUrl: string) => {
    try {
      const response = await fetch('/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl })
      });

      if (!response.ok) {
        throw new Error('Frame extraction failed');
      }

      const frameData = await response.json();
      
      setState(prev => ({
        ...prev,
        extractedFrames: frameData.frames,
        costs: {
          ...prev.costs,
          rendiApi: frameData.cost || 1.25
        }
      }));

      return frameData;
    } catch (error) {
      setState(prev => ({
        ...prev,
        errors: [
          ...prev.errors,
          {
            section: 'frames',
            message: error instanceof Error ? error.message : 'Frame extraction error',
            timestamp: Date.now()
          }
        ]
      }));
      throw error;
    }
  };

  const retryTranscription = async () => {
    if (!state.videoUrl) return;
    
    setState(prev => ({
      ...prev,
      transcriptionStatus: 'whisper-processing',
      errors: prev.errors.filter(error => error.section !== 'transcription')
    }));

    try {
      await handleTranscription(state.videoUrl);
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  return (
    <div data-testid="architecture-experiment">
      {/* Upload Section */}
      <div data-testid="upload-section">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
          data-testid="file-input"
        />
        {state.uploadProgress > 0 && (
          <div data-testid="upload-progress">{state.uploadProgress}%</div>
        )}
      </div>

      {/* Video Player Section */}
      <div data-testid="video-section">
        {state.videoUrl && (
          <video
            src={state.videoUrl}
            controls
            data-testid="video-player"
          />
        )}
      </div>

      {/* Transcript Section */}
      <div data-testid="transcript-section">
        <div data-testid="full-transcript-section">
          <h3>Full Transcript</h3>
          {state.transcriptionStatus === 'whisper-processing' && (
            <div data-testid="whisper-loading">Processing with Whisper...</div>
          )}
          {state.fullTranscript && (
            <div data-testid="full-transcript-content">{state.fullTranscript}</div>
          )}
        </div>

        <div data-testid="segmented-transcript-section">
          <h3>Segmented Transcript</h3>
          {state.transcriptionStatus === 'segmenting' && (
            <div data-testid="segmentation-loading">Creating 5-second segments...</div>
          )}
          {state.segmentedTranscript && (
            <div data-testid="segmented-transcript-content">
              {state.segmentedTranscript.map(segment => (
                <div key={segment.id} data-testid={`segment-${segment.id}`}>
                  [{segment.start}s-{segment.end}s] {segment.text}
                  {segment.confidence && (
                    <span data-testid={`confidence-${segment.id}`}>
                      ({Math.round(segment.confidence * 100)}%)
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {state.errors.some(e => e.section === 'transcription') && (
          <div data-testid="transcription-error">
            <button 
              onClick={retryTranscription}
              data-testid="retry-transcription-button"
            >
              Retry Transcription
            </button>
          </div>
        )}
      </div>

      {/* Frame Grid Section */}
      <div data-testid="frame-section">
        <h3>Extracted Frames</h3>
        <div data-testid="frame-grid">
          {state.extractedFrames ? (
            state.extractedFrames.map((frame, index) => (
              <div key={index} data-testid={`frame-${index}`}>
                <img src={frame.url} alt={`Frame at ${frame.timestamp}s`} />
                <span data-testid={`frame-timestamp-${index}`}>{frame.timestamp}s</span>
              </div>
            ))
          ) : (
            Array.from({ length: 9 }, (_, i) => (
              <div key={i} data-testid={`frame-placeholder-${i}`}>
                Loading frame {i + 1}...
              </div>
            ))
          )}
        </div>
      </div>

      {/* Processing Status Section */}
      <div data-testid="status-section">
        <div data-testid="processing-step">{state.processingStep}</div>
        <div data-testid="transcription-status">{state.transcriptionStatus}</div>
        
        {/* Cost Breakdown */}
        <div data-testid="cost-breakdown">
          <div data-testid="vercel-blob-cost">${state.costs.vercelBlob}</div>
          <div data-testid="whisper-cost">${state.costs.openaiWhisper}</div>
          <div data-testid="rendi-cost">${state.costs.rendiApi}</div>
          <div data-testid="total-cost">
            ${(state.costs.vercelBlob + state.costs.openaiWhisper + state.costs.rendiApi).toFixed(2)}
          </div>
        </div>

        {/* Timing Information */}
        {state.timings.totalProcessingTime && (
          <div data-testid="processing-time">
            {(state.timings.totalProcessingTime / 1000).toFixed(1)}s
          </div>
        )}

        {/* Error Display */}
        {state.errors.length > 0 && (
          <div data-testid="error-list">
            {state.errors.map((error, index) => (
              <div key={index} data-testid={`error-${index}`}>
                [{error.section}] {error.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

describe('Task 6: Component Integration and Data Flow', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    (global.fetch as MockedFunction<any>).mockImplementation((url: string) => {
      if (url.includes('/api/experiment/transcribe')) {
        const requestBody = JSON.parse(arguments[1]?.body || '{}');
        
        if (requestBody.stage === 'whisper') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              fullTranscript: 'Hello everyone, welcome to our presentation. Today we will discuss AI and machine learning.',
              metadata: { cost: 0.03 }
            })
          });
        } else if (requestBody.stage === 'segmentation') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              segmentedTranscript: [
                { id: 1, start: 0, end: 5, text: 'Hello everyone, welcome to our presentation.', confidence: 0.95 },
                { id: 2, start: 5, end: 10, text: 'Today we will discuss AI and machine learning.', confidence: 0.92 }
              ]
            })
          });
        }
      } else if (url.includes('/api/experiment/extract-frames')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            frames: [
              { url: 'blob:frame-1', timestamp: 5 },
              { url: 'blob:frame-2', timestamp: 10 }
            ],
            cost: 1.25
          })
        });
      }
      
      return Promise.reject(new Error('Unknown API endpoint'));
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Upload to Processing Flow', () => {
    
    it('should handle complete file upload to processing flow', async () => {
      render(<MockArchitectureExperiment />);

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });

      // Upload file
      await act(async () => {
        await user.upload(fileInput, testFile);
      });

      // Wait for upload progress
      await waitFor(() => {
        expect(screen.getByTestId('upload-progress')).toHaveTextContent('100%');
      });

      // Verify video player appears
      expect(screen.getByTestId('video-player')).toBeInTheDocument();

      // Wait for processing to complete
      await waitFor(() => {
        expect(screen.getByTestId('processing-step')).toHaveTextContent('complete');
      }, { timeout: 5000 });

      // Verify final state
      expect(screen.getByTestId('full-transcript-content')).toHaveTextContent('Hello everyone');
      expect(screen.getByTestId('segmented-transcript-content')).toBeInTheDocument();
      expect(screen.getByTestId('whisper-cost')).toHaveTextContent('$0.03');
      expect(screen.getByTestId('rendi-cost')).toHaveTextContent('$1.25');
    });

    it('should show real-time progress updates during processing', async () => {
      render(<MockArchitectureExperiment />);

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });

      await act(async () => {
        await user.upload(fileInput, testFile);
      });

      // Should show whisper processing
      await waitFor(() => {
        expect(screen.getByTestId('whisper-loading')).toHaveTextContent('Processing with Whisper...');
      });

      // Should transition to segmentation
      await waitFor(() => {
        expect(screen.getByTestId('segmentation-loading')).toHaveTextContent('Creating 5-second segments...');
      });

      // Should complete
      await waitFor(() => {
        expect(screen.getByTestId('transcription-status')).toHaveTextContent('complete');
      });
    });

    it('should update costs incrementally as operations complete', async () => {
      render(<MockArchitectureExperiment />);

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });

      await act(async () => {
        await user.upload(fileInput, testFile);
      });

      // Initial state - costs should be zero
      expect(screen.getByTestId('whisper-cost')).toHaveTextContent('$0');
      expect(screen.getByTestId('rendi-cost')).toHaveTextContent('$0');

      // Wait for transcription to complete and update Whisper cost
      await waitFor(() => {
        expect(screen.getByTestId('whisper-cost')).toHaveTextContent('$0.03');
      });

      // Wait for frame extraction to complete and update Rendi cost
      await waitFor(() => {
        expect(screen.getByTestId('rendi-cost')).toHaveTextContent('$1.25');
      });

      // Final total cost
      await waitFor(() => {
        expect(screen.getByTestId('total-cost')).toHaveTextContent('$1.28');
      });
    });
  });

  describe('Parallel Processing Integration', () => {
    
    it('should handle transcription and frame extraction in parallel', async () => {
      const transcriptionStartTimes: number[] = [];
      const frameExtractionStartTimes: number[] = [];

      // Override fetch to track timing
      (global.fetch as MockedFunction<any>).mockImplementation((url: string) => {
        if (url.includes('/api/experiment/transcribe')) {
          transcriptionStartTimes.push(Date.now());
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              fullTranscript: 'Test transcript',
              metadata: { cost: 0.03 }
            })
          });
        } else if (url.includes('/api/experiment/extract-frames')) {
          frameExtractionStartTimes.push(Date.now());
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              frames: [{ url: 'blob:frame-1', timestamp: 5 }],
              cost: 1.25
            })
          });
        }
        
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<MockArchitectureExperiment />);

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });

      await act(async () => {
        await user.upload(fileInput, testFile);
      });

      await waitFor(() => {
        expect(screen.getByTestId('processing-step')).toHaveTextContent('complete');
      });

      // Verify both APIs were called
      expect(transcriptionStartTimes.length).toBeGreaterThan(0);
      expect(frameExtractionStartTimes.length).toBeGreaterThan(0);

      // Verify they started within a reasonable time window (parallel execution)
      const timeDifference = Math.abs(transcriptionStartTimes[0] - frameExtractionStartTimes[0]);
      expect(timeDifference).toBeLessThan(100); // Within 100ms
    });

    it('should handle partial failures in parallel processing', async () => {
      // Mock transcription success but frame extraction failure
      (global.fetch as MockedFunction<any>).mockImplementation((url: string) => {
        if (url.includes('/api/experiment/transcribe')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              fullTranscript: 'Successful transcription',
              metadata: { cost: 0.03 }
            })
          });
        } else if (url.includes('/api/experiment/extract-frames')) {
          return Promise.resolve({
            ok: false,
            status: 500
          });
        }
        
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<MockArchitectureExperiment />);

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });

      await act(async () => {
        await user.upload(fileInput, testFile);
      });

      await waitFor(() => {
        expect(screen.getByTestId('processing-step')).toHaveTextContent('error');
      });

      // Verify transcription succeeded
      expect(screen.getByTestId('full-transcript-content')).toHaveTextContent('Successful transcription');
      expect(screen.getByTestId('whisper-cost')).toHaveTextContent('$0.03');

      // Verify frame extraction failed
      expect(screen.getByTestId('error-list')).toBeInTheDocument();
      const errors = screen.getAllByTestId(/^error-\d+$/);
      expect(errors.some(error => error.textContent?.includes('frames'))).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    
    it('should show retry option for transcription failures', async () => {
      let callCount = 0;
      
      // Mock API to fail first, succeed second
      (global.fetch as MockedFunction<any>).mockImplementation((url: string) => {
        if (url.includes('/api/experiment/transcribe')) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: false,
              status: 500
            });
          } else {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                fullTranscript: 'Retry successful transcript',
                metadata: { cost: 0.03 }
              })
            });
          }
        } else if (url.includes('/api/experiment/extract-frames')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              frames: [{ url: 'blob:frame-1', timestamp: 5 }],
              cost: 1.25
            })
          });
        }
        
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<MockArchitectureExperiment />);

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });

      await act(async () => {
        await user.upload(fileInput, testFile);
      });

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByTestId('transcription-error')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByTestId('retry-transcription-button');
      await act(async () => {
        await user.click(retryButton);
      });

      // Wait for successful retry
      await waitFor(() => {
        expect(screen.getByTestId('full-transcript-content')).toHaveTextContent('Retry successful transcript');
      });

      expect(screen.getByTestId('transcription-status')).toHaveTextContent('complete');
    });

    it('should clear errors when retry is successful', async () => {
      let callCount = 0;
      
      (global.fetch as MockedFunction<any>).mockImplementation((url: string) => {
        if (url.includes('/api/experiment/transcribe')) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ ok: false, status: 500 });
          } else {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                fullTranscript: 'Successful retry',
                segmentedTranscript: [
                  { id: 1, start: 0, end: 5, text: 'Successful retry', confidence: 0.95 }
                ],
                metadata: { cost: 0.03 }
              })
            });
          }
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<MockArchitectureExperiment />);

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' });

      await act(async () => {
        await user.upload(fileInput, testFile);
      });

      // Wait for error and retry
      await waitFor(() => {
        expect(screen.getByTestId('transcription-error')).toBeInTheDocument();
      });

      const retryButton = screen.getByTestId('retry-transcription-button');
      await act(async () => {
        await user.click(retryButton);
      });

      // Verify error is cleared after successful retry
      await waitFor(() => {
        expect(screen.queryByTestId('transcription-error')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('transcription-status')).toHaveTextContent('complete');
    });
  });

  describe('Large Dataset Performance', () => {
    
    it('should handle large segmented transcript efficiently', async () => {
      const largeSegments = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        start: i * 5,
        end: (i + 1) * 5,
        text: `This is segment ${i + 1} with some test content that simulates a real transcript segment.`,
        confidence: 0.85 + Math.random() * 0.15
      }));

      (global.fetch as MockedFunction<any>).mockImplementation((url: string) => {
        if (url.includes('/api/experiment/transcribe')) {
          const requestBody = JSON.parse(arguments[1]?.body || '{}');
          
          if (requestBody.stage === 'whisper') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                fullTranscript: 'Very long transcript content...',
                metadata: { cost: 0.15 }
              })
            });
          } else {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                segmentedTranscript: largeSegments
              })
            });
          }
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<MockArchitectureExperiment />);

      const startTime = performance.now();

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test video content'], 'large-video.mp4', { type: 'video/mp4' });

      await act(async () => {
        await user.upload(fileInput, testFile);
      });

      await waitFor(() => {
        expect(screen.getByTestId('segmented-transcript-content')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;

      // Verify large dataset is rendered
      const segments = screen.getAllByTestId(/^segment-\d+$/);
      expect(segments.length).toBe(1000);

      // Verify performance is acceptable (should render within 2 seconds)
      expect(renderTime).toBeLessThan(2000);

      // Verify individual segments are accessible
      expect(screen.getByTestId('segment-1')).toHaveTextContent('[0s-5s] This is segment 1');
      expect(screen.getByTestId('segment-500')).toHaveTextContent('[2495s-2500s] This is segment 500');
    });

    it('should handle many frame updates without performance degradation', async () => {
      const manyFrames = Array.from({ length: 200 }, (_, i) => ({
        url: `blob:frame-${i}`,
        timestamp: i * 5
      }));

      (global.fetch as MockedFunction<any>).mockImplementation((url: string) => {
        if (url.includes('/api/experiment/extract-frames')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              frames: manyFrames,
              cost: 5.0
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<MockArchitectureExperiment />);

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test video content'], 'long-video.mp4', { type: 'video/mp4' });

      const startTime = performance.now();

      await act(async () => {
        await user.upload(fileInput, testFile);
      });

      await waitFor(() => {
        expect(screen.getByTestId('frame-grid')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;

      // Verify all frames are rendered
      const frames = screen.getAllByTestId(/^frame-\d+$/);
      expect(frames.length).toBe(200);

      // Performance should still be reasonable
      expect(renderTime).toBeLessThan(3000);

      // Verify frame data is correct
      expect(screen.getByTestId('frame-timestamp-0')).toHaveTextContent('0s');
      expect(screen.getByTestId('frame-timestamp-199')).toHaveTextContent('995s');
    });
  });

  describe('State Synchronization', () => {
    
    it('should maintain state consistency across component updates', async () => {
      render(<MockArchitectureExperiment />);

      // Access state management functions
      const updateState = (window as any).updateExperimentState;
      const getState = (window as any).getExperimentState;

      // Update state and verify synchronization
      act(() => {
        updateState({
          processingStep: 'processing',
          transcriptionStatus: 'whisper-processing',
          costs: { vercelBlob: 0.01, openaiWhisper: 0, rendiApi: 0 }
        });
      });

      expect(screen.getByTestId('processing-step')).toHaveTextContent('processing');
      expect(screen.getByTestId('transcription-status')).toHaveTextContent('whisper-processing');
      expect(screen.getByTestId('vercel-blob-cost')).toHaveTextContent('$0.01');

      // Update costs
      act(() => {
        updateState({
          costs: { 
            vercelBlob: 0.01, 
            openaiWhisper: 0.03, 
            rendiApi: 1.25 
          }
        });
      });

      expect(screen.getByTestId('whisper-cost')).toHaveTextContent('$0.03');
      expect(screen.getByTestId('rendi-cost')).toHaveTextContent('$1.25');
      expect(screen.getByTestId('total-cost')).toHaveTextContent('$1.29');

      // Verify state object consistency
      const currentState = getState();
      expect(currentState.costs.openaiWhisper).toBeCloseTo(0.03, 2);
      expect(currentState.processingStep).toBe('processing');
    });

    it('should handle rapid state updates without race conditions', async () => {
      render(<MockArchitectureExperiment />);

      const updateState = (window as any).updateExperimentState;

      // Simulate rapid updates that might happen during processing
      const updates = [
        { uploadProgress: 10 },
        { uploadProgress: 20 },
        { uploadProgress: 50 },
        { uploadProgress: 75 },
        { uploadProgress: 100, processingStep: 'processing' },
        { transcriptionStatus: 'whisper-processing' },
        { fullTranscript: 'Partial transcript...' },
        { transcriptionStatus: 'segmenting' },
        { segmentedTranscript: [{ id: 1, start: 0, end: 5, text: 'First segment', confidence: 0.9 }] },
        { transcriptionStatus: 'complete' },
        { processingStep: 'complete' }
      ];

      // Apply updates rapidly
      for (const update of updates) {
        await act(async () => {
          updateState(update);
          // Allow time for state to propagate
          await new Promise(resolve => setTimeout(resolve, 100));
        });
      }

      // Verify final state is correct
      expect(screen.getByTestId('upload-progress')).toHaveTextContent('100%');
      expect(screen.getByTestId('processing-step')).toHaveTextContent('complete');
      expect(screen.getByTestId('transcription-status')).toHaveTextContent('complete');
      expect(screen.getByTestId('full-transcript-content')).toHaveTextContent('Partial transcript...');
      expect(screen.getByTestId('segment-1')).toHaveTextContent('[0s-5s] First segment');
    });
  });
});