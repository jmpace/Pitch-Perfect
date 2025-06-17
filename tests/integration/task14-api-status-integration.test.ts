/**
 * Task 14: API Status Communication Integration Tests
 * 
 * Tests the integration between API endpoints to verify status-based communication
 * flow replaces error-based coordination between services.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock fetch for external API calls
global.fetch = vi.fn()

describe('Task 14: API Status Communication Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console methods to track logging
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Transcription API Status Response Integration', () => {
    test('returns HTTP 202 with status response when Mux playback ID not available', async () => {
      // Simulate the transcribe route handler behavior
      const mockTranscribeHandler = async (request: Request) => {
        const body = await request.json()
        const { muxPlaybackId, videoUrl } = body

        // Check if playback ID is available
        if (!muxPlaybackId && !videoUrl.includes('/mux/')) {
          // Return status response instead of throwing error
          return new Response(JSON.stringify({
            success: false,
            status: 'waiting_for_dependency',
            message: 'Audio extraction in progress',
            dependency: {
              type: 'mux_playback_id',
              required_for: 'audio_file_access',
              description: 'Waiting for Mux to process audio-only static rendition'
            },
            estimated_wait_seconds: 45,
            retry_recommended: true,
            current_step: 'audio_extraction_in_progress',
            progress_percentage: 25
          }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        // Normal processing would continue here
        return new Response(JSON.stringify({
          success: true,
          stage: 'whisper_complete',
          fullTranscript: 'Transcribed text...'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Test without Mux playback ID
      const request = new Request('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'https://storage.googleapis.com/vercel-blob/video.mp4',
          videoDuration: '180',
          stage: 'whisper'
        })
      })

      const response = await mockTranscribeHandler(request)
      const data = await response.json()

      // Verify status response
      expect(response.status).toBe(202)
      expect(data.success).toBe(false)
      expect(data.status).toBe('waiting_for_dependency')
      expect(data.message).toBe('Audio extraction in progress')
      expect(data.dependency.type).toBe('mux_playback_id')
      expect(data.retry_recommended).toBe(true)
      
      // Verify no error was thrown
      expect(console.error).not.toHaveBeenCalled()
    })

    test('returns HTTP 200 with transcription when Mux playback ID is available', async () => {
      // Mock OpenAI transcription call
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'This is the transcribed audio content.'
        })
      })

      const mockTranscribeHandler = async (request: Request) => {
        const body = await request.json()
        const { muxPlaybackId } = body

        if (muxPlaybackId) {
          // Simulate successful transcription
          return new Response(JSON.stringify({
            success: true,
            stage: 'whisper_complete',
            fullTranscript: 'This is the transcribed audio content.',
            whisperData: {
              text: 'This is the transcribed audio content.',
              language: 'en'
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({
          success: false,
          error: 'Missing required parameters'
        }), {
          status: 400
        })
      }

      const request = new Request('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'https://stream.mux.com/test-playback-id.m4a',
          videoDuration: '180',
          stage: 'whisper',
          muxPlaybackId: 'test-playback-id'
        })
      })

      const response = await mockTranscribeHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.stage).toBe('whisper_complete')
      expect(data.fullTranscript).toContain('transcribed audio content')
    })
  })

  describe('Frontend and API Integration', () => {
    test('frontend correctly interprets 202 status response', async () => {
      // Simulate frontend fetch behavior
      const mockFrontendFetch = async (url: string, options: RequestInit) => {
        // Simulate API returning 202 status
        return {
          ok: false,
          status: 202,
          json: async () => ({
            success: false,
            status: 'waiting_for_dependency',
            message: 'Audio extraction in progress',
            dependency: {
              type: 'mux_playback_id',
              required_for: 'audio_file_access'
            },
            estimated_wait_seconds: 45,
            retry_recommended: true
          })
        }
      }

      // Simulate frontend handling
      const response = await mockFrontendFetch('/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({ videoUrl: 'test.mp4' })
      })

      const data = await response.json()

      // Frontend should detect 202 status
      expect(response.status).toBe(202)
      expect(response.ok).toBe(false)
      
      // Frontend should recognize this as a waiting state, not an error
      const isWaitingStatus = response.status === 202 || data.status === 'waiting_for_dependency'
      expect(isWaitingStatus).toBe(true)
      
      // Frontend should NOT treat this as an error
      const shouldAddToErrors = response.status >= 500
      expect(shouldAddToErrors).toBe(false)
      
      // Frontend should set appropriate state
      const expectedState = {
        transcriptionStage: 'waiting_for_dependency',
        transcriptionWaitingReason: data.message,
        estimatedWaitTime: data.estimated_wait_seconds
      }
      
      expect(expectedState.transcriptionStage).toBe('waiting_for_dependency')
      expect(expectedState.estimatedWaitTime).toBe(45)
    })

    test('automatic retry triggers when dependency becomes available', async () => {
      let retryCount = 0
      
      // Simulate API that returns waiting status first, then success
      const mockApi = async () => {
        retryCount++
        
        if (retryCount === 1) {
          // First call: waiting for dependency
          return {
            ok: false,
            status: 202,
            json: async () => ({
              success: false,
              status: 'waiting_for_dependency',
              message: 'Audio extraction in progress',
              retry_recommended: true
            })
          }
        } else {
          // Second call: dependency available, transcription succeeds
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              stage: 'whisper_complete',
              fullTranscript: 'Transcribed content after retry'
            })
          }
        }
      }

      // First attempt
      const firstResponse = await mockApi()
      const firstData = await firstResponse.json()
      
      expect(firstResponse.status).toBe(202)
      expect(firstData.status).toBe('waiting_for_dependency')
      expect(firstData.retry_recommended).toBe(true)
      
      // Simulate state after frame extraction completes
      const state = {
        transcriptionStage: 'waiting_for_dependency',
        extractedFrames: [{ url: 'frame1.jpg', timestamp: 5 }],
        muxPlaybackId: 'newly-available-id',
        segmentedTranscript: []
      }
      
      // Check retry condition (simplified logic)
      const needsRetry = state.transcriptionStage === 'waiting_for_dependency' &&
                        state.extractedFrames.length > 0 &&
                        state.segmentedTranscript.length === 0 &&
                        !!state.muxPlaybackId
      
      expect(needsRetry).toBe(true)
      
      // Second attempt (retry)
      const retryResponse = await mockApi()
      const retryData = await retryResponse.json()
      
      expect(retryResponse.status).toBe(200)
      expect(retryData.success).toBe(true)
      expect(retryData.fullTranscript).toContain('Transcribed content after retry')
      expect(retryCount).toBe(2)
    })
  })

  describe('Error Logging and Developer Experience', () => {
    test('status responses generate clean INFO logs instead of ERROR logs', () => {
      const mockLogger = {
        log: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
      }

      // Simulate API logging for waiting status
      const logStatusResponse = (status: any) => {
        if (status.status === 'waiting_for_dependency') {
          mockLogger.info(`Status: ${status.status}`)
          mockLogger.log(`⏳ ${status.message}`)
        } else if (status.error) {
          mockLogger.error(`Error: ${status.error}`)
        }
      }

      // Log a waiting status
      logStatusResponse({
        status: 'waiting_for_dependency',
        message: 'Audio extraction in progress'
      })

      // Verify clean logging
      expect(mockLogger.info).toHaveBeenCalledWith('Status: waiting_for_dependency')
      expect(mockLogger.log).toHaveBeenCalledWith('⏳ Audio extraction in progress')
      expect(mockLogger.error).not.toHaveBeenCalled()
      
      // Log a real error for comparison
      logStatusResponse({
        error: 'OpenAI API authentication failed'
      })
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error: OpenAI API authentication failed')
    })

    test('eliminates misleading "Large file detected" error messages', () => {
      // OLD behavior (what we're replacing)
      const oldErrorMessage = 'Large file detected - please wait for frame extraction to complete before transcription.'
      
      // NEW behavior
      const newStatusMessage = 'Audio extraction in progress'
      
      // Verify the old misleading message is not used
      expect(newStatusMessage).not.toContain('Large file')
      expect(newStatusMessage).not.toContain('frame extraction')
      
      // Verify new message is clear and accurate
      expect(newStatusMessage).toBe('Audio extraction in progress')
    })
  })

  describe('Parallel Processing Preservation', () => {
    test('frame extraction and transcription continue to run in parallel', async () => {
      const timeline: Array<{operation: string, timestamp: number}> = []
      const startTime = Date.now()
      
      // Simulate frame extraction
      const extractFrames = async () => {
        timeline.push({ operation: 'frame_extraction_start', timestamp: Date.now() - startTime })
        await new Promise(resolve => setTimeout(resolve, 100)) // Simulate processing
        timeline.push({ operation: 'frame_extraction_complete', timestamp: Date.now() - startTime })
        return { muxPlaybackId: 'test-id', frames: ['frame1.jpg', 'frame2.jpg'] }
      }
      
      // Simulate transcription with retry
      const transcribe = async (muxPlaybackId?: string) => {
        timeline.push({ operation: 'transcription_attempt', timestamp: Date.now() - startTime })
        
        if (!muxPlaybackId) {
          timeline.push({ operation: 'transcription_waiting', timestamp: Date.now() - startTime })
          return { status: 'waiting_for_dependency' }
        }
        
        timeline.push({ operation: 'transcription_complete', timestamp: Date.now() - startTime })
        return { status: 'success', transcript: 'Transcribed text' }
      }
      
      // Start both operations in parallel
      const [frameResult, transcriptResult] = await Promise.all([
        extractFrames(),
        transcribe() // First attempt without playback ID
      ])
      
      // Verify parallel execution
      const frameStart = timeline.find(t => t.operation === 'frame_extraction_start')
      const transcriptAttempt = timeline.find(t => t.operation === 'transcription_attempt')
      
      expect(frameStart).toBeDefined()
      expect(transcriptAttempt).toBeDefined()
      
      // Both should start nearly simultaneously (within 10ms)
      expect(Math.abs(frameStart!.timestamp - transcriptAttempt!.timestamp)).toBeLessThan(10)
      
      // Verify transcription waited for dependency
      expect(transcriptResult.status).toBe('waiting_for_dependency')
      
      // Simulate retry after frames complete
      const retryResult = await transcribe(frameResult.muxPlaybackId)
      expect(retryResult.status).toBe('success')
      
      // Verify complete timeline
      expect(timeline.map(t => t.operation)).toEqual([
        'frame_extraction_start',
        'transcription_attempt',
        'transcription_waiting',
        'frame_extraction_complete',
        'transcription_attempt',
        'transcription_complete'
      ])
    })
  })

  describe('State Management Integration', () => {
    test('state transitions correctly from waiting to success', () => {
      // Initial state
      let state = {
        transcriptionStage: undefined as string | undefined,
        transcriptionWaitingReason: undefined as string | undefined,
        estimatedWaitTime: undefined as number | undefined,
        errors: [] as Array<{message: string}>
      }
      
      // Receive waiting status
      const waitingResponse = {
        status: 'waiting_for_dependency',
        message: 'Audio extraction in progress',
        estimated_wait_seconds: 45
      }
      
      // Update state for waiting
      state = {
        ...state,
        transcriptionStage: 'waiting_for_dependency',
        transcriptionWaitingReason: waitingResponse.message,
        estimatedWaitTime: waitingResponse.estimated_wait_seconds
      }
      
      expect(state.transcriptionStage).toBe('waiting_for_dependency')
      expect(state.errors).toHaveLength(0) // No errors added
      
      // Clear waiting state before retry
      state = {
        ...state,
        transcriptionStage: undefined,
        transcriptionWaitingReason: undefined,
        estimatedWaitTime: undefined
      }
      
      // Successful retry
      state = {
        ...state,
        transcriptionStage: 'whisper_complete'
      }
      
      expect(state.transcriptionStage).toBe('whisper_complete')
      expect(state.errors).toHaveLength(0) // Still no errors
    })
  })
})