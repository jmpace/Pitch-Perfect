import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/test-video')

describe('Task 6: Whisper Transcription Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock
    vi.mocked(fetch).mockClear()
  })

  describe('🔴 RED Phase: Failing Tests for Whisper Transcription Components', () => {
    
    describe('Parallel Processing State Management', () => {
      it('should start both frame extraction and transcription simultaneously after upload', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Wait for loading to complete
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        // Mock successful upload response
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ url: 'https://blob.vercel-storage.com/test-video.mp4' })
        } as Response)

        // Upload a file to trigger parallel processing
        const file = new File(['test video content'], 'test-video.mp4', { type: 'video/mp4' })
        const uploadInput = screen.getByTestId('file-input')
        fireEvent.change(uploadInput, { target: { files: [file] } })

        // Should show parallel processing indicators
        await waitFor(() => {
          expect(screen.getByTestId('frame-extraction-progress')).toBeInTheDocument()
          expect(screen.getByTestId('transcription-progress')).toBeInTheDocument()
        })

        // Both progress bars should be visible with 0% initially
        expect(screen.getByTestId('frame-extraction-progress')).toHaveAttribute('aria-valuenow', '0')
        expect(screen.getByTestId('transcription-progress')).toHaveAttribute('aria-valuenow', '0')
        
        // Should show parallel processing indicator
        expect(screen.getByTestId('parallel-processing-icon')).toBeInTheDocument()
      })

      it('should update transcription progress through two-stage pipeline', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Simulate Whisper API completion
        const updateState = (window as any).updateExperimentState
        updateState({ 
          processingStep: 'transcribing',
          transcriptionStage: 'whisper_complete',
          whisperProgress: 100,
          segmentationProgress: 0
        })

        // Should show segmentation processing started
        await waitFor(() => {
          expect(screen.getByText('Processing segments: 0%')).toBeInTheDocument()
          expect(screen.getByText('Converting to 5-second segments...')).toBeInTheDocument()
        })
      })

      it('should handle transcription completion before frame extraction', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Simulate transcription completing first
        const updateState = (window as any).updateExperimentState
        updateState({
          fullTranscript: 'Complete transcript from Whisper API',
          segmentedTranscript: [
            { text: 'Hello everyone, welcome to our presentation', startTime: 0, endTime: 5, confidence: 0.95 },
            { text: 'Today we will be discussing the future of AI', startTime: 5, endTime: 10, confidence: 0.92 }
          ],
          extractionProgress: 65 // Still in progress
        })

        // Transcription should be complete while extraction continues
        expect(screen.getByTestId('transcription-complete-indicator')).toBeInTheDocument()
        expect(screen.getByTestId('frame-extraction-progress')).toHaveAttribute('aria-valuenow', '65')
        expect(screen.getByText('Processing video... (1 operation remaining)')).toBeInTheDocument()
      })
    })

    describe('Whisper API Integration Components', () => {
      it('should render Whisper transcription status with progress', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Should show transcription progress area
        expect(screen.getByTestId('transcription-progress-area')).toBeInTheDocument()
        expect(screen.getByText('Transcribing audio: 0%')).toBeInTheDocument()
        expect(screen.getByTestId('whisper-status-text')).toBeInTheDocument()
      })

      it('should display cost tracking for OpenAI Whisper', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Should show Whisper cost in breakdown
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toContainElement(screen.getByText(/OpenAI Whisper: \$0\.00/))
        
        // Update with actual cost
        const updateState = (window as any).updateExperimentState
        updateState({ costs: { openaiWhisper: 0.03, vercelBlob: 0.02, rendiApi: 1.25 } })
        
        await waitFor(() => {
          expect(screen.getByText(/OpenAI Whisper: \$0\.03/)).toBeInTheDocument()
        })
      })

      it('should show retry mechanism for failed transcription', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Simulate transcription failure
        const simulateError = (window as any).simulateError
        simulateError('transcription')

        // Should show retry options
        await waitFor(() => {
          expect(screen.getByTestId('retry-transcription-button')).toBeInTheDocument()
          expect(screen.getByText('Transcription failed - Retrying...')).toBeInTheDocument()
          expect(screen.getByText('Automatic retry in 3... 2... 1...')).toBeInTheDocument()
        })
      })
    })

    describe('Dual Transcript Display Components', () => {
      it('should render both full and segmented transcript sections', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Both transcript areas should be present
        expect(screen.getByTestId('full-transcript-area')).toBeInTheDocument()
        expect(screen.getByTestId('segmented-transcript-area')).toBeInTheDocument()
        
        // Should show placeholder text initially
        expect(screen.getByText('Transcript will appear here...')).toBeInTheDocument()
        expect(screen.getByText('Time-stamped segments will appear here...')).toBeInTheDocument()
      })

      it('should display full transcript when Whisper completes', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Update with full transcript
        const updateState = (window as any).updateExperimentState
        updateState({ 
          fullTranscript: 'Hello everyone, welcome to our presentation. Today we will be discussing the future of AI and its applications in modern software development.'
        })

        // Full transcript should be displayed
        await waitFor(() => {
          const fullTranscriptArea = screen.getByTestId('full-transcript-area')
          expect(fullTranscriptArea).toHaveTextContent('Hello everyone, welcome to our presentation')
        })
      })

      it('should display segmented transcript with 5-second intervals', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Update with segmented transcript
        const updateState = (window as any).updateExperimentState
        updateState({
          segmentedTranscript: [
            { text: 'Hello everyone, welcome to our presentation', startTime: 0, endTime: 5, confidence: 0.95 },
            { text: 'Today we will be discussing the future of AI', startTime: 5, endTime: 10, confidence: 0.92 },
            { text: 'and its applications in modern software development', startTime: 10, endTime: 15, confidence: 0.89 }
          ]
        })

        // Segmented transcript should show time-aligned blocks
        await waitFor(() => {
          expect(screen.getByText('0:00 - 0:05')).toBeInTheDocument()
          expect(screen.getByText('0:05 - 0:10')).toBeInTheDocument()
          expect(screen.getByText('0:10 - 0:15')).toBeInTheDocument()
          expect(screen.getByText('Hello everyone, welcome to our presentation')).toBeInTheDocument()
        })
      })

      it('should show loading skeleton during segmentation processing', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Simulate Whisper complete but segmentation in progress
        const updateState = (window as any).updateExperimentState
        updateState({
          fullTranscript: 'Complete transcript',
          segmentationInProgress: true,
          segmentationProgress: 40
        })

        // Should show loading state for segmented transcript
        await waitFor(() => {
          expect(screen.getByTestId('segmented-transcript-loading')).toBeInTheDocument()
          expect(screen.getByText('Processing segments: 40%')).toBeInTheDocument()
        })
      })
    })

    describe('Frame-Transcript Alignment', () => {
      it('should align frame timestamps with transcript segments', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Update with both frames and transcript segments
        const updateState = (window as any).updateExperimentState
        updateState({
          extractedFrames: [
            { url: 'frame1.jpg', timestamp: 5, filename: 'frame_00m05s.png' },
            { url: 'frame2.jpg', timestamp: 10, filename: 'frame_00m10s.png' },
            { url: 'frame3.jpg', timestamp: 15, filename: 'frame_00m15s.png' }
          ],
          segmentedTranscript: [
            { text: 'Segment 1', startTime: 0, endTime: 5, confidence: 0.95 },
            { text: 'Segment 2', startTime: 5, endTime: 10, confidence: 0.92 },
            { text: 'Segment 3', startTime: 10, endTime: 15, confidence: 0.89 }
          ]
        })

        // Frame timestamps should align with segment boundaries
        await waitFor(() => {
          expect(screen.getByTestId('timestamp-overlay-1')).toHaveTextContent('0:05')
          expect(screen.getByTestId('timestamp-overlay-2')).toHaveTextContent('0:10')
          expect(screen.getByTestId('timestamp-overlay-3')).toHaveTextContent('0:15')
        })
      })
    })

    describe('Accessibility Features', () => {
      it('should announce transcription progress for screen readers', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Should have aria-live regions for announcements
        expect(screen.getByLabelText('Status updates')).toBeInTheDocument()
        expect(screen.getByLabelText('Error announcements')).toBeInTheDocument()
        
        // Progress bars should have proper aria attributes
        const transcriptionProgress = screen.getByTestId('transcription-progress')
        expect(transcriptionProgress).toHaveAttribute('aria-valuenow')
        expect(transcriptionProgress).toHaveAttribute('aria-valuemin', '0')
        expect(transcriptionProgress).toHaveAttribute('aria-valuemax', '100')
      })

      it('should support keyboard navigation through transcript sections', async () => {
        render(<ArchitectureExperimentPage />)
        
        const fullTranscriptArea = screen.getByTestId('full-transcript-area')
        const segmentedTranscriptArea = screen.getByTestId('segmented-transcript-area')
        
        // Both areas should be focusable
        expect(fullTranscriptArea).toHaveAttribute('tabIndex')
        expect(segmentedTranscriptArea).toHaveAttribute('tabIndex')
      })
    })

    describe('Error Handling', () => {
      it('should handle segmentation failure with recovery options', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Simulate segmentation failure after successful Whisper
        const updateState = (window as any).updateExperimentState
        updateState({
          fullTranscript: 'Complete transcript available',
          segmentationError: 'Python segmentation script failed: JSON parsing error'
        })

        // Should show error state with retry option
        await waitFor(() => {
          expect(screen.getByText('Segmentation failed - Retrying...')).toBeInTheDocument()
          expect(screen.getByTestId('retry-segmentation-button')).toBeInTheDocument()
          expect(screen.getByText('Failed to process 5-second segments. Retrying automatically...')).toBeInTheDocument()
        })
        
        // Full transcript should remain available
        expect(screen.getByTestId('full-transcript-area')).toHaveTextContent('Complete transcript available')
      })

      it('should handle network recovery during transcription', async () => {
        render(<ArchitectureExperimentPage />)
        
        // Simulate network failure then recovery
        const updateState = (window as any).updateExperimentState
        updateState({ networkStatus: 'offline', transcriptionProgress: 70 })
        
        await waitFor(() => {
          expect(screen.getByText('Connection lost - Retrying...')).toBeInTheDocument()
        })
        
        // Simulate recovery
        updateState({ networkStatus: 'online' })
        
        await waitFor(() => {
          expect(screen.getByText('Connection restored - Resuming...')).toBeInTheDocument()
        })
      })
    })
  })
})