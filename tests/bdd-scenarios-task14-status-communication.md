# BDD Scenarios: Task 14 - Status Communication Migration

## Feature: Replace Error-Based with Status-Based Mux Audio Extraction Communication

**Background**: Replace "fake error" coordination system with explicit status responses. ALL videos require Mux audio extraction regardless of size. The current system throws misleading "Large file detected" errors when the real issue is Mux audio extraction timing.

---

## Scenario 1: Video Upload with Audio Ready Immediately

**Given** the transcription API is migrated to status-based communication  
**And** a video is uploaded that has fast Mux audio extraction  
**When** transcription is attempted and Mux audio is already available  
**Then** the API returns HTTP 200 with successful transcription data  
**And** no status communication responses are triggered  
**And** the processing flow shows "✅ Transcription: Complete"  
**And** no waiting states appear in the UI  

---

## Scenario 2: Video Upload with Audio Extraction in Progress - Status Response (NEW BEHAVIOR)

**Given** the transcription API is migrated to status-based communication  
**And** a video is uploaded that triggers Mux audio extraction delay  
**When** transcription is attempted before Mux audio-only file is ready  
**Then** the API returns HTTP 202 (Accepted) instead of HTTP 500  
**And** the response body contains structured status data:
```json
{
  "success": false,
  "status": "waiting_for_dependency",
  "message": "Audio extraction in progress",
  "dependency": {
    "type": "mux_playback_id",
    "required_for": "audio_file_access",
    "description": "Waiting for Mux to process audio-only static rendition"
  },
  "estimated_wait_seconds": 45,
  "retry_recommended": true,
  "current_step": "audio_extraction_in_progress",
  "progress_percentage": 25
}
```
**And** no Error object is thrown in the server code  
**And** no fake error stack traces appear in server logs  

---

## Scenario 3: Frontend Status Detection - No Error Message Parsing (NEW BEHAVIOR)

**Given** the frontend is migrated to status-based detection  
**And** the transcription API returns HTTP 202 with waiting status  
**When** the frontend processes the API response  
**Then** it detects the 202 status code (not error message parsing)  
**And** it extracts the status field: `"waiting_for_dependency"`  
**And** it sets `transcriptionStage` to `'waiting_for_dependency'`  
**And** it does NOT add an error to the errors array  
**And** it calls `checkProcessingCompletion()` to set up retry logic  
**And** the UI shows "🎵 Audio extraction in progress" (not error banner)  

---

## Scenario 4: Automatic Retry Logic - Simple Status Check (SIMPLIFIED)

**Given** the retry logic is migrated to status-based detection  
**And** `transcriptionStage` is set to `'waiting_for_dependency'`  
**And** frame extraction has completed providing muxPlaybackId  
**When** the retry condition check runs in `checkProcessingCompletion()`  
**Then** it evaluates `prev.transcriptionStage === 'waiting_for_dependency'`  
**And** it does NOT use `.includes('Large file detected')` parsing  
**And** it clears the waiting status: `transcriptionStage: undefined`  
**And** the automatic retry is triggered with `handleTranscription()`  
**And** the retry uses the now-available muxPlaybackId  

---

## Scenario 5: Developer Experience - Clean Error Logs (PRIMARY BENEFIT)

**Given** the status communication migration is complete  
**When** monitoring application logs during video processing with audio extraction delay  
**Then** server logs show INFO level: "Status: waiting_for_dependency"  
**And** API response logs show "HTTP 202 - Audio extraction in progress"  
**And** no fake error stack traces appear in server logs  
**And** no "Error: Large file detected..." messages in logs  
**And** browser console shows structured JSON status response  
**And** Network tab shows 202 response (not 500 Internal Server Error)  

**When** a real transcription error occurs (e.g., invalid audio format)  
**Then** server logs show ERROR level with proper error details  
**And** the error has genuine stack trace and actionable context  
**And** developers can easily distinguish real errors from coordination status  

---

## Scenario 6: Code Maintainability - Eliminated String Parsing (TECHNICAL DEBT REMOVAL)

**Given** the status communication migration is complete  
**When** reviewing the codebase for error handling patterns  
**Then** no code contains `.includes('Large file detected')`  
**And** no code contains `.includes('wait for frame extraction')`  
**And** retry logic uses `transcriptionStage === 'waiting_for_dependency'`  
**And** inter-service communication uses explicit status fields  
**And** new developers can understand the flow without error message parsing  
**And** the coordination logic is self-documenting through status values  

---

