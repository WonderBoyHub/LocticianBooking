import React, { useCallback, useState, useRef, DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  X,
  File,
  Image,
  FileText,
  Music,
  Video,
  Archive,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  progress?: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  url?: string;
}

export interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
  onFilesSelected?: (files: File[]) => void;
  onFileRemove?: (fileId: string) => void;
  onUploadProgress?: (fileId: string, progress: number) => void;
  onUploadComplete?: (fileId: string, url: string) => void;
  onUploadError?: (fileId: string, error: string) => void;
  uploadFunction?: (file: File, onProgress: (progress: number) => void) => Promise<string>;
  showPreview?: boolean;
  allowedTypes?: string[];
  dropzoneText?: string;
  browseText?: string;
  error?: string;
  label?: string;
  required?: boolean;
  hint?: string;
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return <Image className="w-8 h-8" />;
  if (fileType.startsWith('video/')) return <Video className="w-8 h-8" />;
  if (fileType.startsWith('audio/')) return <Music className="w-8 h-8" />;
  if (fileType.includes('pdf') || fileType.includes('document')) return <FileText className="w-8 h-8" />;
  if (fileType.includes('zip') || fileType.includes('rar')) return <Archive className="w-8 h-8" />;
  return <File className="w-8 h-8" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const createFilePreview = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    } else {
      resolve(null);
    }
  });
};

const FilePreview: React.FC<{
  uploadedFile: UploadedFile;
  onRemove: (fileId: string) => void;
  showPreview: boolean;
}> = ({ uploadedFile, onRemove, showPreview }) => {
  const { file, preview, progress, status, error } = uploadedFile;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
    >
      <div className="flex items-start space-x-3">
        {/* File Icon/Preview */}
        <div className="flex-shrink-0">
          {showPreview && preview ? (
            <img
              src={preview}
              alt={file.name}
              className="w-12 h-12 object-cover rounded-lg"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
              {getFileIcon(file.type)}
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {file.name}
          </p>
          <p className="text-xs text-gray-500">
            {formatFileSize(file.size)}
          </p>

          {/* Progress Bar */}
          {status === 'uploading' && typeof progress === 'number' && (
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-brand-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{progress}% uploaded</p>
            </div>
          )}

          {/* Error Message */}
          {status === 'error' && error && (
            <div className="mt-2 flex items-center text-red-600">
              <AlertCircle className="w-3 h-3 mr-1" />
              <p className="text-xs">{error}</p>
            </div>
          )}
        </div>

        {/* Status Icon */}
        <div className="flex-shrink-0">
          {status === 'uploading' && (
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          )}
          {status === 'completed' && (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
          {status === 'error' && (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
          {status === 'pending' && (
            <button
              onClick={() => onRemove(uploadedFile.id)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  disabled = false,
  className,
  onFilesSelected,
  onFileRemove,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  uploadFunction,
  showPreview = true,
  allowedTypes,
  dropzoneText = 'Drag and drop files here, or click to browse',
  browseText = 'Browse Files',
  error,
  label,
  required = false,
  hint,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size must be less than ${formatFileSize(maxSize)}`;
    }

    // Check file type
    if (allowedTypes && allowedTypes.length > 0) {
      const isAllowed = allowedTypes.some(type => {
        if (type.includes('*')) {
          const baseType = type.split('/')[0];
          return file.type.startsWith(baseType + '/');
        }
        return file.type === type;
      });

      if (!isAllowed) {
        return `File type ${file.type} is not allowed`;
      }
    }

    return null;
  };

  const generateFileId = () => {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    // Check max files limit
    if (uploadedFiles.length + fileArray.length > maxFiles) {
      setValidationError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setValidationError(null);

    const newUploadedFiles: UploadedFile[] = [];

    for (const file of fileArray) {
      const validationError = validateFile(file);

      if (validationError) {
        setValidationError(validationError);
        continue;
      }

      const fileId = generateFileId();
      const preview = await createFilePreview(file);

      const uploadedFile: UploadedFile = {
        id: fileId,
        file,
        preview: preview || undefined,
        status: 'pending',
        progress: 0,
      };

      newUploadedFiles.push(uploadedFile);
    }

    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);

    if (onFilesSelected) {
      onFilesSelected(newUploadedFiles.map(uf => uf.file));
    }

    // Auto-upload if upload function is provided
    if (uploadFunction) {
      for (const uploadedFile of newUploadedFiles) {
        uploadFile(uploadedFile);
      }
    }
  }, [uploadedFiles.length, maxFiles, maxSize, allowedTypes, onFilesSelected, uploadFunction]);

  const uploadFile = async (uploadedFile: UploadedFile) => {
    if (!uploadFunction) return;

    setUploadedFiles(prev =>
      prev.map(file =>
        file.id === uploadedFile.id
          ? { ...file, status: 'uploading', progress: 0 }
          : file
      )
    );

    try {
      const url = await uploadFunction(
        uploadedFile.file,
        (progress) => {
          setUploadedFiles(prev =>
            prev.map(file =>
              file.id === uploadedFile.id
                ? { ...file, progress }
                : file
            )
          );
          if (onUploadProgress) {
            onUploadProgress(uploadedFile.id, progress);
          }
        }
      );

      setUploadedFiles(prev =>
        prev.map(file =>
          file.id === uploadedFile.id
            ? { ...file, status: 'completed', progress: 100, url }
            : file
        )
      );

      if (onUploadComplete) {
        onUploadComplete(uploadedFile.id, url);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      setUploadedFiles(prev =>
        prev.map(file =>
          file.id === uploadedFile.id
            ? { ...file, status: 'error', error: errorMessage }
            : file
        )
      );

      if (onUploadError) {
        onUploadError(uploadedFile.id, errorMessage);
      }
    }
  };

  const handleFileRemove = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
    if (onFileRemove) {
      onFileRemove(fileId);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled) return;

    const { files } = e.dataTransfer;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleBrowseClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const dropzoneClassName = clsx(
    'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
    {
      'border-brand-primary bg-brand-accent': isDragOver && !disabled,
      'border-gray-300 hover:border-gray-400': !isDragOver && !disabled && !error,
      'border-red-300 bg-red-50': error || validationError,
      'border-gray-200 bg-gray-50 cursor-not-allowed': disabled,
    },
    className
  );

  const displayError = error || validationError;

  return (
    <div className="space-y-4">
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Dropzone */}
      <div
        className={dropzoneClassName}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          disabled={disabled}
          className="sr-only"
        />

        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-4" />

        <p className="text-gray-600 mb-2">
          {dropzoneText}
        </p>

        <button
          type="button"
          disabled={disabled}
          className="btn-outline btn-sm"
        >
          {browseText}
        </button>

        {hint && (
          <p className="text-xs text-gray-500 mt-2">
            {hint}
          </p>
        )}
      </div>

      {/* Error Message */}
      {displayError && (
        <p className="form-error" role="alert">
          {displayError}
        </p>
      )}

      {/* File Previews */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">
            Selected Files ({uploadedFiles.length})
          </h4>
          <AnimatePresence>
            {uploadedFiles.map((uploadedFile) => (
              <FilePreview
                key={uploadedFile.id}
                uploadedFile={uploadedFile}
                onRemove={handleFileRemove}
                showPreview={showPreview}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};