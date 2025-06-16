/**
 * Task 13: Aligned Data Structure for Perfect Timestamp Synchronization
 * 
 * This module defines the data structures that pair extracted frames (every 5 seconds) 
 * with corresponding transcript segments (5-second chunks) ensuring perfect timestamp alignment
 * for Claude 4 Opus multimodal analysis.
 */

// Frame data from extract-frames API
export interface TimestampedFrame {
  timestamp: number; // seconds from video start (5, 10, 15, ...)
  url: string; // Mux thumbnail URL or base64 data
  filename: string; // frame_00m05s.png, frame_00m10s.png, etc.
}

// Transcript segment data from transcribe API  
export interface TimestampedTranscriptSegment {
  startTime: number; // seconds from video start (5, 10, 15, ...)
  endTime: number; // startTime + 5
  text: string; // transcript text for this 5-second window
  confidence: number; // confidence score from Whisper
}

// Word-level timestamp data (if available from Whisper)
export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

// Perfect temporal alignment between frame and transcript
export interface AlignedSegment {
  timestamp: number; // 5, 10, 15, etc. - the key alignment point
  frame: TimestampedFrame;
  transcriptSegment: TimestampedTranscriptSegment;
}

// Complete aligned dataset for Claude 4 Opus analysis
export interface AlignedPitchData {
  sessionId: string;
  videoMetadata: {
    duration: number;
    filename: string;
    uploadUrl: string;
    size?: number;
  };
  alignedSegments: AlignedSegment[];
  analysisMetadata: {
    totalFrames: number;
    totalSegments: number;
    alignmentAccuracy: number; // percentage of successfully aligned segments
    processingTime: number;
    costs: {
      frameExtraction: number;
      transcription: number;
      total: number;
    };
  };
}

// Claude 4 Opus API request payload
export interface PitchAnalysisRequest {
  sessionId: string;
  fundingStage?: 'pre-seed' | 'seed' | 'series-a';
  alignedData: AlignedPitchData;
  analysisOptions?: {
    includeConfidenceThreshold?: number; // minimum confidence for transcript segments
    focusAreas?: Array<'visual-verbal-alignment' | 'pacing' | 'content-gaps' | 'competitive-positioning'>;
    outputFormat?: 'detailed' | 'summary';
  };
}

// Individual framework point score (matches existing scoring-framework-3.ts)
export interface FrameworkScore {
  pointId: string;
  score: number; // 1-10
  rationale: string;
  improvementSuggestions: string[];
}

// Timestamped recommendation (matches existing prompt schema)
export interface TimestampedRecommendation {
  id: string;
  timestamp: number; // seconds from video start
  duration: number; // recommended review duration in seconds
  category: 'speech' | 'content' | 'visual' | 'overall';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  specificIssue: string;
  actionableAdvice: string;
  relatedFrameworkScore: string; // framework point ID
}

// Slide analysis for specific frame (matches existing prompt schema)
export interface SlideAnalysis {
  timestamp: number;
  slideImage: string; // frame filename
  contentSummary: string;
  designFeedback: string;
  alignmentWithSpeech: string; // e.g., "MISMATCH: Speaker mentions $34B, slide shows $200B"
  improvementSuggestions: string[];
  score: number; // 1-10
}

// Claude 4 Opus API response (matches existing pitch-analysis-prompt.md schema)
export interface PitchAnalysisResponse {
  sessionId: string;
  fundingStage: 'pre-seed' | 'seed' | 'series-a';
  overallScore: number;
  categoryScores: {
    speech: number;
    content: number;
    visual: number;
    overall: number;
  };
  individualScores: FrameworkScore[];
  timestampedRecommendations: TimestampedRecommendation[];
  slideAnalysis: SlideAnalysis[];
  analysisTimestamp: string;
  processingTime: number;
}

// API response wrapper
export interface PitchAnalysisApiResponse {
  success: boolean;
  data?: PitchAnalysisResponse;
  error?: string;
  metadata: {
    model: 'claude-4-opus';
    inputTokens: number;
    outputTokens: number;
    cost: number;
    processingTime: number;
    alignmentQuality: number; // percentage of segments with perfect alignment
  };
}

// Utility type for alignment validation
export interface AlignmentValidationResult {
  isValid: boolean;
  issues: Array<{
    segmentIndex: number;
    issue: 'missing_frame' | 'missing_transcript' | 'timestamp_mismatch' | 'empty_content';
    description: string;
  }>;
  alignmentAccuracy: number;
  recommendations: string[];
}