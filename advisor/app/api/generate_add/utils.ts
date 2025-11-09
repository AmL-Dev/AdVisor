export interface Veo3Prompt {
  description: string;
  storyStructure?: {
    hook?: string;
    development?: string;
    climax?: string;
    resolution?: string;
  };
  emotionalArc?: string;
  style: string;
  camera: string;
  lenses?: string;
  lighting: string;
  background?: string;
  foreground?: string;
  elements: string[];
  motion: string;
  storyBeats?: Array<{ time: string; event: string }>;
  ending: string;
  text?: string;
  backgroundMusic?: string;
  dialogue?: string[];
  logoIntegration: string;
  productIntegration: string;
  visualMetaphors?: string[];
  keywords: string[];
  aspectRatio: string;
}

