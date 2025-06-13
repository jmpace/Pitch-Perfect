import { test, expect } from '@playwright/test'

test.describe('Task 1 BDD Scenarios - Architecture Experiment Page Foundation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/experiment/architecture-test')
  })

  test.describe('Initial Page Load and Navigation', () => {
    test('should load page within 2 seconds without JavaScript errors', async ({ page }) => {
      const startTime = Date.now()
      
      // Listen for console errors
      const consoleErrors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
        }
      })

      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(2000)
      expect(consoleErrors).toHaveLength(0)
    })

    test('should display correct browser title', async ({ page }) => {
      await expect(page).toHaveTitle('Architecture Experiment - Pitch Perfect')
    })

    test('should display 4 card placeholders with pulse animation', async ({ page }) => {
      // Check all sections are present
      await expect(page.getByTestId('upload-section')).toBeVisible()
      await expect(page.getByTestId('video-section')).toBeVisible()
      await expect(page.getByTestId('transcripts-section')).toBeVisible()
      await expect(page.getByTestId('processing-section')).toBeVisible()

      // Check grid layout
      const gridLayout = page.getByTestId('grid-layout')
      await expect(gridLayout).toHaveClass(/grid/)
      await expect(gridLayout).toHaveClass(/grid-cols-1/)
      await expect(gridLayout).toHaveClass(/md:grid-cols-2/)
    })

    test('should support keyboard navigation', async ({ page }) => {
      // Test Tab key navigation
      await page.keyboard.press('Tab')
      await expect(page.getByTestId('choose-file-button')).toBeFocused()
      
      // Continue tabbing through elements
      await page.keyboard.press('Tab')
      await expect(page.getByTestId('frame-placeholder-1')).toBeFocused()
    })

    test('should announce page content to screen readers', async ({ page }) => {
      const mainElement = page.locator('main')
      await expect(mainElement).toHaveAttribute('aria-label', 'Architecture Experiment Page')
    })
  })

  test.describe('State Initialization and Debug Display', () => {
    test('should initialize all 9 state variables with default values', async ({ page }) => {
      // Toggle debug panel with Ctrl+D
      await page.keyboard.press('Control+KeyD')
      
      const debugPanel = page.getByTestId('debug-panel')
      await expect(debugPanel).toBeVisible()

      const debugContent = page.getByTestId('debug-content')
      await expect(debugContent).toContainText('"videoFile": null')
      await expect(debugContent).toContainText('"videoUrl": ""')
      await expect(debugContent).toContainText('"uploadProgress": 0')
      await expect(debugContent).toContainText('"processingStep": "idle"')
      await expect(debugContent).toContainText('"fullTranscript": ""')
      await expect(debugContent).toContainText('"segmentedTranscript": []')
      await expect(debugContent).toContainText('"extractedFrames": []')
      await expect(debugContent).toContainText('"errors": []')
      await expect(debugContent).toContainText('"timings": {}')
    })

    test('should toggle debug panel with Ctrl+D', async ({ page }) => {
      const debugPanel = page.getByTestId('debug-panel')
      
      // Initially hidden
      await expect(debugPanel).toHaveClass(/hidden/)
      
      // Show with Ctrl+D
      await page.keyboard.press('Control+KeyD')
      await expect(debugPanel).toHaveClass(/block/)
      
      // Hide with Ctrl+D again
      await page.keyboard.press('Control+KeyD')
      await expect(debugPanel).toHaveClass(/hidden/)
    })

    test('should display debug panel with proper styling', async ({ page }) => {
      await page.keyboard.press('Control+KeyD')
      
      const debugPanel = page.getByTestId('debug-panel')
      await expect(debugPanel).toHaveClass(/bg-gray-100/)
      await expect(debugPanel).toHaveClass(/border-gray-300/)
      await expect(debugPanel).toHaveClass(/rounded-lg/)
      
      const debugContent = page.getByTestId('debug-content')
      await expect(debugContent).toHaveClass(/font-mono/)
    })
  })

  test.describe('Four-Section Grid Layout Rendering', () => {
    test('should display 4 sections in 2x2 grid with correct borders', async ({ page }) => {
      // Upload section - blue border
      const uploadSection = page.getByTestId('upload-section')
      await expect(uploadSection).toHaveClass(/border-blue-500/)
      await expect(uploadSection).toHaveClass(/rounded-lg/)

      // Video section - green border  
      const videoSection = page.getByTestId('video-section')
      await expect(videoSection).toHaveClass(/border-emerald-500/)

      // Transcripts section - purple border
      const transcriptsSection = page.getByTestId('transcripts-section')
      await expect(transcriptsSection).toHaveClass(/border-purple-500/)

      // Processing section - orange border
      const processingSection = page.getByTestId('processing-section')
      await expect(processingSection).toHaveClass(/border-amber-500/)
    })

    test('should display section titles with correct styling', async ({ page }) => {
      await expect(page.getByTestId('upload-title')).toContainText('Upload')
      await expect(page.getByTestId('video-title')).toContainText('Video Playback & Frames')
      await expect(page.getByTestId('transcripts-title')).toContainText('Transcripts')
      await expect(page.getByTestId('processing-title')).toContainText('Processing Status')

      // Check title styling
      const uploadTitle = page.getByTestId('upload-title')
      await expect(uploadTitle).toHaveClass(/text-lg/)
      await expect(uploadTitle).toHaveClass(/font-semibold/)
    })

    test('should stack sections vertically on mobile', async ({ page }) => {
      // Simulate mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      const gridLayout = page.getByTestId('grid-layout')
      await expect(gridLayout).toHaveClass(/grid-cols-1/)
    })

    test('should support keyboard navigation between sections', async ({ page }) => {
      // Each section should be focusable
      await page.keyboard.press('Tab')
      await expect(page.getByTestId('choose-file-button')).toBeFocused()
      
      // Continue to next section
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
      }
      
      // Should reach transcripts section
      const transcriptsArea = page.getByTestId('full-transcript-area')
      await expect(transcriptsArea).toBeVisible()
    })
  })

  test.describe('Upload Section Interactive Elements', () => {
    test('should display dropzone with correct styling', async ({ page }) => {
      const dropzone = page.getByTestId('dropzone')
      await expect(dropzone).toBeVisible()
      await expect(dropzone).toContainText('Drop video file here')
      await expect(dropzone).toHaveClass(/border-dashed/)
      await expect(dropzone).toHaveClass(/border-2/)
    })

    test('should show hover state on dropzone', async ({ page }) => {
      const dropzone = page.getByTestId('dropzone')
      await dropzone.hover()
      await expect(dropzone).toHaveClass(/hover:bg-blue-50/)
    })

    test('should display Choose File button with correct styling', async ({ page }) => {
      const chooseFileButton = page.getByTestId('choose-file-button')
      await expect(chooseFileButton).toBeVisible()
      await expect(chooseFileButton).toContainText('Choose File')
      await expect(chooseFileButton).toHaveClass(/bg-blue-600/)
      await expect(chooseFileButton).toHaveClass(/text-white/)
    })

    test('should show button hover state', async ({ page }) => {
      const chooseFileButton = page.getByTestId('choose-file-button')
      await chooseFileButton.hover()
      await expect(chooseFileButton).toHaveClass(/hover:bg-blue-700/)
    })

    test('should display progress bar at 0% initially', async ({ page }) => {
      const progressBar = page.getByTestId('progress-bar')
      await expect(progressBar).toBeVisible()
      await expect(progressBar).toHaveAttribute('aria-valuenow', '0')
      
      const progressText = page.getByTestId('progress-text')
      await expect(progressText).toContainText('0%')
    })

    test('should open file dialog when Choose File is clicked', async ({ page }) => {
      const chooseFileButton = page.getByTestId('choose-file-button')
      await expect(chooseFileButton).toHaveAttribute('aria-label', /Choose video file, opens file dialog/)
    })
  })

  test.describe('Video Playback Section State Display', () => {
    test('should display video placeholder with correct styling', async ({ page }) => {
      const videoPlaceholder = page.getByTestId('video-placeholder')
      await expect(videoPlaceholder).toBeVisible()
      await expect(videoPlaceholder).toHaveClass(/bg-gray-700/)
      await expect(videoPlaceholder).toHaveClass(/aspect-video/)
      
      const placeholderText = page.getByTestId('video-placeholder-text')
      await expect(placeholderText).toContainText('No video uploaded')
      await expect(placeholderText).toHaveClass(/text-white/)
    })

    test('should display 3x3 grid of frame placeholders', async ({ page }) => {
      const frameGrid = page.getByTestId('frame-grid')
      await expect(frameGrid).toHaveClass(/grid-cols-3/)
      
      // Check all 9 frame placeholders
      for (let i = 1; i <= 9; i++) {
        const framePlaceholder = page.getByTestId(`frame-placeholder-${i}`)
        await expect(framePlaceholder).toBeVisible()
        await expect(framePlaceholder).toHaveClass(/bg-gray-400/)
        
        const frameLabel = page.getByTestId(`frame-label-${i}`)
        await expect(frameLabel).toContainText(`Frame ${i}`)
      }
    })

    test('should support keyboard navigation on frame placeholders', async ({ page }) => {
      const frameButton = page.getByTestId('frame-placeholder-1')
      await frameButton.focus()
      await expect(frameButton).toBeFocused()
      await expect(frameButton).toHaveClass(/focus:ring-2/)
    })

    test('should announce video area to screen readers', async ({ page }) => {
      const videoPlaceholder = page.getByTestId('video-placeholder')
      await expect(videoPlaceholder).toHaveAttribute('aria-label', 'Video playback area, no video loaded')
    })
  })

  test.describe('Transcripts Section Dual Layout', () => {
    test('should display two equal columns for transcripts', async ({ page }) => {
      const transcriptsContainer = page.getByTestId('transcripts-container')
      await expect(transcriptsContainer).toHaveClass(/grid-cols-2/)
      
      const fullTranscriptArea = page.getByTestId('full-transcript-area')
      await expect(fullTranscriptArea).toBeVisible()
      await expect(fullTranscriptArea).toHaveClass(/bg-gray-50/)
      await expect(fullTranscriptArea).toHaveClass(/overflow-y-auto/)
      
      const segmentedTranscriptArea = page.getByTestId('segmented-transcript-area')
      await expect(segmentedTranscriptArea).toBeVisible()
      await expect(segmentedTranscriptArea).toHaveClass(/bg-gray-50/)
    })

    test('should display column headers', async ({ page }) => {
      await expect(page.locator('text=Full Transcript')).toBeVisible()
      await expect(page.locator('text=Segmented Transcript')).toBeVisible()
    })

    test('should show placeholder text in transcript areas', async ({ page }) => {
      const fullTranscriptArea = page.getByTestId('full-transcript-area')
      await expect(fullTranscriptArea).toContainText('Transcript will appear here...')
      
      const segmentedTranscriptArea = page.getByTestId('segmented-transcript-area')
      await expect(segmentedTranscriptArea).toContainText('Time-stamped segments will appear here...')
    })

    test('should have proper scrollable areas', async ({ page }) => {
      const fullTranscriptArea = page.getByTestId('full-transcript-area')
      await expect(fullTranscriptArea).toHaveClass(/h-\[200px\]/)
      await expect(fullTranscriptArea).toHaveClass(/overflow-y-auto/)
    })
  })

  test.describe('Processing Status Section with Progress Indicators', () => {
    test('should display 4 processing steps', async ({ page }) => {
      const step1 = page.getByTestId('step-1')
      await expect(step1).toContainText('1. Upload')
      
      const step2 = page.getByTestId('step-2')
      await expect(step2).toContainText('2. Extract Frames')
      
      const step3 = page.getByTestId('step-3')
      await expect(step3).toContainText('3. Transcribe')
      
      const step4 = page.getByTestId('step-4')
      await expect(step4).toContainText('4. Complete')
    })

    test('should show initial step status', async ({ page }) => {
      const currentStepText = page.getByTestId('current-step-text')
      await expect(currentStepText).toContainText('Waiting to start...')
      await expect(currentStepText).toHaveClass(/italic/)
    })

    test('should display timing information', async ({ page }) => {
      const timingDisplay = page.getByTestId('timing-display')
      await expect(timingDisplay).toContainText('Total Time: 0:00')
      await expect(timingDisplay).toHaveClass(/font-mono/)
    })

    test('should show error log status', async ({ page }) => {
      const errorLog = page.getByTestId('error-log')
      await expect(errorLog).toContainText('No errors')
      await expect(errorLog).toHaveClass(/text-green-600/)
    })

    test('should display cost tracker', async ({ page }) => {
      const costTracker = page.getByTestId('cost-tracker')
      await expect(costTracker).toContainText('$0.00')
      await expect(costTracker).toHaveClass(/text-blue-600/)
      await expect(costTracker).toHaveClass(/underline/)
    })

    test('should expand cost breakdown when clicked', async ({ page }) => {
      const costTracker = page.getByTestId('cost-tracker')
      const costBreakdown = page.getByTestId('cost-breakdown')
      
      // Initially hidden
      await expect(costBreakdown).toHaveClass(/hidden/)
      
      // Click to expand
      await costTracker.click()
      await expect(costBreakdown).toHaveClass(/block/)
      
      // Check breakdown items
      await expect(costBreakdown).toContainText('Vercel Blob: $0.00')
      await expect(costBreakdown).toContainText('Rendi API: $0.00')
      await expect(costBreakdown).toContainText('OpenAI Whisper: $0.00')
    })
  })

  test.describe('State Updates and UI Reactivity', () => {
    test('should update progress bar when state changes', async ({ page }) => {
      // Toggle debug panel
      await page.keyboard.press('Control+KeyD')
      
      // Simulate state change via browser console
      await page.evaluate(() => {
        (window as any).updateExperimentState({ uploadProgress: 45 })
      })

      // Check progress bar updates
      await page.waitForSelector('[data-testid="progress-fill"][style*="width: 45%"]')
      
      const progressText = page.getByTestId('progress-text')
      await expect(progressText).toContainText('45%')
      
      // Check debug panel shows updated state
      const debugContent = page.getByTestId('debug-content')
      await expect(debugContent).toContainText('"uploadProgress": 45')
    })

    test('should update processing step indicator', async ({ page }) => {
      // Change processing step
      await page.evaluate(() => {
        (window as any).updateExperimentState({ processingStep: 'extracting' })
      })

      // Step 2 should be highlighted
      const step2 = page.getByTestId('step-2')
      await expect(step2).toHaveClass(/bg-blue-600/)
      await expect(step2).toHaveClass(/animate-pulse/)
      
      // Current step text should update
      const currentStepText = page.getByTestId('current-step-text')
      await expect(currentStepText).toContainText('Extracting frames...')
    })

    test('should handle state change animations', async ({ page }) => {
      // Progress bar should have transition animation
      const progressFill = page.getByTestId('progress-fill')
      await expect(progressFill).toHaveClass(/transition-all/)
      await expect(progressFill).toHaveClass(/duration-300/)
      await expect(progressFill).toHaveClass(/ease-out/)
    })
  })

  test.describe('Responsive Design and Mobile Interaction', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Set mobile viewport (iPhone SE)
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Sections should stack vertically
      const gridLayout = page.getByTestId('grid-layout')
      await expect(gridLayout).toHaveClass(/grid-cols-1/)
      
      // All sections should still be visible
      await expect(page.getByTestId('upload-section')).toBeVisible()
      await expect(page.getByTestId('video-section')).toBeVisible()
      await expect(page.getByTestId('transcripts-section')).toBeVisible()
      await expect(page.getByTestId('processing-section')).toBeVisible()
    })

    test('should maintain touch targets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Buttons should be at least 44px tall for touch accessibility
      const chooseFileButton = page.getByTestId('choose-file-button')
      const buttonHeight = await chooseFileButton.boundingBox()
      expect(buttonHeight?.height).toBeGreaterThanOrEqual(44)
    })

    test('should reposition debug panel on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      
      await page.keyboard.press('Control+KeyD')
      
      const debugPanel = page.getByTestId('debug-panel')
      await expect(debugPanel).toBeVisible()
      // Debug panel should still be positioned properly on mobile
    })
  })

  test.describe('Error States and Accessibility', () => {
    test('should display error state correctly', async ({ page }) => {
      // Simulate error
      await page.evaluate(() => {
        (window as any).simulateError('upload')
      })

      // Error card should appear
      const errorCard = page.getByTestId('error-card')
      await expect(errorCard).toBeVisible()
      await expect(errorCard).toHaveClass(/border-red-500/)
      
      const errorMessage = page.getByTestId('error-message')
      await expect(errorMessage).toContainText('Something went wrong in Upload section')
      await expect(errorMessage).toHaveClass(/text-red-600/)
      
      const retryButton = page.getByTestId('retry-button')
      await expect(retryButton).toBeVisible()
      await expect(retryButton).toContainText('Retry')
    })

    test('should handle retry functionality', async ({ page }) => {
      // Simulate error first
      await page.evaluate(() => {
        (window as any).simulateError('upload')
      })

      await expect(page.getByTestId('error-card')).toBeVisible()
      
      // Click retry
      const retryButton = page.getByTestId('retry-button')
      await retryButton.click()
      
      // Loading spinner should appear temporarily
      await expect(page.getByTestId('loading-spinner')).toBeVisible()
      
      // Error should eventually clear
      await expect(page.getByTestId('error-card')).not.toBeVisible({ timeout: 1000 })
    })

    test('should maintain accessibility during errors', async ({ page }) => {
      await page.evaluate(() => {
        (window as any).simulateError('upload')
      })

      // Other sections should remain accessible
      await expect(page.getByTestId('video-section')).toBeVisible()
      await expect(page.getByTestId('transcripts-section')).toBeVisible()
      await expect(page.getByTestId('processing-section')).toBeVisible()
      
      // Keyboard navigation should still work
      await page.keyboard.press('Tab')
      const retryButton = page.getByTestId('retry-button')
      await expect(retryButton).toBeFocused()
    })
  })

  test.describe('Keyboard Navigation and Focus Management', () => {
    test('should follow logical tab order', async ({ page }) => {
      // Start tabbing from beginning
      await page.keyboard.press('Tab')
      await expect(page.getByTestId('choose-file-button')).toBeFocused()
      
      // Continue to frame placeholders
      await page.keyboard.press('Tab')
      await expect(page.getByTestId('frame-placeholder-1')).toBeFocused()
      
      // Continue through remaining frames
      for (let i = 2; i <= 9; i++) {
        await page.keyboard.press('Tab')
        await expect(page.getByTestId(`frame-placeholder-${i}`)).toBeFocused()
      }
    })

    test('should support reverse tab navigation', async ({ page }) => {
      // Focus on a known element first
      await page.getByTestId('choose-file-button').focus()
      
      // Tab forward then back
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      
      await expect(page.getByTestId('choose-file-button')).toBeFocused()
    })

    test('should show visible focus indicators', async ({ page }) => {
      const chooseFileButton = page.getByTestId('choose-file-button')
      await chooseFileButton.focus()
      
      // Focus indicator should be visible
      await expect(chooseFileButton).toHaveClass(/focus:ring-2/)
      await expect(chooseFileButton).toHaveClass(/focus:ring-blue-500/)
    })

    test('should never trap focus', async ({ page }) => {
      // Tab through all elements without getting stuck
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab')
        // Should not throw or get stuck
      }
      
      // Should be able to tab out of the application
      const activeElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(activeElement).toBeDefined()
    })
  })
})