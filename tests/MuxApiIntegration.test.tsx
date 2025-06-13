import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom'

/**
 * 🔴 RED Phase: Mux API Integration Tests
 * 
 * These tests verify the API endpoint integration with Mux and will FAIL with current Rendi implementation.
 * They focus on:
 * 1. Authentication: Mux Basic auth vs Rendi X-API-KEY
 * 2. Request Payload: videoDuration included from client-side extraction  
 * 3. Response Format: Mux URLs, playback IDs, and metadata
 * 4. Error Handling: Mux-specific error messages and retry logic
 * 5. Cost Calculation: Mux pricing structure vs Rendi
 * 
 * Expected behavior AFTER migration:
 * - POST requests to Mux use Authorization: Basic header
 * - Request includes { videoUrl, videoDuration } 
 * - Response contains playbackId and image.mux.com URLs
 * - No polling delays - direct URL generation
 */

// Mock Next.js request/response
const mockNextRequest = (body: any) => ({
  json: vi.fn().mockResolvedValue(body)
})

const mockNextResponse = {
  json: vi.fn((data, options) => ({ data, options }))
}

// Mock fetch for external API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import the API route handler
import { POST } from '@/app/api/experiment/extract-frames/route'

describe('🔴 RED Phase: Mux API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
    
    // Set up Mux environment variables (these should be used AFTER migration)
    process.env.MUX_TOKEN_ID = 'test-mux-token-id'
    process.env.MUX_TOKEN_SECRET = 'test-mux-token-secret'
    
    // Clear Rendi API key to ensure tests expect Mux
    delete process.env.RENDI_API_KEY
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authentication - Mux Basic Auth vs Rendi X-API-KEY', () => {
    test('🔴 SHOULD FAIL: API uses Mux Basic auth instead of Rendi X-API-KEY', async () => {
      // Mock successful Mux upload response
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload-123', url: 'https://storage.googleapis.com/mux-uploads/upload-123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 'asset-456', playback_ids: [{ id: 'test-playback-id' }] } })
        })

      const request = mockNextRequest({
        videoUrl: 'blob:http://localhost:3000/test-video',
        videoDuration: 132
      })

      await POST(request as any)

      // ❌ WILL FAIL: Current implementation uses X-API-KEY for Rendi
      // Should use Basic auth for Mux
      const uploadCall = mockFetch.mock.calls.find(call => 
        call[0].includes('mux.com') && call[1]?.method === 'POST'
      )
      
      expect(uploadCall).toBeDefined()
      expect(uploadCall[1].headers).toHaveProperty('Authorization')
      expect(uploadCall[1].headers.Authorization).toMatch(/^Basic /)
      expect(uploadCall[1].headers).not.toHaveProperty('X-API-KEY')
      
      // Verify Base64 encoded credentials
      const authHeader = uploadCall[1].headers.Authorization
      const encodedCredentials = authHeader.replace('Basic ', '')
      const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString()
      expect(decodedCredentials).toBe('test-mux-token-id:test-mux-token-secret')
    })

    test('🔴 SHOULD FAIL: Mux API endpoints called instead of Rendi', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload-123', url: 'https://storage.googleapis.com/upload-url' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { playback_ids: [{ id: 'playback-123' }] } })
        })

      const request = mockNextRequest({
        videoUrl: 'blob:test-video',
        videoDuration: 60
      })

      await POST(request as any)

      // ❌ WILL FAIL: Current implementation calls api.rendi.dev
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mux.com/video/v1/uploads',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringMatching(/^Basic /)
          })
        })
      )

      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('rendi.dev'),
        expect.any(Object)
      )
    })
  })

  describe('Request Payload - Client-Side Duration Extraction', () => {
    test('🔴 SHOULD FAIL: API requires videoDuration in request payload', async () => {
      const request = mockNextRequest({
        videoUrl: 'blob:test-video'
        // Missing videoDuration - should be required after migration
      })

      const response = await POST(request as any)

      // ❌ WILL FAIL: Current implementation doesn't require videoDuration
      expect(response.data.error).toContain('videoDuration is required')
      expect(response.options.status).toBe(400)
    })

    test('🔴 SHOULD FAIL: API accepts videoDuration and uses it for frame calculation', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload-123', url: 'https://upload-url' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { playback_ids: [{ id: 'playback-123' }] } })
        })

      const request = mockNextRequest({
        videoUrl: 'blob:test-video',
        videoDuration: 47 // Should generate 10 frames (0, 5, 10, 15, 20, 25, 30, 35, 40, 45)
      })

      const response = await POST(request as any)

      // ❌ WILL FAIL: Current implementation doesn't use videoDuration for frame calculation
      expect(response.data.frameCount).toBe(10)
      expect(response.data.frames).toHaveLength(10)
      
      // Verify frames are generated mathematically
      expect(response.data.frames[0].timestamp).toBe(0)
      expect(response.data.frames[1].timestamp).toBe(5)
      expect(response.data.frames[9].timestamp).toBe(45)
    })

    test('🔴 SHOULD FAIL: dynamic frame count calculation works for any video length', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload-123', url: 'https://upload-url' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { playback_ids: [{ id: 'playback-123' }] } })
        })

      // Test 3600-second video (1 hour)
      const request = mockNextRequest({
        videoUrl: 'blob:long-video',
        videoDuration: 3600
      })

      const response = await POST(request as any)

      // ❌ WILL FAIL: Current implementation generates fixed 9 frames
      expect(response.data.frameCount).toBe(720) // 3600 ÷ 5 = 720 frames
      expect(response.data.frames[0].timestamp).toBe(0)
      expect(response.data.frames[719].timestamp).toBe(3595)
    })
  })

  describe('Response Format - Mux Playback IDs and URLs', () => {
    test('🔴 SHOULD FAIL: response includes Mux playback ID in metadata', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload-123', url: 'https://upload-url' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            data: { 
              id: 'asset-456',
              playback_ids: [{ id: 'vs4PEFhydV1ecwMavpioLBCwzaXf8PnI' }] 
            } 
          })
        })

      const request = mockNextRequest({
        videoUrl: 'blob:test-video',
        videoDuration: 60
      })

      const response = await POST(request as any)

      // ❌ WILL FAIL: Current implementation doesn't include Mux playback ID
      expect(response.data.metadata).toHaveProperty('playbackId')
      expect(response.data.metadata.playbackId).toBe('vs4PEFhydV1ecwMavpioLBCwzaXf8PnI')
      expect(response.data.metadata.extractionMethod).toBe('mux_upload')
      expect(response.data.metadata).not.toHaveProperty('commandId') // No Rendi command ID
    })

    test('🔴 SHOULD FAIL: frame URLs use Mux image service format', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload-123', url: 'https://upload-url' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            data: { playback_ids: [{ id: 'test-playback-id' }] } 
          })
        })

      const request = mockNextRequest({
        videoUrl: 'blob:test-video',
        videoDuration: 15 // Should generate 3 frames (0, 5, 10)
      })

      const response = await POST(request as any)

      // ❌ WILL FAIL: Current implementation generates Rendi URLs or mock URLs
      expect(response.data.frames).toHaveLength(3)
      
      expect(response.data.frames[0].url).toBe(
        'https://image.mux.com/test-playback-id/frame_00m00s.png?time=0'
      )
      expect(response.data.frames[1].url).toBe(
        'https://image.mux.com/test-playback-id/frame_00m05s.png?time=5'
      )
      expect(response.data.frames[2].url).toBe(
        'https://image.mux.com/test-playback-id/frame_00m10s.png?time=10'
      )

      // Verify filename format
      expect(response.data.frames[0].filename).toBe('frame_00m00s.png')
      expect(response.data.frames[1].filename).toBe('frame_00m05s.png')
      expect(response.data.frames[2].filename).toBe('frame_00m10s.png')
    })
  })

  describe('Processing Workflow - No Polling Required', () => {
    test('🔴 SHOULD FAIL: immediate response without polling delays', async () => {
      const startTime = Date.now()

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload-123', url: 'https://upload-url' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { playback_ids: [{ id: 'playback-123' }] } })
        })

      const request = mockNextRequest({
        videoUrl: 'blob:test-video',
        videoDuration: 30
      })

      const response = await POST(request as any)
      const endTime = Date.now()

      // ❌ WILL FAIL: Current Rendi implementation has polling delays (5-second intervals)
      expect(endTime - startTime).toBeLessThan(2000) // Should be fast with Mux
      expect(response.data.metadata.processingTime).toBeLessThan(2000)
      
      // No polling-related properties
      expect(response.data.metadata).not.toHaveProperty('commandId')
      expect(response.data.metadata).not.toHaveProperty('pollAttempts')
    })

    test('🔴 SHOULD FAIL: workflow metadata shows Mux steps instead of Rendi', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload-123', url: 'https://upload-url' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { playback_ids: [{ id: 'playback-123' }] } })
        })

      const request = mockNextRequest({
        videoUrl: 'blob:test-video',
        videoDuration: 25
      })

      const response = await POST(request as any)

      // ❌ WILL FAIL: Current implementation shows Rendi workflow steps
      expect(response.data.metadata.workflowSteps).toEqual([
        'upload_to_mux',
        'get_playback_id', 
        'generate_urls'
      ])
      expect(response.data.metadata.extractionMethod).toBe('mux_upload')
      expect(response.data.metadata.extractionMethod).not.toBe('rendi_ffmpeg')
    })
  })

  describe('Cost Calculation - Mux Pricing vs Rendi', () => {
    test('🔴 SHOULD FAIL: cost calculation uses Mux pricing structure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload-123', url: 'https://upload-url' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { playback_ids: [{ id: 'playback-123' }] } })
        })

      const request = mockNextRequest({
        videoUrl: 'blob:test-video',
        videoDuration: 60 // 12 frames
      })

      const response = await POST(request as any)

      // ❌ WILL FAIL: Current implementation uses Rendi pricing ($0.30 base + $0.01 per frame)
      // Mux should have different pricing structure
      expect(response.data.cost).not.toBe(0.42) // Old Rendi calculation
      expect(response.data.cost).toBeGreaterThan(0)
      expect(response.data.cost).toBeLessThan(0.40) // Mux should be different pricing
    })

    test('🔴 SHOULD FAIL: cost metadata shows Mux upload pricing', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'upload-123', url: 'https://upload-url' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { playbook_ids: [{ id: 'playback-123' }] } })
        })

      const request = mockNextRequest({
        videoUrl: 'blob:test-video',
        videoDuration: 30
      })

      const response = await POST(request as any)

      // ❌ WILL FAIL: Current implementation doesn't include Mux-specific cost breakdown
      expect(response.data.metadata).toHaveProperty('costBreakdown')
      expect(response.data.metadata.costBreakdown).toHaveProperty('muxUpload')
      expect(response.data.metadata.costBreakdown).toHaveProperty('muxStorage')
      expect(response.data.metadata.costBreakdown).not.toHaveProperty('rendiProcessing')
    })
  })

  describe('Error Handling - Mux-Specific Errors', () => {
    test('🔴 SHOULD FAIL: Mux upload failure returns Mux error messages', async () => {
      // Mock Mux upload failure
      mockFetch.mockRejectedValueOnce(new Error('Mux upload failed: Invalid video format'))

      const request = mockNextRequest({
        videoUrl: 'blob:test-video',
        videoDuration: 60
      })

      const response = await POST(request as any)

      // ❌ WILL FAIL: Current implementation returns Rendi error messages
      expect(response.data.error).toContain('Mux upload failed')
      expect(response.data.details).toContain('Invalid video format')
      expect(response.data.error).not.toContain('Rendi')
      expect(response.data.error).not.toContain('FFmpeg')
      expect(response.data.error).not.toContain('polling')
    })

    test('🔴 SHOULD FAIL: fallback mock frames use Mux URL format', async () => {
      // Mock complete Mux API failure
      mockFetch.mockRejectedValueOnce(new Error('Mux service unavailable'))

      const request = mockNextRequest({
        videoUrl: 'blob:test-video',
        videoDuration: 20 // Should generate 4 mock frames
      })

      const response = await POST(request as any)

      // ❌ WILL FAIL: Current implementation uses picsum.photos for mock frames
      expect(response.data.success).toBe(true) // Should still succeed with mocks
      expect(response.data.frames).toHaveLength(4)
      
      // Mock frames should follow Mux URL pattern
      response.data.frames.forEach((frame: any, index: number) => {
        expect(frame.url).toMatch(/^https:\/\/image\.mux\.com\/mock-playback-id\/frame_\d{2}m\d{2}s\.png\?time=\d+$/)
        expect(frame.timestamp).toBe(index * 5)
      })

      expect(response.data.metadata.extractionMethod).toBe('mock_fallback_after_mux_error')
      expect(response.data.metadata.error).toContain('Mux service unavailable')
    })

    test('🔴 SHOULD FAIL: missing Mux credentials returns appropriate error', async () => {
      // Clear Mux credentials
      delete process.env.MUX_TOKEN_ID
      delete process.env.MUX_TOKEN_SECRET

      const request = mockNextRequest({
        videoUrl: 'blob:test-video',
        videoDuration: 30
      })

      const response = await POST(request as any)

      // ❌ WILL FAIL: Current implementation checks for RENDI_API_KEY
      expect(response.data.error).toContain('Mux credentials not configured')
      expect(response.options.status).toBe(500)
      expect(response.data.error).not.toContain('Rendi')
    })
  })
})