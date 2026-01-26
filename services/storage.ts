import { supabase } from './supabase';

export const BUCKETS = {
    PROFILES: 'profiles',
    DOCUMENTS: 'documents',
    EXPENSES: 'expenses'
} as const;

export type BucketName = typeof BUCKETS[keyof typeof BUCKETS];

/**
 * Enterprise Storage Service
 * Enforces strict path conventions for RLS compliance and domain isolation.
 */
export const StorageService = {
    getProfilePath: (type: 'parent' | 'child' | 'teacher', userId: string) => {
        return `${type}/${userId}/avatar_${Date.now()}.png`;
    },

    /**
     * Standardizes document paths for Admission Sync
     */
    getDocumentPath: (parentId: string, admissionId: string, requirementId: number, fileName: string) => {
        const ext = fileName.split('.').pop() || 'dat';
        return `parent/${parentId}/adm-${admissionId}/req-${requirementId}_${Date.now()}.${ext}`;
    },

    /**
     * Standardizes expense artifact paths
     */
    getExpensePath: (branchId: number | string, category: string, fileName: string) => {
        const ext = fileName.split('.').pop() || 'dat';
        const safeCategory = category.toLowerCase().replace(/\s+/g, '_');
        return `branch-${branchId}/${safeCategory}/${Date.now()}_${fileName}`;
    },

    async upload(bucket: BucketName, path: string, file: File, onProgress?: (progress: number) => void) {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: true,
            });

        if (error) throw error;
        return { path: data.path };
    },

    async getSignedUrl(bucket: BucketName, path: string, expiresIn = 3600) {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, expiresIn);
            
        if (error) throw error;
        return data.signedUrl;
    }
};