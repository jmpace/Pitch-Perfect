import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'

global.fetch = vi.fn()
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/test-video')

describe('Task 6: Transcript Display Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetch).mockClear()
  })

  describe('🔴 RED Phase: Transcript Display UI Tests', () => {
    
    describe('Dual Transcript Layout', () => {
      it('should render side-by-side transcript sections', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        expect(screen.getByTestId('dual-transcript-container')).toBeInTheDocument()
        expect(screen.getByTestId('full-transcript-section')).toBeInTheDocument()
        expect(screen.getByTestId('segmented-transcript-section')).toBeInTheDocument()
        
        // Should have proper layout classes
        const container = screen.getByTestId('dual-transcript-container')
        expect(container).toHaveClass('grid', 'grid-cols-2', 'gap-4')
      })

      it('should have independently scrollable containers', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        const fullTranscriptArea = screen.getByTestId('full-transcript-area')
        const segmentedTranscriptArea = screen.getByTestId('segmented-transcript-area')

        expect(fullTranscriptArea).toHaveClass('overflow-y-auto')
        expect(segmentedTranscriptArea).toHaveClass('overflow-y-auto')
        expect(fullTranscriptArea).toHaveClass('h-[200px]')
        expect(segmentedTranscriptArea).toHaveClass('h-[200px]')
      })

      it('should show clear section headers', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        expect(screen.getByText('Full Transcript')).toBeInTheDocument()
        expect(screen.getByText('Segmented Transcript')).toBeInTheDocument()
      })
    })

    describe('Full Transcript Display', () => {
      it('should display placeholder text initially', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        const fullTranscriptArea = screen.getByTestId('full-transcript-area')
        expect(fullTranscriptArea).toHaveTextContent('Transcript will appear here...')
      })

      it('should populate with raw Whisper text when available', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        const fullTranscript = 'Hello everyone, welcome to our presentation today. We will be discussing the future of artificial intelligence and its applications in modern software development. This is a comprehensive overview that will cover multiple topics and provide detailed insights.'

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({ fullTranscript })
        })

        const fullTranscriptArea = screen.getByTestId('full-transcript-area')
        expect(fullTranscriptArea).toHaveTextContent(fullTranscript)
      })

      it('should support text selection and copying', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({ fullTranscript: 'Selectable transcript text' })
        })

        const fullTranscriptArea = screen.getByTestId('full-transcript-area')
        
        // Should have proper styling for text selection
        expect(fullTranscriptArea).toHaveClass('whitespace-pre-wrap')
        expect(fullTranscriptArea).not.toHaveClass('select-none')
      })

      it('should show loading state during Whisper processing', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({ 
            transcriptionStage: 'whisper_in_progress',
            transcriptionProgress: 45
          })
        })

        expect(screen.getByTestId('full-transcript-loading')).toBeInTheDocument()
        expect(screen.getByTestId('full-transcript-skeleton')).toBeInTheDocument()
      })
    })

    describe('Segmented Transcript Display', () => {
      it('should display placeholder text initially', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        const segmentedTranscriptArea = screen.getByTestId('segmented-transcript-area')
        expect(segmentedTranscriptArea).toHaveTextContent('Time-stamped segments will appear here...')
      })

      it('should display 5-second aligned segments with timestamps', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        const segmentedTranscript = [
          { text: 'Hello everyone, welcome to our presentation', startTime: 0, endTime: 5, confidence: 0.95 },
          { text: 'Today we will be discussing the future of AI', startTime: 5, endTime: 10, confidence: 0.92 },
          { text: 'and its applications in modern software development', startTime: 10, endTime: 15, confidence: 0.89 },
          { text: 'This comprehensive overview covers multiple topics', startTime: 15, endTime: 20, confidence: 0.91 }
        ]

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({ segmentedTranscript })
        })

        // Should show all segments with proper formatting
        expect(screen.getByTestId('segment-0')).toBeInTheDocument()
        expect(screen.getByTestId('segment-1')).toBeInTheDocument()
        expect(screen.getByTestId('segment-2')).toBeInTheDocument()
        expect(screen.getByTestId('segment-3')).toBeInTheDocument()

        // Check timestamp format
        expect(screen.getByText('0:00 - 0:05')).toBeInTheDocument()
        expect(screen.getByText('0:05 - 0:10')).toBeInTheDocument()
        expect(screen.getByText('0:10 - 0:15')).toBeInTheDocument()
        expect(screen.getByText('0:15 - 0:20')).toBeInTheDocument()
      })

      it('should show confidence scores for each segment', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        const segmentedTranscript = [
          { text: 'High confidence segment', startTime: 0, endTime: 5, confidence: 0.95 },
          { text: 'Medium confidence segment', startTime: 5, endTime: 10, confidence: 0.82 },
          { text: 'Lower confidence segment', startTime: 10, endTime: 15, confidence: 0.67 }
        ]

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({ segmentedTranscript })
        })

        expect(screen.getByTestId('confidence-0')).toHaveTextContent('95%')
        expect(screen.getByTestId('confidence-1')).toHaveTextContent('82%')
        expect(screen.getByTestId('confidence-2')).toHaveTextContent('67%')
      })

      it('should color-code confidence levels', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        const segmentedTranscript = [
          { text: 'High confidence', startTime: 0, endTime: 5, confidence: 0.95 },
          { text: 'Medium confidence', startTime: 5, endTime: 10, confidence: 0.75 },
          { text: 'Low confidence', startTime: 10, endTime: 15, confidence: 0.55 }
        ]

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({ segmentedTranscript })
        })

        // High confidence (>90%) - green
        expect(screen.getByTestId('confidence-indicator-0')).toHaveClass('bg-green-500')
        
        // Medium confidence (70-90%) - yellow
        expect(screen.getByTestId('confidence-indicator-1')).toHaveClass('bg-yellow-500')
        
        // Low confidence (<70%) - red
        expect(screen.getByTestId('confidence-indicator-2')).toHaveClass('bg-red-500')
      })

      it('should show loading state during segmentation processing', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            fullTranscript: 'Complete transcript available',
            transcriptionStage: 'segmentation_in_progress',
            segmentationProgress: 60
          })
        })

        expect(screen.getByTestId('segmented-transcript-loading')).toBeInTheDocument()
        expect(screen.getByText('Processing segments: 60%')).toBeInTheDocument()
      })
    })

    describe('Frame-Transcript Alignment Visualization', () => {
      it('should highlight alignment between frames and transcript segments', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        const frames = [
          { url: 'frame1.jpg', timestamp: 5, filename: 'frame_00m05s.png' },
          { url: 'frame2.jpg', timestamp: 10, filename: 'frame_00m10s.png' },
          { url: 'frame3.jpg', timestamp: 15, filename: 'frame_00m15s.png' }
        ]

        const segmentedTranscript = [
          { text: 'First segment', startTime: 0, endTime: 5, confidence: 0.95 },
          { text: 'Second segment', startTime: 5, endTime: 10, confidence: 0.92 },
          { text: 'Third segment', startTime: 10, endTime: 15, confidence: 0.89 }
        ]

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({ extractedFrames: frames, segmentedTranscript })
        })

        // Frame timestamps should visually align with segment boundaries
        expect(screen.getByTestId('frame-segment-alignment-indicator')).toBeInTheDocument()
        expect(screen.getByTestId('timestamp-alignment-5s')).toBeInTheDocument()
        expect(screen.getByTestId('timestamp-alignment-10s')).toBeInTheDocument()
        expect(screen.getByTestId('timestamp-alignment-15s')).toBeInTheDocument()
      })

      it('should show visual correspondence between frames and segments', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            extractedFrames: [{ url: 'frame1.jpg', timestamp: 5, filename: 'frame_00m05s.png' }],
            segmentedTranscript: [{ text: 'Aligned segment', startTime: 0, endTime: 5, confidence: 0.95 }]
          })
        })

        // Should show visual indicators of alignment
        expect(screen.getByTestId('alignment-indicator-5s')).toBeInTheDocument()
        expect(screen.getByTestId('alignment-highlight')).toBeInTheDocument()
      })
    })

    describe('Loading and Error States', () => {
      it('should show loading skeleton for both transcript sections', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            transcriptionStage: 'whisper_in_progress',
            segmentationInProgress: false
          })
        })

        expect(screen.getByTestId('full-transcript-skeleton')).toBeInTheDocument()
        expect(screen.getByTestId('segmented-transcript-skeleton')).toBeInTheDocument()
      })

      it('should handle segmentation error while preserving full transcript', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            fullTranscript: 'Complete transcript preserved',
            segmentationError: 'Failed to process segments',
            transcriptionStage: 'segmentation_failed'
          })
        })

        // Full transcript should remain available
        expect(screen.getByTestId('full-transcript-area')).toHaveTextContent('Complete transcript preserved')
        
        // Segmented transcript should show error state
        expect(screen.getByTestId('segmentation-error-message')).toBeInTheDocument()
        expect(screen.getByText('Failed to process 5-second segments. Retrying automatically...')).toBeInTheDocument()
      })

      it('should show retry countdown for failed segmentation', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            segmentationError: 'Processing failed',
            retryCountdown: 3
          })
        })

        expect(screen.getByText('Automatic retry in 3... 2... 1...')).toBeInTheDocument()
        expect(screen.getByTestId('retry-countdown-timer')).toBeInTheDocument()
      })
    })

    describe('Accessibility Features', () => {
      it('should have proper ARIA labels and roles', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        const fullTranscriptArea = screen.getByTestId('full-transcript-area')
        const segmentedTranscriptArea = screen.getByTestId('segmented-transcript-area')

        expect(fullTranscriptArea).toHaveAttribute('role', 'region')
        expect(segmentedTranscriptArea).toHaveAttribute('role', 'region')
        expect(fullTranscriptArea).toHaveAttribute('aria-label', 'Full transcript content')
        expect(segmentedTranscriptArea).toHaveAttribute('aria-label', 'Time-segmented transcript content')
      })

      it('should support keyboard navigation between transcript sections', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        const fullTranscriptArea = screen.getByTestId('full-transcript-area')
        const segmentedTranscriptArea = screen.getByTestId('segmented-transcript-area')

        expect(fullTranscriptArea).toHaveAttribute('tabIndex', '0')
        expect(segmentedTranscriptArea).toHaveAttribute('tabIndex', '0')
      })

      it('should announce transcript updates for screen readers', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        // Should have aria-live regions for announcements
        expect(screen.getByTestId('transcript-announcements')).toHaveAttribute('aria-live', 'polite')
        
        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({ fullTranscript: 'New transcript content' })
        })

        expect(screen.getByTestId('transcript-announcements')).toHaveTextContent('Full transcript updated')
      })

      it('should have sufficient color contrast for confidence indicators', async () => {
        render(<ArchitectureExperimentPage />)
        
        await waitFor(() => {
          expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        })

        await act(async () => {
          const updateState = (window as any).updateExperimentState
          updateState({
            segmentedTranscript: [
              { text: 'Test segment', startTime: 0, endTime: 5, confidence: 0.95 }
            ]
          })
        })

        const confidenceIndicator = screen.getByTestId('confidence-indicator-0')
        // Should use colors with sufficient contrast (4.5:1 minimum)
        expect(confidenceIndicator).toHaveAttribute('aria-label', 'Confidence: 95%')
      })
    })
  })
})