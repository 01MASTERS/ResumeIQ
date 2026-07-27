"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useRef, useCallback } from "react";
import {
  ArrowRight, UploadCloud, FileType, 
  Trash2, Eye, FileJson,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface ResumeUploadStepProps {
  onNext: (payload: { type: 'files', files: File[] } | { type: 'json', data: string }) => void;
  onBack: () => void;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export function ResumeUploadStep({ onNext, onBack }: ResumeUploadStepProps) {
  const [files, setFiles] = useState<{file: File, id: string, preview: string, error?: string}[]>([]);
  const [jsonInput, setJsonInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    
    const processed = fileArray.map(file => {
      let error;
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
        error = "Invalid file type. Only PDF and DOCX are allowed.";
      } else if (file.size > MAX_SIZE) {
        error = "File too large. Maximum size is 10MB.";
      }
      
      const preview = URL.createObjectURL(file);
      return { file, id: Math.random().toString(36).substring(7), preview, error };
    });

    setFiles(prev => [...prev, ...processed]);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const openPreview = (url: string) => {
    window.open(url, '_blank');
  };

  const handleContinueFiles = () => {
    const validFiles = files.filter(f => !f.error).map(f => f.file);
    if (validFiles.length === 0) {
      toast.error("Please upload at least one valid resume.");
      return;
    }
    onNext({ type: 'files', files: validFiles });
  };

  const handleContinueJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) throw new Error("Must be an array of candidates");
      onNext({ type: 'json', data: jsonInput });
    } catch (e: unknown) {
      toast.error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-6xl mx-auto px-4 sm:px-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight mb-2">Provide Candidates</h2>
        <p className="text-muted-foreground text-lg">
          Upload resumes or provide structured JSON data.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-card/40 p-6 md:p-10 shadow-2xl">
        <Tabs defaultValue="upload" className="w-full">
          <div className="flex justify-center mb-10">
            <TabsList className="p-1">
              <TabsTrigger value="upload" className="px-8 py-2.5">File Upload</TabsTrigger>
              <TabsTrigger value="json" className="px-8 py-2.5">JSON Input</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="upload" className="space-y-6 outline-none">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[320px] group
                ${isDragging 
                  ? "border-primary bg-primary/[0.05] scale-[1.02]" 
                  : "border-white/[0.1] hover:border-primary/50 hover:bg-primary/[0.02]"
                }
              `}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple 
                accept=".pdf,.docx"
                onChange={(e) => {
                  if (e.target.files) handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-all duration-300 shadow-xl ${isDragging ? 'bg-primary text-primary-foreground shadow-primary/25 scale-110' : 'bg-white/[0.03] text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}`}>
                <UploadCloud className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Drag & Drop Resumes</h3>
              <p className="text-base text-muted-foreground mb-8">or click to browse from your computer</p>
              <div className="flex gap-4 text-xs text-muted-foreground/70 font-semibold uppercase tracking-wider">
                <span className="bg-white/[0.03] px-4 py-1.5 rounded-full border border-white/[0.08] shadow-sm">PDF</span>
                <span className="bg-white/[0.03] px-4 py-1.5 rounded-full border border-white/[0.08] shadow-sm">DOCX</span>
                <span className="bg-white/[0.03] px-4 py-1.5 rounded-full border border-white/[0.08] shadow-sm">Max 10MB</span>
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-3 mt-6">
                <h4 className="font-medium flex items-center gap-2">
                  Uploaded Files <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs">{files.length}</span>
                </h4>
                <div className="grid gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  {files.map((f) => (
                    <motion.div 
                      key={f.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`flex items-center justify-between p-3 rounded-xl border ${f.error ? 'bg-destructive/10 border-destructive/20' : 'bg-background border-white/5'}`}
                    >
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className={`p-2 rounded-lg ${f.error ? 'bg-destructive/20 text-destructive' : 'bg-primary/10 text-primary'}`}>
                          <FileType className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <p className="font-medium text-sm truncate max-w-[200px] sm:max-w-[300px]">{f.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(f.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          {f.error && (
                            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3 h-3" /> {f.error}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!f.error && (
                          <Button variant="ghost" size="icon" onClick={() => openPreview(f.preview)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => removeFile(f.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t border-white/5">
              <Button variant="ghost" onClick={onBack}>Back</Button>
              <Button onClick={handleContinueFiles} size="lg" className="rounded-xl px-8" disabled={files.filter(f => !f.error).length === 0}>
                Continue <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="json" className="space-y-6 outline-none">
            <div className="bg-background/50 border border-white/10 rounded-2xl p-4 relative group">
              <div className="absolute top-6 right-6 text-muted-foreground flex items-center gap-2 pointer-events-none">
                <FileJson className="w-5 h-5" />
              </div>
              <Textarea 
                placeholder={`[\n  {\n    "candidate_name": "Jane Doe",\n    "resume_text": "Experienced software engineer..."\n  }\n]`}
                className="font-mono text-sm min-h-[350px] bg-transparent border-none focus-visible:ring-0 p-2 resize-y custom-scrollbar"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
            </div>
            
            <div className="flex justify-between mt-8 pt-6 border-t border-white/5">
              <Button variant="ghost" onClick={onBack}>Back</Button>
              <Button onClick={handleContinueJson} size="lg" className="rounded-xl px-8" disabled={!jsonInput.trim()}>
                Continue <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
}
