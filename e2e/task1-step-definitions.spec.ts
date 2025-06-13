import { test, expect, Page, Locator } from '@playwright/test';
import { setTimeout } from 'timers/promises';

/**
 * Complete UI Implementation Step Definitions for Task 1
 * Tests render, visual, interaction, timing, accessibility, and integration
 */

class ArchitectureExperimentPage {
  readonly page: Page;
  readonly uploadSection: Locator;
  readonly videoSection: Locator;
  readonly transcriptsSection: Locator;
  readonly processingSection: Locator;
  readonly debugPanel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.uploadSection = page.locator('[data-testid="upload-section"]');
    this.videoSection = page.locator('[data-testid="video-section"]');
    this.transcriptsSection = page.locator('[data-testid="transcripts-section"]');
    this.processingSection = page.locator('[data-testid="processing-section"]');
    this.debugPanel = page.locator('[data-testid="debug-panel"]');
  }

  async navigateToExperiment() {
    await this.page.goto('/experiment/architecture-test');
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    // Wait for either skeleton to appear or grid layout to be visible
    await this.page.waitForSelector('[data-testid="loading-skeleton"], [data-testid="grid-layout"]');
    // If skeleton is visible, wait for it to disappear and grid to appear
    const skeleton = this.page.locator('[data-testid="loading-skeleton"]');
    if (await skeleton.isVisible()) {
      await this.page.waitForSelector('[data-testid="grid-layout"]');
    }
  }

  async getComputedStyle(element: Locator, property: string): Promise<string> {
    return await element.evaluate((el, prop) => {
      return window.getComputedStyle(el).getPropertyValue(prop);
    }, property);
  }

  async getBoundingBox(element: Locator) {
    return await element.boundingBox();
  }

  async pressKeyAndWait(key: string, delay: number = 100) {
    await this.page.keyboard.press(key);
    await setTimeout(delay);
  }
}

