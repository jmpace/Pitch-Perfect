# BDD Scenarios: Task 4 - Frame Extraction Integration

## Essential User Experience Scenarios Building on Existing Upload System

### Scenario 1: Automatic Frame Extraction After Upload Completion
**Feature**: Automatic Frame Extraction via Rendi API with Timestamp-Named Files  
**As a** user who has successfully uploaded a video  
**I want** frames to be automatically extracted every 5 seconds with timestamp filenames  
**So that** I can see visual thumbnails without additional manual steps  

**Given** the user has successfully uploaded a 2-minute video using the existing UploadDropzone  
**And** the processing status shows "4. Complete" with green checkmark for upload  
**And** the processingStep state is currently 'complete'  
**And** the videoUrl state contains a valid Vercel Blob URL  
**And** the frame grid shows 9 placeholder boxes with gray background and "Frame" text  

**When** the onUploadComplete callback is triggered with the blob URL  
**Then** the processingStep automatically updates from 'complete' to 'extracting'  
**And** the processing status section shows "2. Extract Frames" with blue pulsing background  
**And** the step indicator for "1. Upload" changes to green checkmark  
**And** all 9 frame placeholders immediately show loading spinners  
**And** each placeholder maintains 120px × 68px dimensions with rotation animation  
**And** the current step text updates to "Extracting frames at 5-second intervals..."  

**When** the Rendi API begins processing the video automatically  
**Then** the system sends FFmpeg command with 120 output files defined as:  
- out_1: "frame_00m05s.png"  
- out_2: "frame_00m10s.png"  
- out_3: "frame_00m15s.png"  
- out_4: "frame_00m20s.png"  
- out_5: "frame_00m25s.png"  
- out_6: "frame_00m30s.png"  
- out_7: "frame_00m35s.png"  
- out_8: "frame_00m40s.png"  
- out_9: "frame_00m45s.png"  
- ... up to out_120: "frame_10m00s.png"  

**And** a progress bar appears below the processing steps showing 0-100%  
**And** the progress updates incrementally every 5-10 seconds  
**And** the cost tracker section updates: "Rendi API: $0.00" → "$1.20"  
**And** the timing display continues from upload time and counts up  
**And** no user interaction is required during this automatic process  

**When** the Rendi API completes frame extraction  
**Then** the processingStep automatically updates from 'extracting' to 'transcribing'  
**And** the "2. Extract Frames" step shows green checkmark with success background  
**And** the extractedFrames state array populates with frame objects containing timestamp filenames:  
```javascript
[
  { url: "https://api.rendi.dev/files/frame_00m05s.png", timestamp: 5, filename: "frame_00m05s.png" },
  { url: "https://api.rendi.dev/files/frame_00m10s.png", timestamp: 10, filename: "frame_00m10s.png" },
  { url: "https://api.rendi.dev/files/frame_00m15s.png", timestamp: 15, filename: "frame_00m15s.png" },
  // ... etc for 9 frames total
]
```
**And** the frame grid displays actual video thumbnails instead of placeholders  
**And** timestamp overlays appear on each frame showing: "0:05", "0:10", "0:15", etc.  
**And** timestamp text has semi-transparent dark background with white text positioned bottom-right  

### Scenario 3: Rendi API Error Handling with Existing Error System
**Given** the user has uploaded a video successfully  
**And** automatic frame extraction has started  
**And** the existing error system is ready to capture frame extraction errors  

