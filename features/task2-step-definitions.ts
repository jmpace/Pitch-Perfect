import { test, expect, Page, Locator } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

// Test utilities for complete UI verification
class UITestUtils {
  constructor(private page: Page) {}

  async waitForElement(selector: string, timeout = 5000): Promise<Locator> {
    const element = this.page.locator(selector);
    await element.waitFor({ timeout });
    return element;
  }

  async getComputedStyle(element: Locator, property: string): Promise<string> {
    return await element.evaluate((el, prop) => {
      return window.getComputedStyle(el).getPropertyValue(prop);
    }, property);
  }

  async getRGBFromColor(element: Locator, property: string): Promise<string> {
    const color = await this.getComputedStyle(element, property);
    // Normalize color formats to RGB
    if (color.startsWith('#')) {
      return this.hexToRgb(color);
    }
    return color;
  }

  private hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgb(${r}, ${g}, ${b})`;
  }

  async measureTiming(action: () => Promise<void>): Promise<number> {
    const start = Date.now();
    await action();
    return Date.now() - start;
  }

  createMockVideoFile(sizeInMB: number = 10): File {
    const bytes = sizeInMB * 1024 * 1024;
    const buffer = new ArrayBuffer(bytes);
    return new File([buffer], 'test-video.mp4', { type: 'video/mp4' });
  }

  createMockInvalidFile(): File {
    const buffer = new ArrayBuffer(1024);
    return new File([buffer], 'test-document.pdf', { type: 'application/pdf' });
  }
}

// Step definitions for Task 2 - Complete UI Implementation Testing

test.describe('Task 2: Vercel Blob Upload Integration - Complete UI Testing', () => {
  let page: Page;
  let utils: UITestUtils;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    utils = new UITestUtils(page);
    await page.goto('/experiment/architecture-test');
    await page.waitForLoadState('networkidle');
  });

  // Scenario 1: Initial Upload Dropzone Appearance
  test('should display initial dropzone with complete visual specifications', async () => {
    // Wait for dropzone to render
    const dropzone = await utils.waitForElement('[data-testid="upload-dropzone"]');
    
    // Verify dropzone is visible and rendered
    await expect(dropzone).toBeVisible();
    
    // Test minimum height requirement
    const boundingBox = await dropzone.boundingBox();
    expect(boundingBox?.height).toBeGreaterThanOrEqual(200);
    
    // Verify border styling (dashed gray)
    const borderStyle = await utils.getComputedStyle(dropzone, 'border-style');
    const borderColor = await utils.getRGBFromColor(dropzone, 'border-color');
    expect(borderStyle).toBe('dashed');
    expect(borderColor).toMatch(/rgb\(229,\s*231,\s*235\)|rgb\(209,\s*213,\s*219\)/); // gray-200 or gray-300
    
    // Verify rounded corners
    const borderRadius = await utils.getComputedStyle(dropzone, 'border-radius');
    expect(borderRadius).toBe('8px');
    
    // Verify upload icon is present
    const uploadIcon = await utils.waitForElement('[data-testid="upload-icon"]');
    await expect(uploadIcon).toBeVisible();
    
    // Verify primary text styling
    const primaryText = await utils.waitForElement('[data-testid="upload-primary-text"]');
    await expect(primaryText).toHaveText('Drag & drop your video file here');
    const fontSize = await utils.getComputedStyle(primaryText, 'font-size');
    const fontWeight = await utils.getComputedStyle(primaryText, 'font-weight');
    expect(fontSize).toBe('18px');
    expect(fontWeight).toBe('500');
    
    // Verify secondary text styling
    const secondaryText = await utils.waitForElement('[data-testid="upload-secondary-text"]');
    await expect(secondaryText).toHaveText('or click to browse');
    const secondaryFontSize = await utils.getComputedStyle(secondaryText, 'font-size');
    const secondaryColor = await utils.getRGBFromColor(secondaryText, 'color');
    expect(secondaryFontSize).toBe('14px');
    expect(secondaryColor).toMatch(/rgb\(107,\s*114,\s*128\)/); // text-gray-500
    
    // Verify cursor changes to pointer on hover
    await dropzone.hover();
    const cursor = await utils.getComputedStyle(dropzone, 'cursor');
    expect(cursor).toBe('pointer');
  });

  // Scenario 2: Drag and Drop Visual Feedback States
  test('should show correct visual feedback during drag operations', async () => {
    const dropzone = await utils.waitForElement('[data-testid="upload-dropzone"]');
    
    // Test drag over dropzone
    await page.evaluate(() => {
      const dropzoneEl = document.querySelector('[data-testid="upload-dropzone"]') as HTMLElement;
      const dragEnterEvent = new DragEvent('dragenter', {
        bubbles: true,
        dataTransfer: new DataTransfer()
      });
      dropzoneEl.dispatchEvent(dragEnterEvent);
    });
    
    // Verify drag active state within timing requirement
    const timing = await utils.measureTiming(async () => {
      await expect(dropzone).toHaveAttribute('data-drag-active', 'true');
    });
    expect(timing).toBeLessThan(100); // Should activate within 100ms
    
    // Verify border changes to solid blue
    const borderStyle = await utils.getComputedStyle(dropzone, 'border-style');
    const borderColor = await utils.getRGBFromColor(dropzone, 'border-color');
    expect(borderStyle).toBe('solid');
    expect(borderColor).toMatch(/rgb\(59,\s*130,\s*246\)/); // blue-500
    
    // Verify background color changes to light blue
    const backgroundColor = await utils.getRGBFromColor(dropzone, 'background-color');
    expect(backgroundColor).toMatch(/rgb\(239,\s*246,\s*255\)/); // blue-50
    
    // Verify icon color changes to blue
    const uploadIcon = await utils.waitForElement('[data-testid="upload-icon"]');
    const iconColor = await utils.getRGBFromColor(uploadIcon, 'color');
    expect(iconColor).toMatch(/rgb\(59,\s*130,\s*246\)/); // blue-500
    
    // Verify text changes
    const primaryText = await utils.waitForElement('[data-testid="upload-primary-text"]');
    await expect(primaryText).toHaveText('Drop your video file here');
    const textColor = await utils.getRGBFromColor(primaryText, 'color');
    expect(textColor).toMatch(/rgb\(59,\s*130,\s*246\)/); // blue-500
    
    // Verify blue glow shadow
    const boxShadow = await utils.getComputedStyle(dropzone, 'box-shadow');
    expect(boxShadow).toContain('rgb(59, 130, 246)'); // Should contain blue color
    
    // Test drag leave - verify revert to default state
    await page.evaluate(() => {
      const dropzoneEl = document.querySelector('[data-testid="upload-dropzone"]') as HTMLElement;
      const dragLeaveEvent = new DragEvent('dragleave', {
        bubbles: true,
        dataTransfer: new DataTransfer()
      });
      dropzoneEl.dispatchEvent(dragLeaveEvent);
    });
    
    // Verify transition back to default state within timing
    const revertTiming = await utils.measureTiming(async () => {
      await expect(dropzone).toHaveAttribute('data-drag-active', 'false');
    });
    expect(revertTiming).toBeLessThan(150); // Should revert within 150ms
  });

  // Scenario 3: File Browse Button Interaction
  test('should handle file browser interaction correctly', async () => {
    const dropzone = await utils.waitForElement('[data-testid="upload-dropzone"]');
    
    // Set up file input mock
    const fileInput = await utils.waitForElement('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', 'video/mp4,video/mov,video/webm');
    
    // Verify file input is hidden but accessible
    const display = await utils.getComputedStyle(fileInput, 'display');
    const visibility = await utils.getComputedStyle(fileInput, 'visibility');
    expect(display === 'none' || visibility === 'hidden').toBe(true);
    
    // Test click triggers file input
    await dropzone.click();
    
    // Simulate file selection
    const testFile = utils.createMockVideoFile(10);
    await fileInput.setInputFiles([{
      name: testFile.name,
      mimeType: testFile.type,
      buffer: Buffer.from(await testFile.arrayBuffer())
    }]);
    
    // Verify filename appears in UI
    const filenameDisplay = await utils.waitForElement('[data-testid="selected-filename"]');
    await expect(filenameDisplay).toHaveText('test-video.mp4');
    const filenameFontSize = await utils.getComputedStyle(filenameDisplay, 'font-size');
    expect(filenameFontSize).toBe('14px');
  });

  // Scenario 4: File Validation Visual Feedback
  test('should show correct validation feedback for invalid files', async () => {
    const dropzone = await utils.waitForElement('[data-testid="upload-dropzone"]');
    
    // Test invalid file type
    const invalidFile = utils.createMockInvalidFile();
    await page.evaluate((file) => {
      const dropzoneEl = document.querySelector('[data-testid="upload-dropzone"]') as HTMLElement;
      const dt = new DataTransfer();
      dt.items.add(new File([new ArrayBuffer(1024)], file.name, { type: file.type }));
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        dataTransfer: dt
      });
      dropzoneEl.dispatchEvent(dropEvent);
    }, { name: invalidFile.name, type: invalidFile.type });
    
    // Verify error state styling
    await expect(dropzone).toHaveAttribute('data-validation-state', 'error');
    const borderColor = await utils.getRGBFromColor(dropzone, 'border-color');
    const backgroundColor = await utils.getRGBFromColor(dropzone, 'background-color');
    expect(borderColor).toMatch(/rgb\(239,\s*68,\s*68\)/); // red-500
    expect(backgroundColor).toMatch(/rgb\(254,\s*242,\s*242\)/); // red-50
    
    // Verify error icon
    const errorIcon = await utils.waitForElement('[data-testid="error-icon"]');
    await expect(errorIcon).toBeVisible();
    const iconColor = await utils.getRGBFromColor(errorIcon, 'color');
    expect(iconColor).toMatch(/rgb\(239,\s*68,\s*68\)/); // red-500
    
    // Verify error message
    const errorMessage = await utils.waitForElement('[data-testid="error-message"]');
    await expect(errorMessage).toHaveText('Invalid file type. Please select MP4, MOV, or WebM');
    const messageColor = await utils.getRGBFromColor(errorMessage, 'color');
    expect(messageColor).toMatch(/rgb\(239,\s*68,\s*68\)/); // red-500
    
    // Verify error state persists for required duration
    await page.waitForTimeout(3000);
    await expect(dropzone).toHaveAttribute('data-validation-state', 'error');
    
    // Test file size validation
    const largeFile = utils.createMockVideoFile(150); // 150MB - over limit
    await page.evaluate((file) => {
      const dropzoneEl = document.querySelector('[data-testid="upload-dropzone"]') as HTMLElement;
      const dt = new DataTransfer();
      const buffer = new ArrayBuffer(file.size);
      dt.items.add(new File([new ArrayBuffer(1024)], file.name, { type: file.type }));
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        dataTransfer: dt
      });
      dropzoneEl.dispatchEvent(dropEvent);
    }, { name: largeFile.name, type: largeFile.type, size: largeFile.size });
    
    // Verify size error message
    const sizeErrorMessage = await utils.waitForElement('[data-testid="error-message"]');
    await expect(sizeErrorMessage).toHaveText('File too large. Maximum size is 100MB');
    
    // Verify file size display
    const fileSizeDisplay = await utils.waitForElement('[data-testid="file-size-display"]');
    await expect(fileSizeDisplay).toBeVisible();
    const sizeColor = await utils.getRGBFromColor(fileSizeDisplay, 'color');
    expect(sizeColor).toMatch(/rgb\(107,\s*114,\s*128\)/); // gray-500
  });

  // Scenario 5: Upload Progress Visualization
  test('should display complete upload progress visualization', async () => {
    const dropzone = await utils.waitForElement('[data-testid="upload-dropzone"]');
    
    // Simulate valid file upload
    const validFile = utils.createMockVideoFile(10);
    await page.evaluate((file) => {
      const dropzoneEl = document.querySelector('[data-testid="upload-dropzone"]') as HTMLElement;
      const dt = new DataTransfer();
      const buffer = new ArrayBuffer(file.size);
      dt.items.add(new File([new ArrayBuffer(1024)], file.name, { type: file.type }));
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        dataTransfer: dt
      });
      dropzoneEl.dispatchEvent(dropEvent);
    }, { name: validFile.name, type: validFile.type, size: validFile.size });
    
    // Verify progress container appears
    const progressContainer = await utils.waitForElement('[data-testid="upload-progress"]');
    await expect(progressContainer).toBeVisible();
    
    // Verify filename display
    const filenameDisplay = await utils.waitForElement('[data-testid="progress-filename"]');
    await expect(filenameDisplay).toHaveText('test-video.mp4');
    const filenameFontSize = await utils.getComputedStyle(filenameDisplay, 'font-size');
    const filenameFontWeight = await utils.getComputedStyle(filenameDisplay, 'font-weight');
    expect(filenameFontSize).toBe('16px');
    expect(filenameFontWeight).toBe('500');
    
    // Verify file info display
    const fileInfo = await utils.waitForElement('[data-testid="file-info"]');
    await expect(fileInfo).toBeVisible();
    const infoColor = await utils.getRGBFromColor(fileInfo, 'color');
    expect(infoColor).toMatch(/rgb\(107,\s*114,\s*128\)/); // gray-500
    
    // Verify progress bar structure
    const progressBar = await utils.waitForElement('[data-testid="progress-bar"]');
    await expect(progressBar).toBeVisible();
    const progressBarHeight = await utils.getComputedStyle(progressBar, 'height');
    const progressBarRadius = await utils.getComputedStyle(progressBar, 'border-radius');
    expect(progressBarHeight).toBe('8px');
    expect(progressBarRadius).toBeTruthy(); // Should have rounded corners
    
    // Verify progress fill
    const progressFill = await utils.waitForElement('[data-testid="progress-fill"]');
    const fillColor = await utils.getRGBFromColor(progressFill, 'background-color');
    expect(fillColor).toMatch(/rgb\(59,\s*130,\s*246\)/); // blue-500
    
    // Verify percentage display
    const percentageDisplay = await utils.waitForElement('[data-testid="progress-percentage"]');
    await expect(percentageDisplay).toHaveText('0%');
    
    // Verify status text
    const statusText = await utils.waitForElement('[data-testid="upload-status"]');
    await expect(statusText).toHaveText('Uploading...');
    
    // Verify spinner/loader
    const spinner = await utils.waitForElement('[data-testid="upload-spinner"]');
    await expect(spinner).toBeVisible();
    
    // Simulate progress updates
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('upload-progress', { detail: { percentage: 50 } }));
    });
    
    // Verify progress updates
    await expect(percentageDisplay).toHaveText('50%');
    const fillWidth = await utils.getComputedStyle(progressFill, 'width');
    expect(fillWidth).toBe('50%');
    
    // Verify estimated time and speed displays
    const estimatedTime = await utils.waitForElement('[data-testid="estimated-time"]');
    const uploadSpeed = await utils.waitForElement('[data-testid="upload-speed"]');
    await expect(estimatedTime).toBeVisible();
    await expect(uploadSpeed).toBeVisible();
    
    // Simulate completion
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('upload-complete', { 
        detail: { blobUrl: 'https://example.com/blob/video.mp4' }
      }));
    });
    
    // Verify completion state
    await expect(percentageDisplay).toHaveText('100%');
    const completedFillColor = await utils.getRGBFromColor(progressFill, 'background-color');
    expect(completedFillColor).toMatch(/rgb\(16,\s*185,\s*129\)/); // green-500
    
    const completedStatus = await utils.waitForElement('[data-testid="upload-status"]');
    await expect(completedStatus).toHaveText('Upload complete!');
    const statusColor = await utils.getRGBFromColor(completedStatus, 'color');
    expect(statusColor).toMatch(/rgb\(16,\s*185,\s*129\)/); // green-500
    
    // Verify success checkmark
    const checkmark = await utils.waitForElement('[data-testid="success-checkmark"]');
    await expect(checkmark).toBeVisible();
    
    // Verify blob URL link
    const blobUrlLink = await utils.waitForElement('[data-testid="blob-url-link"]');
    await expect(blobUrlLink).toBeVisible();
    await expect(blobUrlLink).toHaveAttribute('href', 'https://example.com/blob/video.mp4');
  });

  // Scenario 6: Upload Error States and Recovery
  test('should handle upload errors with complete visual feedback', async () => {
    const dropzone = await utils.waitForElement('[data-testid="upload-dropzone"]');
    
    // Start upload
    const validFile = utils.createMockVideoFile(10);
    await page.evaluate((file) => {
      const dropzoneEl = document.querySelector('[data-testid="upload-dropzone"]') as HTMLElement;
      const dt = new DataTransfer();
      const buffer = new ArrayBuffer(file.size);
      dt.items.add(new File([new ArrayBuffer(1024)], file.name, { type: file.type }));
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        dataTransfer: dt
      });
      dropzoneEl.dispatchEvent(dropEvent);
    }, { name: validFile.name, type: validFile.type, size: validFile.size });
    
    // Simulate progress to 35%
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('upload-progress', { detail: { percentage: 35 } }));
    });
    
    // Simulate network error
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('upload-error', { 
        detail: { error: 'Network error', percentage: 35 }
      }));
    });
    
    // Verify error state
    const progressFill = await utils.waitForElement('[data-testid="progress-fill"]');
    const errorFillColor = await utils.getRGBFromColor(progressFill, 'background-color');
    expect(errorFillColor).toMatch(/rgb\(239,\s*68,\s*68\)/); // red-500
    
    // Verify error message
    const errorMessage = await utils.waitForElement('[data-testid="error-message"]');
    await expect(errorMessage).toHaveText('Upload failed - Network error');
    const messageColor = await utils.getRGBFromColor(errorMessage, 'color');
    expect(messageColor).toMatch(/rgb\(239,\s*68,\s*68\)/); // red-500
    
    // Verify retry button
    const retryButton = await utils.waitForElement('[data-testid="retry-button"]');
    await expect(retryButton).toBeVisible();
    const retryButtonBg = await utils.getRGBFromColor(retryButton, 'background-color');
    expect(retryButtonBg).toMatch(/rgb\(59,\s*130,\s*246\)/); // blue-500
    
    // Verify cancel button
    const cancelButton = await utils.waitForElement('[data-testid="cancel-button"]');
    await expect(cancelButton).toBeVisible();
    const cancelButtonBg = await utils.getRGBFromColor(cancelButton, 'background-color');
    expect(cancelButtonBg).toMatch(/rgb\(107,\s*114,\s*128\)/); // gray-500
    
    // Verify error icon
    const errorIcon = await utils.waitForElement('[data-testid="error-icon"]');
    await expect(errorIcon).toBeVisible();
    
    // Test retry functionality
    await retryButton.click();
    
    // Verify retry state
    const retryStatus = await utils.waitForElement('[data-testid="upload-status"]');
    await expect(retryStatus).toHaveText('Retrying upload...');
    
    // Verify retry counter
    const retryCounter = await utils.waitForElement('[data-testid="retry-counter"]');
    await expect(retryCounter).toHaveText('Attempt 2 of 3');
    
    // Simulate multiple failures
    for (let attempt = 2; attempt <= 3; attempt++) {
      await page.evaluate((attemptNum) => {
        window.dispatchEvent(new CustomEvent('upload-error', { 
          detail: { error: 'Network error', attempt: attemptNum }
        }));
      }, attempt);
      
      if (attempt < 3) {
        await retryButton.click();
      }
    }
    
    // Verify final failure state
    const finalErrorMessage = await utils.waitForElement('[data-testid="error-message"]');
    await expect(finalErrorMessage).toHaveText('Upload failed after 3 attempts');
    
    // Verify "Choose Different File" button
    const chooseFileButton = await utils.waitForElement('[data-testid="choose-different-file"]');
    await expect(chooseFileButton).toBeVisible();
    
    // Verify error details section
    const errorDetails = await utils.waitForElement('[data-testid="error-details"]');
    await expect(errorDetails).toBeVisible();
    
    // Test reset functionality
    await chooseFileButton.click();
    
    // Verify dropzone resets to initial state
    await expect(dropzone).toHaveAttribute('data-upload-state', 'initial');
    await expect(dropzone).not.toHaveAttribute('data-validation-state', 'error');
  });

  // Scenario 7: Keyboard Navigation and Accessibility
  test('should support complete keyboard navigation and accessibility', async () => {
    // Test keyboard focus
    await page.keyboard.press('Tab');
    
    const dropzone = await utils.waitForElement('[data-testid="upload-dropzone"]');
    await expect(dropzone).toBeFocused();
    
    // Verify focus ring styling
    const focusRingWidth = await utils.getComputedStyle(dropzone, 'outline-width');
    const focusRingColor = await utils.getRGBFromColor(dropzone, 'outline-color');
    expect(focusRingWidth).toBe('2px');
    expect(focusRingColor).toMatch(/rgb\(59,\s*130,\s*246\)/); // blue-500
    
    // Verify ARIA attributes
    await expect(dropzone).toHaveAttribute('role', 'button');
    await expect(dropzone).toHaveAttribute('aria-label', 'Upload video file, dropzone, button');
    await expect(dropzone).toHaveAttribute('tabindex', '0');
    
    // Test keyboard activation
    await page.keyboard.press('Enter');
    
    // Verify file input is triggered (would open file dialog in real browser)
    const fileInput = await utils.waitForElement('input[type="file"]');
    await expect(fileInput).toBeFocused();
    
    // Test Space key activation
    await page.keyboard.press('Escape'); // Close any open dialogs
    await dropzone.focus();
    await page.keyboard.press('Space');
    
    // Simulate file selection and verify screen reader announcements
    await page.evaluate(() => {
      // Mock screen reader announcements
      const announcements: string[] = [];
      const originalAriaLive = document.createElement('div');
      originalAriaLive.setAttribute('aria-live', 'polite');
      originalAriaLive.setAttribute('data-testid', 'screen-reader-announcements');
      document.body.appendChild(originalAriaLive);
      
      // Simulate file selection
      window.dispatchEvent(new CustomEvent('file-selected', {
        detail: { filename: 'test-video.mp4', fileSize: '10.5 MB' }
      }));
    });
    
    // Verify screen reader announcements
    const announcements = await utils.waitForElement('[data-testid="screen-reader-announcements"]');
    await expect(announcements).toHaveText('test-video.mp4 selected, file size 10.5 MB');
    
    // Test progress announcements
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('upload-progress', { detail: { percentage: 25 } }));
    });
    
    await page.waitForTimeout(100);
    await expect(announcements).toHaveText('Upload progress: 25% complete');
    
    // Test error state accessibility
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('upload-error', { detail: { error: 'Network error' } }));
    });
    
    await expect(announcements).toHaveText('Upload failed: Network error');
    
    // Verify error state has proper ARIA attributes
    await expect(dropzone).toHaveAttribute('aria-describedby', 'error-message');
    const errorMessage = await utils.waitForElement('[data-testid="error-message"]');
    await expect(errorMessage).toHaveAttribute('role', 'alert');
    
    // Test escape key to cancel upload
    await page.keyboard.press('Escape');
    
    // Verify cancellation confirmation
    const cancelConfirm = await utils.waitForElement('[data-testid="cancel-confirmation"]');
    await expect(cancelConfirm).toBeVisible();
    await expect(cancelConfirm).toHaveAttribute('role', 'dialog');
    await expect(cancelConfirm).toHaveAttribute('aria-modal', 'true');
  });

  // Scenario 8: Mobile Touch Interface Experience
  test('should provide complete mobile touch interface', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const dropzone = await utils.waitForElement('[data-testid="upload-dropzone"]');
    
    // Verify mobile-specific text
    const primaryText = await utils.waitForElement('[data-testid="upload-primary-text"]');
    await expect(primaryText).toHaveText('Tap to select video file');
    
    // Verify drag and drop text is hidden on mobile
    const dragText = page.locator('[data-testid="drag-drop-text"]');
    await expect(dragText).toBeHidden();
    
    // Verify minimum touch target size
    const boundingBox = await dropzone.boundingBox();
    expect(boundingBox?.height).toBeGreaterThanOrEqual(44);
    expect(boundingBox?.width).toBeGreaterThanOrEqual(44);
    
    // Verify responsive margins
    const marginLeft = await utils.getComputedStyle(dropzone, 'margin-left');
    const marginRight = await utils.getComputedStyle(dropzone, 'margin-right');
    expect(parseInt(marginLeft)).toBeGreaterThan(0);
    expect(parseInt(marginRight)).toBeGreaterThan(0);
    
    // Test touch interaction
    await dropzone.tap();
    
    // Verify mobile file picker attributes
    const fileInput = await utils.waitForElement('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', 'video/mp4,video/mov,video/webm');
    await expect(fileInput).toHaveAttribute('capture', 'environment');
    
    // Test orientation change
    await page.setViewportSize({ width: 667, height: 375 }); // Landscape
    
    // Verify layout adapts to landscape
    const landscapeBox = await dropzone.boundingBox();
    expect(landscapeBox?.width || 0).toBeGreaterThan(boundingBox?.width || 0);
    
    // Simulate poor connectivity
    await page.evaluate(() => {
      // Mock slow connection
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: '2g' },
        writable: true
      });
      window.dispatchEvent(new CustomEvent('connection-change'));
    });
    
    // Verify connection indicator
    const connectionIndicator = await utils.waitForElement('[data-testid="connection-indicator"]');
    await expect(connectionIndicator).toHaveText('Slow connection detected');
    
    // Verify background upload option
    const backgroundUpload = await utils.waitForElement('[data-testid="background-upload-option"]');
    await expect(backgroundUpload).toBeVisible();
    
    // Verify data usage estimate
    const dataUsage = await utils.waitForElement('[data-testid="data-usage-estimate"]');
    await expect(dataUsage).toBeVisible();
  });

  // Scenario 9: Integration with Processing Status Panel
  test('should integrate completely with processing status panel', async () => {
    const dropzone = await utils.waitForElement('[data-testid="upload-dropzone"]');
    
    // Complete upload
    const validFile = utils.createMockVideoFile(10);
    await page.evaluate((file) => {
      const dropzoneEl = document.querySelector('[data-testid="upload-dropzone"]') as HTMLElement;
      const dt = new DataTransfer();
      const buffer = new ArrayBuffer(file.size);
      dt.items.add(new File([new ArrayBuffer(1024)], file.name, { type: file.type }));
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        dataTransfer: dt
      });
      dropzoneEl.dispatchEvent(dropEvent);
    }, { name: validFile.name, type: validFile.type, size: validFile.size });
    
    // Simulate upload completion
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('upload-complete', { 
        detail: { 
          blobUrl: 'https://example.com/blob/video.mp4',
          uploadTime: 45000,
          fileSize: 10485760,
          uploadSpeed: 233016
        }
      }));
    });
    
    // Verify processing status panel updates
    const processingPanel = await utils.waitForElement('[data-testid="processing-status-panel"]');
    await expect(processingPanel).toBeVisible();
    
    // Verify upload completion indicator
    const uploadStatus = await utils.waitForElement('[data-testid="upload-complete-status"]');
    await expect(uploadStatus).toHaveText('✓ Upload Complete');
    const statusColor = await utils.getRGBFromColor(uploadStatus, 'color');
    expect(statusColor).toMatch(/rgb\(16,\s*185,\s*129\)/); // green-500
    
    // Verify timing display
    const uploadTiming = await utils.waitForElement('[data-testid="upload-timing"]');
    await expect(uploadTiming).toHaveText('Completed in 45 seconds');
    
    // Verify metrics display
    const fileSize = await utils.waitForElement('[data-testid="file-size-metric"]');
    const uploadSpeed = await utils.waitForElement('[data-testid="upload-speed-metric"]');
    await expect(fileSize).toBeVisible();
    await expect(uploadSpeed).toBeVisible();
    
    // Verify blob URL accessibility
    const blobUrl = await utils.waitForElement('[data-testid="blob-url-debug"]');
    await expect(blobUrl).toHaveText('https://example.com/blob/video.mp4');
    
    // Test connection to next processing step
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('start-frame-extraction'));
    });
    
    // Verify upload section maintains completed state
    await expect(dropzone).toHaveAttribute('data-upload-state', 'completed');
    
    // Verify connection indicator
    const connectionLine = await utils.waitForElement('[data-testid="process-connection-line"]');
    await expect(connectionLine).toBeVisible();
    
    // Test re-upload requirement scenario
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('processing-error', { 
        detail: { requiresReupload: true, reason: 'Corrupted file detected' }
      }));
    });
    
    // Verify re-upload state
    await expect(dropzone).toHaveAttribute('data-upload-state', 'reupload-required');
    
    const reuploadMessage = await utils.waitForElement('[data-testid="reupload-message"]');
    await expect(reuploadMessage).toHaveText('Re-upload Required');
    
    const reuploadReason = await utils.waitForElement('[data-testid="reupload-reason"]');
    await expect(reuploadReason).toHaveText('Corrupted file detected');
    
    // Verify upload history is preserved
    const uploadHistory = await utils.waitForElement('[data-testid="upload-history"]');
    await expect(uploadHistory).toBeVisible();
  });

  // Cross-Component Integration Test
  test('should integrate with all imported ShadCN components', async () => {
    const dropzone = await utils.waitForElement('[data-testid="upload-dropzone"]');
    
    // Verify Card component is used for dropzone container
    const cardContainer = await utils.waitForElement('[data-testid="upload-card"]');
    await expect(cardContainer).toBeVisible();
    const cardClasses = await cardContainer.getAttribute('class');
    expect(cardClasses).toContain('card'); // ShadCN Card component
    
    // Verify Button component is used for retry/cancel buttons
    const validFile = utils.createMockVideoFile(10);
    await page.evaluate((file) => {
      const dropzoneEl = document.querySelector('[data-testid="upload-dropzone"]') as HTMLElement;
      const dt = new DataTransfer();
      dt.items.add(new File([new ArrayBuffer(1024)], file.name, { type: file.type }));  
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        dataTransfer: dt
      });
      dropzoneEl.dispatchEvent(dropEvent);
    }, { name: validFile.name, type: validFile.type, size: validFile.size });
    
    // Simulate error to show buttons
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('upload-error', { detail: { error: 'Network error' } }));
    });
    
    const retryButton = await utils.waitForElement('[data-testid="retry-button"]');
    const retryClasses = await retryButton.getAttribute('class');
    expect(retryClasses).toContain('button'); // ShadCN Button component
    
    // Verify Progress component is used
    const progressContainer = await utils.waitForElement('[data-testid="upload-progress"]');
    const progressBar = progressContainer.locator('[data-testid="progress-bar"]');
    const progressClasses = await progressBar.getAttribute('class');
    expect(progressClasses).toContain('progress'); // ShadCN Progress component
    
    // Verify all components respond to theme changes
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    
    // Verify dark mode styling
    const darkModeCard = await utils.waitForElement('[data-testid="upload-card"]');
    const darkBg = await utils.getRGBFromColor(darkModeCard, 'background-color');
    expect(darkBg).toMatch(/rgb\(39,\s*39,\s*42\)/); // Dark mode background
  });
});