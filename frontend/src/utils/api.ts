import axios from 'axios';
import { resolveApiUrl } from '../utils/urlUtils';

const api = axios.create({
    baseURL: resolveApiUrl('/api'),
    timeout: 180000
});

export type LogEntry = {
    id: string;
    timestamp: string;
    level: string;
    logger: string;
    thread: string;
    message: string;
};

export const systemApi = {
    streamLogs: () => {
        return new EventSource(resolveApiUrl('/api/system/logs'));
    },
    logs: (params?: { level?: string; query?: string; limit?: number }) => api.get('/system/logs/history', { params }),
    clearLogs: () => api.delete('/system/logs'),
    getHealth: () => api.get('/system/health'),
    upload: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    }
};

export const settingsApi = {
    get: () => api.get('/settings'),
    models: (provider: 'minimax' | 'deepseek' | 'openai' | 'gemini') => api.get(`/settings/${provider}/models`),
    update: (provider: 'minimax' | 'deepseek' | 'openai' | 'gemini', payload: { apiKey?: string; model?: string; baseUrl?: string }) => api.post(`/settings/${provider}`, payload)
};

export const chatApi = {
    ask: (message: string, messages?: ProviderMessage[], options?: any) => api.post('/chat/ask', { message, messages }, options),
    stream: (message: string) => {
        return new EventSource(resolveApiUrl('/api/chat/stream?message=' + encodeURIComponent(message)));
    },
    streamUrl: () => resolveApiUrl('/api/chat/stream'),
    translate: (payload: { text: string; sourceLang: string; targetLang: string; style: string }) => api.post('/chat/translate', payload)
};

export type ProviderMessage = {
    role: 'user' | 'assistant' | 'system';
    content: string;
};

export const deepSeekApi = {
    ask: (message: string, messages: ProviderMessage[], options?: any) => api.post('/deepseek/chat/ask', { message, messages }, options),
    streamUrl: () => resolveApiUrl('/api/deepseek/chat/stream'),
    balance: () => api.get('/deepseek/account/balance'),
    usage: () => api.get('/deepseek/account/usage')
};

export const openaiApi = {
    ask: (message: string, messages: ProviderMessage[], options?: any) => api.post('/openai/chat/ask', { message, messages }, options),
    streamUrl: () => resolveApiUrl('/api/openai/chat/stream')
};

export const geminiApi = {
    ask: (message: string, messages: ProviderMessage[], mode = 'auto', documentIds?: string[], model?: string, options?: any) => api.post('/gemini/chat/ask', { message, messages, mode, documentIds, model }, options),
    streamUrl: () => resolveApiUrl('/api/gemini/chat/stream'),
    capabilities: () => api.get('/gemini/models/capabilities'),
    probe: () => api.post('/gemini/models/probe')
};

export const imageApi = {
    history: () => api.get(`/images/history?t=${Date.now()}`),
    deleteHistory: (id: string) => api.delete(`/images/history/${id}`),
    clearHistory: () => api.delete('/images/history')
};

export const ttsApi = {
    voices: () => api.get('/tts/voices'),
    history: () => api.get(`/tts/history?t=${Date.now()}`),
    deleteHistory: (id: string) => api.delete(`/tts/history/${id}`),
    clearHistory: () => api.delete('/tts/history'),
    generate: (payload: {
        text: string;
        voiceId?: string;
        model?: string;
        format?: string;
        speed?: number;
        vol?: number;
        pitch?: number;
        sampleRate?: number;
        bitrate?: number;
        source?: string;
    }) => api.post('/tts/tts', payload),
    preview: (payload: {
        text: string;
        voiceId?: string;
        model?: string;
        format?: string;
        speed?: number;
        vol?: number;
        pitch?: number;
        sampleRate?: number;
        bitrate?: number;
        source?: string;
    }) => api.post('/tts/preview', payload)
};

export type DataSourceMode = 'json' | 'postgresql';

export type DataManagementStatus = {
    mode: DataSourceMode;
    ready: boolean;
    json?: Record<string, any>;
    postgresql?: {
        configured?: boolean;
        available?: boolean;
        ready?: boolean;
        host?: string;
        port?: number;
        database?: string;
        username?: string;
        jdbcUrl?: string;
        message?: string;
    };
};

export const dataManagementApi = {
    status: () => api.get<DataManagementStatus>('/data-management/status'),
    switchMode: (mode: DataSourceMode) => api.post('/data-management/mode', { mode }),
    testConnection: (mode: DataSourceMode) => api.post('/data-management/test-connection', { mode })
};

export type DocumentRecord = {
    id: string;
    name: string;
    filename: string;
    type: string;
    sizeBytes: number;
    uploadTime: number;
    url: string;
    chunks?: any[];
};

export const documentApi = {
    list: () => api.get<DocumentRecord[]>('/documents'),
    delete: (id: string) => api.delete(`/documents/${id}`),
    upload: (file: File, name?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        if (name) {
            formData.append('name', name);
        }
        return api.post('/documents/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    }
};

