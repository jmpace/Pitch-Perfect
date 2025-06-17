/**
 * Centralized Model Configuration
 * 
 * Single source of truth for Claude model selection across the application.
 * To switch models, only update MODEL_CONFIG.PITCH_ANALYSIS below.
 */

export const MODEL_CONFIG = {
  // Primary model for pitch analysis - change this one line to switch models
  PITCH_ANALYSIS: 'claude-3-5-sonnet-latest',
  
  // Display names for UI components
  DISPLAY_NAMES: {
    'claude-3-5-sonnet-latest': 'Claude 3.5 Sonnet',
    'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
    'claude-4-opus': 'Claude 4 Opus'
  },
  
  // Pricing per 1K tokens for cost calculation
  PRICING: {
    'claude-3-5-sonnet-latest': { input: 0.003, output: 0.015 },
    'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
    'claude-4-opus': { input: 0.015, output: 0.075 }
  }
} as const;

// Type for supported models
export type SupportedModel = keyof typeof MODEL_CONFIG.DISPLAY_NAMES;

// Helper function to get display name for current model
export function getCurrentModelDisplayName(): string {
  return MODEL_CONFIG.DISPLAY_NAMES[MODEL_CONFIG.PITCH_ANALYSIS as SupportedModel] || 'Claude AI';
}

// Helper function to get pricing for current model
export function getCurrentModelPricing() {
  return MODEL_CONFIG.PRICING[MODEL_CONFIG.PITCH_ANALYSIS as SupportedModel] || MODEL_CONFIG.PRICING['claude-3-5-sonnet-latest'];
}