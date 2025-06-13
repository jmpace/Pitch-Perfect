# BDD Scenarios for Task 1: Create Foundation Next.js Page and State Management

Feature: Architecture Experiment Page Foundation
  As a developer implementing the architecture experiment
  I want to ensure the foundation page provides complete UI/UX functionality
  So that users can interact with all sections effectively

  Background:
    Given the Next.js application is running
    And the architecture experiment page is accessible

  Scenario: Initial Page Load and Navigation
    Given the user is on the main application
    And the browser window is 1440px wide by 900px tall
    When the user navigates to "/experiment/architecture-test"
    Then the page loads within 2 seconds without JavaScript errors
    And the browser title displays "Architecture Experiment - Pitch Perfect"
    And the page displays a loading skeleton with 4 empty card placeholders
    And each placeholder shows a subtle pulse animation in gray (#f3f4f6)
    And the page is accessible via keyboard navigation with Tab key
    And screen readers announce "Architecture Experiment Page, main content"

  Scenario: State Initialization and Debug Display
    Given the user has loaded "/experiment/architecture-test"
    And the page is fully rendered
    When the page completes initial state setup
    Then all 9 state variables are initialized with default values
    And a debug panel in the bottom-right shows state values in JSON format
    And the debug panel has a light gray background with monospace font
    And the debug panel can be toggled with keyboard shortcut Ctrl+D
    And the state displays: videoFile: null, videoUrl: "", uploadProgress: 0
    And the state displays: processingStep: "idle", fullTranscript: "", segmentedTranscript: []
    And the state displays: extractedFrames: [], errors: [], timings: {}
    And screen readers can access state information via aria-live region

  Scenario: Four-Section Grid Layout Rendering
    Given the user is on "/experiment/architecture-test"
    And the page has completed loading
    When the grid layout renders
    Then 4 distinct sections are visible in a 2x2 grid layout
    And the "Upload" section appears in top-left with blue border (#3b82f6)
    And the "Video Playback & Frames" section appears in top-right with green border (#10b981)
    And the "Transcripts" section appears in bottom-left with purple border (#8b5cf6)
    And the "Processing Status" section appears in bottom-right with orange border (#f59e0b)
    And each section has a ShadCN Card component with rounded corners (8px radius)
    And each section title is displayed in 18px semibold font
    And each section has 16px padding inside the card
    And on mobile (< 768px), sections stack vertically with 12px gaps
    And keyboard navigation cycles through sections with Tab key
    And each section is announced by screen readers with section title and role

  Scenario: Upload Section Interactive Elements
    Given the user is viewing the architecture experiment page
    And the Upload section is visible in the top-left
    When the user focuses on the Upload section
    Then a dashed border dropzone is displayed with "Drop video file here" text
    And the dropzone has a hover state with light blue background (#eff6ff)
    And a "Choose File" ShadCN Button is visible below the dropzone
    And the button has primary blue styling with white text
    And a progress bar (ShadCN Progress component) shows 0% initially
    And the progress bar has a gray background with blue fill color
    When the user hovers over the "Choose File" button
    Then the button background darkens to (#2563eb) within 150ms
    And the cursor changes to pointer
    When the user clicks the "Choose File" button
    Then a file dialog opens filtered to video files (MP4, MOV, WebM)
    And screen readers announce "Choose video file, button, opens file dialog"

  Scenario: Video Playback Section State Display
    Given the user is on the architecture experiment page
    And no video has been uploaded yet
    When the user views the "Video Playback & Frames" section
    Then a placeholder video area is displayed with 16:9 aspect ratio
    And the placeholder has a dark gray background (#374151) with centered text
    And the text reads "No video uploaded" in white 16px font
    And below the placeholder, a 3x3 grid of frame placeholders is shown
    And each frame placeholder is 120px x 68px with gray background
    And frame placeholders have "Frame 1", "Frame 2", etc. labels
    And the section height adjusts to maintain visual balance
    And keyboard navigation allows focusing on each placeholder frame
    And screen readers announce "Video playback area, no video loaded"

  Scenario: Transcripts Section Dual Layout
    Given the user is on the architecture experiment page
    And the Transcripts section is visible
    When the section renders with no transcript data
    Then the section is divided into two equal vertical columns
    And the left column has header "Full Transcript" in 16px semibold font
    And the right column has header "Segmented Transcript" in 16px semibold font
    And each column has a scrollable text area with light gray background
    And placeholder text in left column reads "Transcript will appear here..."
    And placeholder text in right column reads "Time-stamped segments will appear here..."
    And both text areas have 12px padding and rounded corners
    And scroll bars appear when content exceeds 200px height
    And keyboard navigation allows tabbing between text areas
    And screen readers identify each area with appropriate labels

  Scenario: Processing Status Section with Progress Indicators
    Given the user is viewing the architecture experiment page
    And the Processing Status section is in the bottom-right
    When the section displays initial state
    Then a step indicator shows 4 processing steps vertically aligned
    And steps are labeled: "1. Upload", "2. Extract Frames", "3. Transcribe", "4. Complete"
    And all steps initially show gray circles with step numbers
    And current step indicator shows "Waiting to start..." in italic text
    And a timing display shows "Total Time: 0:00" in monospace font
    And an error log area shows "No errors" in green text
    And a cost tracker displays "$0.00" with breakdown hidden
    When the user clicks on the cost tracker
    Then cost breakdown expands showing individual service costs
    And the breakdown animates open over 200ms with smooth easing
    And screen readers announce cost information when expanded

  Scenario: State Updates and UI Reactivity
    Given the user is on the architecture experiment page
    And the debug panel is visible (Ctrl+D pressed)
    When the user simulates a state change (via browser dev tools)
    And sets uploadProgress to 45
    Then the Upload section progress bar animates to 45% filled
    And the progress bar shows "45%" text overlay in center
    And the debug panel JSON updates to show uploadProgress: 45
    And the update animation completes in 300ms with ease-out timing
    When the processingStep state changes to "extracting"
    Then the Processing Status section highlights step 2 in blue
    And the current step text updates to "Extracting frames..."
    And a pulsing animation appears on the active step indicator
    And screen readers announce "Processing step changed to extracting frames"

  Scenario: Responsive Design and Mobile Interaction
    Given the user accesses "/experiment/architecture-test" on mobile
    And the viewport is 375px wide by 667px tall (iPhone SE)
    When the page loads and renders
    Then all 4 sections stack vertically instead of 2x2 grid
    And each section maintains full width with 16px side margins
    And section cards have 12px vertical spacing between them
    And touch targets (buttons) are minimum 44px tall for accessibility
    And text remains readable without horizontal scrolling
    And the debug panel repositions to bottom of screen when activated
    When the user swipes vertically
    Then smooth scrolling occurs without janky animations
    And section headers remain properly aligned during scroll
    And all interactive elements remain accessible via touch

  Scenario: Error States and Accessibility
    Given the user is on the architecture experiment page
    And a simulated component error occurs in the Upload section
    When the error boundary catches the component error
    Then the Upload section displays a red-bordered error card
    And the error message "Something went wrong in Upload section" appears
    And a "Retry" button is displayed with secondary styling
    And the error is logged to the debug panel with timestamp
    And other sections continue functioning normally
    And the error state is announced to screen readers as "Error in upload section"
    When the user clicks the "Retry" button
    Then the Upload section attempts to re-render
    And a loading spinner appears for 500ms during retry
    And the section either recovers or shows persistent error state
    And screen readers announce the retry attempt and outcome

  Scenario: Keyboard Navigation and Focus Management
    Given the user is on the architecture experiment page
    And has loaded without using mouse or touch
    When the user presses Tab key repeatedly
    Then focus moves through elements in logical order:
    And first focus lands on Upload section "Choose File" button
    And second focus moves to Video section (first frame placeholder)
    And third focus cycles through remaining frame placeholders
    And fourth focus moves to Transcripts section (left text area)
    And fifth focus moves to right text area in Transcripts
    And sixth focus enters Processing Status section elements
    And focus indicators are clearly visible with blue outline (2px)
    And focus never gets trapped in any section
    When the user presses Shift+Tab
    Then focus moves in reverse order through all elements
    And screen readers announce each focused element appropriately