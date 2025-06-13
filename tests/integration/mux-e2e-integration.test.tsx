import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom'

/**
 * Integration Tests: End-to-End Mux API Flow
 * 
 * Tests the complete video processing pipeline from upload to frame extraction:
 * 1. Video file upload to Vercel Blob
 * 2. Client-side duration extraction via HTML5 video element
 * 3. API call with videoUrl + videoDuration payload
 * 4. Mux upload → playback ID retrieval → frame URL generation
 * 5. Response with mathematical frame URLs (no polling)
 * 
 * This verifies the seams between:
 * - Client-side duration extraction and API payload
 * - API route and Mux external service
 * - Frame URL generation and UI display
 * - Error handling across the full pipeline
 */

// Import the API route handler for direct testing
import { POST, GET } from '@/app/api/experiment/extract-frames/route'
import { NextRequest } from 'next/server'

// Mock fetch for external Mux API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Integration: End-to-End Mux API Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
    
    // Set up Mux environment variables
    process.env.MUX_TOKEN_ID = 'test-mux-token-id'
    process.env.MUX_TOKEN_SECRET = 'test-mux-token-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complete Video Processing Pipeline', () => {
    test('should process video through complete Mux workflow', async () => {
      // Mock Mux API responses for successful flow
      mockFetch
        // 1. Mux upload creation
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              id: 'upload-123',
              url: 'https://storage.googleapis.com/mux-uploads/upload-123',
              asset_id: 'asset-456'
            }
          })
        })
        // 2. Video upload to Mux storage (PUT request)
        .mockResolvedValueOnce({
          ok: true,
          status: 200
        })
        // 3. Asset retrieval with playback ID
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              id: 'asset-456',
              playback_ids: [{ id: 'vs4PEFhydV1ecwMavpioLBCwzaXf8PnI' }],
              duration: 132.5
            }
          })
        })

      // Create API request with client-extracted duration
      const request = new NextRequest('http://localhost:3000/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:http://localhost:3000/video-123',
          videoDuration: 132.5
        })
      })

      const response = await POST(request)
      const result = await response.json()

      // Verify successful response structure
      expect(result.success).toBe(true)
      expect(result.frames).toBeDefined()
      expect(result.frameCount).toBeDefined()
      expect(result.cost).toBeDefined()
      expect(result.metadata).toBeDefined()

      // Verify frame count calculation (132.5 seconds ÷ 5 = 27 frames)
      expect(result.frameCount).toBe(27)
      expect(result.frames).toHaveLength(27)

      // Verify Mux URL format
      expect(result.frames[0].url).toBe(
        'https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/frame_00m00s.png?time=0'
      )
      expect(result.frames[1].url).toBe(
        'https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/frame_00m05s.png?time=5'
      )
      expect(result.frames[26].url).toBe(
        'https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/frame_02m10s.png?time=130'
      )

      // Verify metadata shows Mux workflow
      expect(result.metadata.extractionMethod).toBe('mux_upload')
      expect(result.metadata.playbackId).toBe('vs4PEFhydV1ecwMavpioLBCwzaXf8PnI')
      expect(result.metadata.workflowSteps).toEqual([
        'upload_to_mux',
        'get_playback_id',
        'generate_urls'
      ])

      // Verify no Rendi-specific properties
      expect(result.metadata).not.toHaveProperty('commandId')
      expect(result.metadata).not.toHaveProperty('pollAttempts')
    })

    test('should handle different video durations correctly', async () => {
      const testCases = [
        { duration: 30, expectedFrames: 6, lastTimestamp: 25 },
        { duration: 47, expectedFrames: 10, lastTimestamp: 45 },
        { duration: 3600, expectedFrames: 720, lastTimestamp: 3595 }
      ]

      for (const testCase of testCases) {
        // Mock successful Mux responses
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              data: { id: 'upload-123', url: 'https://upload-url', asset_id: 'asset-456' }
            })
          })
          .mockResolvedValueOnce({ ok: true })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              data: { playback_ids: [{ id: 'test-playback-id' }] }
            })
          })

        const request = new NextRequest('http://localhost:3000/api/experiment/extract-frames', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: `blob:video-${testCase.duration}s`,
            videoDuration: testCase.duration
          })
        })

        const response = await POST(request)
        const result = await response.json()

        expect(result.frameCount).toBe(testCase.expectedFrames)
        expect(result.frames).toHaveLength(testCase.expectedFrames)
        expect(result.frames[0].timestamp).toBe(0)
        expect(result.frames[result.frames.length - 1].timestamp).toBe(testCase.lastTimestamp)

        // Clear mocks for next iteration
        mockFetch.mockClear()
      }
    })
  })

  describe('Authentication Integration', () => {
    test('should use Mux Basic authentication correctly', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 'upload-123', url: 'https://upload-url', asset_id: 'asset-456' } })
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { playback_ids: [{ id: 'test-playback-id' }] } })
        })

      const request = new NextRequest('http://localhost:3000/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:test-video',
          videoDuration: 60
        })
      })

      await POST(request)

      // Verify Mux upload call uses Basic auth
      const uploadCall = mockFetch.mock.calls.find(call => 
        call[0] === 'https://api.mux.com/video/v1/uploads'
      )
      
      expect(uploadCall).toBeDefined()
      expect(uploadCall[1].headers.Authorization).toMatch(/^Basic /)
      
      // Verify credentials are properly encoded
      const authHeader = uploadCall[1].headers.Authorization
      const encodedCredentials = authHeader.replace('Basic ', '')
      const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString()
      expect(decodedCredentials).toBe('test-mux-token-id:test-mux-token-secret')

      // Verify no X-API-KEY header (Rendi style)
      expect(uploadCall[1].headers).not.toHaveProperty('X-API-KEY')
    })

    test('should handle missing Mux credentials gracefully', async () => {
      delete process.env.MUX_TOKEN_ID
      delete process.env.MUX_TOKEN_SECRET

      const request = new NextRequest('http://localhost:3000/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:test-video',
          videoDuration: 60
        })
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toContain('Mux credentials not configured')
      expect(result.error).not.toContain('Rendi')

      // Restore for other tests
      process.env.MUX_TOKEN_ID = 'test-mux-token-id'
      process.env.MUX_TOKEN_SECRET = 'test-mux-token-secret'
    })
  })

  describe('Error Handling Integration', () => {
    test('should handle Mux upload failures with fallback', async () => {
      // Mock Mux upload failure
      mockFetch.mockRejectedValueOnce(new Error('Mux service unavailable'))

      const request = new NextRequest('http://localhost:3000/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:test-video',
          videoDuration: 30
        })
      })

      const response = await POST(request)
      const result = await response.json()

      // Should succeed with mock frames as fallback
      expect(result.success).toBe(true)
      expect(result.frames).toHaveLength(6) // 30 seconds ÷ 5 = 6 frames
      
      // Mock frames should use Mux URL format
      expect(result.frames[0].url).toMatch(/^https:\/\/image\.mux\.com\/mock-playback-id\/frame_\d{2}m\d{2}s\.png\?time=\d+$/)
      
      expect(result.metadata.extractionMethod).toBe('mock_fallback_after_mux_error')
      expect(result.metadata.error).toContain('Mux service unavailable')
    })

    test('should handle invalid video duration input', async () => {
      const invalidDurations = [
        { videoDuration: null, description: 'null duration' },
        { videoDuration: -5, description: 'negative duration' },
        { videoDuration: 'invalid', description: 'string duration' }
      ]

      for (const testCase of invalidDurations) {
        const request = new NextRequest('http://localhost:3000/api/experiment/extract-frames', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: 'blob:test-video',
            videoDuration: testCase.videoDuration
          })
        })

        const response = await POST(request)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.error).toContain('videoDuration is required and must be a positive number')
      }
    })

    test('should handle missing video URL', async () => {
      const request = new NextRequest('http://localhost:3000/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoDuration: 60
          // Missing videoUrl
        })
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toContain('Video URL is required')
    })
  })

  describe('API Health Check Integration', () => {
    test('should provide health check with environment status', async () => {
      const request = new NextRequest('http://localhost:3000/api/experiment/extract-frames', {
        method: 'GET'
      })

      const response = await GET()
      const result = await response.json()

      expect(result.message).toContain('Mux frame extraction API is ready')
      expect(result.endpoint).toBe('/api/experiment/extract-frames')
      expect(result.method).toBe('POST')
      expect(result.requiredFields).toEqual(['videoUrl', 'videoDuration'])
      expect(result.environmentCheck.muxTokenId).toBe(true)
      expect(result.environmentCheck.muxTokenSecret).toBe(true)
    })
  })

  describe('Performance Integration', () => {
    test('should complete processing without polling delays', async () => {
      const startTime = Date.now()

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 'upload-123', url: 'https://upload-url', asset_id: 'asset-456' } })
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { playback_ids: [{ id: 'test-playback-id' }] } })
        })

      const request = new NextRequest('http://localhost:3000/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:test-video',
          videoDuration: 60
        })
      })

      const response = await POST(request)
      const result = await response.json()
      const endTime = Date.now()

      // Should be fast without polling (excluding the 2-second brief wait for Mux processing)
      expect(endTime - startTime).toBeLessThan(5000)
      expect(result.metadata.processingTime).toBeDefined()
      
      // No polling-related metadata
      expect(result.metadata).not.toHaveProperty('pollAttempts')
      expect(result.metadata).not.toHaveProperty('commandId')
    })
  })

  describe('Cost Calculation Integration', () => {
    test('should calculate Mux-specific costs correctly', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 'upload-123', url: 'https://upload-url', asset_id: 'asset-456' } })
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { playback_ids: [{ id: 'test-playback-id' }] } })
        })

      const request = new NextRequest('http://localhost:3000/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:test-video',
          videoDuration: 60 // 12 frames
        })
      })

      const response = await POST(request)
      const result = await response.json()

      // Verify Mux cost structure (upload + storage per frame)
      expect(result.cost).toBeGreaterThan(0)
      expect(result.cost).toBe(0.021) // 0.015 upload + (12 * 0.0005) storage

      // Should not use old Rendi pricing (0.30 + 0.01 per frame = 0.42)
      expect(result.cost).not.toBe(0.42)
    })
  })
})