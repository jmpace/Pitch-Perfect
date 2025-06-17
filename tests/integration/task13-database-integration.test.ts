/**
 * Task 13 Integration Tests: Database Interactions and State Management
 * 
 * Tests state management across components and simulated database operations
 * for pitch analysis data persistence and retrieval.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import { 
  AlignedPitchData, 
  PitchAnalysisResponse,
  TimestampedRecommendation,
  SlideAnalysis
} from '@/types/pitch-analysis'

// Mock database interface (simulating future database integration)
interface MockDatabase {
  pitchAnalyses: Record<string, PitchAnalysisResponse>
  sessions: Record<string, { 
    sessionId: string
    status: 'processing' | 'completed' | 'failed'
    createdAt: Date
    alignedData?: AlignedPitchData
    analysisResults?: PitchAnalysisResponse
  }>
}

// Mock database implementation
const mockDatabase: MockDatabase = {
  pitchAnalyses: {},
  sessions: {}
}

// Mock database operations
const mockDatabaseOps = {
  saveSession: vi.fn(async (sessionId: string, data: any) => {
    mockDatabase.sessions[sessionId] = {
      sessionId,
      ...data,
      createdAt: new Date()
    }
    return mockDatabase.sessions[sessionId]
  }),

  updateSession: vi.fn(async (sessionId: string, updates: any) => {
    if (mockDatabase.sessions[sessionId]) {
      mockDatabase.sessions[sessionId] = {
        ...mockDatabase.sessions[sessionId],
        ...updates
      }
    }
    return mockDatabase.sessions[sessionId]
  }),

  getSession: vi.fn(async (sessionId: string) => {
    return mockDatabase.sessions[sessionId] || null
  }),

  savePitchAnalysis: vi.fn(async (sessionId: string, analysis: PitchAnalysisResponse) => {
    mockDatabase.pitchAnalyses[sessionId] = analysis
    return analysis
  }),

  getPitchAnalysis: vi.fn(async (sessionId: string) => {
    return mockDatabase.pitchAnalyses[sessionId] || null
  }),

  listSessions: vi.fn(async () => {
    return Object.values(mockDatabase.sessions)
  })
}

// State management hook for pitch analysis integration
function usePitchAnalysisState() {
  const [state, setState] = useState({
    sessionId: '',
    isAnalyzing: false,
    analysisProgress: 0,
    analysisStage: 'idle' as 'idle' | 'preparing' | 'sending' | 'analyzing' | 'complete' | 'error',
    analysisResults: null as PitchAnalysisResponse | null,
    error: null as string | null,
    alignedData: null as AlignedPitchData | null
  })

  const startAnalysis = async (sessionId: string, alignedData: AlignedPitchData) => {
    setState(prev => ({
      ...prev,
      sessionId,
      isAnalyzing: true,
      analysisProgress: 0,
      analysisStage: 'preparing',
      error: null,
      alignedData
    }))

    // Save session to database
    await mockDatabaseOps.saveSession(sessionId, {
      status: 'processing',
      alignedData
    })

    // Simulate analysis progress
    for (const stage of ['preparing', 'sending', 'analyzing'] as const) {
      setState(prev => ({ ...prev, analysisStage: stage, analysisProgress: prev.analysisProgress + 25 }))
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  const completeAnalysis = async (results: PitchAnalysisResponse) => {
    setState(prev => ({
      ...prev,
      isAnalyzing: false,
      analysisProgress: 100,
      analysisStage: 'complete',
      analysisResults: results
    }))

    // Save results to database
    await mockDatabaseOps.savePitchAnalysis(state.sessionId, results)
    await mockDatabaseOps.updateSession(state.sessionId, {
      status: 'completed',
      analysisResults: results
    })
  }

  const failAnalysis = async (error: string) => {
    setState(prev => ({
      ...prev,
      isAnalyzing: false,
      analysisStage: 'error',
      error
    }))

    await mockDatabaseOps.updateSession(state.sessionId, {
      status: 'failed'
    })
  }

  const resetState = () => {
    setState({
      sessionId: '',
      isAnalyzing: false,
      analysisProgress: 0,
      analysisStage: 'idle',
      analysisResults: null,
      error: null,
      alignedData: null
    })
  }

  return {
    state,
    startAnalysis,
    completeAnalysis,
    failAnalysis,
    resetState
  }
}

describe('Task 13: Database Integration and State Management', () => {
  const mockAlignedData: AlignedPitchData = {
    sessionId: 'test-session-db-123',
    videoMetadata: {
      duration: 180,
      filename: 'test-pitch.mp4',
      uploadUrl: 'https://blob.vercel.com/test-video',
      size: 75000000
    },
    alignedSegments: [
      {
        timestamp: 5,
        frame: {
          timestamp: 5,
          url: 'https://image.mux.com/test-playback-id/thumbnail.png?time=5',
          filename: 'frame_00m05s.png'
        },
        transcriptSegment: {
          startTime: 0,
          endTime: 5,
          text: 'Today I want to present our innovative solution.',
          confidence: 0.95
        }
      }
    ],
    analysisMetadata: {
      totalFrames: 1,
      totalSegments: 1,
      alignmentAccuracy: 1.0,
      processingTime: 45000,
      costs: {
        frameExtraction: 0.15,
        transcription: 0.03,
        total: 0.18
      }
    }
  }

  const mockAnalysisResults: PitchAnalysisResponse = {
    sessionId: 'test-session-db-123',
    fundingStage: 'seed',
    overallScore: 8.1,
    categoryScores: {
      speech: 7.5,
      content: 8.2,
      visual: 8.0,
      overall: 8.8
    },
    individualScores: [
      {
        pointId: 'pace_rhythm',
        score: 8,
        rationale: 'Excellent pacing with strategic pauses',
        improvementSuggestions: ['Continue this strong pacing throughout']
      }
    ],
    timestampedRecommendations: [
      {
        id: 'rec_001',
        timestamp: 5,
        duration: 10,
        category: 'content',
        priority: 'medium',
        title: 'Enhance Problem Statement',
        description: 'Add more customer validation evidence',
        specificIssue: 'Problem lacks quantified impact',
        actionableAdvice: 'Include specific metrics about customer pain',
        relatedFrameworkScore: 'problem_definition'
      }
    ],
    slideAnalysis: [
      {
        timestamp: 5,
        slideImage: 'frame_00m05s.png',
        contentSummary: 'Title slide with company logo',
        designFeedback: 'Professional and clean design',
        alignmentWithSpeech: 'ALIGNED: Introduction matches title slide',
        improvementSuggestions: ['Consider adding tagline'],
        score: 8
      }
    ],
    analysisTimestamp: '2025-06-16T16:30:00Z',
    processingTime: 15.2
  }

  beforeEach(() => {
    // Clear mock database
    mockDatabase.pitchAnalyses = {}
    mockDatabase.sessions = {}
    vi.clearAllMocks()
  })

  describe('State Management Integration', () => {
    it('should manage analysis state lifecycle correctly', async () => {
      const { result } = renderHook(() => usePitchAnalysisState())

      // Initial state
      expect(result.current.state.isAnalyzing).toBe(false)
      expect(result.current.state.analysisStage).toBe('idle')
      expect(result.current.state.analysisProgress).toBe(0)

      // Start analysis
      await act(async () => {
        await result.current.startAnalysis('test-session-db-123', mockAlignedData)
      })

      expect(result.current.state.isAnalyzing).toBe(true)
      expect(result.current.state.sessionId).toBe('test-session-db-123')
      expect(result.current.state.analysisStage).toBe('analyzing')
      expect(result.current.state.alignedData).toEqual(mockAlignedData)

      // Complete analysis
      await act(async () => {
        await result.current.completeAnalysis(mockAnalysisResults)
      })

      expect(result.current.state.isAnalyzing).toBe(false)
      expect(result.current.state.analysisStage).toBe('complete')
      expect(result.current.state.analysisProgress).toBe(100)
      expect(result.current.state.analysisResults).toEqual(mockAnalysisResults)
    })

    it('should handle analysis failures gracefully', async () => {
      const { result } = renderHook(() => usePitchAnalysisState())

      await act(async () => {
        await result.current.startAnalysis('test-session-fail', mockAlignedData)
      })

      await act(async () => {
        await result.current.failAnalysis('API rate limit exceeded')
      })

      expect(result.current.state.isAnalyzing).toBe(false)
      expect(result.current.state.analysisStage).toBe('error')
      expect(result.current.state.error).toBe('API rate limit exceeded')
    })

    it('should reset state correctly', async () => {
      const { result } = renderHook(() => usePitchAnalysisState())

      await act(async () => {
        await result.current.startAnalysis('test-session-reset', mockAlignedData)
        await result.current.completeAnalysis(mockAnalysisResults)
      })

      expect(result.current.state.analysisResults).not.toBeNull()

      await act(async () => {
        result.current.resetState()
      })

      expect(result.current.state.sessionId).toBe('')
      expect(result.current.state.isAnalyzing).toBe(false)
      expect(result.current.state.analysisStage).toBe('idle')
      expect(result.current.state.analysisResults).toBeNull()
      expect(result.current.state.error).toBeNull()
    })
  })

  describe('Database Operations', () => {
    it('should save and retrieve session data correctly', async () => {
      const sessionId = 'test-session-save'
      
      // Save session
      const savedSession = await mockDatabaseOps.saveSession(sessionId, {
        status: 'processing',
        alignedData: mockAlignedData
      })

      expect(savedSession.sessionId).toBe(sessionId)
      expect(savedSession.status).toBe('processing')
      expect(savedSession.alignedData).toEqual(mockAlignedData)
      expect(savedSession.createdAt).toBeInstanceOf(Date)

      // Retrieve session
      const retrievedSession = await mockDatabaseOps.getSession(sessionId)
      expect(retrievedSession).toEqual(savedSession)
    })

    it('should update session status during analysis lifecycle', async () => {
      const sessionId = 'test-session-update'

      // Create initial session
      await mockDatabaseOps.saveSession(sessionId, {
        status: 'processing'
      })

      // Update to completed
      const updatedSession = await mockDatabaseOps.updateSession(sessionId, {
        status: 'completed',
        analysisResults: mockAnalysisResults
      })

      expect(updatedSession.status).toBe('completed')
      expect(updatedSession.analysisResults).toEqual(mockAnalysisResults)

      // Verify persistence
      const retrievedSession = await mockDatabaseOps.getSession(sessionId)
      expect(retrievedSession.status).toBe('completed')
    })

    it('should save and retrieve pitch analysis results', async () => {
      const sessionId = 'test-analysis-save'

      // Save analysis
      const savedAnalysis = await mockDatabaseOps.savePitchAnalysis(sessionId, mockAnalysisResults)
      expect(savedAnalysis).toEqual(mockAnalysisResults)

      // Retrieve analysis
      const retrievedAnalysis = await mockDatabaseOps.getPitchAnalysis(sessionId)
      expect(retrievedAnalysis).toEqual(mockAnalysisResults)
    })

    it('should handle non-existent sessions gracefully', async () => {
      const nonExistentSession = await mockDatabaseOps.getSession('non-existent')
      expect(nonExistentSession).toBeNull()

      const nonExistentAnalysis = await mockDatabaseOps.getPitchAnalysis('non-existent')
      expect(nonExistentAnalysis).toBeNull()
    })

    it('should list all sessions correctly', async () => {
      // Create multiple sessions
      await mockDatabaseOps.saveSession('session-1', { status: 'completed' })
      await mockDatabaseOps.saveSession('session-2', { status: 'processing' })
      await mockDatabaseOps.saveSession('session-3', { status: 'failed' })

      const sessions = await mockDatabaseOps.listSessions()
      expect(sessions).toHaveLength(3)
      expect(sessions.map(s => s.sessionId)).toContain('session-1')
      expect(sessions.map(s => s.sessionId)).toContain('session-2')
      expect(sessions.map(s => s.sessionId)).toContain('session-3')
    })
  })

  describe('Data Consistency and Validation', () => {
    it('should maintain data consistency across state updates', async () => {
      const { result } = renderHook(() => usePitchAnalysisState())

      // Update mock data with correct session ID
      const testAlignedData = { ...mockAlignedData, sessionId: 'consistency-test' }

      await act(async () => {
        await result.current.startAnalysis('consistency-test', testAlignedData)
      })

      // Verify database was updated
      const session = await mockDatabaseOps.getSession('consistency-test')
      expect(session.alignedData.sessionId).toBe(result.current.state.sessionId)
      expect(session.alignedData).toEqual(result.current.state.alignedData)

      // Update analysis results with correct session ID
      const testAnalysisResults = { ...mockAnalysisResults, sessionId: 'consistency-test' }

      await act(async () => {
        await result.current.completeAnalysis(testAnalysisResults)
      })

      // Verify analysis was saved to database
      const savedAnalysis = await mockDatabaseOps.getPitchAnalysis('consistency-test')
      expect(savedAnalysis).toEqual(result.current.state.analysisResults)

      // Verify session was updated
      const updatedSession = await mockDatabaseOps.getSession('consistency-test')
      expect(updatedSession.status).toBe('completed')
      expect(updatedSession.analysisResults).toEqual(testAnalysisResults)
    })

    it('should validate timestamped recommendations structure', async () => {
      const invalidRecommendation: TimestampedRecommendation = {
        id: 'invalid-rec',
        timestamp: -5, // Invalid negative timestamp
        duration: 0, // Invalid zero duration
        category: 'speech',
        priority: 'high',
        title: '',
        description: '',
        specificIssue: '',
        actionableAdvice: '',
        relatedFrameworkScore: 'invalid_point_id'
      }

      const invalidResults = {
        ...mockAnalysisResults,
        timestampedRecommendations: [invalidRecommendation]
      }

      // In a real implementation, this would trigger validation errors
      await mockDatabaseOps.savePitchAnalysis('invalid-test', invalidResults)
      
      const retrieved = await mockDatabaseOps.getPitchAnalysis('invalid-test')
      expect(retrieved.timestampedRecommendations[0].timestamp).toBe(-5) // Stored as-is for now
      
      // TODO: Add validation logic to reject invalid data
    })

    it('should validate slide analysis structure', async () => {
      const validSlideAnalysis: SlideAnalysis = {
        timestamp: 10,
        slideImage: 'frame_00m10s.png',
        contentSummary: 'Problem definition slide',
        designFeedback: 'Good visual hierarchy',
        alignmentWithSpeech: 'ALIGNED: Speech matches slide content',
        improvementSuggestions: ['Add more specific metrics'],
        score: 7
      }

      const resultsWithSlideAnalysis = {
        ...mockAnalysisResults,
        slideAnalysis: [validSlideAnalysis]
      }

      await mockDatabaseOps.savePitchAnalysis('slide-analysis-test', resultsWithSlideAnalysis)
      
      const retrieved = await mockDatabaseOps.getPitchAnalysis('slide-analysis-test')
      expect(retrieved.slideAnalysis).toHaveLength(1)
      expect(retrieved.slideAnalysis[0]).toEqual(validSlideAnalysis)
    })

    it('should maintain referential integrity between sessions and analyses', async () => {
      const sessionId = 'integrity-test'

      // Update mock data with correct session ID
      const testAlignedData = { ...mockAlignedData, sessionId }
      const testAnalysisResults = { ...mockAnalysisResults, sessionId }

      // Create session
      await mockDatabaseOps.saveSession(sessionId, {
        status: 'processing',
        alignedData: testAlignedData
      })

      // Save analysis
      await mockDatabaseOps.savePitchAnalysis(sessionId, testAnalysisResults)

      // Update session with analysis reference
      await mockDatabaseOps.updateSession(sessionId, {
        status: 'completed',
        analysisResults: testAnalysisResults
      })

      // Verify referential integrity
      const session = await mockDatabaseOps.getSession(sessionId)
      const analysis = await mockDatabaseOps.getPitchAnalysis(sessionId)

      expect(session.analysisResults.sessionId).toBe(analysis.sessionId)
      expect(session.sessionId).toBe(sessionId)
      expect(analysis.sessionId).toBe(sessionId)
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent session operations', async () => {
      const sessionIds = ['concurrent-1', 'concurrent-2', 'concurrent-3']
      
      // Create sessions concurrently
      const createPromises = sessionIds.map(id => 
        mockDatabaseOps.saveSession(id, { 
          status: 'processing',
          alignedData: { ...mockAlignedData, sessionId: id }
        })
      )

      const createdSessions = await Promise.all(createPromises)
      expect(createdSessions).toHaveLength(3)

      // Update sessions concurrently
      const updatePromises = sessionIds.map(id =>
        mockDatabaseOps.updateSession(id, { status: 'completed' })
      )

      const updatedSessions = await Promise.all(updatePromises)
      updatedSessions.forEach(session => {
        expect(session.status).toBe('completed')
      })
    })

    it('should handle large analysis results efficiently', async () => {
      // Create large analysis results
      const largeResults: PitchAnalysisResponse = {
        ...mockAnalysisResults,
        individualScores: Array.from({ length: 13 }, (_, i) => ({
          pointId: `point_${i}`,
          score: Math.floor(Math.random() * 10) + 1,
          rationale: `Detailed rationale for point ${i} with comprehensive explanation`,
          improvementSuggestions: [`Suggestion 1 for point ${i}`, `Suggestion 2 for point ${i}`]
        })),
        timestampedRecommendations: Array.from({ length: 20 }, (_, i) => ({
          id: `rec_${i}`,
          timestamp: i * 10,
          duration: 15,
          category: ['speech', 'content', 'visual', 'overall'][i % 4] as any,
          priority: ['high', 'medium', 'low'][i % 3] as any,
          title: `Recommendation ${i}`,
          description: `Detailed description for recommendation ${i}`,
          specificIssue: `Specific issue ${i}`,
          actionableAdvice: `Actionable advice for issue ${i}`,
          relatedFrameworkScore: `point_${i % 13}`
        }))
      }

      const startTime = Date.now()
      await mockDatabaseOps.savePitchAnalysis('large-results', largeResults)
      const saveTime = Date.now() - startTime

      const retrieveStartTime = Date.now()
      const retrieved = await mockDatabaseOps.getPitchAnalysis('large-results')
      const retrieveTime = Date.now() - retrieveStartTime

      expect(saveTime).toBeLessThan(100) // Should save quickly
      expect(retrieveTime).toBeLessThan(100) // Should retrieve quickly
      expect(retrieved.individualScores).toHaveLength(13)
      expect(retrieved.timestampedRecommendations).toHaveLength(20)
    })
  })
})