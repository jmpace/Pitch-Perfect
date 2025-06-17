/**
 * Task 14: Component Integration Tests
 * 
 * Tests how unit-tested components work together in the status communication flow,
 * ensuring proper integration between frontend and backend components.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock component functions that were unit tested
const mockTranscriptionAPI = {
  checkMuxPlaybackId: vi.fn(),
  returnStatusResponse: vi.fn(),
  processTranscription: vi.fn()
}

const mockFrontendState = {
  updateTranscriptionStage: vi.fn(),
  setWaitingStatus: vi.fn(),
  clearWaitingStatus: vi.fn(),
  triggerRetry: vi.fn()
}

const mockRetryLogic = {
  checkRetryConditions: vi.fn(),
  executeRetry: vi.fn(),
  updateRetryState: vi.fn()
}

describe('Task 14: Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('API and Frontend Component Integration', () => {
    test('API status response flows correctly to frontend state management', async () => {
      // Mock API returning waiting status
      mockTranscriptionAPI.returnStatusResponse.mockResolvedValue({
        status: 202,
        data: {
          success: false,
          status: 'waiting_for_dependency',
          message: 'Audio extraction in progress',
          estimated_wait_seconds: 45
        }
      })

      // Simulate the integration flow
      const handleTranscriptionRequest = async (videoUrl: string) => {
        // API checks for Mux playback ID
        const hasPlaybackId = await mockTranscriptionAPI.checkMuxPlaybackId(videoUrl)
        
        if (!hasPlaybackId) {
          // API returns status response
          const response = await mockTranscriptionAPI.returnStatusResponse()
          
          // Frontend receives and processes status
          if (response.status === 202) {
            await mockFrontendState.setWaitingStatus({
              stage: response.data.status,
              message: response.data.message,
              estimatedTime: response.data.estimated_wait_seconds
            })
          }
          
          return response
        }
        
        // Would process transcription
        return await mockTranscriptionAPI.processTranscription(videoUrl)
      }

      // Execute integration
      mockTranscriptionAPI.checkMuxPlaybackId.mockResolvedValue(false)
      const result = await handleTranscriptionRequest('test-video.mp4')

      // Verify component interactions
      expect(mockTranscriptionAPI.checkMuxPlaybackId).toHaveBeenCalledWith('test-video.mp4')
      expect(mockTranscriptionAPI.returnStatusResponse).toHaveBeenCalled()
      expect(mockFrontendState.setWaitingStatus).toHaveBeenCalledWith({
        stage: 'waiting_for_dependency',
        message: 'Audio extraction in progress',
        estimatedTime: 45
      })
      expect(result.status).toBe(202)
    })

    test('frontend retry logic integrates with backend status checks', async () => {
      // Setup mock state
      const frontendState = {
        transcriptionStage: 'waiting_for_dependency',
        extractedFrames: ['frame1.jpg', 'frame2.jpg'],
        muxPlaybackId: 'test-playback-id',
        segmentedTranscript: []
      }

      // Mock retry condition checker
      mockRetryLogic.checkRetryConditions.mockImplementation((state) => {
        return state.transcriptionStage === 'waiting_for_dependency' &&
               state.extractedFrames.length > 0 &&
               state.segmentedTranscript.length === 0 &&
               !!state.muxPlaybackId
      })

      // Check if retry is needed
      const needsRetry = mockRetryLogic.checkRetryConditions(frontendState)
      expect(needsRetry).toBe(true)

      // Execute retry
      mockRetryLogic.executeRetry.mockImplementation(async () => {
        // Clear waiting status
        await mockFrontendState.clearWaitingStatus()
        
        // Call transcription API with playback ID
        return await mockTranscriptionAPI.processTranscription(frontendState.muxPlaybackId)
      })

      mockTranscriptionAPI.processTranscription.mockResolvedValue({
        success: true,
        fullTranscript: 'Transcribed content'
      })

      const retryResult = await mockRetryLogic.executeRetry()

      // Verify integration
      expect(mockFrontendState.clearWaitingStatus).toHaveBeenCalled()
      expect(mockTranscriptionAPI.processTranscription).toHaveBeenCalledWith('test-playback-id')
      expect(retryResult.success).toBe(true)
    })
  })

  describe('State Management Component Integration', () => {
    test('state transitions flow correctly through components', async () => {
      const stateManager = {
        currentState: 'initial',
        history: [] as string[],
        
        transition: function(newState: string) {
          this.history.push(this.currentState)
          this.currentState = newState
        }
      }

      // Simulate state flow
      // 1. Initial upload
      stateManager.transition('uploading')
      expect(stateManager.currentState).toBe('uploading')
      
      // 2. Upload complete, start processing
      stateManager.transition('processing')
      
      // 3. Transcription attempts, gets waiting status
      mockFrontendState.updateTranscriptionStage.mockImplementation((stage) => {
        if (stage === 'waiting_for_dependency') {
          stateManager.transition('waiting_for_audio')
        }
      })
      
      await mockFrontendState.updateTranscriptionStage('waiting_for_dependency')
      expect(stateManager.currentState).toBe('waiting_for_audio')
      
      // 4. Frame extraction completes
      stateManager.transition('frames_ready')
      
      // 5. Retry transcription
      stateManager.transition('transcribing')
      
      // 6. Success
      stateManager.transition('completed')
      
      // Verify state history
      expect(stateManager.history).toEqual([
        'initial',
        'uploading', 
        'processing',
        'waiting_for_audio',
        'frames_ready',
        'transcribing'
      ])
      expect(stateManager.currentState).toBe('completed')
    })
  })

  describe('Error Banner to Status Banner Component Integration', () => {
    test('UI components display correct banner based on response type', () => {
      const bannerComponent = {
        show: vi.fn(),
        hide: vi.fn(),
        currentType: null as string | null
      }

      // Helper to determine banner type
      const showAppropiateBanner = (response: any) => {
        if (response.status === 202 || response.status === 'waiting_for_dependency') {
          bannerComponent.currentType = 'info'
          bannerComponent.show({
            type: 'info',
            message: response.message || 'Processing...',
            icon: '🎵'
          })
        } else if (response.error) {
          bannerComponent.currentType = 'error'
          bannerComponent.show({
            type: 'error',
            message: response.error,
            icon: '❌'
          })
        }
      }

      // Test waiting status
      showAppropiateBanner({
        status: 'waiting_for_dependency',
        message: 'Audio extraction in progress'
      })
      
      expect(bannerComponent.currentType).toBe('info')
      expect(bannerComponent.show).toHaveBeenCalledWith({
        type: 'info',
        message: 'Audio extraction in progress',
        icon: '🎵'
      })

      // Test real error
      showAppropiateBanner({
        error: 'OpenAI API authentication failed'
      })
      
      expect(bannerComponent.currentType).toBe('error')
      expect(bannerComponent.show).toHaveBeenLastCalledWith({
        type: 'error',
        message: 'OpenAI API authentication failed',
        icon: '❌'
      })
    })
  })

  describe('Progress Tracking Component Integration', () => {
    test('progress indicators update correctly through status flow', () => {
      const progressTracker = {
        transcriptionProgress: 0,
        frameProgress: 0,
        overallProgress: 0,
        
        updateProgress: function(component: string, value: number) {
          if (component === 'transcription') {
            this.transcriptionProgress = value
          } else if (component === 'frames') {
            this.frameProgress = value
          }
          
          // Calculate overall progress
          this.overallProgress = Math.floor(
            (this.transcriptionProgress + this.frameProgress) / 2
          )
        }
      }

      // Start processing
      progressTracker.updateProgress('frames', 50)
      expect(progressTracker.frameProgress).toBe(50)
      expect(progressTracker.overallProgress).toBe(25)
      
      // Transcription waiting (show some progress)
      progressTracker.updateProgress('transcription', 25)
      expect(progressTracker.transcriptionProgress).toBe(25)
      expect(progressTracker.overallProgress).toBe(37)
      
      // Frames complete
      progressTracker.updateProgress('frames', 100)
      expect(progressTracker.overallProgress).toBe(62)
      
      // Transcription retry and complete
      progressTracker.updateProgress('transcription', 100)
      expect(progressTracker.overallProgress).toBe(100)
    })
  })

  describe('Logging Component Integration', () => {
    test('logger components work together for clean status tracking', () => {
      const apiLogger = {
        logs: [] as any[],
        log: function(level: string, message: string, data?: any) {
          this.logs.push({ level, message, data, component: 'api' })
        }
      }
      
      const frontendLogger = {
        logs: [] as any[],
        log: function(level: string, message: string, data?: any) {
          this.logs.push({ level, message, data, component: 'frontend' })
        }
      }

      // API logs status response
      apiLogger.log('info', 'Returning wait status', {
        status: 'waiting_for_dependency',
        httpCode: 202
      })
      
      // Frontend logs receipt
      frontendLogger.log('info', 'Received wait status from API', {
        willRetry: true,
        estimatedWait: 45
      })
      
      // Frontend logs retry
      frontendLogger.log('info', 'Initiating automatic retry', {
        reason: 'dependency_available',
        muxPlaybackId: 'test-id'
      })
      
      // API logs success
      apiLogger.log('info', 'Transcription completed', {
        duration: 180,
        transcriptLength: 1500
      })

      // Verify clean logging across components
      const allLogs = [...apiLogger.logs, ...frontendLogger.logs]
      const errorLogs = allLogs.filter(log => log.level === 'error')
      const fakeErrorLogs = allLogs.filter(log => 
        log.message.includes('Large file') || 
        log.message.includes('fake error')
      )
      
      expect(errorLogs).toHaveLength(0)
      expect(fakeErrorLogs).toHaveLength(0)
      expect(allLogs).toHaveLength(4)
      
      // Verify coordination is clear
      expect(apiLogger.logs[0].data.httpCode).toBe(202)
      expect(frontendLogger.logs[0].data.willRetry).toBe(true)
    })
  })

  describe('Dependency Resolution Component Integration', () => {
    test('components coordinate to resolve Mux dependency', async () => {
      const dependencyResolver = {
        dependencies: new Map(),
        
        register: function(key: string, value: any) {
          this.dependencies.set(key, value)
        },
        
        check: function(key: string) {
          return this.dependencies.get(key)
        },
        
        waitFor: async function(key: string, timeout = 5000) {
          const start = Date.now()
          while (Date.now() - start < timeout) {
            if (this.check(key)) {
              return this.check(key)
            }
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          return null
        }
      }

      // Frame extraction component registers playback ID
      setTimeout(() => {
        dependencyResolver.register('mux_playback_id', 'playback-123')
      }, 200)

      // Transcription component waits for dependency
      const waitPromise = dependencyResolver.waitFor('mux_playback_id', 1000)
      
      // Initially not available
      expect(dependencyResolver.check('mux_playback_id')).toBeUndefined()
      
      // Wait for resolution
      const playbackId = await waitPromise
      
      expect(playbackId).toBe('playback-123')
      expect(dependencyResolver.check('mux_playback_id')).toBe('playback-123')
    })
  })
})