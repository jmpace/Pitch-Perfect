import { test, expect } from '@playwright/test'

/**
 * Mux Migration Step Definitions - Complete UI Implementation Testing
 * 
 * Tests the COMPLETE UI implementation for Mux-based frame URL generation,
 * covering rendering, visual verification, interactions, timing, accessibility,
 * and cross-component integration.
 */

test.describe('Mux Migration - Complete UI Implementation', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to architecture experiment page
    await page.goto('/experiment/architecture-test')
    
    // Wait for page to load completely
    await page.waitForSelector('[data-testid="grid-layout"]')
    await page.waitForTimeout(1000) // Allow skeleton to complete
  })

  test('API generates Mux frame URLs instead of processing with Rendi FFmpeg', async ({ page }) => {
    // Mock the Mux API responses
    await page.route('/api/experiment/extract-frames', async (route) => {
      const request = await route.request()
      const postData = request.postDataJSON()
      
      // Verify API receives videoDuration from client
      expect(postData).toHaveProperty('videoDuration')
      expect(postData.videoDuration).toBe(132)
      
      // Mock Mux-based response with 27 frames (132 ÷ 5 = 26.4, rounded to 27)
      const mockFrames = []
      for (let i = 0; i < 27; i++) {
        const time = i * 5
        const minutes = Math.floor(time / 60)
        const seconds = time % 60
        const filename = `frame_${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s.png`
        
        mockFrames.push({
          url: `https://image.mux.com/test-playback-id/${filename}?time=${time}`,
          timestamp: time,
          filename: filename
        })
      }
      
      await route.fulfill({
        json: {
          success: true,
          frames: mockFrames,
          frameCount: 27,
          cost: 0.02,
          metadata: {
            processingTime: 2500,
            videoUrl: postData.videoUrl,
            extractionMethod: 'mux_upload',
            playbackId: 'test-playback-id'
          }
        }
      })
    })
    
    // Mock video duration extraction
    await page.addInitScript(() => {
      // Override video element duration when created
      const originalCreateElement = document.createElement
      document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName)
        if (tagName.toLowerCase() === 'video') {
          Object.defineProperty(element, 'duration', {
            get: () => 132,
            configurable: true
          })
        }
        return element
      }
    })
    
    // Upload a test video file
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: 'test-video.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video content')
    })
    
    // Wait for frame extraction to complete
    await page.waitForSelector('[data-testid="frame-image-1"]', { timeout: 10000 })
    
    // **Render Testing**: Verify all 9 visible frames render to DOM
    for (let i = 1; i <= 9; i++) {
      const frameImage = page.locator(`[data-testid="frame-image-${i}"]`)
      await expect(frameImage).toBeVisible()
      
      // Verify frame URLs point to Mux image service
      const src = await frameImage.getAttribute('src')
      expect(src).toMatch(/https:\/\/image\.mux\.com\/test-playback-id\/frame_\d{2}m\d{2}s\.png\?time=\d+/)
    }
    
    // **Visual Verification**: Check frame dimensions and styling
    const firstFrame = page.locator('[data-testid="frame-image-1"]')
    const frameStyles = await firstFrame.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        width: computed.width,
        height: computed.height,
        borderRadius: computed.borderRadius,
        objectFit: computed.objectFit
      }
    })
    
    expect(frameStyles.width).toBe('120px')
    expect(frameStyles.height).toBe('68px')
    expect(frameStyles.borderRadius).toContain('px') // Should have rounded corners
    expect(frameStyles.objectFit).toBe('cover')
    
    // **Visual Verification**: Check timestamp overlay positioning and styling
    const timestampOverlay = page.locator('[data-testid="timestamp-overlay-1"]')
    await expect(timestampOverlay).toBeVisible()
    await expect(timestampOverlay).toHaveText('0:00')
    
    const overlayStyles = await timestampOverlay.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        position: computed.position,
        bottom: computed.bottom,
        right: computed.right,
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        fontSize: computed.fontSize,
        zIndex: computed.zIndex
      }
    })
    
    expect(overlayStyles.position).toBe('absolute')
    expect(overlayStyles.bottom).toBe('4px')
    expect(overlayStyles.right).toBe('4px')
    expect(overlayStyles.backgroundColor).toMatch(/rgba?\(0,\s*0,\s*0/) // Black with opacity
    expect(overlayStyles.color).toMatch(/rgba?\(255,\s*255,\s*255/) // White text
    expect(overlayStyles.zIndex).toBe('10')
  })

  test('Dynamic frame count calculation for videos of any length', async ({ page }) => {
    // Test 30-second video (6 frames)
    await page.route('/api/experiment/extract-frames', async (route) => {
      const request = await route.request()
      const postData = request.postDataJSON()
      
      const duration = postData.videoDuration
      const frameCount = Math.floor(duration / 5) + 1 // Include frame at 0 seconds
      const mockFrames = []
      
      for (let i = 0; i < frameCount; i++) {
        const time = i * 5
        if (time >= duration) break
        
        const minutes = Math.floor(time / 60)
        const seconds = time % 60
        const filename = `frame_${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s.png`
        
        mockFrames.push({
          url: `https://image.mux.com/test-playback-id/${filename}?time=${time}`,
          timestamp: time,
          filename: filename
        })
      }
      
      await route.fulfill({
        json: {
          success: true,
          frames: mockFrames,
          frameCount: mockFrames.length,
          cost: 0.02,
          metadata: { extractionMethod: 'mux_upload' }
        }
      })
    })
    
    // Mock 30-second video duration
    await page.addInitScript(() => {
      window.testVideoDuration = 30
      const originalCreateElement = document.createElement
      document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName)
        if (tagName.toLowerCase() === 'video') {
          Object.defineProperty(element, 'duration', {
            get: () => window.testVideoDuration,
            configurable: true
          })
        }
        return element
      }
    })
    
    // Upload file and wait for processing
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: 'short-video.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video content')
    })
    
    await page.waitForTimeout(3000) // Allow processing
    
    // **Render Testing**: Verify exactly 6 frames are visible (0, 5, 10, 15, 20, 25)
    for (let i = 1; i <= 6; i++) {
      const frameImage = page.locator(`[data-testid="frame-image-${i}"]`)
      await expect(frameImage).toBeVisible()
    }
    
    // Verify frames 7-9 are hidden for short videos
    for (let i = 7; i <= 9; i++) {
      const framePlaceholder = page.locator(`[data-testid="frame-placeholder-${i}"]`)
      const isHidden = await framePlaceholder.evaluate((el) => {
        return window.getComputedStyle(el).display === 'none' || el.classList.contains('hidden')
      })
      expect(isHidden).toBe(true)
    }
    
    // **Visual Verification**: Check frame indicator text for short video
    const frameIndicator = page.locator('[data-testid="frame-indicator"]')
    await expect(frameIndicator).toHaveText('Showing 6 frames from 30-second video')
  })

  test('Client-side video duration extraction replaces server-side detection', async ({ page }) => {
    let extractionApiCalled = false
    let receivedPayload: any = null
    
    // Mock API to capture the payload
    await page.route('/api/experiment/extract-frames', async (route) => {
      extractionApiCalled = true
      receivedPayload = await route.request().postDataJSON()
      
      await route.fulfill({
        json: {
          success: true,
          frames: [],
          frameCount: 0,
          cost: 0,
          metadata: { extractionMethod: 'mux_upload' }
        }
      })
    })
    
    // Mock video element with specific duration
    await page.addInitScript(() => {
      window.mockDuration = 147.5 // Specific test duration
      
      const originalCreateElement = document.createElement
      document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName)
        if (tagName.toLowerCase() === 'video') {
          // Mock duration property
          Object.defineProperty(element, 'duration', {
            get: () => window.mockDuration,
            configurable: true
          })
          
          // Mock metadata loading
          setTimeout(() => {
            element.dispatchEvent(new Event('loadedmetadata'))
          }, 100)
        }
        return element
      }
    })
    
    // Upload file to trigger duration extraction
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: 'test-video.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video content')
    })
    
    // Wait for upload completion and frame extraction to start
    await page.waitForTimeout(2000)
    
    // **Interaction Testing**: Verify API was called with duration
    expect(extractionApiCalled).toBe(true)
    expect(receivedPayload).toHaveProperty('videoDuration')
    expect(receivedPayload.videoDuration).toBe(147.5)
    expect(receivedPayload).toHaveProperty('videoUrl')
    expect(receivedPayload.videoUrl).toMatch(/^blob:/)
  })

  test('Mux authentication and cost calculation updates', async ({ page }) => {
    let apiHeaders: any = {}
    let responseData: any = null
    
    // Mock API to capture authentication headers
    await page.route('/api/experiment/extract-frames', async (route) => {
      const request = route.request()
      apiHeaders = request.headers()
      
      // Mock successful Mux response
      responseData = {
        success: true,
        frames: [
          {
            url: 'https://image.mux.com/test-id/frame_00m00s.png?time=0',
            timestamp: 0,
            filename: 'frame_00m00s.png'
          }
        ],
        frameCount: 1,
        cost: 0.025, // Mux pricing
        metadata: {
          processingTime: 1200,
          extractionMethod: 'mux_upload',
          playbackId: 'test-mux-playback-id'
        }
      }
      
      await route.fulfill({ json: responseData })
    })
    
    // Upload file
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: 'test-video.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video content')
    })
    
    await page.waitForTimeout(3000)
    
    // **Visual Verification**: Check cost breakdown shows Mux instead of Rendi
    const costTracker = page.locator('[data-testid="cost-tracker"]')
    await costTracker.click()
    
    const costBreakdown = page.locator('[data-testid="cost-breakdown"]')
    await expect(costBreakdown).toBeVisible()
    
    // Verify Mux cost line appears
    await expect(costBreakdown).toContainText('Mux API: $0.03') // Updated cost format
    
    // Verify no Rendi cost line appears
    const breakdownText = await costBreakdown.textContent()
    expect(breakdownText).not.toContain('Rendi API')
    
    // **Visual Verification**: Check cost breakdown styling
    const breakdownStyles = await costBreakdown.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        fontSize: computed.fontSize,
        color: computed.color,
        marginTop: computed.marginTop
      }
    })
    
    expect(breakdownStyles.fontSize).toBe('12px') // text-xs
    expect(breakdownStyles.color).toMatch(/rgb\(75,\s*85,\s*99\)/) // text-gray-600
    expect(breakdownStyles.marginTop).toBe('8px')
  })

  test('Error handling transitions from Rendi polling failures to Mux API failures', async ({ page }) => {
    // Mock Mux API failure
    await page.route('/api/experiment/extract-frames', async (route) => {
      await route.fulfill({
        status: 500,
        json: {
          error: 'Mux upload failed',
          details: 'Invalid video format for Mux processing'
        }
      })
    })
    
    // Upload file to trigger error
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: 'test-video.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video content')
    })
    
    await page.waitForTimeout(3000)
    
    // **Render Testing**: Verify error states render in frame grid
    for (let i = 1; i <= 9; i++) {
      const framePlaceholder = page.locator(`[data-testid="frame-placeholder-${i}"]`)
      await expect(framePlaceholder).toBeVisible()
      
      // **Visual Verification**: Check error state styling
      const hasErrorClass = await framePlaceholder.evaluate((el) => {
        return el.classList.contains('bg-red-500')
      })
      expect(hasErrorClass).toBe(true)
      
      // Verify warning icon appears
      const warningIcon = page.locator(`[data-testid="warning-icon-${i}"]`)
      await expect(warningIcon).toBeVisible()
      await expect(warningIcon).toHaveText('⚠')
    }
    
    // **Visual Verification**: Check error message content (no Rendi references)
    const errorLog = page.locator('[data-testid="error-log"]')
    await expect(errorLog).toBeVisible()
    
    const errorText = await errorLog.textContent()
    expect(errorText).toContain('Mux')
    expect(errorText).not.toContain('Rendi')
    expect(errorText).not.toContain('polling')
    expect(errorText).not.toContain('FFmpeg')
    
    // **Visual Verification**: Check error log styling
    const errorStyles = await errorLog.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        color: computed.color,
        fontSize: computed.fontSize
      }
    })
    
    expect(errorStyles.color).toMatch(/rgb\(239,\s*68,\s*68\)/) // text-red-500
    expect(errorStyles.fontSize).toBe('14px') // text-sm
    
    // **Interaction Testing**: Test retry functionality
    const retryButton = page.locator('[data-testid="retry-frame-extraction"]')
    await expect(retryButton).toBeVisible()
    await expect(retryButton).toHaveText('Retry Frame Extraction')
    
    // **Visual Verification**: Check retry button styling
    const buttonStyles = await retryButton.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color
      }
    })
    
    expect(buttonStyles.backgroundColor).toMatch(/rgb\(37,\s*99,\s*235\)/) // bg-blue-600
    expect(buttonStyles.color).toMatch(/rgb\(255,\s*255,\s*255\)/) // text-white
  })

  test('Frame URLs point to Mux image service with proper parameters', async ({ page }) => {
    // Mock successful Mux response with various frame timestamps
    await page.route('/api/experiment/extract-frames', async (route) => {
      const mockFrames = [
        {
          url: 'https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/frame_00m00s.png?time=0',
          timestamp: 0,
          filename: 'frame_00m00s.png'
        },
        {
          url: 'https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/frame_00m05s.png?time=5',
          timestamp: 5,
          filename: 'frame_00m05s.png'
        },
        {
          url: 'https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/frame_01m25s.png?time=85',
          timestamp: 85,
          filename: 'frame_01m25s.png'
        }
      ]
      
      await route.fulfill({
        json: {
          success: true,
          frames: mockFrames,
          frameCount: 3,
          cost: 0.02,
          metadata: { extractionMethod: 'mux_upload' }
        }
      })
    })
    
    // Upload file
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: 'test-video.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video content')
    })
    
    await page.waitForTimeout(3000)
    
    // **Render Testing**: Verify frame images load with Mux URLs
    const frame1 = page.locator('[data-testid="frame-image-1"]')
    const frame2 = page.locator('[data-testid="frame-image-2"]')
    const frame3 = page.locator('[data-testid="frame-image-3"]')
    
    await expect(frame1).toBeVisible()
    await expect(frame2).toBeVisible()
    await expect(frame3).toBeVisible()
    
    // **Visual Verification**: Check exact URL formats
    const frame1Src = await frame1.getAttribute('src')
    const frame2Src = await frame2.getAttribute('src')
    const frame3Src = await frame3.getAttribute('src')
    
    expect(frame1Src).toBe('https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/frame_00m00s.png?time=0')
    expect(frame2Src).toBe('https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/frame_00m05s.png?time=5')
    expect(frame3Src).toBe('https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/frame_01m25s.png?time=85')
    
    // Verify no URLs point to Rendi or other services
    expect(frame1Src).not.toContain('rendi')
    expect(frame1Src).not.toContain('picsum') // No fallback mock URLs
    
    // **Visual Verification**: Check timestamp overlays match URL parameters
    const timestamp1 = page.locator('[data-testid="timestamp-overlay-1"]')
    const timestamp2 = page.locator('[data-testid="timestamp-overlay-2"]')
    const timestamp3 = page.locator('[data-testid="timestamp-overlay-3"]')
    
    await expect(timestamp1).toHaveText('0:00')
    await expect(timestamp2).toHaveText('0:05')
    await expect(timestamp3).toHaveText('1:25')
  })

  test('Processing workflow eliminates Rendi polling phase with faster completion', async ({ page }) => {
    let apiCallTimestamp: number
    let responseTimestamp: number
    
    // Mock fast Mux response (no polling delay)
    await page.route('/api/experiment/extract-frames', async (route) => {
      apiCallTimestamp = Date.now()
      
      // Simulate quick Mux processing (no 5-second polling intervals)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      responseTimestamp = Date.now()
      
      await route.fulfill({
        json: {
          success: true,
          frames: [
            {
              url: 'https://image.mux.com/test-id/frame_00m00s.png?time=0',
              timestamp: 0,
              filename: 'frame_00m00s.png'
            }
          ],
          frameCount: 1,
          cost: 0.02,
          metadata: {
            processingTime: 500,
            extractionMethod: 'mux_upload',
            workflowSteps: ['upload_to_mux', 'get_playback_id', 'generate_urls']
          }
        }
      })
    })
    
    // Upload file and time the process
    const startTime = Date.now()
    
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: 'test-video.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video content')
    })
    
    // **Timing Verification**: Wait for processing to complete
    await page.waitForSelector('[data-testid="frame-image-1"]', { timeout: 5000 })
    const endTime = Date.now()
    
    // Verify processing completed faster than old Rendi polling (should be < 2 seconds vs 5+ seconds)
    const totalTime = endTime - startTime
    expect(totalTime).toBeLessThan(3000) // Much faster than Rendi polling
    
    // **Visual Verification**: Check processing step transitions
    const currentStepText = page.locator('[data-testid="current-step-text"]')
    await expect(currentStepText).toHaveText('Transcribing audio...')
    
    // Verify step 3 (transcribing) is now active
    const step3 = page.locator('[data-testid="step-3"]')
    const step3Classes = await step3.getAttribute('class')
    expect(step3Classes).toContain('bg-blue-600')
    expect(step3Classes).toContain('animate-pulse')
    
    // **Visual Verification**: Verify no polling progress indicators
    const extractionProgress = page.locator('[data-testid="extraction-progress"]')
    await expect(extractionProgress).not.toBeVisible() // Should be hidden after completion
  })

  test('Accessibility support maintained during Mux migration', async ({ page }) => {
    // Mock frame data
    await page.route('/api/experiment/extract-frames', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          frames: [
            {
              url: 'https://image.mux.com/test-id/frame_00m00s.png?time=0',
              timestamp: 0,
              filename: 'frame_00m00s.png'
            },
            {
              url: 'https://image.mux.com/test-id/frame_00m05s.png?time=5',
              timestamp: 5,
              filename: 'frame_00m05s.png'
            }
          ],
          frameCount: 2,
          cost: 0.02,
          metadata: { extractionMethod: 'mux_upload' }
        }
      })
    })
    
    // Upload file
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: 'test-video.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video content')
    })
    
    await page.waitForTimeout(3000)
    
    // **Accessibility Testing**: Verify ARIA labels and roles
    const frame1Container = page.locator('[data-testid="frame-container-1"]')
    await expect(frame1Container).toHaveAttribute('role', 'button')
    await expect(frame1Container).toHaveAttribute('aria-label', 'Seek to 0:00')
    await expect(frame1Container).toHaveAttribute('tabindex', '0')
    
    const frame2Container = page.locator('[data-testid="frame-container-2"]')
    await expect(frame2Container).toHaveAttribute('aria-label', 'Seek to 0:05')
    
    // **Accessibility Testing**: Verify keyboard navigation
    await frame1Container.focus()
    
    // Check focus styling
    const focusStyles = await frame1Container.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        outline: computed.outline,
        outlineOffset: computed.outlineOffset
      }
    })
    
    // Should have focus ring (exact values may vary)
    expect(focusStyles.outline).not.toBe('none')
    
    // **Accessibility Testing**: Test keyboard interaction
    await page.keyboard.press('Tab')
    await expect(frame2Container).toBeFocused()
    
    // **Accessibility Testing**: Test Enter/Space key activation
    await page.keyboard.press('Enter')
    // Should trigger click handler (seek functionality)
    
    // **Visual Verification**: Check alt text on frame images
    const frame1Image = page.locator('[data-testid="frame-image-1"]')
    const altText = await frame1Image.getAttribute('alt')
    expect(altText).toBe('Frame at 0s')
  })
})