## Scenario 7: System Behavior Preservation - Identical Processing Flow

**Given** the status communication migration is complete  
**When** processing any video that requires Mux audio extraction coordination  
**Then** the automatic retry occurs at the same timing as before migration  
**And** the final transcription result is identical to pre-migration behavior  
**And** the total processing time is unchanged  
**And** the parallel processing (frames + transcription) behavior is preserved  
**And** pitch analysis integration continues to work correctly  
**And** all existing functionality remains intact  

---

## Scenario 8: API Contract Evolution - Structured Response Format

**Given** the transcription API response format has been migrated  
**When** the system encounters the audio extraction wait condition  
**Then** the API returns consistent JSON structure (not Error object)  
**And** the HTTP status code is semantically correct (202 not 500)  
**And** the response schema includes all required status fields  
**And** the frontend can reliably parse the status information  
**And** the response format is typed and predictable  
**And** no breaking changes affect existing API behavior for ready audio  

---

## Scenario 9: UI Feedback Improvement - Status Display vs Error Display

**Given** the frontend status handling is migrated  
**And** a video triggers Mux audio extraction delay  
**When** the status response is received and processed  
**Then** the UI shows blue info banner (not red error banner)  
**And** the banner displays "🎵 Audio extraction in progress"  
**And** the banner shows estimated wait time from API response  
**And** no error messages appear in the Processing Status section  
**And** the Debug Panel shows clean 202 status logs  

**When** the audio becomes available and retry succeeds  
**Then** the info banner updates to "✅ Audio ready - processing transcript"  
**And** the banner fades out smoothly after transcription starts  
**And** the normal transcription progress indicators appear  
**And** no error-to-success state transitions occur  

---

## Scenario 10: Rollback Validation - Original System Restoration

**Given** the migration has been implemented and tested  
**When** the changes are rolled back via `git reset --hard HEAD~1`  
**Then** the system reverts to error-based communication  
**And** audio extraction delays trigger fake "Large file detected" errors  
**And** frontend resumes error message parsing with `.includes()` logic  
**And** automatic retry continues to function correctly  
**And** all processing functionality remains intact  
**And** the rollback is seamless with no data loss  

**When** testing the rolled-back system  
**Then** videos trigger the original error messages during coordination  
**And** retry logic works using error message parsing  
**And** the user experience is identical to pre-migration  
**And** all integrations continue to work  

---

## Scenario 11: Multiple Video Processing - Status Isolation

**Given** the status communication system is active  
**And** one video has completed processing successfully  
**When** a second video is uploaded that triggers audio extraction delay  
**Then** the status communication applies only to the new video  
**And** the waiting status is isolated to the current processing session  
**And** previous video results remain accessible and unaffected  
**And** no cross-contamination of status messages occurs  
**And** each video gets its own status communication lifecycle  

---

## Scenario 12: Edge Case - Network Interruption During Status Communication

**Given** a video is in the audio extraction wait state  
**And** the UI shows "Audio extraction in progress" status  
**When** network connectivity is temporarily lost  
**Then** the status remains at the last known state  
**And** no false error messages are generated  
**And** the system gracefully handles the network interruption  

**When** network connectivity is restored  
**Then** the system resumes status checking automatically  
**And** the retry logic continues from the last known state  
**And** the processing completes normally after recovery  

---

## Technical Validation Criteria

### API Response Format:
- ✅ HTTP 202 (Accepted) instead of HTTP 500 (Internal Server Error)
- ✅ Structured JSON status response with consistent schema
- ✅ No Error objects thrown for coordination timing
- ✅ Semantic HTTP status codes for different conditions

### Frontend Logic Simplification:
- ✅ Status code and field detection instead of error message parsing
- ✅ Simple enum checks: `transcriptionStage === 'waiting_for_dependency'`
- ✅ Cleaner state management without fake errors
- ✅ Elimination of fragile string parsing logic

### Developer Experience Improvements:
- ✅ Clean separation between real errors and coordination status
- ✅ Structured logging with appropriate log levels
- ✅ Self-documenting status communication
- ✅ Easier debugging and onboarding for new developers

### System Reliability:
- ✅ Preserved automatic retry functionality and timing
- ✅ Maintained processing performance
- ✅ No regression in existing integrations
- ✅ Universal behavior regardless of video characteristics

### Code Quality Improvements:
- ✅ Removed error message string parsing dependencies
- ✅ Improved separation of concerns
- ✅ More maintainable inter-service communication
- ✅ Cleaner, more predictable codebase structure