**When** the Rendi API request fails due to network timeout after 30 seconds  
**Then** the processingStep remains as 'extracting' (doesn't advance)  
**And** a new error is added to the errors state array with section: 'frames'  
**And** the existing error display shows: "Frame extraction failed - network timeout"  
**And** all frame placeholders change from loading spinners to error icons (⚠)  
**And** each placeholder shows red background (#EF4444) with white warning symbol  
**And** the cost tracker shows partial charge: "Rendi API: $0.35 (partial)"  

**And** the existing retry mechanism becomes available  
**And** a "Retry Frame Extraction" button appears using existing Button component  
**And** the error integrates with the existing getSectionError('frames') function  

**When** the user clicks the retry button  
**Then** the error is cleared from the errors array using existing error handling  
**And** the processingStep remains 'extracting' and frame extraction restarts  
**And** all frame placeholders return to loading spinner state  
**And** the progress bar resets and begins updating again  
**And** new timestamp-named files are requested from Rendi API  

### Scenario 4: Variable Video Length Handling with Timestamp Filenames
**Given** the user uploads a 35-second video using the existing upload system  
**And** the upload completes successfully with Vercel Blob URL  

**When** automatic frame extraction begins  
**Then** the system sends the complete 120-frame FFmpeg command to Rendi API with all timestamp filenames:  
- frame_00m05s.png through frame_10m00s.png (120 total possible outputs)  
**And** the Rendi API automatically stops extraction when video ends at 35 seconds  
**And** only creates files up to frame_00m35s.png (7 files total)  
**And** the processing continues with normal progress indicators  

**When** extraction completes  
**Then** exactly 7 frames are returned by Rendi API with correct timestamp filenames:  
```javascript
[
  { url: "...", timestamp: 5, filename: "frame_00m05s.png" },
  { url: "...", timestamp: 10, filename: "frame_00m10s.png" },
  { url: "...", timestamp: 15, filename: "frame_00m15s.png" },
  { url: "...", timestamp: 20, filename: "frame_00m20s.png" },
  { url: "...", timestamp: 25, filename: "frame_00m25s.png" },
  { url: "...", timestamp: 30, filename: "frame_00m30s.png" },
  { url: "...", timestamp: 35, filename: "frame_00m35s.png" }
]
```
**And** the extractedFrames state contains exactly 7 frame objects  
**And** only 7 positions in the frame grid show actual thumbnails  
**And** the remaining 2 positions (8 and 9) remain as empty/hidden placeholders  
**And** the grid layout adapts gracefully with proper spacing  

### Scenario 6: Integration with Existing Debug Panel
**Given** the debug panel is accessible via Ctrl+D (existing functionality)  
**And** frame extraction has completed successfully  

**When** the user opens the debug panel  
**Then** the extractedFrames array is visible in the state display  
**And** each frame object shows complete data with timestamp filename:  
```json
{
  "url": "https://api.rendi.dev/files/frame_00m15s.png",
  "timestamp": 15,
  "filename": "frame_00m15s.png"
}
```
**And** the processingStep shows current value ('transcribing' after frames complete)  
**And** the errors array shows any frame-related errors that occurred  
**And** the debug panel updates in real-time as frame extraction progresses  

### Scenario 7: Cost Tracking Integration with Existing System
**Given** the existing cost tracking system is displaying current session costs  
**And** the cost breakdown shows: "Vercel Blob: $0.02, Rendi API: $0.00, OpenAI Whisper: $0.00"  

**When** frame extraction begins automatically  
**Then** the cost tracker updates in real-time during processing  
**And** Rendi API costs increment: "$0.00" → "$0.30" → "$0.65" → "$1.20"  
**And** the total session cost updates accordingly  
**And** the existing cost display formatting and styling is maintained  

**When** extraction completes  
**Then** final costs are displayed with the existing completion styling  
**And** the cost breakdown shows accurate Rendi API charges  
**And** comparison to current system cost ($4.00+) uses existing comparison logic  

### Scenario 8: Performance Integration with Existing Timing System
**Given** the existing timing system tracks processing duration  
**And** upload timing has been recorded in the timings state object  

**When** frame extraction begins  
**Then** a new timing entry starts: timings.frameExtraction = startTime  
**And** the existing elapsed time display continues counting from upload completion  
**And** no separate timing display is needed (uses existing system)  

**When** extraction completes  
**Then** the timing entry finalizes: timings.frameExtraction = totalDuration  
**And** the main timing display shows total processing time including upload + extraction  
**And** individual step timings are available in the debug panel  

### Scenario 9: State Management Integration with Existing ExperimentState
**Given** the existing ExperimentState interface includes extractedFrames: ExtractedFrame[]  
**And** the setState function is already managing all experiment state  

**When** frame extraction progresses  
**Then** only the relevant state properties update:  
- processingStep: 'extracting'  
- extractedFrames: [...new frames with timestamp filenames]  
- errors: [...existing errors, new frame errors if any]  
- timings: {...existing timings, frameExtraction: duration}  

**And** all other state properties remain unchanged  
**And** React re-renders are triggered only for components that use changed state  
**And** the existing state exposure to window.experimentState includes frame data  

### Scenario 10: Long Video Filename Handling (8+ minutes)
**Given** the user uploads an 8-minute video  
**And** the upload completes successfully  

**When** frame extraction processes automatically  
**Then** the Rendi API creates 96 frames with timestamp filenames:  
- frame_00m05s.png (5 seconds)  
- frame_00m10s.png (10 seconds)  
- ...  
- frame_07m55s.png (7 minutes 55 seconds)  
- frame_08m00s.png (8 minutes exactly)  

**And** the extractedFrames state contains all 96 frame objects  
**And** each frame object includes the correct timestamp filename  
**And** the frame grid displays only the first 9 frames (0:05 through 0:45)  
**And** all 96 frames are available in the debug panel for verification  

### Success Criteria for Task 4 Integration
- ✅ Frame extraction starts automatically when upload completes (no manual trigger)  
- ✅ Rendi API receives FFmpeg command with 120 timestamp-named output files  
- ✅ Files are created with correct naming: frame_00m05s.png, frame_00m10s.png, etc.  
- ✅ ExtractedFrame objects include timestamp filenames in filename property  
- ✅ Variable video lengths work correctly (Rendi stops at video end)  
- ✅ Frame grid populates with actual thumbnails and timestamp overlays  
- ✅ Error handling integrates with existing error system  
- ✅ Cost tracking updates existing cost display  
- ✅ Debug panel shows frame data with correct filenames  
- ✅ State management uses existing ExperimentState structure  
- ✅ Processing steps advance correctly: uploading → extracting → transcribing