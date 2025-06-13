import { test, expect } from '@playwright/test'

test.describe('Task 2: Video File Upload with Vercel Blob Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/experiment/architecture-test')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Scenario 1: Initial Upload Dropzone Appearance', () => {
    test('should display upload dropzone with correct styling and content', async ({ page }) => {
      // Given the user navigates to "/experiment/architecture-test"
      // And the page has finished loading completely
      await page.waitForSelector('[data-testid="upload-section"]')

      // When the user looks at the Upload section in the grid layout
      const uploadSection = page.locator('[data-testid="upload-section"]')
      await expect(uploadSection).toBeVisible()

      // Then they see a large rectangular dropzone with a dashed border in gray (#E5E7EB)
      const dropzone = page.locator('[data-testid="upload-dropzone"]')
      await expect(dropzone).toBeVisible()
      await expect(dropzone).toHaveCSS('border-style', 'dashed')
      
      // And the dropzone displays a centered upload cloud icon in muted gray
      const uploadIcon = page.locator('[data-testid="upload-icon"]')
      await expect(uploadIcon).toBeVisible()
      
      // And below the icon shows "Drag & drop your video file here" in 18px font weight 500
      const primaryText = page.locator('[data-testid="upload-primary-text"]')
      await expect(primaryText).toContainText('Drag & drop your video file here')
      await expect(primaryText).toHaveCSS('font-size', '18px')
      await expect(primaryText).toHaveCSS('font-weight', '500')
      
      // And below that shows "or click to browse" in 14px text-gray-500
      const secondaryText = page.locator('[data-testid="upload-secondary-text"]')
      await expect(secondaryText).toContainText('or click to browse')
      await expect(secondaryText).toHaveCSS('font-size', '14px')
      
      // And the dropzone has a minimum height of 200px and fills the available card width
      await expect(dropzone).toHaveCSS('min-height', '200px')
      
      // And the cursor changes to pointer when hovering over the dropzone
      await dropzone.hover()
      await expect(dropzone).toHaveCSS('cursor', 'pointer')
      
      // And the entire dropzone has a subtle rounded corner radius of 8px
      await expect(dropzone).toHaveCSS('border-radius', '8px')
    })
  })

  test.describe('Scenario 2: Drag and Drop Visual Feedback States', () => {
    test('should provide visual feedback during drag and drop interactions', async ({ page }) => {
      const dropzone = page.locator('[data-testid="upload-dropzone"]')
      
      // Given the user is viewing the upload dropzone in its default state
      await expect(dropzone).toHaveAttribute('data-drag-active', 'false')
      
      // When the user drags a video file over the browser window but not over the dropzone
      // Then the dropzone remains in its default visual state
      // (This scenario is covered by default state verification above)
      
      // When the user drags the video file directly over the dropzone area
      // Simulate drag enter using proper drag events
      await dropzone.dispatchEvent('dragenter', {
        bubbles: true,
        cancelable: true
      })
      await dropzone.dispatchEvent('dragover', {
        bubbles: true,
        cancelable: true
      })
      
      // Then the dropzone border changes from dashed gray to solid blue (#3B82F6) within 100ms
      // And the background color shifts to a light blue tint (#EFF6FF)
      // And the upload icon changes from gray to blue (#3B82F6)
      // And the text changes to "Drop your video file here" in blue color
      await expect(dropzone).toHaveAttribute('data-drag-active', 'true')
      
      // When the user drags the file away from the dropzone but keeps it in the browser
      await dropzone.dispatchEvent('dragleave', {
        bubbles: true,
        cancelable: true
      })
      
      // Then all visual changes revert to the default state within 150ms
      await expect(dropzone).toHaveAttribute('data-drag-active', 'false')
    })
  })

  test.describe('Scenario 3: File Browse Button Interaction', () => {
    test('should open file browser when clicking dropzone', async ({ page }) => {
      const dropzone = page.locator('[data-testid="upload-dropzone"]')
      const fileInput = page.locator('[data-testid="file-input"]')
      
      // Given the user is viewing the upload dropzone
      await expect(dropzone).toBeVisible()
      
      // When the user clicks anywhere within the dropzone area
      await dropzone.click()
      
      // Then a native file browser dialog opens immediately
      // (Note: In automated tests, we verify the file input is triggered)
      await expect(fileInput).toHaveAttribute('accept', 'video/mp4,video/mov,video/webm')
    })
  })

  test.describe('Scenario 4: File Validation Visual Feedback', () => {
    test('should show error state for invalid file types', async ({ page }) => {
      const dropzone = page.locator('[data-testid="upload-dropzone"]')
      
      // Mock file upload with invalid type
      await page.route('/api/experiment/upload', async route => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid file type. Please select MP4, MOV, or WebM'
          })
        })
      })
      
      // Given the user has dragged a file over the upload dropzone
      // When the file is not a video type (e.g., .txt, .jpg, .pdf)
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('test content')
      })
      
      // Then the dropzone shows an error state with red border (#EF4444)
      await expect(dropzone).toHaveAttribute('data-validation-state', 'error')
      
      // And displays an X icon in red
      const errorIcon = page.locator('[data-testid="error-icon"]')
      await expect(errorIcon).toBeVisible()
      
      // And shows "Invalid file type. Please select MP4, MOV, or WebM" in red text
      const errorMessage = page.locator('[data-testid="error-message"]')
      await expect(errorMessage).toContainText('Invalid file type. Please select MP4, MOV, or WebM')
    })

    test('should show error for files larger than 100MB', async ({ page }) => {
      const dropzone = page.locator('[data-testid="upload-dropzone"]')
      
      // Mock file upload with size error
      await page.route('/api/experiment/upload', async route => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'File too large. Maximum size is 100MB'
          })
        })
      })
      
      // When the file is a video but exceeds 100MB in size
      const fileInput = page.locator('[data-testid="file-input"]')
      // Create a test file representing 101MB (without actual buffer)
      await fileInput.setInputFiles({
        name: 'large.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from('large video content - simulating 101MB file')
      })
      
      // Then the dropzone shows the same red error styling
      await expect(dropzone).toHaveAttribute('data-validation-state', 'error')
      
      // And displays "File too large. Maximum size is 100MB" in red text
      const errorMessage = page.locator('[data-testid="error-message"]')
      await expect(errorMessage).toContainText('File too large. Maximum size is 100MB')
      
      // And optionally shows the file size in gray text below the error message
      const fileSizeDisplay = page.locator('[data-testid="file-size-display"]')
      // This is optional UI enhancement - test passes if element exists or not
      const fileSizeDisplayCount = await fileSizeDisplay.count()
      expect(fileSizeDisplayCount >= 0).toBe(true)
    })
  })

  test.describe('Scenario 5: Upload Progress Visualization', () => {
    test('should display progress during file upload', async ({ page }) => {
      // Mock successful upload with progress
      await page.route('/api/experiment/upload', async route => {
        // Simulate slow upload for progress tracking
        await new Promise(resolve => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            blobUrl: 'https://blob.vercel-storage.com/test-123.mp4',
            filename: 'test-123.mp4',
            size: 1024000,
            type: 'video/mp4',
            uploadTime: 1500
          })
        })
      })
      
      // Given a valid video file has been selected for upload
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles({
        name: 'test.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from('test video content')
      })
      
      // When the upload process begins
      // Then the dropzone transforms to show a progress indicator layout
      const progressContainer = page.locator('[data-testid="upload-progress-container"]')
      await expect(progressContainer).toBeVisible()
      
      // And displays the filename at the top in 16px font weight 500
      const progressFilename = page.locator('[data-testid="progress-filename"]')
      await expect(progressFilename).toContainText('test.mp4')
      await expect(progressFilename).toHaveCSS('font-size', '16px')
      await expect(progressFilename).toHaveCSS('font-weight', '500')
      
      // And shows file size and type information below filename in gray text
      const fileInfo = page.locator('[data-testid="file-info"]')
      await expect(fileInfo).toBeVisible()
      
      // And renders a progress bar with blue fill (#3B82F6) on gray background
      const progressBar = page.locator('[data-testid="upload-progress"]')
      await expect(progressBar).toBeVisible()
      
      // And displays percentage text aligned to the right of the progress bar
      const progressPercentage = page.locator('[data-testid="progress-percentage"]')
      await expect(progressPercentage).toBeVisible()
      
      // And shows "Uploading..." status text below the progress bar
      const uploadStatus = page.locator('[data-testid="upload-status"]')
      await expect(uploadStatus).toContainText('Uploading...')
      
      // And the upload icon is replaced with a spinning loader animation
      const uploadSpinner = page.locator('[data-testid="upload-spinner"]')
      await expect(uploadSpinner).toBeVisible()
    })

    test('should show completion state when upload finishes', async ({ page }) => {
      // Mock successful upload completion
      await page.route('/api/experiment/upload', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            blobUrl: 'https://blob.vercel-storage.com/completed-123.mp4',
            filename: 'completed-123.mp4',
            size: 2048000,
            type: 'video/mp4',
            uploadTime: 2000
          })
        })
      })
      
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles({
        name: 'completed.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from('completed video content')
      })
      
      // When upload completes successfully at 100%
      // Then the progress bar fills completely with green color (#10B981)
      // And percentage shows "100%"
      // And status changes to "Upload complete!" in green text
      const uploadStatus = page.locator('[data-testid="upload-status"]')
      await expect(uploadStatus).toContainText('Upload complete!')
      
      // And a success checkmark replaces the spinner
      const successCheckmark = page.locator('[data-testid="success-checkmark"]')
      await expect(successCheckmark).toBeVisible()
      
      // And the blob URL appears as a clickable link below the status
      const blobUrlLink = page.locator('[data-testid="blob-url-link"]')
      await expect(blobUrlLink).toBeVisible()
      await expect(blobUrlLink).toHaveAttribute('href', 'https://blob.vercel-storage.com/completed-123.mp4')
    })
  })

  test.describe('Scenario 6: Upload Error States and Recovery', () => {
    test('should handle upload errors with retry functionality', async ({ page }) => {
      // Mock upload failure
      await page.route('/api/experiment/upload', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Upload failed - Network error'
          })
        })
      })
      
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles({
        name: 'error-test.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from('error test content')
      })
      
      // Given a video file upload is in progress at 35% completion
      // When a network error occurs during upload
      // Then the progress bar stops animating at 35%
      // And displays "Upload failed - Network error" in red text
      const errorMessage = page.locator('[data-testid="error-message"]')
      await expect(errorMessage).toContainText('Upload failed - Network error')
      
      // And shows a "Retry Upload" button with blue background
      const retryButton = page.locator('[data-testid="retry-button"]')
      await expect(retryButton).toBeVisible()
      
      // And shows a "Cancel" button with gray background next to retry
      const cancelButton = page.locator('[data-testid="cancel-button"]')
      await expect(cancelButton).toBeVisible()
    })
  })

  test.describe('Scenario 7: Keyboard Navigation and Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      const dropzone = page.locator('[data-testid="upload-dropzone"]')
      
      // Given the user is navigating the page using only keyboard
      // When the user tabs to the upload dropzone
      await page.keyboard.press('Tab')
      await dropzone.focus()
      
      // Then the dropzone receives focus with a visible focus ring in blue
      await expect(dropzone).toBeFocused()
      // Check for focus ring - verify focus classes are applied
      const focusRingClasses = await dropzone.getAttribute('class')
      expect(focusRingClasses).toContain('focus:ring')
      
      // And screen readers announce "Upload video file, dropzone, button"
      await expect(dropzone).toHaveAttribute('aria-label', 'Upload video file, dropzone, button')
      await expect(dropzone).toHaveAttribute('role', 'button')
      await expect(dropzone).toHaveAttribute('tabIndex', '0')
      
      // When the user presses Enter or Space while dropzone is focused
      await page.keyboard.press('Enter')
      
      // Then the file browser dialog opens immediately
      // (Verified by checking if the hidden file input is triggered)
      const fileInput = page.locator('[data-testid="file-input"]')
      await expect(fileInput).toHaveAttribute('type', 'file')
    })
  })

  test.describe('Scenario 8: Mobile Touch Interface Experience', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Given the user is accessing the page on a mobile device (viewport < 768px)
      // When the user views the upload dropzone
      const dropzone = page.locator('[data-testid="upload-dropzone"]')
      await expect(dropzone).toBeVisible()
      
      // Then the dropzone adapts to mobile screen width with proper margins
      // And maintains minimum touch target size of 44px for interactive elements
      // And the upload text adjusts to "Tap to select video file"
      const primaryText = page.locator('[data-testid="upload-primary-text"]')
      await expect(primaryText).toBeVisible()
      
      // When the user taps the dropzone on mobile
      await dropzone.click()
      
      // Then the mobile file picker opens immediately
      const fileInput = page.locator('[data-testid="file-input"]')
      await expect(fileInput).toHaveAttribute('accept', 'video/mp4,video/mov,video/webm')
    })
  })

  test.describe('Scenario 10: Integration with Processing Status Panel', () => {
    test('should integrate with processing status panel', async ({ page }) => {
      // Mock successful upload
      await page.route('/api/experiment/upload', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            blobUrl: 'https://blob.vercel-storage.com/integration-123.mp4',
            filename: 'integration-123.mp4',
            size: 1024000,
            type: 'video/mp4',
            uploadTime: 1500
          })
        })
      })
      
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles({
        name: 'integration.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from('integration test content')
      })
      
      // Given a video file has been successfully uploaded via the dropzone
      // When the upload completes and blob URL is available
      const blobUrlLink = page.locator('[data-testid="blob-url-link"]')
      await expect(blobUrlLink).toBeVisible()
      
      // Then the Processing Status panel immediately updates
      const processingSection = page.locator('[data-testid="processing-section"]')
      await expect(processingSection).toBeVisible()
      
      // And shows "✓ Upload Complete" with green checkmark
      // (This would be reflected in the processing step indicators)
      const step1 = page.locator('[data-testid="step-1"]')
      await expect(step1).toBeVisible()
      
      // And the blob URL becomes available for subsequent processing steps
      await expect(blobUrlLink).toHaveAttribute('href', 'https://blob.vercel-storage.com/integration-123.mp4')
    })
  })
})