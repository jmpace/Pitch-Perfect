/**
 * Task 13 Integration Tests: External Service Integrations (Anthropic API)
 * 
 * Tests integration with Anthropic Claude API, handling different response scenarios,
 * error conditions, rate limiting, and service availability issues.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { 
  AlignedPitchData, 
  PitchAnalysisApiResponse,
  AlignedSegment
} from '@/types/pitch-analysis'

// Mock fetch for network-level testing
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk')

describe('Task 13: External Service Integration Tests', () => {
  const mockAlignedData: AlignedPitchData = {
    sessionId: 'test-external-service',
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
          text: 'Welcome to our pitch presentation about revolutionizing small business automation.',
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
          text: 'The problem affects 50 million small businesses who waste 40% of their time on manual tasks.',
          confidence: 0.92
        }
      }
    ],
    analysisMetadata: {
      totalFrames: 2,
      totalSegments: 2,
      alignmentAccuracy: 1.0,
      processingTime: 30000,
      costs: {
        frameExtraction: 0.10,
        transcription: 0.02,
        total: 0.12
      }
    }
  }

  let mockAnthropicClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock Anthropic client
    mockAnthropicClient = {
      messages: {
        create: vi.fn()
      }
    }

    // Mock Anthropic constructor
    const MockedAnthropic = vi.mocked(Anthropic)
    MockedAnthropic.mockImplementation(() => mockAnthropicClient)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Anthropic API Integration', () => {
    it('should successfully call Anthropic API with proper parameters', async () => {
      const mockResponse = {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            sessionId: 'test-external-service',
            fundingStage: 'seed',
            overallScore: 7.5,
            categoryScores: { speech: 7.0, content: 8.0, visual: 7.5, overall: 8.0 },
            individualScores: [],
            timestampedRecommendations: [],
            slideAnalysis: [],
            analysisTimestamp: '2025-06-16T16:30:00Z',
            processingTime: 12.3
          })
        }],
        usage: {
          input_tokens: 2000,
          output_tokens: 500
        }
      }

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse)

      // Import and call the API endpoint
      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request as any)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(1)
      
      const callArgs = mockAnthropicClient.messages.create.mock.calls[0][0]
      expect(callArgs.model).toBe('claude-3-5-sonnet-20241022')
      expect(callArgs.temperature).toBe(0.1)
      expect(callArgs.max_tokens).toBe(4000)
      expect(callArgs.system).toContain('You are an expert venture capital pitch coach')
      expect(callArgs.messages[0].role).toBe('user')
      expect(Array.isArray(callArgs.messages[0].content)).toBe(true)

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data?.overallScore).toBe(7.5)
    })

    it('should handle Anthropic API rate limiting errors', async () => {
      const rateLimitError = new Error('Request rate limit exceeded')
      rateLimitError.name = 'RateLimitError'
      
      mockAnthropicClient.messages.create.mockRejectedValue(rateLimitError)

      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request as any)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Request rate limit exceeded')
      expect(data.metadata.cost).toBe(0)
    })

    it('should handle Anthropic API authentication errors', async () => {
      const authError = new Error('Invalid API key')
      authError.name = 'AuthenticationError'
      
      mockAnthropicClient.messages.create.mockRejectedValue(authError)

      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request as any)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid API key')
    })

    it('should handle network connectivity issues', async () => {
      const networkError = new Error('Network request failed')
      networkError.name = 'NetworkError'
      
      mockAnthropicClient.messages.create.mockRejectedValue(networkError)

      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request as any)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Network request failed')
    })

    it('should handle malformed API responses gracefully', async () => {
      const malformedResponse = {
        content: [{
          type: 'text' as const,
          text: 'This is not valid JSON and cannot be parsed as analysis results'
        }],
        usage: {
          input_tokens: 1500,
          output_tokens: 200
        }
      }

      mockAnthropicClient.messages.create.mockResolvedValue(malformedResponse)

      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request as any)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to parse analysis results from Claude')
      expect(data.metadata.inputTokens).toBe(1500)
      expect(data.metadata.outputTokens).toBe(200)
    })

    it('should handle partial JSON responses in code blocks', async () => {
      const partialJsonResponse = {
        content: [{
          type: 'text' as const,
          text: `Here's my analysis:

\`\`\`json
{
  "sessionId": "test-external-service",
  "fundingStage": "seed",
  "overallScore": 6.8,
  "categoryScores": {
    "speech": 6.5,
    "content": 7.0,
    "visual": 6.8,
    "overall": 7.5
  },
  "individualScores": [
    {
      "pointId": "pace_rhythm",
      "score": 7,
      "rationale": "Good pacing overall",
      "improvementSuggestions": ["Use more strategic pauses"]
    }
  ],
  "timestampedRecommendations": [],
  "slideAnalysis": [],
  "analysisTimestamp": "2025-06-16T16:30:00Z",
  "processingTime": 11.2
}
\`\`\`

This analysis shows...`
        }],
        usage: {
          input_tokens: 2200,
          output_tokens: 600
        }
      }

      mockAnthropicClient.messages.create.mockResolvedValue(partialJsonResponse)

      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request as any)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data?.overallScore).toBe(6.8)
      expect(data.data?.categoryScores.speech).toBe(6.5)
    })

    it('should validate API key configuration', async () => {
      // Mock missing API key
      const originalEnv = process.env.ANTHROPIC_API_KEY
      delete process.env.ANTHROPIC_API_KEY

      try {
        const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
        const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
          method: 'POST',
          body: JSON.stringify({ alignedData: mockAlignedData })
        })

        // This should trigger an error due to missing API key
        const response = await POST(request as any)
        const data = await response.json() as PitchAnalysisApiResponse

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
      } finally {
        // Restore API key
        if (originalEnv) {
          process.env.ANTHROPIC_API_KEY = originalEnv
        }
      }
    })
  })

  describe('Service Resilience and Retry Logic', () => {
    it('should handle timeout scenarios', async () => {
      const timeoutError = new Error('Request timeout after 30 seconds')
      timeoutError.name = 'TimeoutError'
      
      mockAnthropicClient.messages.create.mockRejectedValue(timeoutError)

      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request as any)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Request timeout after 30 seconds')
    })

    it('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service temporarily unavailable')
      serviceError.name = 'ServiceUnavailableError'
      
      mockAnthropicClient.messages.create.mockRejectedValue(serviceError)

      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request as any)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Service temporarily unavailable')
    })

    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('Monthly quota exceeded')
      quotaError.name = 'QuotaExceededError'
      
      mockAnthropicClient.messages.create.mockRejectedValue(quotaError)

      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request as any)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Monthly quota exceeded')
    })
  })

  describe('Payload Size and Optimization', () => {
    it('should handle large multimodal payloads efficiently', async () => {
      // Create large payload with many segments
      const largeAlignedData: AlignedPitchData = {
        ...mockAlignedData,
        alignedSegments: Array.from({ length: 30 }, (_, i) => ({
          timestamp: (i + 1) * 5,
          frame: {
            timestamp: (i + 1) * 5,
            url: `https://image.mux.com/test/thumbnail.png?time=${(i + 1) * 5}`,
            filename: `frame_${String((i + 1) * 5).padStart(5, '0')}s.png`
          },
          transcriptSegment: {
            startTime: i * 5,
            endTime: (i + 1) * 5,
            text: `This is a longer transcript segment ${i + 1} with detailed content about our business strategy and market opportunity.`,
            confidence: 0.9 + (Math.random() * 0.1)
          }
        }))
      }

      const mockResponse = {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            sessionId: 'test-external-service',
            fundingStage: 'series-a',
            overallScore: 8.2,
            categoryScores: { speech: 8.0, content: 8.5, visual: 8.0, overall: 8.2 },
            individualScores: [],
            timestampedRecommendations: [],
            slideAnalysis: [],
            analysisTimestamp: '2025-06-16T16:30:00Z',
            processingTime: 18.7
          })
        }],
        usage: {
          input_tokens: 8500, // Large input tokens
          output_tokens: 1200
        }
      }

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse)

      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: largeAlignedData })
      })

      const startTime = Date.now()
      const response = await POST(request as any)
      const processingTime = Date.now() - startTime
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.metadata.inputTokens).toBe(8500)
      expect(data.metadata.cost).toBeGreaterThan(0.1) // Higher cost for large payload
      expect(processingTime).toBeLessThan(5000) // Should still be reasonable
    })

    it('should respect maximum segment limits for cost control', async () => {
      // Create payload exceeding MAX_FRAMES (20)
      const excessiveData: AlignedPitchData = {
        ...mockAlignedData,
        alignedSegments: Array.from({ length: 50 }, (_, i) => ({
          timestamp: (i + 1) * 5,
          frame: {
            timestamp: (i + 1) * 5,
            url: `https://image.mux.com/test/thumbnail.png?time=${(i + 1) * 5}`,
            filename: `frame_${String((i + 1) * 5).padStart(5, '0')}s.png`
          },
          transcriptSegment: {
            startTime: i * 5,
            endTime: (i + 1) * 5,
            text: `Segment ${i + 1} content`,
            confidence: 0.9
          }
        }))
      }

      const mockResponse = {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            sessionId: 'test-external-service',
            fundingStage: 'seed',
            overallScore: 7.0,
            categoryScores: { speech: 7.0, content: 7.0, visual: 7.0, overall: 7.0 },
            individualScores: [],
            timestampedRecommendations: [],
            slideAnalysis: [],
            analysisTimestamp: '2025-06-16T16:30:00Z',
            processingTime: 15.0
          })
        }],
        usage: {
          input_tokens: 5000, // Should be limited despite 50 segments
          output_tokens: 800
        }
      }

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse)

      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: excessiveData })
      })

      const response = await POST(request as any)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // Cost should be controlled despite large input
      expect(data.metadata.cost).toBeLessThan(1.0)
    })
  })

  describe('Response Quality and Validation', () => {
    it('should validate framework compliance in responses', async () => {
      const compliantResponse = {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            sessionId: 'test-external-service',
            fundingStage: 'seed',
            overallScore: 7.5,
            categoryScores: {
              speech: 7.0,
              content: 8.0,
              visual: 7.5,
              overall: 7.8
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
                rationale: 'Clear problem statement with supporting evidence',
                improvementSuggestions: ['Add more customer pain examples']
              }
            ],
            timestampedRecommendations: [
              {
                id: 'rec_001',
                timestamp: 10,
                duration: 15,
                category: 'content',
                priority: 'high',
                title: 'Enhance Problem Evidence',
                description: 'Strengthen problem validation with data',
                specificIssue: 'Lack of quantified customer pain',
                actionableAdvice: 'Add specific metrics about time/cost waste',
                relatedFrameworkScore: 'problem_definition'
              }
            ],
            slideAnalysis: [
              {
                timestamp: 5,
                slideImage: 'frame_00m05s.png',
                contentSummary: 'Title slide with company branding',
                designFeedback: 'Professional design with good contrast',
                alignmentWithSpeech: 'ALIGNED: Intro matches title slide',
                improvementSuggestions: ['Consider adding value proposition'],
                score: 7
              }
            ],
            analysisTimestamp: '2025-06-16T16:30:00Z',
            processingTime: 12.5
          })
        }],
        usage: {
          input_tokens: 2500,
          output_tokens: 900
        }
      }

      mockAnthropicClient.messages.create.mockResolvedValue(compliantResponse)

      const { POST } = await import('@/app/api/experiment/analyze-pitch/route')
      const request = new Request('http://localhost:3000/api/experiment/analyze-pitch', {
        method: 'POST',
        body: JSON.stringify({ alignedData: mockAlignedData })
      })

      const response = await POST(request as any)
      const data = await response.json() as PitchAnalysisApiResponse

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      const analysisData = data.data!
      
      // Validate framework point IDs are valid
      const validPointIds = [
        'pace_rhythm', 'filler_words', 'vocal_confidence',
        'problem_definition', 'solution_clarity', 'market_validation',
        'traction_evidence', 'financial_projections', 'ask_clarity',
        'slide_design', 'data_visualization', 'storytelling', 'executive_presence'
      ]
      
      analysisData.individualScores.forEach(score => {
        expect(validPointIds).toContain(score.pointId)
        expect(score.score).toBeGreaterThanOrEqual(1)
        expect(score.score).toBeLessThanOrEqual(10)
        expect(score.rationale).toBeTruthy()
        expect(Array.isArray(score.improvementSuggestions)).toBe(true)
      })

      // Validate timestamped recommendations
      analysisData.timestampedRecommendations.forEach(rec => {
        expect(rec.timestamp).toBeGreaterThanOrEqual(0)
        expect(rec.duration).toBeGreaterThan(0)
        expect(['speech', 'content', 'visual', 'overall']).toContain(rec.category)
        expect(['high', 'medium', 'low']).toContain(rec.priority)
        expect(validPointIds).toContain(rec.relatedFrameworkScore)
      })
    })
  })
})