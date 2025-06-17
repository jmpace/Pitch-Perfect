# BDD Scenarios: Task 6 - Whisper Transcription with Parallel Processing

## Overview

These scenarios test the implementation of OpenAI Whisper transcription integration with parallel processing architecture. The system processes frame extraction and transcription simultaneously, with transcription involving a two-stage pipeline (Whisper API + Python segmentation).

## Core Requirements Tested

- Parallel processing of frame extraction and transcription
- Two-stage transcription pipeline (Whisper API → Python segmentation)
- 5-second segment alignment with extracted frames
- Complete UI feedback for parallel operations
- Error handling for partial failures
- Cost tracking for Whisper API usage

---

## Scenario 1: Simultaneous Frame Extraction and Transcription Initiation

**Given** the user has successfully uploaded a video file
- The upload section displays "Upload complete" with a green checkmark icon
- The video player shows the uploaded video with standard HTML5 controls enabled
- The processing status panel displays "Upload complete - Starting processing..." in blue text
- The transcript sections show placeholder text "Transcript will appear here..." in light gray
- The frame grid displays 9 empty placeholder boxes with dashed borders
- The cost breakdown shows "OpenAI Whisper: $0.00" and "Mux API: $0.00" in the debug panel

**When** the upload completes and triggers parallel processing
**Then** both frame extraction and transcription start simultaneously within 300ms
- The processing status updates to "Processing video..." with a dual-section progress area
- Frame extraction progress bar appears labeled "Extracting frames: 0%" with blue fill color
- Transcription progress bar appears below it labeled "Transcribing audio: 0%" with green fill color
- Both transcript sections transition to loading skeleton components with subtle pulsing animation
- The frame grid displays loading placeholders with spinning gray icons in each of the 9 cells
- A combined estimated time appears: "Estimated time: 45 seconds"

**And** the UI clearly indicates parallel operations are running
- The progress section shows both operations side-by-side with individual percentages
- Each progress bar has its own colored indicator and status text
- The overall processing step indicator remains at "processing" until both complete
- A small parallel processing icon (⫸) appears next to the main status

**And** keyboard users can tab through all active progress indicators
- Tab navigation cycles through both progress sections
- Each progress bar receives focus with a visible blue outline
- Screen readers announce "Starting frame extraction and transcription simultaneously"
- Focus indicators remain visible and properly contrasted

---

## Scenario 2: Whisper Transcription Completes and Begins Segmentation Processing

**Given** both parallel processes are running with different completion rates
- Frame extraction shows "Extracting frames: 45%" with blue progress bar partially filled
- Transcription shows "Transcribing audio: 85%" with green progress bar nearly complete
- Time estimates show "Frame extraction: ~30s remaining, Transcription: ~8s remaining"
- The overall status displays "Processing video... (2 operations in progress)"
- Loading skeletons continue pulsing in both transcript sections

**When** the Whisper API returns successful transcription results
**Then** the transcription immediately begins segmentation processing
- The Whisper progress bar fills to 100% briefly, then transforms into segmentation progress
- The transcription status updates to "Processing segments: 0%" with a sub-progress bar
- A secondary status line appears: "Converting to 5-second segments..." in smaller italic text
- The full transcript section immediately populates with raw Whisper output text
- The segmented transcript section maintains loading skeleton for 5-second segments processing

**And** frame extraction continues independently
- Frame extraction progress continues showing current percentage unchanged
- Frame grid still displays loading placeholders with spinning icons
- The overall processing status updates to "Processing video... (2 operations in progress)"
- Time estimates recalculate: "Frame extraction: ~30s, Segmentation: ~5s"

**And** partial transcription results become immediately available
- Full transcript displays complete Whisper text with proper paragraph breaks
- Text is fully selectable and copyable with standard browser selection behavior
- Scrollbar appears on the right side if content exceeds container height
- Cost breakdown updates to show "OpenAI Whisper: $0.03" replacing the $0.00 placeholder

**And** accessibility features work with partial completion
- Screen readers announce "Transcription received, processing 5-second segments"
- Full transcript content is accessible to screen reader navigation
- Focus can move to the full transcript area for reading
- Loading state for segmented transcript is announced as "Processing segments"

---

## Scenario 3: Segmentation Processing Completes Successfully

**Given** Whisper transcription is complete and 5-second segmentation is processing
- Full transcript section shows complete Whisper output with readable formatting
- Segmentation progress shows "Processing segments: 60%" with animated progress bar
- Sub-status displays "Converting Whisper segments to 5-second intervals..."
- Frame extraction continues running independently at 70% completion
- Python script is processing the Whisper JSON output in the background

