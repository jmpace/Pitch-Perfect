/**
 * Task 6 Integration Tests: API Endpoints
 * 
 * Tests the API endpoints and their integration with external services
 * for the Whisper transcription feature with parallel processing.
 * 
 * Focus areas:
 * - API route functionality and error handling
 * - Integration with OpenAI Whisper API
 * - Two-stage transcription pipeline (Whisper + Segmentation)
 * - Cost calculation and timing measurement
 */

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST, GET } from '../../src/app/api/experiment/transcribe/route';

// Mock the OpenAI client
vi.mock('@ai-sdk/openai', () => ({
  openai: {
    audio: {
      transcriptions: {
        create: vi.fn()
      }
    }
  }
}));

// Mock fetch for video URL requests
global.fetch = vi.fn();

describe('Task 6: API Endpoints Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  describe('/api/experiment/transcribe POST endpoint', () => {
    
    it('should handle Whisper stage transcription successfully', async () => {
      const mockWhisperResponse = {
        text: 'Hello everyone, welcome to our presentation today.',
        language: 'en',
        duration: 120,
        words: [
          { word: 'Hello', start: 0.0, end: 0.5 },
          { word: 'everyone', start: 0.5, end: 1.0 }
        ],
        segments: [
          { id: 1, start: 0.0, end: 5.0, text: 'Hello everyone, welcome to our presentation.' }
        ]
      };

      // Mock OpenAI API response
      const { openai } = await import('@ai-sdk/openai');
      (openai.audio.transcriptions.create as MockedFunction<any>).mockResolvedValue(mockWhisperResponse);

      // Mock video fetch
      (global.fetch as MockedFunction<any>).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      });

      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'blob:test-video-url',
          videoDuration: 120,
          stage: 'whisper'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.stage).toBe('whisper_complete');
      expect(data.fullTranscript).toBe(mockWhisperResponse.text);
      expect(data.whisperData.language).toBe('en');
      expect(data.metadata.cost).toBeGreaterThan(0);
      expect(data.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should handle segmentation stage processing successfully', async () => {
      const fullTranscript = 'Hello everyone, welcome to our presentation today. We will be discussing various topics including AI and machine learning.';
      
      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'blob:test-video-url',
          videoDuration: 120,
          stage: 'segmentation',
          fullTranscript
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.stage).toBe('segmentation_complete');
      expect(data.segmentedTranscript).toBeInstanceOf(Array);
      expect(data.segmentedTranscript.length).toBeGreaterThan(0);
      
      // Verify 5-second segment alignment
      data.segmentedTranscript.forEach((segment: any, index: number) => {
        expect(segment.startTime).toBe(index * 5);
        expect(segment.endTime).toBe(Math.min((index + 1) * 5, 120));
        expect(segment.confidence).toBeGreaterThan(0.8);
        expect(segment.text).toBeTruthy();
      });
    });

    it('should handle missing video URL with proper error', async () => {
      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          stage: 'whisper'
          // Missing videoUrl
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Video URL is required');
    });

    it('should handle missing OpenAI API key', async () => {
      delete process.env.OPENAI_API_KEY;

      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'blob:test-video-url',
          stage: 'whisper'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('OpenAI API key not configured');
    });

    it('should handle OpenAI API rate limiting gracefully', async () => {
      const { openai } = await import('@ai-sdk/openai');
      (openai.audio.transcriptions.create as MockedFunction<any>).mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      // Mock video fetch
      (global.fetch as MockedFunction<any>).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      });

      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'blob:test-video-url',
          videoDuration: 60,
          stage: 'whisper'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error during transcription');
      expect(data.details).toContain('Rate limit exceeded');
    });

    it('should provide mock response when video fetch fails', async () => {
      const { openai } = await import('@ai-sdk/openai');
      (openai.audio.transcriptions.create as MockedFunction<any>).mockRejectedValue(
        new Error('Failed to fetch video')
      );

      // Mock failed video fetch
      (global.fetch as MockedFunction<any>).mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'blob:test-video-url',
          videoDuration: 120,
          stage: 'whisper'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.fullTranscript).toBeTruthy();
      expect(data.metadata.transcriptionMethod).toBe('mock_whisper_for_development');
    });

    it('should calculate costs accurately for different video durations', async () => {
      const testCases = [
        { duration: 30, expectedCost: 0.00 }, // Less than 1 minute
        { duration: 60, expectedCost: 0.01 }, // Exactly 1 minute
        { duration: 120, expectedCost: 0.01 }, // 2 minutes
        { duration: 300, expectedCost: 0.03 } // 5 minutes
      ];

      for (const testCase of testCases) {
        const { openai } = await import('@ai-sdk/openai');
        (openai.audio.transcriptions.create as MockedFunction<any>).mockResolvedValue({
          text: 'Test transcript',
          language: 'en',
          duration: testCase.duration,
          words: [],
          segments: []
        });

        (global.fetch as MockedFunction<any>).mockResolvedValue({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
        });

        const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
          method: 'POST',
          body: JSON.stringify({
            videoUrl: 'blob:test-video-url',
            videoDuration: testCase.duration,
            stage: 'whisper'
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.metadata.cost).toBe(testCase.expectedCost);
      }
    });

    it('should handle invalid stage parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'blob:test-video-url',
          stage: 'invalid-stage'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid stage parameter');
    });

    it('should process large transcripts into appropriate segments', async () => {
      const largeTranscript = Array.from({ length: 1000 }, (_, i) => `Word${i}`).join(' ');
      const videoDuration = 600; // 10 minutes

      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'blob:test-video-url',
          videoDuration,
          stage: 'segmentation',
          fullTranscript: largeTranscript
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.segmentedTranscript).toBeInstanceOf(Array);
      expect(data.segmentedTranscript.length).toBe(120); // 600 seconds / 5 seconds per segment
      
      // Verify segments don't exceed video duration
      const lastSegment = data.segmentedTranscript[data.segmentedTranscript.length - 1];
      expect(lastSegment.endTime).toBeLessThanOrEqual(videoDuration);
    });
  });

  describe('/api/experiment/transcribe GET endpoint', () => {
    
    it('should return health check information', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Whisper transcription API is ready');
      expect(data.endpoint).toBe('/api/experiment/transcribe');
      expect(data.method).toBe('POST');
      expect(data.stages).toEqual(['whisper', 'segmentation']);
      expect(data.requiredFields).toEqual(['videoUrl', 'videoDuration']);
      expect(data.environmentCheck.openaiApiKey).toBe(true);
    });

    it('should show environment check failure when API key missing', async () => {
      delete process.env.OPENAI_API_KEY;

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environmentCheck.openaiApiKey).toBe(false);
    });
  });

  describe('Cost calculation integration', () => {
    
    it('should provide accurate cost estimates for different scenarios', async () => {
      const scenarios = [
        { duration: 30, description: '30-second video' },
        { duration: 180, description: '3-minute video' },
        { duration: 600, description: '10-minute video' }
      ];

      for (const scenario of scenarios) {
        const { openai } = await import('@ai-sdk/openai');
        (openai.audio.transcriptions.create as MockedFunction<any>).mockResolvedValue({
          text: 'Sample transcript',
          language: 'en',
          duration: scenario.duration,
          words: [],
          segments: []
        });

        (global.fetch as MockedFunction<any>).mockResolvedValue({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
        });

        const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
          method: 'POST',
          body: JSON.stringify({
            videoUrl: 'blob:test-video-url',
            videoDuration: scenario.duration,
            stage: 'whisper'
          })
        });

        const response = await POST(request);
        const data = await response.json();

        const expectedCost = Math.round((scenario.duration / 60) * 0.006 * 100) / 100;
        expect(data.metadata.cost).toBe(expectedCost);
      }
    });
  });

  describe('Error handling and resilience', () => {
    
    it('should handle network timeouts gracefully', async () => {
      const { openai } = await import('@ai-sdk/openai');
      (openai.audio.transcriptions.create as MockedFunction<any>).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      (global.fetch as MockedFunction<any>).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      });

      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'blob:test-video-url',
          videoDuration: 60,
          stage: 'whisper'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error during transcription');
    });

    it('should handle malformed request bodies', async () => {
      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error during transcription');
    });

    it('should handle segmentation processing failures', async () => {
      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'blob:test-video-url',
          videoDuration: null, // Invalid duration
          stage: 'segmentation',
          fullTranscript: 'Test transcript'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error during transcription');
    });
  });

  describe('Performance and timing', () => {
    
    it('should track processing times accurately', async () => {
      const { openai } = await import('@ai-sdk/openai');
      
      // Mock a delayed response
      (openai.audio.transcriptions.create as MockedFunction<any>).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          text: 'Test transcript',
          language: 'en',
          duration: 60,
          words: [],
          segments: []
        }), 500))
      );

      (global.fetch as MockedFunction<any>).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      });

      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/experiment/transcribe', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'blob:test-video-url',
          videoDuration: 60,
          stage: 'whisper'
        })
      });

      const response = await POST(request);
      const data = await response.json();
      const totalTime = Date.now() - startTime;

      expect(data.metadata.processingTime).toBeGreaterThan(400);
      expect(data.metadata.processingTime).toBeLessThan(totalTime + 100);
    });

    it('should handle concurrent requests without conflicts', async () => {
      const { openai } = await import('@ai-sdk/openai');
      (openai.audio.transcriptions.create as MockedFunction<any>).mockResolvedValue({
        text: 'Concurrent test transcript',
        language: 'en',
        duration: 30,
        words: [],
        segments: []
      });

      (global.fetch as MockedFunction<any>).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      });

      const requests = Array.from({ length: 3 }, (_, i) => 
        new NextRequest('http://localhost:3000/api/experiment/transcribe', {
          method: 'POST',
          body: JSON.stringify({
            videoUrl: `blob:test-video-url-${i}`,
            videoDuration: 30,
            stage: 'whisper'
          })
        })
      );

      const responses = await Promise.all(requests.map(req => POST(req)));
      const dataResults = await Promise.all(responses.map(res => res.json()));

      dataResults.forEach((data, index) => {
        expect(data.success).toBe(true);
        expect(data.fullTranscript).toBe('Concurrent test transcript');
      });
    });
  });
});