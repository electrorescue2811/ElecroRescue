
export interface PCBComponent {
  name: string;
  type: string;
  function: string;
  isCritical: boolean;
}

export interface DamageAssessment {
  detected: boolean;
  visibleFaults: string[];
  conditionGrade: 'A' | 'B' | 'C' | 'D';
  conditionDescription: string;
}

export interface CostAnalysis {
  componentValueRange: string;
  manufacturingComplexity: string;
  conditionDepreciation: string;
}

export interface FinalValuation {
  asIsValue: string;
}

export interface AnalysisResult {
  summary: string[];
  components: PCBComponent[];
  pcbCategory: string;
  damageAssessment: DamageAssessment;
  costAnalysis: CostAnalysis;
  finalValuation: FinalValuation;
  technicalInsights: string;
  suggestions: string[];
}

export interface AnalysisState {
  isLoading: boolean;
  result: AnalysisResult | null;
  error: string | null;
  imagePreview: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface ProjectIdea {
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  missingComponents: string[];
  steps?: string[]; // Optional because recommendations might not have steps initially
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  type: 'analysis' | 'project'; // Discriminator
  
  // Analysis Fields
  result?: AnalysisResult;
  imageData?: string; // Base64 data URI

  // Project Fields
  project?: ProjectIdea;
  projectSource?: 'inventory' | 'recommended';
}

export interface ProjectHistoryItem {
  id: string;
  timestamp: number;
  sourceType: 'inventory' | 'recommended';
  componentsInput: string;
  project: ProjectIdea; // Stores the specific project selected
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  password?: string; // Simulated auth
  loginKey?: string; // Admin Quick Login Key
  age?: string;
  university?: string;
  domain?: string;
  bio?: string;
  verified?: boolean;
  technicalInterests?: string[];
  usageContext?: string;
  engineeringSummary?: string;
}

export interface MarketplaceItem {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  price: string;
  condition: string;
  contactInfo: string;
  timestamp: number;
  imageUrl?: string;
  status?: 'pending' | 'approved'; // Status for admin control
  stock?: number; // Inventory quantity
}

export interface HelpRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: 'general' | 'admin';
  timestamp: number;
  status: 'pending' | 'resolved';
  queryText?: string;
  responseText?: string;
}