**When** the Python segmentation script completes successfully
**Then** the segmented transcript section populates with 5-second aligned segments
- Segmentation progress bar fills to 100% with a green checkmark icon appearing
- The transcription status updates to "Transcription complete!" in green text
- Loading skeleton fades out over 200ms revealing the segmented content
- Segmented transcript displays time-aligned blocks: "[00:00-00:05] Hello everyone, welcome to our presentation...", "[00:05-00:10] Today we'll be discussing..."
- Each 5-second segment appears as a distinct block with clear visual separation
- Segment timestamps use consistent formatting and align with frame extraction intervals

**And** both transcript sections are now fully populated and functional
- Full transcript shows complete raw Whisper text with proper formatting
- Segmented transcript shows all processed 5-second aligned segments
- Both sections have independent scrollbars if content exceeds container height
- Text in both sections is selectable, copyable, and searchable with Ctrl+F
- Visual hierarchy clearly distinguishes between full and segmented content

**And** the processing status reflects partial completion appropriately
- Overall status updates to "Processing video... (1 operation remaining)"
- Only frame extraction progress continues to display and animate
- Transcription section shows completed checkmark status with green background
- Time estimate updates to show only remaining frame extraction time

**And** accessibility features work with completed transcription
- Screen readers announce "5-second segmentation complete"
- Both transcript sections are fully navigable with screen reader commands
- Segment boundaries are announced clearly when navigating segmented transcript
- Keyboard users can tab between full and segmented transcript areas

---

## Scenario 4: Frame Extraction Completes After Transcription

**Given** transcription and segmentation are complete while frame extraction continues
- Full transcript displays complete Whisper text with proper formatting
- Segmented transcript shows all 5-second aligned segments with clear boundaries
- Frame extraction shows "Extracting frames: 92%" with 5 seconds remaining
- Transcription sections display completed status with green checkmarks
- Cost breakdown shows updated Whisper cost and pending Mux cost

**When** frame extraction completes successfully
**Then** the entire processing section updates to completion state
- Frame extraction progress bar fills to 100% with a green checkmark icon
- Overall processing status changes to "Processing complete!" with celebration animation
- All 9 frame grid cells populate with extracted frame images within 500ms
- Timestamp overlays appear on each frame matching segment intervals (00:05, 00:10, 00:15, etc.)
- Cost breakdown shows final totals: "OpenAI Whisper: $0.03" and "Mux API: $1.25"
- Total cost calculation appears: "Total: $1.28"

**And** the alignment between frames and segments is visually clear
- Frame timestamps (00:05, 00:10, 00:15...) perfectly align with segment boundaries
- Both frame grid and segmented transcript use consistent 5-second intervals
- Visual correspondence between frames and text segments is immediately apparent
- Hover effects work on frame thumbnails showing enlarged previews

**And** all content sections are fully interactive and accessible
- Frame grid thumbnails are clearly visible with proper aspect ratios
- Both transcript sections are scrollable with smooth scrolling behavior
- Video player maintains all standard controls and functionality
- All interactive elements have proper focus indicators and keyboard accessibility

**And** completion state is properly announced
- Screen readers announce "Video processing completed successfully"
- Visual completion indicators (checkmarks, green status) have sufficient color contrast
- Success state is maintained until user starts a new upload
- Debug panel shows comprehensive timing and cost information

---

## Scenario 5: Segmentation Processing Failure with Recovery

**Given** Whisper transcription completed successfully but segmentation encounters an error
- Full transcript displays complete Whisper output correctly and remains functional
- Segmentation processing was at 40% when Python script encountered an error
- Frame extraction continues normally at 65% completion
- Error log shows "Python segmentation script failed: JSON parsing error"

**When** the Python segmentation script fails
**Then** the segmented transcript section shows appropriate error handling
- Segmentation progress bar immediately changes to red color with warning icon (⚠️)
- Status text updates to "Segmentation failed - Retrying..." in red text
- Loading skeleton is replaced with error message: "Failed to process 5-second segments. Retrying automatically..."
- A manual "Retry Segmentation" button appears with red outline styling
- Countdown timer displays: "Automatic retry in 3... 2... 1..." with decreasing numbers
- Full transcript section remains completely unaffected and fully functional

**And** automatic retry mechanism activates after countdown
- After 3-second countdown, segmentation processing automatically restarts
- Progress bar returns to blue color and resets to 0% with pulsing animation
- Error state clears and normal processing states return
- Sub-status shows "Re-processing segments... Attempt 2 of 3" to indicate retry attempt
- Retry counter is visible and updates with each attempt

