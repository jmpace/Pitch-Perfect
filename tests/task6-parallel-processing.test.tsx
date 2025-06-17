import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'

// Mock fetch for API calls
global.fetch = vi.fn()
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/test-video')

describe('Task 6: Parallel Processing State Management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetch).mockClear()
  })

  describe('🔴 RED Phase: Parallel Processing Unit Tests', () => {
    
    describe('Parallel Operations Initialization', () => {
      it('should initialize parallel processing state correctly', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        // Mock APIs for parallel operations
        vi.mocked(fetch)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ url: 'blob:test-video.mp4' })
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ frames: [], frameCount: 0 })
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ fullTranscript: '', segmentedTranscript: [] })
          } as Response)

        // Upload file to trigger parallel processing
        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' })
        
        await act(async () => {
          fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } })
        })

        // Should show parallel processing UI elements
        expect(screen.getByTestId('parallel-processing-container')).toBeInTheDocument()
        expect(screen.getByTestId('frame-extraction-section')).toBeInTheDocument()
        expect(screen.getByTestId('transcription-section')).toBeInTheDocument()
      })

      it('should track progress for both operations independently', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        // Simulate different progress for each operation
        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            processingStep: 'processing',
            extractionProgress: 45,
            transcriptionProgress: 67
          })
        })

        // Each operation should show its own progress
        expect(screen.getByTestId('frame-extraction-progress')).toHaveAttribute('aria-valuenow', '45')
        expect(screen.getByTestId('transcription-progress')).toHaveAttribute('aria-valuenow', '67')
      })

      it('should show estimated time remaining for parallel operations', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            processingStep: 'processing',
            timeEstimates: {
              frameExtraction: 45,
              transcription: 32
            }
          })
        })

        expect(screen.getByText('Frame extraction: ~45s remaining')).toBeInTheDocument()
        expect(screen.getByText('Transcription: ~32s remaining')).toBeInTheDocument()
      })
    })

    describe('Two-Stage Transcription Pipeline', () => {
      it('should handle Whisper API completion transitioning to segmentation', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        // Simulate Whisper API completion
        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            transcriptionStage: 'whisper_complete',
            whisperProgress: 100,
            segmentationProgress: 0,
            fullTranscript: 'Raw Whisper output'
          })
        })

        // Should show segmentation processing started
        expect(screen.getByTestId('segmentation-progress-bar')).toBeInTheDocument()
        expect(screen.getByText('Converting to 5-second segments...')).toBeInTheDocument()
        expect(screen.getByTestId('full-transcript-populated')).toBeInTheDocument()
      })

      it('should update segmentation progress independently', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            transcriptionStage: 'segmentation_in_progress',
            segmentationProgress: 73,
            fullTranscript: 'Complete transcript'
          })
        })

        expect(screen.getByTestId('segmentation-progress-bar')).toHaveAttribute('aria-valuenow', '73')
        expect(screen.getByText('Processing segments: 73%')).toBeInTheDocument()
      })

      it('should complete segmentation and populate segmented transcript', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        const segmentedTranscript = [
          { text: 'Hello everyone', startTime: 0, endTime: 5, confidence: 0.95 },
          { text: 'Welcome to our presentation', startTime: 5, endTime: 10, confidence: 0.92 }
        ]

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            transcriptionStage: 'segmentation_complete',
            segmentationProgress: 100,
            segmentedTranscript
          })
        })

        expect(screen.getByTestId('segmentation-complete-indicator')).toBeInTheDocument()
        expect(screen.getByTestId('segmented-transcript-populated')).toBeInTheDocument()
      })
    })

    describe('Completion State Management', () => {
      it('should handle transcription completing before frame extraction', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            transcriptionStage: 'complete',
            extractionProgress: 67,
            operationsRemaining: 1
          })
        })

        expect(screen.getByTestId('transcription-complete-status')).toBeInTheDocument()
        expect(screen.getByText('Processing video... (1 operation remaining)')).toBeInTheDocument()
        expect(screen.getByTestId('frame-extraction-progress')).toHaveAttribute('aria-valuenow', '67')
      })

      it('should handle frame extraction completing before transcription', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            extractionProgress: 100,
            extractedFrames: [
              { url: 'frame1.jpg', timestamp: 5, filename: 'frame_00m05s.png' }
            ],
            transcriptionStage: 'whisper_in_progress',
            transcriptionProgress: 54,
            operationsRemaining: 1
          })
        })

        expect(screen.getByTestId('frame-extraction-complete-status')).toBeInTheDocument()
        expect(screen.getByText('Processing video... (1 operation remaining)')).toBeInTheDocument()
        expect(screen.getByTestId('transcription-progress')).toHaveAttribute('aria-valuenow', '54')
      })

      it('should show completion state when both operations finish', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            processingStep: 'complete',
            extractionProgress: 100,
            transcriptionStage: 'complete',
            operationsRemaining: 0
          })
        })

        expect(screen.getByTestId('processing-complete-status')).toBeInTheDocument()
        expect(screen.getByText('Processing complete!')).toBeInTheDocument()
        expect(screen.getByTestId('celebration-animation')).toBeInTheDocument()
      })
    })

    describe('Error Handling in Parallel Processing', () => {
      it('should handle partial failure - transcription fails, frames succeed', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            extractionProgress: 100,
            extractedFrames: [{ url: 'frame1.jpg', timestamp: 5, filename: 'frame1.png' }],
            transcriptionError: 'Whisper API failed',
            operationsRemaining: 0
          })
        })

        expect(screen.getByTestId('frame-extraction-complete-status')).toBeInTheDocument()
        expect(screen.getByTestId('transcription-error-status')).toBeInTheDocument()
        expect(screen.getByTestId('retry-transcription-button')).toBeInTheDocument()
      })

      it('should handle segmentation failure with full transcript available', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            extractionProgress: 100,
            fullTranscript: 'Complete transcript available',
            segmentationError: 'Python segmentation script failed',
            transcriptionStage: 'segmentation_failed'
          })
        })

        expect(screen.getByTestId('full-transcript-available')).toBeInTheDocument()
        expect(screen.getByTestId('segmentation-error-status')).toBeInTheDocument()
        expect(screen.getByTestId('retry-segmentation-button')).toBeInTheDocument()
      })

      it('should handle network recovery affecting parallel operations', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        // Simulate network interruption
        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            networkStatus: 'offline',
            extractionProgress: 45,
            transcriptionProgress: 67
          })
        })

        expect(screen.getByText('Connection lost - Retrying...')).toBeInTheDocument()

        // Simulate recovery
        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            networkStatus: 'online',
            extractionProgress: 0, // Frame extraction resumes from checkpoint
            transcriptionProgress: 0 // Transcription restarts (API can't resume)
          })
        })

        expect(screen.getByText('Connection restored - Resuming...')).toBeInTheDocument()
        expect(screen.getByText('Restarting Whisper transcription...')).toBeInTheDocument()
      })
    })

    describe('Progress Indicator Components', () => {
      it('should render dual progress bars with correct styling', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            processingStep: 'processing',
            extractionProgress: 35,
            transcriptionProgress: 68
          })
        })

        const frameProgress = screen.getByTestId('frame-extraction-progress')
        const transcriptionProgress = screen.getByTestId('transcription-progress')

        expect(frameProgress).toHaveClass('bg-blue-500') // Blue fill color
        expect(transcriptionProgress).toHaveClass('bg-green-500') // Green fill color
        
        expect(screen.getByText('Extracting frames: 35%')).toBeInTheDocument()
        expect(screen.getByText('Transcribing audio: 68%')).toBeInTheDocument()
      })

      it('should show parallel processing icon when both operations are running', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            processingStep: 'processing',
            parallelOperationsActive: true
          })
        })

        expect(screen.getByTestId('parallel-processing-icon')).toBeInTheDocument()
        expect(screen.getByText('⫸')).toBeInTheDocument() // Parallel processing icon
      })
    })
  })
})