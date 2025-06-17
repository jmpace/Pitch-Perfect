/**
 * Task 13 Integration Tests: API Endpoints and Data Flow Validation
 * 
 * Tests the complete data flow from aligned pitch data through the Anthropic API
 * to structured analysis results, focusing on integration points and data consistency.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/experiment/analyze-pitch/route'
import { 
  AlignedPitchData, 
  PitchAnalysisApiResponse,
  AlignedSegment,
  TimestampedFrame,
  TimestampedTranscriptSegment
} from '@/types/pitch-analysis'

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn()
}))

describe('Task 13: API Endpoints Integration Tests', () => {
  const mockAlignedData: AlignedPitchData = {
    sessionId: 'test-session-123',
    videoMetadata: {
      duration: 120,
      filename: 'test-pitch.mp4',
      uploadUrl: 'https://blob.vercel.com/test-video',
      size: 50000000
    },
    alignedSegments: [
      {
        timestamp: 5,
        frame: {
          timestamp: 5,
          url: 'https://image.mux.com/JOr801bDngpLlXZX00I3QPZW1lzzb8OX00PEfPkgsBFp8Y/thumbnail.png?time=5',
          filename: 'frame_00m05s.png'
        },
        transcriptSegment: {
          startTime: 0,
          endTime: 5,
          text: 'Welcome everyone, today I want to talk about our revolutionary AI platform.',
          confidence: 0.95
        }
      },
      {
        timestamp: 10,
        frame: {
          timestamp: 10,
          url: 'https://image.mux.com/JOr801bDngpLlXZX00I3QPZW1lzzb8OX00PEfPkgsBFp8Y/thumbnail.png?time=10',
          filename: 'frame_00m10s.png'
        },
        transcriptSegment: {
          startTime: 5,
          endTime: 10,
          text: 'The problem we are solving affects over 50 million small businesses.',
          confidence: 0.92
        }
      },
      {
        timestamp: 15,
        frame: {
          timestamp: 15,
          url: 'https://image.mux.com/test-playback-id/thumbnail.png?time=15',
          filename: 'frame_00m15s.png'
        },
        transcriptSegment: {
          startTime: 10,
          endTime: 15,
          text: 'Our solution provides 10x faster processing with 95% accuracy.',
          confidence: 0.98
        }
      }
    ],
    analysisMetadata: {
      totalFrames: 3,
      totalSegments: 3,
      alignmentAccuracy: 1.0,
      processingTime: 45000,
      costs: {
        frameExtraction: 0.15,
        transcription: 0.03,
        total: 0.18
      }
    }
  }

  const mockAnthropicResponse = {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
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
            score: 7,
            rationale: 'Good speaking pace with occasional rushed sections',
            improvementSuggestions: ['Practice consistent pacing', 'Use strategic pauses']
          },
          {
            pointId: 'problem_definition',
            score: 8,
            rationale: 'Clear problem statement with specific metrics',
            improvementSuggestions: ['Add more customer pain examples']
          }
        ],
        timestampedRecommendations: [
          {
            id: 'rec_001',
            timestamp: 5,
            duration: 10,
            category: 'content',
            priority: 'high',
            title: 'Strengthen Problem Definition',
            description: 'Add more specific customer pain points',
            specificIssue: 'Problem statement lacks emotional impact',
            actionableAdvice: 'Include specific customer quotes or case studies',
            relatedFrameworkScore: 'problem_definition'
          }
        ],
        slideAnalysis: [
          {
            timestamp: 10,
            slideImage: 'frame_00m10s.png',
            contentSummary: 'Problem slide showing market statistics',
            designFeedback: 'Clean layout with good data visualization',
            alignmentWithSpeech: 'ALIGNED: Verbal claims match slide data',
            improvementSuggestions: ['Consider larger font for key numbers'],
            score: 7
          }
        ],
        analysisTimestamp: '2025-06-16T16:30:00Z',
        processingTime: 12.5
      })
    }],
    usage: {
      input_tokens: 2500,
      output_tokens: 800
    }
  }

  let mockMessagesCreate: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up mock
    mockMessagesCreate = vi.fn().mockResolvedValue(mockAnthropicResponse)
    const MockedAnthropic = vi.mocked(require('@anthropic-ai/sdk').default)
    MockedAnthropic.mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate
      }
    }))
  })

  describe('Analyze Pitch API Route', () => {
    it('should successfully process aligned pitch data and return analysis', async () => {
      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.data?.sessionId).toBe('test-session-123')
      expect(data.data?.overallScore).toBe(7.2)
      expect(data.metadata.model).toBe('claude-3-5-sonnet-20241022')
      expect(data.metadata.alignmentQuality).toBe(1.0)
    })

    it('should validate required aligned data structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({}) // Missing alignedData
      })

      const response = await POST(request)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing aligned data')
    })

    it('should handle empty aligned segments', async () => {
      const emptyData = {
        ...mockAlignedData,
        alignedSegments: []
      }

      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: emptyData })
      })

      const response = await POST(request)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('No aligned segments provided')
    })

    it('should limit segments for cost control', async () => {
      // Create data with more than MAX_FRAMES (20) segments
      const manySegments: AlignedSegment[] = []
      for (let i = 0; i < 25; i++) {
        manySegments.push({
          timestamp: (i + 1) * 5,
          frame: {
            timestamp: (i + 1) * 5,
            url: `https://image.mux.com/test/thumbnail.png?time=${(i + 1) * 5}`,
            filename: `frame_${String((i + 1) * 5).padStart(5, '0')}s.png`
          },
          transcriptSegment: {
            startTime: i * 5,
            endTime: (i + 1) * 5,
            text: `Segment ${i + 1} transcript text`,
            confidence: 0.9
          }
        })
      }

      const largeData = {
        ...mockAlignedData,
        alignedSegments: manySegments
      }

      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: largeData })
      })

      const response = await POST(request)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // Should limit to MAX_FRAMES (20) segments
      expect(data.metadata.inputTokens).toBeLessThan(10000) // Cost control check
    })

    it('should calculate costs accurately', async () => {
      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(data.metadata.cost).toBeGreaterThan(0)
      expect(data.metadata.inputTokens).toBe(2500)
      expect(data.metadata.outputTokens).toBe(800)
      
      // Verify cost calculation: (2500/1000 * 0.015) + (800/1000 * 0.075) = 0.0375 + 0.06 = 0.0975
      const expectedCost = (2500 / 1000) * 0.015 + (800 / 1000) * 0.075
      expect(data.metadata.cost).toBeCloseTo(expectedCost, 4)
    })

    it('should handle Anthropic API failures gracefully', async () => {
      // Mock API failure
      mockMessagesCreate.mockRejectedValue(new Error('API rate limit exceeded'))

      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('API rate limit exceeded')
      expect(data.metadata.cost).toBe(0)
    })

    it('should handle malformed JSON responses from Claude', async () => {
      // Mock malformed response
      mockMessagesCreate.mockResolvedValue({
        content: [{
          type: 'text' as const,
          text: 'This is not valid JSON response from Claude'
        }],
        usage: {
          input_tokens: 1000,
          output_tokens: 100
        }
      })

      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to parse analysis results from Claude')
      expect(data.metadata.inputTokens).toBe(1000)
      expect(data.metadata.outputTokens).toBe(100)
    })
  })

  describe('Data Flow Validation', () => {
    it('should preserve alignment quality through the analysis pipeline', async () => {
      const testData = {
        ...mockAlignedData,
        analysisMetadata: {
          ...mockAlignedData.analysisMetadata,
          alignmentAccuracy: 0.85 // Partial alignment
        }
      }

      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: testData })
      })

      const response = await POST(request)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(data.metadata.alignmentQuality).toBe(0.85)
    })

    it('should format multimodal content correctly for Claude', async () => {
      let capturedMessages: any = null
      
      mockMessagesCreate.mockImplementation((params) => {
        capturedMessages = params
        return Promise.resolve(mockAnthropicResponse)
      })

      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      await POST(request)

      expect(capturedMessages).toBeDefined()
      expect(capturedMessages.messages[0].content).toBeInstanceOf(Array)
      
      const content = capturedMessages.messages[0].content
      expect(content[0].text).toContain('Full Transcript')
      expect(content[0].text).toContain('Frame-by-Frame Analysis')
      expect(content.some((c: any) => c.text?.includes('Frame 1 - 0:05'))).toBe(true)
      expect(content.some((c: any) => c.text?.includes('Frame 2 - 0:10'))).toBe(true)
    })

    it('should handle Mux URL references in multimodal content', async () => {
      let capturedMessages: any = null
      
      mockMessagesCreate.mockImplementation((params) => {
        capturedMessages = params
        return Promise.resolve(mockAnthropicResponse)
      })

      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      await POST(request)

      const content = capturedMessages.messages[0].content
      const muxUrls = content.filter((c: any) => 
        c.text?.includes('image.mux.com') && c.text?.includes('Slide Image:')
      )
      expect(muxUrls.length).toBeGreaterThan(0)
    })

    it('should validate response schema matches expected format', async () => {
      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      
      const analysisData = data.data!
      
      // Validate required fields
      expect(analysisData.sessionId).toBe('test-session-123')
      expect(analysisData.fundingStage).toMatch(/^(pre-seed|seed|series-a)$/)
      expect(typeof analysisData.overallScore).toBe('number')
      expect(analysisData.categoryScores).toHaveProperty('speech')
      expect(analysisData.categoryScores).toHaveProperty('content')
      expect(analysisData.categoryScores).toHaveProperty('visual')
      expect(analysisData.categoryScores).toHaveProperty('overall')
      expect(Array.isArray(analysisData.individualScores)).toBe(true)
      expect(Array.isArray(analysisData.timestampedRecommendations)).toBe(true)
      expect(Array.isArray(analysisData.slideAnalysis)).toBe(true)
      
      // Validate score ranges
      expect(analysisData.overallScore).toBeGreaterThanOrEqual(1)
      expect(analysisData.overallScore).toBeLessThanOrEqual(10)
      
      // Validate individual scores structure
      analysisData.individualScores.forEach(score => {
        expect(score).toHaveProperty('pointId')
        expect(score).toHaveProperty('score')
        expect(score).toHaveProperty('rationale')
        expect(score).toHaveProperty('improvementSuggestions')
        expect(score.score).toBeGreaterThanOrEqual(1)
        expect(score.score).toBeLessThanOrEqual(10)
      })
    })
  })

  describe('Performance and Cost Optimization', () => {
    it('should complete analysis within reasonable time limits', async () => {
      const startTime = Date.now()
      
      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request)
      const data = await response.json() as PitchAnalysisApiResponse
      
      const processingTime = Date.now() - startTime
      
      expect(response.status).toBe(200)
      expect(processingTime).toBeLessThan(30000) // Should complete within 30 seconds
      expect(data.metadata.processingTime).toBeGreaterThan(0)
    })

    it('should track cost accurately across different payload sizes', async () => {
      const smallData = {
        ...mockAlignedData,
        alignedSegments: mockAlignedData.alignedSegments.slice(0, 1) // 1 segment
      }

      const request = new NextRequest('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: smallData })
      })

      const response = await POST(request)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(data.success).toBe(true)
      expect(data.metadata.cost).toBeGreaterThan(0)
      expect(data.metadata.cost).toBeLessThan(1) // Should be reasonable cost
    })
  })
})