test.describe('Task 1: Foundation Page Complete UI Tests', () => {
  let architecturePage: ArchitectureExperimentPage;

  test.beforeEach(async ({ page }) => {
    architecturePage = new ArchitectureExperimentPage(page);
  });

  test.describe('Initial Page Load and Navigation', () => {
    test('page loads within 2 seconds without JavaScript errors', async ({ page }) => {
      const startTime = Date.now();
      let jsErrors: string[] = [];
      
      // Capture JavaScript errors
      page.on('pageerror', (error) => {
        jsErrors.push(error.message);
      });

      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000);
      expect(jsErrors).toHaveLength(0);
    });

    test('browser title displays correctly', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await expect(page).toHaveTitle('Architecture Experiment - Pitch Perfect');
    });

    test('loading skeleton with 4 card placeholders renders', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      
      // Check for skeleton placeholders
      const skeletonCards = page.locator('[data-testid="skeleton-card"]');
      await expect(skeletonCards).toHaveCount(4);
      
      // Verify pulse animation
      const firstSkeleton = skeletonCards.first();
      const backgroundColor = await architecturePage.getComputedStyle(firstSkeleton, 'background-color');
      expect(backgroundColor).toMatch(/rgb\(243,\s*244,\s*246\)|#f3f4f6/);
      
      // Check animation exists
      const animationName = await architecturePage.getComputedStyle(firstSkeleton, 'animation-name');
      expect(animationName).toContain('pulse');
    });

    test('page is accessible via keyboard navigation', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Test Tab navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.locator(':focus').first();
      await expect(focusedElement).toBeVisible();
      
      // Verify focus indicator
      const outlineWidth = await architecturePage.getComputedStyle(focusedElement, 'outline-width');
      expect(parseInt(outlineWidth)).toBeGreaterThanOrEqual(2);
    });

    test('screen reader accessibility announcements', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      
      const mainContent = page.locator('main, [role="main"]');
      await expect(mainContent).toHaveAttribute('aria-label', /Architecture Experiment/);
      
      const pageHeading = page.locator('h1');
      await expect(pageHeading).toBeVisible();
      await expect(pageHeading).toHaveText(/Architecture Experiment/);
    });
  });

  test.describe('State Initialization and Debug Display', () => {
    test('all 9 state variables initialize with default values', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Wait for state initialization
      await page.waitForFunction(() => {
        return window.experimentState !== undefined;
      });
      
      const state = await page.evaluate(() => window.experimentState);
      
      expect(state.videoFile).toBeNull();
      expect(state.videoUrl).toBe('');
      expect(state.uploadProgress).toBe(0);
      expect(state.processingStep).toBe('idle');
      expect(state.fullTranscript).toBe('');
      expect(state.segmentedTranscript).toEqual([]);
      expect(state.extractedFrames).toEqual([]);
      expect(state.errors).toEqual([]);
      expect(state.timings).toEqual({});
    });

    test('debug panel displays with correct styling', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Toggle debug panel with Ctrl+D
      await page.keyboard.press('Control+KeyD');
      
      const debugPanel = architecturePage.debugPanel;
      await expect(debugPanel).toBeVisible();
      
      // Verify positioning (bottom-right)
      const panelBox = await architecturePage.getBoundingBox(debugPanel);
      const pageBox = await page.locator('body').boundingBox();
      
      expect(panelBox!.x + panelBox!.width).toBeCloseTo(pageBox!.width, 0);
      expect(panelBox!.y + panelBox!.height).toBeCloseTo(pageBox!.height, 0);
      
      // Verify styling
      const backgroundColor = await architecturePage.getComputedStyle(debugPanel, 'background-color');
      expect(backgroundColor).toMatch(/rgb\(243,\s*244,\s*246\)|#f3f4f6/);
      
      const fontFamily = await architecturePage.getComputedStyle(debugPanel, 'font-family');
      expect(fontFamily).toMatch(/monospace|Monaco|Consolas/);
    });

    test('state values display in JSON format', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      await page.keyboard.press('Control+KeyD');
      
      const debugContent = architecturePage.debugPanel.locator('[data-testid="debug-content"]');
      const content = await debugContent.textContent();
      
      // Verify JSON format
      expect(() => JSON.parse(content!)).not.toThrow();
      
      const jsonData = JSON.parse(content!);
      expect(jsonData).toHaveProperty('videoFile');
      expect(jsonData).toHaveProperty('uploadProgress');
      expect(jsonData).toHaveProperty('processingStep');
    });

    test('screen readers can access state via aria-live region', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const ariaLiveRegion = page.locator('[aria-live="polite"]');
      await expect(ariaLiveRegion).toBeVisible();
      
      // Test state change announcement
      await page.evaluate(() => {
        window.updateExperimentState({ uploadProgress: 25 });
      });
      
      await page.waitForTimeout(500); // Allow for aria-live update
      const liveContent = await ariaLiveRegion.textContent();
      expect(liveContent).toContain('25');
    });
  });

  test.describe('Four-Section Grid Layout Rendering', () => {
    test('4 distinct sections visible in 2x2 grid', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const gridLayout = page.locator('[data-testid="grid-layout"]');
      await expect(gridLayout).toBeVisible();
      
      // Check CSS Grid properties
      const display = await architecturePage.getComputedStyle(gridLayout, 'display');
      expect(display).toBe('grid');
      
      // For responsive grid (md:grid-cols-2), check that there are 2 equal columns on desktop
      const gridTemplateColumns = await architecturePage.getComputedStyle(gridLayout, 'grid-template-columns');
      // Should have 2 columns with equal or similar widths
      const columns = gridTemplateColumns.split(' ');
      expect(columns.length).toBe(2);
      
      // Verify all sections exist
      await expect(architecturePage.uploadSection).toBeVisible();
      await expect(architecturePage.videoSection).toBeVisible();
      await expect(architecturePage.transcriptsSection).toBeVisible();
      await expect(architecturePage.processingSection).toBeVisible();
    });

    test('sections have correct colored borders and positioning', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Upload section - blue border (blue-500)
      const uploadBorder = await architecturePage.getComputedStyle(architecturePage.uploadSection, 'border-color');
      expect(uploadBorder).toMatch(/rgb\(59,\s*130,\s*246\)|rgb\(59,130,246\)|#3b82f6/);
      
      // Video section - emerald border (emerald-500)
      const videoBorder = await architecturePage.getComputedStyle(architecturePage.videoSection, 'border-color');
      expect(videoBorder).toMatch(/rgb\(16,\s*185,\s*129\)|rgb\(16,185,129\)|#10b981/);
      
      // Transcripts section - purple border (purple-500)
      const transcriptsBorder = await architecturePage.getComputedStyle(architecturePage.transcriptsSection, 'border-color');
      expect(transcriptsBorder).toMatch(/rgb\(139,\s*92,\s*246\)|rgb\(139,92,246\)|#8b5cf6/);
      
      // Processing section - amber border (amber-500)
      const processingBorder = await architecturePage.getComputedStyle(architecturePage.processingSection, 'border-color');
      expect(processingBorder).toMatch(/rgb\(245,\s*158,\s*11\)|rgb\(245,158,11\)|#f59e0b/);
    });

    test('ShadCN Card components with correct styling', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const cards = page.locator('[data-component="card"]');
      await expect(cards).toHaveCount(4);
      
      const firstCard = cards.first();
      
      // Verify rounded corners (8px radius)
      const borderRadius = await architecturePage.getComputedStyle(firstCard, 'border-radius');
      expect(borderRadius).toBe('8px');
      
      // Verify padding (16px)
      const padding = await architecturePage.getComputedStyle(firstCard, 'padding');
      expect(padding).toBe('16px');
    });

    test('section titles display with correct typography', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const sectionTitles = page.locator('[data-testid$="-title"]');
      await expect(sectionTitles).toHaveCount(4);
      
      const firstTitle = sectionTitles.first();
      
      // Verify font size (18px)
      const fontSize = await architecturePage.getComputedStyle(firstTitle, 'font-size');
      expect(fontSize).toBe('18px');
      
      // Verify font weight (semibold)
      const fontWeight = await architecturePage.getComputedStyle(firstTitle, 'font-weight');
      expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
    });

    test('mobile responsive layout (< 768px)', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const gridLayout = page.locator('[data-testid="grid-layout"]');
      
      // Check that layout becomes single column
      const gridTemplateColumns = await architecturePage.getComputedStyle(gridLayout, 'grid-template-columns');
      expect(gridTemplateColumns).toBe('1fr');
      
      // Verify 12px gaps
      const gap = await architecturePage.getComputedStyle(gridLayout, 'gap');
      expect(gap).toBe('12px');
      
      // Check section margins (16px sides)
      const firstSection = architecturePage.uploadSection;
      const marginLeft = await architecturePage.getComputedStyle(firstSection, 'margin-left');
      const marginRight = await architecturePage.getComputedStyle(firstSection, 'margin-right');
      expect(marginLeft).toBe('16px');
      expect(marginRight).toBe('16px');
    });

    test('keyboard navigation cycles through sections', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Start keyboard navigation
      await page.keyboard.press('Tab');
      
      const focusOrder = [];
      for (let i = 0; i < 8; i++) {
        const focusedElement = await page.locator(':focus').first();
        const testId = await focusedElement.getAttribute('data-testid');
        if (testId) focusOrder.push(testId);
        await page.keyboard.press('Tab');
      }
      
      // Verify logical focus order through sections
      expect(focusOrder).toContain('upload-section');
      expect(focusOrder).toContain('video-section');
      expect(focusOrder).toContain('transcripts-section');
      expect(focusOrder).toContain('processing-section');
    });

    test('screen reader section announcements', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Check section roles and labels
      await expect(architecturePage.uploadSection).toHaveAttribute('role', 'region');
      await expect(architecturePage.uploadSection).toHaveAttribute('aria-label', /upload/i);
      
      await expect(architecturePage.videoSection).toHaveAttribute('role', 'region');
      await expect(architecturePage.videoSection).toHaveAttribute('aria-label', /video.*playback/i);
      
      await expect(architecturePage.transcriptsSection).toHaveAttribute('role', 'region');
      await expect(architecturePage.transcriptsSection).toHaveAttribute('aria-label', /transcript/i);
      
      await expect(architecturePage.processingSection).toHaveAttribute('role', 'region');
      await expect(architecturePage.processingSection).toHaveAttribute('aria-label', /processing.*status/i);
    });
  });

  test.describe('Upload Section Interactive Elements', () => {
    test('dropzone displays with correct styling and hover state', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const dropzone = architecturePage.uploadSection.locator('[data-testid="dropzone"]');
      await expect(dropzone).toBeVisible();
      
      // Check dashed border
      const borderStyle = await architecturePage.getComputedStyle(dropzone, 'border-style');
      expect(borderStyle).toBe('dashed');
      
      // Test hover state
      await dropzone.hover();
      await page.waitForTimeout(200); // Allow transition
      
      const hoverBg = await architecturePage.getComputedStyle(dropzone, 'background-color');
      expect(hoverBg).toMatch(/rgb\(239,\s*246,\s*255\)|#eff6ff/);
    });

    test('choose file button with ShadCN styling and interactions', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const chooseButton = architecturePage.uploadSection.locator('[data-testid="choose-file-button"]');
      await expect(chooseButton).toBeVisible();
      
      // Verify ShadCN button component
      await expect(chooseButton).toHaveAttribute('data-component', 'button');
      
      // Check primary styling
      const backgroundColor = await architecturePage.getComputedStyle(chooseButton, 'background-color');
      expect(backgroundColor).toMatch(/rgb\(59,\s*130,\s*246\)|#3b82f6/);
      
      const color = await architecturePage.getComputedStyle(chooseButton, 'color');
      expect(color).toMatch(/rgb\(255,\s*255,\s*255\)|#ffffff/);
      
      // Test hover state
      await chooseButton.hover();
      await page.waitForTimeout(150); // Wait for transition
      
      const hoverBg = await architecturePage.getComputedStyle(chooseButton, 'background-color');
      expect(hoverBg).toMatch(/rgb\(37,\s*99,\s*235\)|#2563eb/);
      
      // Verify cursor change
      const cursor = await architecturePage.getComputedStyle(chooseButton, 'cursor');
      expect(cursor).toBe('pointer');
    });

    test('progress bar component with correct initial state', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const progressBar = architecturePage.uploadSection.locator('[data-testid="progress-bar"]');
      await expect(progressBar).toBeVisible();
      
      // Verify ShadCN Progress component
      await expect(progressBar).toHaveAttribute('data-component', 'progress');
      
      // Check initial 0% state
      const progressValue = await progressBar.getAttribute('aria-valuenow');
      expect(progressValue).toBe('0');
      
      // Verify styling
      const backgroundColor = await architecturePage.getComputedStyle(progressBar, 'background-color');
      expect(backgroundColor).toMatch(/rgb\(229,\s*231,\s*235\)|#e5e7eb/); // Gray background
      
      const progressFill = progressBar.locator('[data-testid="progress-fill"]');
      const fillColor = await architecturePage.getComputedStyle(progressFill, 'background-color');
      expect(fillColor).toMatch(/rgb\(59,\s*130,\s*246\)|#3b82f6/); // Blue fill
    });

    test('file dialog opens with correct filters', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const chooseButton = architecturePage.uploadSection.locator('[data-testid="choose-file-button"]');
      
      // Mock file input to capture accept attribute
      const fileInput = architecturePage.uploadSection.locator('input[type="file"]');
      const acceptAttr = await fileInput.getAttribute('accept');
      
      expect(acceptAttr).toContain('.mp4');
      expect(acceptAttr).toContain('.mov');
      expect(acceptAttr).toContain('.webm');
    });

    test('screen reader announcements for upload elements', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const chooseButton = architecturePage.uploadSection.locator('[data-testid="choose-file-button"]');
      
      // Check aria-label
      await expect(chooseButton).toHaveAttribute('aria-label', /choose.*video.*file.*opens.*file.*dialog/i);
      
      // Check button role
      const role = await chooseButton.getAttribute('role');
      expect(role).toBe('button');
    });
  });

  test.describe('Video Playback Section State Display', () => {
    test('placeholder video area with correct aspect ratio', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const videoPlaceholder = architecturePage.videoSection.locator('[data-testid="video-placeholder"]');
      await expect(videoPlaceholder).toBeVisible();
      
      // Check 16:9 aspect ratio
      const box = await architecturePage.getBoundingBox(videoPlaceholder);
      const aspectRatio = box!.width / box!.height;
      expect(aspectRatio).toBeCloseTo(16/9, 1);
      
      // Verify styling
      const backgroundColor = await architecturePage.getComputedStyle(videoPlaceholder, 'background-color');
      expect(backgroundColor).toMatch(/rgb\(55,\s*65,\s*81\)|#374151/);
      
      const color = await architecturePage.getComputedStyle(videoPlaceholder, 'color');
      expect(color).toMatch(/rgb\(255,\s*255,\s*255\)|#ffffff/);
      
      const fontSize = await architecturePage.getComputedStyle(videoPlaceholder, 'font-size');
      expect(fontSize).toBe('16px');
    });

    test('placeholder text displays correctly', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const placeholderText = architecturePage.videoSection.locator('[data-testid="video-placeholder-text"]');
      await expect(placeholderText).toHaveText('No video uploaded');
      
      // Verify centered alignment
      const textAlign = await architecturePage.getComputedStyle(placeholderText, 'text-align');
      expect(textAlign).toBe('center');
    });

    test('3x3 frame grid with correct placeholders', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const frameGrid = architecturePage.videoSection.locator('[data-testid="frame-grid"]');
      await expect(frameGrid).toBeVisible();
      
      // Check for 9 frame placeholders
      const framePlaceholders = frameGrid.locator('[data-testid^="frame-placeholder-"]');
      await expect(framePlaceholders).toHaveCount(9);
      
      // Verify first placeholder dimensions (120px x 68px)
      const firstFrame = framePlaceholders.first();
      const width = await architecturePage.getComputedStyle(firstFrame, 'width');
      const height = await architecturePage.getComputedStyle(firstFrame, 'height');
      
      expect(width).toBe('120px');
      expect(height).toBe('68px');
      
      // Check gray background
      const backgroundColor = await architecturePage.getComputedStyle(firstFrame, 'background-color');
      expect(backgroundColor).toMatch(/rgb\(156,\s*163,\s*175\)|#9ca3af/);
    });

    test('frame placeholder labels display correctly', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const frameLabels = architecturePage.videoSection.locator('[data-testid^="frame-label-"]');
      await expect(frameLabels).toHaveCount(9);
      
      // Check specific labels
      await expect(frameLabels.nth(0)).toHaveText('Frame 1');
      await expect(frameLabels.nth(1)).toHaveText('Frame 2');
      await expect(frameLabels.nth(8)).toHaveText('Frame 9');
    });

    test('section height maintains visual balance', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const videoSectionBox = await architecturePage.getBoundingBox(architecturePage.videoSection);
      const uploadSectionBox = await architecturePage.getBoundingBox(architecturePage.uploadSection);
      
      // Sections should have similar heights for visual balance
      const heightDifference = Math.abs(videoSectionBox!.height - uploadSectionBox!.height);
      expect(heightDifference).toBeLessThan(50); // Allow 50px difference
    });

    test('keyboard navigation through frame placeholders', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Navigate to video section
      await page.keyboard.press('Tab');
      let focused = await page.locator(':focus').first();
      
      // Keep tabbing until we reach video section
      let attempts = 0;
      while (attempts < 10) {
        const testId = await focused.getAttribute('data-testid');
        if (testId?.includes('frame-placeholder')) break;
        await page.keyboard.press('Tab');
        focused = await page.locator(':focus').first();
        attempts++;
      }
      
      // Verify we can focus on frame placeholders
      const focusedTestId = await focused.getAttribute('data-testid');
      expect(focusedTestId).toMatch(/frame-placeholder-\d/);
    });

    test('screen reader announces video area correctly', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const videoPlaceholder = architecturePage.videoSection.locator('[data-testid="video-placeholder"]');
      
      await expect(videoPlaceholder).toHaveAttribute('aria-label', /video.*playback.*area.*no.*video.*loaded/i);
      await expect(videoPlaceholder).toHaveAttribute('role', 'img');
    });
  });

  test.describe('State Updates and UI Reactivity', () => {
    test('progress bar animates to updated percentage', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const progressBar = architecturePage.uploadSection.locator('[data-testid="progress-bar"]');
      const progressFill = progressBar.locator('[data-testid="progress-fill"]');
      
      // Update state to 45%
      await page.evaluate(() => {
        window.updateExperimentState({ uploadProgress: 45 });
      });
      
      // Wait for animation
      await page.waitForTimeout(350); // Allow 300ms animation + buffer
      
      // Verify progress value
      const progressValue = await progressBar.getAttribute('aria-valuenow');
      expect(progressValue).toBe('45');
      
      // Verify visual width (should be 45% of container)
      const fillWidth = await architecturePage.getComputedStyle(progressFill, 'width');
      const containerWidth = await architecturePage.getComputedStyle(progressBar, 'width');
      
      const fillWidthPx = parseInt(fillWidth);
      const containerWidthPx = parseInt(containerWidth);
      const percentage = (fillWidthPx / containerWidthPx) * 100;
      
      expect(percentage).toBeCloseTo(45, 1);
    });

    test('progress bar shows percentage text overlay', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Update progress
      await page.evaluate(() => {
        window.updateExperimentState({ uploadProgress: 45 });
      });
      
      const progressText = architecturePage.uploadSection.locator('[data-testid="progress-text"]');
      await expect(progressText).toHaveText('45%');
      
      // Verify text is centered
      const textAlign = await architecturePage.getComputedStyle(progressText, 'text-align');
      expect(textAlign).toBe('center');
    });

    test('debug panel updates with state changes', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Open debug panel
      await page.keyboard.press('Control+KeyD');
      
      const debugContent = architecturePage.debugPanel.locator('[data-testid="debug-content"]');
      
      // Update state
      await page.evaluate(() => {
        window.updateExperimentState({ uploadProgress: 45 });
      });
      
      // Verify debug panel shows updated value
      const content = await debugContent.textContent();
      const jsonData = JSON.parse(content!);
      expect(jsonData.uploadProgress).toBe(45);
    });

    test('animation timing matches specification (300ms ease-out)', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const progressFill = architecturePage.uploadSection.locator('[data-testid="progress-fill"]');
      
      // Check transition properties
      const transitionDuration = await architecturePage.getComputedStyle(progressFill, 'transition-duration');
      expect(transitionDuration).toBe('0.3s');
      
      const transitionTimingFunction = await architecturePage.getComputedStyle(progressFill, 'transition-timing-function');
      expect(transitionTimingFunction).toMatch(/ease-out|cubic-bezier.*0.*0.*0.58.*1/);
    });

    test('processing step updates highlight correct step', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Update processing step
      await page.evaluate(() => {
        window.updateExperimentState({ processingStep: 'extracting' });
      });
      
      const step2 = architecturePage.processingSection.locator('[data-testid="step-2"]');
      
      // Verify step 2 is highlighted in blue
      const backgroundColor = await architecturePage.getComputedStyle(step2, 'background-color');
      expect(backgroundColor).toMatch(/rgb\(59,\s*130,\s*246\)|#3b82f6/);
      
      // Check current step text
      const currentStepText = architecturePage.processingSection.locator('[data-testid="current-step-text"]');
      await expect(currentStepText).toHaveText('Extracting frames...');
    });

    test('pulsing animation on active step indicator', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Update to active processing step
      await page.evaluate(() => {
        window.updateExperimentState({ processingStep: 'extracting' });
      });
      
      const activeStep = architecturePage.processingSection.locator('[data-testid="step-2"]');
      
      // Check for pulse animation
      const animationName = await architecturePage.getComputedStyle(activeStep, 'animation-name');
      expect(animationName).toContain('pulse');
      
      const animationDuration = await architecturePage.getComputedStyle(activeStep, 'animation-duration');
      expect(parseFloat(animationDuration)).toBeGreaterThan(0);
    });

    test('screen reader announces processing step changes', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const ariaLiveRegion = page.locator('[aria-live="polite"]');
      
      // Update processing step
      await page.evaluate(() => {
        window.updateExperimentState({ processingStep: 'extracting' });
      });
      
      // Wait for announcement
      await page.waitForTimeout(500);
      
      const liveContent = await ariaLiveRegion.textContent();
      expect(liveContent).toMatch(/processing.*step.*changed.*extracting.*frames/i);
    });
  });

  test.describe('Error States and Accessibility', () => {
    test('error boundary displays red-bordered error card', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      // Simulate component error in upload section
      await page.evaluate(() => {
        window.simulateError('upload');
      });
      
      const errorCard = architecturePage.uploadSection.locator('[data-testid="error-card"]');
      await expect(errorCard).toBeVisible();
      
      // Verify red border
      const borderColor = await architecturePage.getComputedStyle(errorCard, 'border-color');
      expect(borderColor).toMatch(/rgb\(239,\s*68,\s*68\)|#ef4444/);
    });

    test('error message displays correctly', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      await page.evaluate(() => {
        window.simulateError('upload');
      });
      
      const errorMessage = architecturePage.uploadSection.locator('[data-testid="error-message"]');
      await expect(errorMessage).toHaveText('Something went wrong in Upload section');
    });

    test('retry button with secondary styling', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      await page.evaluate(() => {
        window.simulateError('upload');
      });
      
      const retryButton = architecturePage.uploadSection.locator('[data-testid="retry-button"]');
      await expect(retryButton).toBeVisible();
      
      // Verify secondary button styling
      const backgroundColor = await architecturePage.getComputedStyle(retryButton, 'background-color');
      expect(backgroundColor).toMatch(/rgb\(243,\s*244,\s*246\)|#f3f4f6/);
      
      const borderColor = await architecturePage.getComputedStyle(retryButton, 'border-color');
      expect(borderColor).toMatch(/rgb\(209,\s*213,\s*219\)|#d1d5db/);
    });

    test('error logged to debug panel with timestamp', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      await page.keyboard.press('Control+KeyD');
      
      await page.evaluate(() => {
        window.simulateError('upload');
      });
      
      const debugContent = architecturePage.debugPanel.locator('[data-testid="debug-content"]');
      const content = await debugContent.textContent();
      const jsonData = JSON.parse(content!);
      
      expect(jsonData.errors).toHaveLength(1);
      expect(jsonData.errors[0]).toHaveProperty('timestamp');
      expect(jsonData.errors[0]).toHaveProperty('section', 'upload');
    });

    test('other sections continue functioning during error', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      await page.evaluate(() => {
        window.simulateError('upload');
      });
      
      // Verify other sections remain interactive
      await expect(architecturePage.videoSection).toBeVisible();
      await expect(architecturePage.transcriptsSection).toBeVisible();
      await expect(architecturePage.processingSection).toBeVisible();
      
      // Test interaction with non-errored section
      const videoPlaceholder = architecturePage.videoSection.locator('[data-testid="video-placeholder"]');
      await expect(videoPlaceholder).toBeVisible();
    });

    test('screen reader announces error state', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      const ariaLiveRegion = page.locator('[aria-live="assertive"]');
      
      await page.evaluate(() => {
        window.simulateError('upload');
      });
      
      await page.waitForTimeout(500);
      
      const liveContent = await ariaLiveRegion.textContent();
      expect(liveContent).toMatch(/error.*upload.*section/i);
    });

    test('retry button triggers re-render with loading state', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      await page.evaluate(() => {
        window.simulateError('upload');
      });
      
      const retryButton = architecturePage.uploadSection.locator('[data-testid="retry-button"]');
      await retryButton.click();
      
      // Verify loading spinner appears
      const loadingSpinner = architecturePage.uploadSection.locator('[data-testid="loading-spinner"]');
      await expect(loadingSpinner).toBeVisible();
      
      // Wait for retry completion (500ms as specified)
      await page.waitForTimeout(600);
      
      // Verify loading spinner is gone
      await expect(loadingSpinner).not.toBeVisible();
    });

    test('screen reader announces retry attempt and outcome', async ({ page }) => {
      await architecturePage.navigateToExperiment();
      await architecturePage.waitForPageLoad();
      
      await page.evaluate(() => {
        window.simulateError('upload');
      });
      
      const ariaLiveRegion = page.locator('[aria-live="polite"]');
      const retryButton = architecturePage.uploadSection.locator('[data-testid="retry-button"]');
      
      await retryButton.click();
      
      // Wait for retry announcement
      await page.waitForTimeout(800);
      
      const liveContent = await ariaLiveRegion.textContent();
      expect(liveContent).toMatch(/retrying.*upload.*section/i);
    });
  });
});