// Workflow Builder Types for Voice Call Center Chatbot Configuration

export type NodeType = 'ai-model' | 'rag-documents' | 'google-sheets' | 'voice-input' | 'voice-output' | 'text-input' | 'text-output' | 'if-condition';

export interface Position {
  x: number;
  y: number;
}

export interface NodePort {
  id: string;
  type: 'input' | 'output';
  position?: 'left' | 'right' | 'top' | 'bottom'; // Position on the node
  label: string;
}

// Base node interface
export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: Position;
  data: NodeData;
  inputs: NodePort[];
  outputs: NodePort[];
}

// Node-specific data types
export interface AIModelData {
  modelName: string;
  provider: 'openai' | 'anthropic' | 'google' | 'custom';
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  apiKeyConfigured: boolean;
}

export interface RAGDocumentData {
  documents: UploadedDocument[];
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
}

export interface UploadedDocument {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt';
  size: number;
  uploadedAt: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
}

export interface GoogleSheetsData {
  spreadsheetId: string;
  sheetName: string;
  range: string;
  credentials: boolean;
  syncMode: 'read' | 'write' | 'both';
  lastSynced?: string;
}

export interface VoiceInputData {
  language: string;
  sampleRate: number;
  vadEnabled: boolean;
}

export interface VoiceOutputData {
  voice: string;
  speed: number;
  pitch: number;
}

export interface TextInputData {
  placeholder?: string;
  allowMultiline: boolean;
  maxLength?: number;
}

export interface TextOutputData {
  format: 'plain' | 'ssml';
  truncateLength?: number;
}

export interface IfConditionData {
  conditionType: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex' | 'custom';
  conditionValue: string;
  caseSensitive: boolean;
  customExpression?: string;
}

export type NodeData = 
  | AIModelData 
  | RAGDocumentData 
  | GoogleSheetsData 
  | VoiceInputData 
  | VoiceOutputData
  | TextInputData
  | TextOutputData
  | IfConditionData;

// Connection between nodes
export interface Connection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

// Full workflow state
export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  createdAt: string;
  updatedAt: string;
}

// Node templates for the sidebar
export interface NodeTemplate {
  type: NodeType;
  label: string;
  description: string;
  icon: string;
  category: 'input' | 'processing' | 'output' | 'data';
  defaultData: NodeData;
  defaultInputs: NodePort[];
  defaultOutputs: NodePort[];
}

// Mock API response types
export interface SaveWorkflowResponse {
  success: boolean;
  workflowId: string;
  message: string;
}

export interface UploadDocumentResponse {
  success: boolean;
  document: UploadedDocument;
  message: string;
}