**And** partial functionality remains available during retry
- Full transcript continues to work normally with all text accessible
- Users can still read, select, and copy the complete Whisper transcription
- Frame extraction proceeds completely unaffected by transcription errors
- Cost tracking shows completed Whisper cost while segmentation retries

**And** accessibility handles segmentation failure appropriately
- Screen readers immediately announce "Segmentation failed, full transcript available"
- Error messages have sufficient color contrast (4.5:1 minimum ratio)
- Retry buttons are keyboard accessible with Enter and Space key activation
- Error state changes are announced without being overly verbose
- Focus management remains stable during error and retry states

---

## Scenario 6: Network Recovery During Two-Stage Transcription Pipeline

**Given** both Whisper API call and frame extraction are affected by network connectivity issues
- Whisper API call was at 70% progress when network connection dropped
- Frame extraction also shows connection errors with spinning retry indicators
- Both operations display "Connection lost - Retrying..." with orange warning status
- Network connectivity indicator shows "Offline" in the browser or system tray

**When** network connection is restored after 10 seconds
**Then** both processes resume appropriately based on their current state
- Network connectivity indicator changes to "Online" 
- Whisper API call restarts from the beginning (API calls cannot resume mid-stream)
- Frame extraction attempts to resume from last successful checkpoint
- Progress indicators update within 2 seconds to show restarted or resumed states
- Status messages change to "Connection restored - Resuming..." with blue informational styling

**And** the two-stage transcription process handles recovery gracefully
- Since Whisper failed, both Whisper API and segmentation will need to run
- Progress indicators clearly show "Restarting Whisper transcription..." 
- Time estimates recalculate based on full restart requirements
- No partial Whisper data is retained from the failed attempt
- Full transcript section returns to loading skeleton state

**And** recovery feedback is clear and comprehensive
- Brief "Connection restored" toast notification appears for 3 seconds
- Progress percentages reset appropriately where restart is necessary
- Time estimates recalculate and display updated completion times
- Visual indicators distinguish between resumed vs restarted operations

**And** accessibility announces recovery status clearly and appropriately
- Screen readers announce "Connection restored, restarting transcription"
- Recovery announcements are made without interrupting ongoing screen reader activity
- Clear distinction in announcements between operations that resumed vs restarted
- Focus management remains stable during network recovery process

---

## Scenario 7: Large File Processing with Extended Segmentation

**Given** the user has uploaded a 95MB, 8-minute video file
- File size is prominently displayed as "95.2 MB" in the upload section
- Frame extraction will generate approximately 96 frames (every 5 seconds)
- Transcription will create approximately 96 corresponding 5-second segments
- Initial cost estimates show projected costs based on file size and duration

**When** parallel processing begins for the large file
**Then** the UI provides detailed progress feedback for extended processing times
- Whisper progress shows percentage with time estimates: "Transcribing: 35% (Est. 2m 15s remaining)"
- Frame progress shows: "Extracting frames: 42% (Est. 1m 30s remaining)"
- Processing status shows current operations: "Processing large file - 2 operations running"
- Segmentation phase will show: "Processing 96 segments..." when it begins
- Loading animations continue smoothly throughout extended processing

**And** segmentation processing handles the larger dataset efficiently
- When segmentation begins, progress updates show: "Processing segments: 15% (23 of 96 complete)"
- Segmentation progress updates incrementally as Python script processes chunks
- Memory usage indicators remain stable during large file processing
- Processing doesn't block the UI thread or cause browser performance issues

**And** the final output properly aligns with frame extraction results
- All 96 5-second segments align perfectly with 96 extracted frames
- Timestamp alignment is maintained throughout: segment [07:35-07:40] matches frame at 07:40
- Both frame grid and segmented transcript show consistent 5-second intervals
- Visual correspondence is clear even with the large number of segments

**And** accessibility features handle extended processing appropriately
- Screen readers provide periodic progress updates every 30 seconds for long operations
- Progress indicators remain responsive and don't appear frozen during intensive processing
- Focus management stays stable throughout extended processing periods
- High contrast mode affects all progress indicators and status text appropriately
- Users can navigate away and return without losing progress state

---

## Error Handling Coverage

### Partial Failure Scenarios Tested:
- ✅ Transcription fails, frames succeed
- ✅ Segmentation fails, Whisper and frames succeed
- ✅ Network interruption during processing
- ✅ Recovery from various failure states

### Success State Scenarios Tested:
- ✅ Both processes complete simultaneously
- ✅ Transcription completes first
- ✅ Frame extraction completes first
- ✅ Large file processing

### Accessibility Features Validated:
- ✅ Screen reader announcements for all state changes
- ✅ Keyboard navigation through all interactive elements
- ✅ Color contrast compliance for all status indicators
- ✅ Focus management during dynamic state changes