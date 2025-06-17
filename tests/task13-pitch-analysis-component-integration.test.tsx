/**
 * 🔴 RED PHASE - TDD Tests for Task 13: Pitch Analysis Component Integration
 * 
 * These tests verify that UI components are actually integrated and working correctly:
 * 1. Component Rendering: Component renders with correct props
 * 2. UI Integration: Imported components are actually used  
 * 3. Event Handling: UI events trigger correct responses
 * 4. State Management: UI updates when state changes
 * 5. CSS Integration: Styles are applied correctly
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the pitch analysis component that we'll implement
const mockPitchAnalysisResults = {
  sessionId: 'test-session-123',
  fundingStage: 'seed',
  overallScore: 7.2,
  categoryScores: {
    speech: 6.8,
    content: 7.5,
    visual: 7.0,
    overall: 8.0
  },
  individualScores: [
    {
      pointId: 'pace_rhythm',
      score: 6,
      rationale: 'Speaking speed varied from 150-190 WPM. Rushed through technical sections at 02:15-02:30.',
      improvementSuggestions: ['Practice pacing for technical content', 'Use strategic pauses for emphasis']
    }
  ],
  timestampedRecommendations: [
    {
      id: 'rec_001',
      timestamp: 92,
      duration: 15,
      category: 'speech',
      priority: 'high',
      title: 'Reduce Filler Words',
      description: 'Multiple \'um\' and \'uh\' instances undermining expertise',
      specificIssue: 'Used \'um\' 4 times in 15 seconds during key value proposition',
      actionableAdvice: 'Practice this section until you can deliver without fillers. Pause instead of using filler words.',
      relatedFrameworkScore: 'filler_words'
    }
  ],
  slideAnalysis: [
    {
      timestamp: 45,
      slideImage: 'frame_00m45s.png',
      contentSummary: 'Market size slide showing $200B opportunity',
      designFeedback: 'Clean layout but font size too small for key metrics',
      alignmentWithSpeech: 'MISMATCH: Speaker mentions $34B, slide shows $200B',
      improvementSuggestions: ['Increase font size for key numbers', 'Ensure slide data matches verbal claims'],
      score: 6
    }
  ],
  analysisTimestamp: '2025-06-16T16:30:00Z',
  processingTime: 12.5
}

// Mock the Progress component from ShadCN
vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className, ...props }: any) => (
    <div 
      className={className}
      data-testid="progress-bar"
      data-value={value}
      role="progressbar"
      aria-valuenow={value}
      {...props}
    />
  )
}))

// Mock the Card components from ShadCN
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="card" {...props}>{children}</div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="card-content" {...props}>{children}</div>
  ),
  CardHeader: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="card-header" {...props}>{children}</div>
  ),
  CardTitle: ({ children, className, ...props }: any) => (
    <h3 className={className} data-testid="card-title" {...props}>{children}</h3>
  )
}))

// Mock the fetch API for pitch analysis
global.fetch = vi.fn()

describe('🔴 RED: Pitch Analysis Component Integration Tests', () => {
  let mockUpdateExperimentState: any
  let mockExperimentState: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Mock the global state and update function
    mockUpdateExperimentState = vi.fn()
    mockExperimentState = {
      videoFile: null,
      videoUrl: 'https://blob.vercel-storage.com/test-video.mp4',
      uploadProgress: 100,
      processingStep: 'complete',
      fullTranscript: 'Welcome to our pitch. We are solving the problem of expensive pitch coaching...',
      segmentedTranscript: [
        { text: 'Welcome to our pitch.', startTime: 0, endTime: 5, confidence: 0.95 },
        { text: 'We are solving the problem of expensive pitch coaching.', startTime: 5, endTime: 10, confidence: 0.92 }
      ],
      extractedFrames: [
        { url: 'https://image.mux.com/test/thumbnail.png?time=5', timestamp: 5, filename: 'frame_00m05s.png' },
        { url: 'https://image.mux.com/test/thumbnail.png?time=10', timestamp: 10, filename: 'frame_00m10s.png' }
      ],
      errors: [],
      timings: { frameExtraction: 2500, transcription: 3000 },
      // Pitch analysis specific state
      pitchAnalysisInProgress: false,
      pitchAnalysisProgress: 0,
      pitchAnalysisResults: null,
      pitchAnalysisError: null
    }

    // Set up global state
    ;(global as any).window = {
      experimentState: mockExperimentState,
      updateExperimentState: mockUpdateExperimentState,
      dispatchEvent: vi.fn()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Component Rendering Tests', () => {
    test('FAIL: should render PitchAnalysisSection component when processing is complete', () => {
      // This test should fail because PitchAnalysisSection component doesn't exist yet
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      render(<ArchitectureExperimentPage />)
      
      // Should find pitch analysis section when both frames and transcription are complete
      expect(screen.getByTestId('pitch-analysis-section')).toBeInTheDocument()
      expect(screen.getByTestId('pitch-analysis-title')).toHaveTextContent('Pitch Analysis')
    })

    test('FAIL: should render pitch analysis section with indigo-500 border', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      render(<ArchitectureExperimentPage />)
      
      const pitchAnalysisSection = screen.getByTestId('pitch-analysis-section')
      expect(pitchAnalysisSection).toHaveClass('border-indigo-500')
    })

    test('FAIL: should automatically appear after both processing completion', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      render(<ArchitectureExperimentPage />)
      
      // Should automatically trigger analysis when both frames and transcript are available
      expect(screen.getByTestId('pitch-analysis-section')).toBeInTheDocument()
      expect(screen.getByTestId('analysis-automatic-trigger')).toBeInTheDocument()
    })
  })

  describe('2. UI Integration Tests', () => {
    test('FAIL: should use Progress component for analysis progress', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      // Set state to show analysis in progress
      ;(global as any).window.experimentState.pitchAnalysisInProgress = true
      ;(global as any).window.experimentState.pitchAnalysisProgress = 25
      
      render(<ArchitectureExperimentPage />)
      
      // Should use the imported Progress component
      const progressBar = screen.getByTestId('analysis-progress-bar')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('data-value', '25')
    })

    test('FAIL: should use Card components for results display', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      // Set state to show completed analysis
      ;(global as any).window.experimentState.pitchAnalysisResults = mockPitchAnalysisResults
      
      render(<ArchitectureExperimentPage />)
      
      // Should use Card components for displaying results
      expect(screen.getByTestId('pitch-analysis-results-card')).toBeInTheDocument()
      expect(screen.getByTestId('overall-score-card')).toBeInTheDocument()
      expect(screen.getByTestId('category-scores-card')).toBeInTheDocument()
    })

    test('FAIL: should display overall score with large readable text', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      ;(global as any).window.experimentState.pitchAnalysisResults = mockPitchAnalysisResults
      
      render(<ArchitectureExperimentPage />)
      
      const overallScore = screen.getByTestId('overall-score-display')
      expect(overallScore).toHaveTextContent('7.2/10')
      expect(overallScore).toHaveClass('text-3xl') // Large text class
    })

    test('FAIL: should display category scores in rows', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      ;(global as any).window.experimentState.pitchAnalysisResults = mockPitchAnalysisResults
      
      render(<ArchitectureExperimentPage />)
      
      expect(screen.getByTestId('category-score-speech')).toHaveTextContent('Speech Mechanics: 6.8/10')
      expect(screen.getByTestId('category-score-content')).toHaveTextContent('Content Quality: 7.5/10')
      expect(screen.getByTestId('category-score-visual')).toHaveTextContent('Visual Presentation: 7.0/10')
      expect(screen.getByTestId('category-score-overall')).toHaveTextContent('Overall Effectiveness: 8.0/10')
    })
  })

  describe('3. Event Handling Tests', () => {
    test('FAIL: should automatically trigger analysis when both frames and transcript are complete', async () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      // Mock successful API response
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPitchAnalysisResults)
      })
      
      render(<ArchitectureExperimentPage />)
      
      // Should automatically call the analysis API
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/experiment/analyze-pitch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('frames')
        })
      })
    })

    test('FAIL: should handle analysis completion and update state', async () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPitchAnalysisResults)
      })
      
      render(<ArchitectureExperimentPage />)
      
      await waitFor(() => {
        expect(mockUpdateExperimentState).toHaveBeenCalledWith({
          pitchAnalysisResults: mockPitchAnalysisResults,
          pitchAnalysisInProgress: false,
          pitchAnalysisProgress: 100
        })
      })
    })

    test('FAIL: should handle API errors with retry mechanism', async () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network timeout'))
      
      render(<ArchitectureExperimentPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('analysis-error-message')).toHaveTextContent('⚠ Analysis failed - Retrying automatically...')
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('retry-countdown-timer')).toHaveTextContent('Retry in 3... 2... 1...')
      })
    })
  })

  describe('4. State Management Tests', () => {
    test('FAIL: should update progress bar when analysis progresses', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      const { rerender } = render(<ArchitectureExperimentPage />)
      
      // Simulate progress updates
      ;(global as any).window.experimentState.pitchAnalysisProgress = 50
      rerender(<ArchitectureExperimentPage />)
      
      const progressBar = screen.getByTestId('analysis-progress-bar')
      expect(progressBar).toHaveAttribute('data-value', '50')
    })

    test('FAIL: should show different progress stages', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      ;(global as any).window.experimentState.pitchAnalysisInProgress = true
      ;(global as any).window.experimentState.pitchAnalysisStage = 'preparing'
      
      render(<ArchitectureExperimentPage />)
      
      expect(screen.getByTestId('analysis-stage-text')).toHaveTextContent('Preparing multimodal data... 0%')
    })

    test('FAIL: should transition through analysis stages', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      const { rerender } = render(<ArchitectureExperimentPage />)
      
      // Simulate stage progression
      const stages = [
        { stage: 'preparing', text: 'Preparing multimodal data... 0%' },
        { stage: 'sending', text: 'Sending to Claude 4 Opus... 25%' },
        { stage: 'analyzing', text: 'Analyzing visual-verbal alignment... 50%' },
        { stage: 'processing', text: 'Processing framework scores... 75%' },
        { stage: 'generating', text: 'Generating recommendations... 100%' }
      ]
      
      stages.forEach(({ stage, text }) => {
        ;(global as any).window.experimentState.pitchAnalysisStage = stage
        rerender(<ArchitectureExperimentPage />)
        expect(screen.getByTestId('analysis-stage-text')).toHaveTextContent(text)
      })
    })
  })

  describe('5. CSS Integration Tests', () => {
    test('FAIL: should apply smooth expand animation to pitch analysis section', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      render(<ArchitectureExperimentPage />)
      
      const pitchAnalysisSection = screen.getByTestId('pitch-analysis-section')
      expect(pitchAnalysisSection).toHaveClass('animate-expand')
    })

    test('FAIL: should apply fade-in animation to results', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      ;(global as any).window.experimentState.pitchAnalysisResults = mockPitchAnalysisResults
      
      render(<ArchitectureExperimentPage />)
      
      const resultsContainer = screen.getByTestId('analysis-results-container')
      expect(resultsContainer).toHaveClass('animate-fade-in')
    })

    test('FAIL: should have proper color coding for progress bar states', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      // Test normal progress (blue)
      ;(global as any).window.experimentState.pitchAnalysisInProgress = true
      const { rerender } = render(<ArchitectureExperimentPage />)
      
      let progressBar = screen.getByTestId('analysis-progress-bar')
      expect(progressBar).toHaveClass('bg-blue-500')
      
      // Test error state (red)
      ;(global as any).window.experimentState.pitchAnalysisError = 'Network timeout'
      rerender(<ArchitectureExperimentPage />)
      
      progressBar = screen.getByTestId('analysis-progress-bar')
      expect(progressBar).toHaveClass('bg-red-500')
    })

    test('FAIL: should apply proper spacing and layout classes', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      render(<ArchitectureExperimentPage />)
      
      const pitchAnalysisSection = screen.getByTestId('pitch-analysis-section')
      expect(pitchAnalysisSection).toHaveClass('rounded-lg', 'p-4', 'border-2', 'border-indigo-500')
    })
  })

  describe('6. Cost Integration Tests', () => {
    test('FAIL: should update cost breakdown with Anthropic Claude cost', async () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...mockPitchAnalysisResults,
          cost: 0.45
        })
      })
      
      render(<ArchitectureExperimentPage />)
      
      await waitFor(() => {
        expect(mockUpdateExperimentState).toHaveBeenCalledWith(
          expect.objectContaining({
            costs: expect.objectContaining({
              anthropicClaude: 0.45
            })
          })
        )
      })
    })

    test('FAIL: should display updated total cost including analysis', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      // Set costs including analysis
      ;(global as any).window.experimentState.costs = {
        vercelBlob: 0.02,
        rendiApi: 1.25,
        openaiWhisper: 0.03,
        anthropicClaude: 0.45
      }
      
      render(<ArchitectureExperimentPage />)
      
      const costTracker = screen.getByTestId('cost-tracker')
      expect(costTracker).toHaveTextContent('$1.75') // Updated total
    })
  })

  describe('7. Multimodal Data Processing Tests', () => {
    test('FAIL: should align frames with transcript segments for API call', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPitchAnalysisResults)
      })
      
      render(<ArchitectureExperimentPage />)
      
      expect(global.fetch).toHaveBeenCalledWith('/api/experiment/analyze-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"alignedData"')
      })
    })

    test('FAIL: should validate perfect timestamp alignment', () => {
      const ArchitectureExperimentPage = require('../src/app/experiment/architecture-test/page.tsx').default
      
      render(<ArchitectureExperimentPage />)
      
      // Should display alignment validation
      expect(screen.getByTestId('timestamp-alignment-validation')).toHaveTextContent('✓ Perfect 5-second alignment detected')
    })
  })
})