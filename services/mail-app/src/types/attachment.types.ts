export interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: Date;
  user_id : string;
  filepath  : string;
  expires_at : Date;
}

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface StorageConfig {
  supabaseUrl: string;
  supabaseKey: string;
  bucketName: string;
  urlExpiryTime?: number;
}

export interface FileUploadResponse {
  success: boolean;
  filePath?: string;
  url?: string;
  metadata?: FileMetadata;
  error?: string;
}

export interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy?: string;
  storagePath? :  string;
  customMetadata?: Record<string, any>;
  uploadedAt? : string;
}

export interface uploadFileResponse {
  filePath: string;
  signedUrl : string;
}

export interface EmailAttachment {
  filename: string;
  content: string; 
  mimeType: string;
  expires_at  : Date
  file_url : string;
};