# BDD Scenarios for Mux Migration (New Functionality Only)

## Feature: Mux-Based Frame URL Generation (Replacing Rendi Processing)

### Scenario: API generates Mux frame URLs instead of processing with Rendi FFmpeg
**Given** a video has been uploaded to Vercel Blob storage
**And** the client extracts video duration as 132 seconds using HTML5 video.duration
**When** the frame extraction API receives `{ videoUrl, videoDuration: 132 }`
**Then** the API uploads the video to Mux via `POST /video/v1/uploads` and `PUT {upload_url}`
**And** the API retrieves the Mux playback_id from `GET /assets/{asset_id}`
**And** the API generates 27 frame URLs mathematically (132 ÷ 5 = 26.4, rounded to 27)
**And** each URL follows format: `https://image.mux.com/{playbackId}/frame_00m05s.png?time=5`
**And** frame URLs are returned for timestamps: 0, 5, 10, 15... up to 130 seconds
**And** no FFmpeg commands are submitted or polled (Rendi logic completely removed)
**And** response maintains existing format: `{ frames: [...], frameCount: 27, cost, metadata }`

### Scenario: Dynamic frame count calculation for videos of any length
**Given** the frame extraction API receives different video durations
**When** a 30-second video is processed (videoDuration: 30)
**Then** exactly 6 frame URLs are generated (timestamps: 0, 5, 10, 15, 20, 25)
**When** a 3600-second video is processed (videoDuration: 3600)
**Then** exactly 720 frame URLs are generated (timestamps: 0, 5, 10... 3595)
**When** a 47-second video is processed (videoDuration: 47)
**Then** exactly 10 frame URLs are generated (timestamps: 0, 5, 10... 45)
**And** all frame URLs use consistent naming: frame_XXmYYs.png format
**And** the UI receives complete frame arrays regardless of video length

### Scenario: Client-side video duration extraction replaces server-side detection
**Given** the user has uploaded a video file successfully
**And** the video element loads the uploaded video for playback
**When** the video metadata loads and duration becomes available
**Then** the client extracts the duration using `video.duration` property
**And** the `handleFrameExtraction()` function is called with both videoUrl and extracted duration
**And** the API request payload includes: `{ videoUrl: "blob://...", videoDuration: 132 }`
**And** no server-side duration detection occurs (eliminating this processing step)
**And** frame extraction begins immediately with known duration

### Scenario: Mux authentication replaces Rendi API key authentication  
**Given** the frame extraction API is configured with Mux credentials
**When** the API makes requests to Mux endpoints
**Then** authentication uses Basic auth with `MUX_TOKEN_ID:MUX_TOKEN_SECRET` base64 encoded
**And** the `X-API-KEY` header used for Rendi is no longer sent
**And** Mux API calls include proper `Authorization: Basic {encoded_credentials}` header
**And** no Rendi API endpoints are contacted during the process

### Scenario: Cost calculation updates for Mux vs Rendi pricing
**Given** frame extraction completes using Mux instead of Rendi  
**When** the cost calculation runs
**Then** the Rendi cost calculation logic is removed ($0.30 base + $0.01 per frame)
**And** Mux upload and storage costs are calculated instead
**And** the cost breakdown shows "Mux API: $X.XX" instead of "Rendi API: $X.XX"
**And** total costs reflect Mux pricing structure
**And** no Rendi cost line items appear in the breakdown

### Scenario: Error handling transitions from Rendi polling failures to Mux API failures
**Given** the frame extraction process encounters errors
**When** Mux upload fails (not Rendi command submission)
**Then** error messages reference "Mux upload failed" instead of "Rendi command failed"
**And** no polling timeout errors occur (5-minute polling logic removed)
**And** error recovery attempts Mux upload retry instead of Rendi command resubmission
**And** fallback mock frames are still provided when Mux API is unavailable
**And** error metadata includes Mux-specific error details

### Scenario: Frame URLs point to Mux image service instead of Rendi output files
**Given** frame extraction has completed successfully
**When** the UI receives the frame array from the API
**Then** each frame URL points to `https://image.mux.com/{playbackId}/...`
**And** no URLs point to Rendi storage or output file locations
**And** frame URLs include `?time=N` parameters for Mux thumbnail generation
**And** frames load on-demand when browser requests the Mux URLs
**And** Mux generates thumbnails dynamically rather than pre-processing files

### Scenario: Processing workflow eliminates Rendi polling phase
**Given** frame extraction begins after video upload
**When** the API processes the video through Mux
**Then** the workflow is: Upload to Mux → Get playback_id → Generate URLs → Return response
**And** no command submission and polling phases occur
**And** processing completes faster without 5-second polling intervals
**And** progress updates reflect Mux upload progress rather than FFmpeg processing
**And** the UI transitions directly from "extracting" to "transcribing" without polling delays

This focused test suite covers only the NEW Mux-specific functionality being added, while the existing frame display, UI interactions, upload flow, and error handling behaviors remain unchanged from the current Rendi implementation.