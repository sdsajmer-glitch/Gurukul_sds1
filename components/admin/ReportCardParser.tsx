import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon } from '../icons/SparklesIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { XIcon } from '../icons/XIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import Spinner from '../common/Spinner';

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error("Failed to convert blob to base64"));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const ReportCardParser: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (file: File | null) => {
        if (file) {
            if (file.size > 4 * 1024 * 1024) {
                setError("Image size should not exceed 4MB.");
                return;
            }
            setImageFile(file);
            setImageUrl(URL.createObjectURL(file));
            setExtractedData(null);
            setError(null);
        }
    };

    const handleParse = async () => {
        if (!imageFile) return;
        setLoading(true);
        setError(null);
        setExtractedData(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const base64Data = await blobToBase64(imageFile);
            
            const imagePart = {
                inlineData: {
                    mimeType: imageFile.type,
                    data: base64Data,
                },
            };

            const textPart = {
                text: `Analyze this image of a student's progress report card. Extract the following information and return it as a valid JSON object only. Do not include any other text or markdown formatting.

                The JSON object should have these keys:
                - "student_name" (string)
                - "class_section" (string)
                - "roll_no" (string)
                - "date_of_birth" (string)
                - "session" (string)
                - "subjects" (an array of objects, where each object has "name", "inspire_1_marks", "empower_1_marks", "marks_obtained", and "grade")
                - "teacher_remarks" (string)
                - "attendance" (string)
                `
            };

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [imagePart, textPart] },
            });
            
            let jsonString = response.text || '';
            // Clean the response to get only the JSON part
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonString = jsonMatch[0];
                const data = JSON.parse(jsonString);
                setExtractedData(data);
            } else {
                throw new Error("AI did not return a valid JSON object.");
            }

        } catch (err: any) {
            setError(err.message || "Failed to parse report card. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setImageFile(null);
        setImageUrl(null);
        setExtractedData(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
            <div className="text-center">
                <h1 className="text-5xl font-serif font-black text-white tracking-tighter uppercase">Report Card Parser</h1>
                <p className="text-lg text-white/50 mt-4 max-w-2xl mx-auto font-serif italic">
                    Use Gemini Vision to automatically extract and structure data from student report cards.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="bg-[#0c0d12] border border-white/5 rounded-[2rem] p-8 space-y-6 shadow-2xl h-full">
                    <h2 className="text-lg font-bold text-white tracking-tight">Upload Image</h2>
                    {!imageUrl ? (
                        <div 
                            className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/[0.02] transition-all"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <UploadIcon className="w-12 h-12 text-white/20 mx-auto mb-4" />
                            <p className="font-bold text-white">Click to upload or drag & drop</p>
                            <p className="text-xs text-white/40 mt-1">PNG, JPG up to 4MB</p>
                        </div>
                    ) : (
                        <div className="relative group">
                            <img src={imageUrl} alt="Report card preview" className="w-full h-auto rounded-xl shadow-lg" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                <button onClick={handleClear} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                                    <XIcon className="w-4 h-4"/> Clear Image
                                </button>
                            </div>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/png, image/jpeg" className="hidden" onChange={e => handleFileChange(e.target.files?.[0] || null)} />

                    <button
                        onClick={handleParse}
                        disabled={!imageFile || loading}
                        className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Spinner className="text-white"/> : <><SparklesIcon className="w-5 h-5"/> Analyze with AI</>}
                    </button>
                </div>

                <div className="bg-[#0c0d12] border border-white/5 rounded-[2rem] p-8 shadow-2xl min-h-[400px]">
                    <h2 className="text-lg font-bold text-white tracking-tight mb-6">Extracted Data</h2>
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <motion.div key="loading" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center justify-center py-20 gap-4">
                                <Spinner size="lg" className="text-primary"/>
                                <p className="text-sm text-white/50 animate-pulse">Gemini is analyzing the document...</p>
                            </motion.div>
                        ) : error ? (
                            <motion.div key="error" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-4">
                                <AlertTriangleIcon className="w-8 h-8 flex-shrink-0" />
                                <span className="text-sm font-bold">{error}</span>
                            </motion.div>
                        ) : extractedData ? (
                            <motion.div key="data" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-6">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><p className="text-xs text-white/40">Name</p><p className="font-bold text-white">{extractedData.student_name}</p></div>
                                        <div><p className="text-xs text-white/40">Class</p><p className="font-bold text-white">{extractedData.class_section}</p></div>
                                        <div><p className="text-xs text-white/40">Roll No.</p><p className="font-bold text-white">{extractedData.roll_no}</p></div>
                                        <div><p className="text-xs text-white/40">Session</p><p className="font-bold text-white">{extractedData.session}</p></div>
                                    </div>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-white/40 uppercase">
                                            <tr>
                                                <th className="p-2">Subject</th>
                                                <th className="p-2 text-center">Inspire 1</th>
                                                <th className="p-2 text-center">Empower 1</th>
                                                <th className="p-2 text-center">Total</th>
                                                <th className="p-2 text-center">Grade</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {extractedData.subjects?.map((s: any, i: number) => (
                                                <tr key={i}>
                                                    <td className="p-2 font-semibold">{s.name}</td>
                                                    <td className="p-2 text-center">{s.inspire_1_marks}</td>
                                                    <td className="p-2 text-center">{s.empower_1_marks}</td>
                                                    <td className="p-2 text-center font-bold">{s.marks_obtained}</td>
                                                    <td className="p-2 text-center font-bold text-primary">{s.grade}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                    <p className="text-xs text-white/40 mb-1">Teacher Remarks</p>
                                    <p className="text-sm text-white italic">"{extractedData.teacher_remarks}"</p>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 gap-4 text-white/20">
                                <SparklesIcon className="w-12 h-12" />
                                <p className="text-sm font-medium">Results will appear here</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default ReportCardParser;
