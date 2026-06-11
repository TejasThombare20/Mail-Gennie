import React, { useRef, useState } from 'react'
import { Button } from './ui-component/Button';
import { AlertCircle, File, FilePlus, FileText, Image, Loader2, Upload, X } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui-component/Card';
import { Progress } from './ui-component/Progress';
import apiHandler from '../handlers/api-handler';
import { Input } from './ui-component/Input';

type Props = {}

const UploadAttachment = (props: Props) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const getFileIcon = (fileType: string) => {
        if (fileType.startsWith('image/')) return <Image className="h-8 w-8 text-blue-500" />;
        if (fileType === 'application/pdf') return <FileText className="h-8 w-8 text-red-500" />;
        return <File className="h-8 w-8 text-gray-500" />;
      };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
      };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setSelectedFile(e.target.files[0]);
          if (file) {
            if (file.size > 1024 * 1024) { 
              setUploadError("File size must be less than 1MB");
              return;
            }
            setSelectedFile(file);
            setUploadError("");
          }
        }
      };

      const uploadFile = async () => {
        if (!selectedFile) return;
        
        setIsUploading(true);
        setUploadProgress(0);
        setUploadError('');
        
        const formData = new FormData();
        
        try {
          await apiHandler.post('/api/files/upload', formData, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total!);
                console.log(`Upload Progress: ${percentCompleted}%`);
              }
          });
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (error) {
          console.error('Error uploading file:', error);
          setUploadError('Error uploading file. Please try again.');
        } finally {
          setIsUploading(false);
        }
      };

    const handleDragOver = (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
        };

    const handleDrop = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              setSelectedFile(e.dataTransfer.files[0]);
              setUploadError('');
            }
          };
      

  return (
    <div className='w-full space-y-1'>
        <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Attachments</h1>
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2"
        >
          <FilePlus className="h-4 w-4" />
          Upload New
        </Button>
      </div>

      {selectedFile && (
        <Card className="bg-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex justify-between items-center">
              <span>Upload File</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              {getFileIcon(selectedFile.type)}
              <div className="flex-1">
                <div className="font-medium truncate">{selectedFile.name}</div>
                <div className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</div>
              </div>
            </div>
            
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <div className="text-xs text-gray-500 text-right">{uploadProgress}% complete</div>
              </div>
            )}
            
            {uploadError && (
              <div className="mt-2 text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {uploadError}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={uploadFile} 
              disabled={isUploading || !!uploadError}
              className="w-full"
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload File
                </span>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      <Input
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
      />

      {/* Dropzone */}
      {!selectedFile && (
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-10 w-10 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium mb-1">Drop files here or click to upload</h3>
          <p className="text-sm text-gray-500">
            Upload any file type (Max file size: 1 MB)
          </p>
        </div>
      )}

    </div>
  )
}

export default UploadAttachment