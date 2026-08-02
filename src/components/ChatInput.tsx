import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Square,
  Paperclip,
  Mic,
  MicOff,
  X,
  FileText,
  Volume2,
  VolumeX,
  Upload,
  Check
} from 'lucide-react';
import { Attachment, AppSettings } from '../types';

interface ChatInputProps {
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  isGenerating: boolean;
  onStopGeneration: () => void;
  settings: AppSettings;
  onToggleVoiceOutput: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isGenerating,
  onStopGeneration,
  settings,
  onToggleVoiceOutput,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isLight = settings.theme === 'light';

  // Camera Modal State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  // Handle Clipboard Paste for images
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          processFiles([file]);
        }
      }
    }
  };

  // Camera Stream Handling
  const openCameraModal = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        setCameraStream(stream);
        setIsCameraOpen(true);
      } else {
        cameraInputRef.current?.click();
      }
    } catch (err) {
      console.warn('Cannot open webcam stream, falling back to camera input file:', err);
      cameraInputRef.current?.click();
    }
  };

  useEffect(() => {
    if (isCameraOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraOpen, cameraStream]);

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      const newAttachment: Attachment = {
        id: `att_cam_${Date.now()}`,
        name: `photo_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.jpg`,
        type: 'image',
        mimeType: 'image/jpeg',
        size: Math.round((dataUrl.length * 3) / 4),
        data: dataUrl,
        previewUrl: dataUrl,
      };

      setAttachments((prev) => [...prev, newAttachment]);
    }
    closeCamera();
  };

  // Speech Recognition
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN"; // Set language to English (India)

      recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];

        if (!result.isFinal) return;

        const transcript = result[0].transcript.trim();

        setText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.log("Speech Error:", event.error);
        alert("Speech Error: " + event.error);
        setIsRecording(false);
      };
      recognition.onend = () => setIsRecording(false);
      console.log("Starting speech recognition...");

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (err) {
      console.error('Speech error:', err);
      setIsRecording(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && settings.sendOnEnter) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isGenerating) return;
    onSendMessage(text.trim(), attachments);
    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const processFiles = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      const isImage = file.type.startsWith('image/');

      reader.onload = (event) => {
        const result = event.target?.result as string;
        const newAttachment: Attachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          type: isImage ? 'image' : 'file',
          mimeType: file.type || 'text/plain',
          size: file.size,
          data: result,
          previewUrl: isImage ? result : undefined,
        };

        setAttachments((prev) => [...prev, newAttachment]);
      };

      if (isImage) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-full max-w-4xl mx-auto px-3 sm:px-6 pb-4 pt-2"
    >
      {/* Drag & Drop Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-cyan-500 backdrop-blur-md font-medium text-xs sm:text-sm ${isLight ? 'bg-white/90 text-cyan-700' : 'bg-slate-950/90 text-cyan-300'}`}
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 animate-bounce text-cyan-500" />
              <span>Drop files or images to attach</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main ChatGPT-style Input Box Container */}
      <div
        className={`relative flex flex-col rounded-2xl p-2.5 sm:p-3 transition-all ${
          isLight
            ? 'bg-white shadow-lg border border-slate-200/90 ring-1 ring-slate-900/5 focus-within:ring-cyan-500/50 focus-within:border-cyan-500/50'
            : 'bg-slate-900/90 shadow-2xl border border-white/10 ring-1 ring-white/5 focus-within:ring-cyan-500/50 focus-within:border-cyan-500/30'
        }`}
      >
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className={`flex flex-wrap gap-2 p-1.5 mb-2 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
            {attachments.map((att) => (
              <div
                key={att.id}
                className={`relative flex items-center gap-2 rounded-xl px-2.5 py-1 text-xs font-medium border shadow-sm ${
                  isLight ? 'bg-slate-100 text-slate-800 border-slate-200' : 'bg-slate-800/90 text-slate-200 border-white/10'
                }`}
              >
                {att.previewUrl ? (
                  <img src={att.previewUrl} alt={att.name} className="h-7 w-7 rounded-lg object-cover" />
                ) : (
                  <FileText className="h-4 w-4 text-purple-500" />
                )}
                <span className="max-w-[110px] sm:max-w-[160px] truncate">{att.name}</span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className={`rounded-full p-0.5 transition-colors ${isLight ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-800' : 'hover:bg-white/20 text-slate-400 hover:text-white'}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Message Infinity AI..."
          rows={1}
          className={`w-full resize-none bg-transparent px-2 py-1 text-sm md:text-base focus:outline-none min-h-[44px] max-h-[180px] ${
            isLight ? 'text-slate-900 placeholder-slate-400' : 'text-slate-100 placeholder-slate-400'
          }`}
        />

        {/* Action Controls Bar */}
        <div className={`flex items-center justify-between pt-2 border-t ${isLight ? 'border-slate-100 text-slate-500' : 'border-white/5 text-slate-400'}`}>
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Gallery Attachment Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-lg p-2 transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900' : 'hover:bg-white/10 hover:text-cyan-300'}`}
              title="Attach File or Image"
            >
              <Paperclip className="h-4 w-4" />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.doc,.docx"
                onChange={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (e.target.files) {
                    processFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }
                }}
                className="hidden pointer-events-none"
              />
            </button>

            {/* Voice Input Button */}
            <button
              onClick={toggleRecording}
              className={`relative rounded-lg p-2 transition-colors ${
                isRecording
                  ? 'bg-red-500/20 text-red-500 animate-pulse ring-1 ring-red-500'
                  : isLight
                  ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  : 'hover:bg-white/10 hover:text-cyan-300'
              }`}
              title={isRecording ? 'Stop Voice Recording' : 'Voice Input'}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            {/* Voice Output Toggle */}
            <button
              onClick={onToggleVoiceOutput}
              className={`rounded-lg p-2 transition-colors ${
                settings.enableVoiceOutput
                  ? 'text-cyan-600 bg-cyan-50'
                  : isLight
                  ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  : 'hover:bg-white/10 hover:text-slate-200'
              }`}
              title={settings.enableVoiceOutput ? 'Voice Output Enabled' : 'Voice Output Disabled'}
            >
              {settings.enableVoiceOutput ? (
                <Volume2 className="h-4 w-4 text-cyan-600" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Send / Stop Button */}
          <div>
            {isGenerating ? (
              <button
                onClick={onStopGeneration}
                className="flex items-center gap-1.5 rounded-xl bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/30 transition-all ring-1 ring-red-500/40"
                title="Stop Generation"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!text.trim() && attachments.length === 0}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  text.trim() || attachments.length > 0
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/25 hover:bg-cyan-500 hover:scale-105 active:scale-95'
                    : isLight
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white/5 text-slate-500 cursor-not-allowed'
                }`}
                title="Send Message"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Camera Capture Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`relative flex flex-col items-center max-w-lg w-full rounded-2xl p-4 shadow-2xl border ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-slate-100'
              }`}
            >
              <div className={`flex w-full items-center justify-between pb-3 border-b font-semibold text-sm ${isLight ? 'border-slate-200 text-slate-900' : 'border-white/10 text-slate-100'}`}>
                <span>Take Photo</span>
                <button
                  onClick={closeCamera}
                  className={`rounded-lg p-1 transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-900' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative my-4 w-full overflow-hidden rounded-xl bg-black aspect-video flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
              </div>

              <div className="flex w-full justify-center gap-4 pt-2">
                <button
                  onClick={closeCamera}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={capturePhoto}
                  className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 shadow-lg shadow-cyan-600/25"
                >
                  <span>Capture Photo</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};