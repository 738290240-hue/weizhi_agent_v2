import axios from 'axios';
import { resolveApiUrl } from '../utils/urlUtils';
const api = axios.create({
    baseURL: resolveApiUrl('/api'),
    timeout: 180000
});
export const systemApi = {
    streamLogs: () => {
        return new EventSource(resolveApiUrl('/api/system/logs'));
    },
    logs: (params) => api.get('/system/logs/history', { params }),
    clearLogs: () => api.delete('/system/logs'),
    getHealth: () => api.get('/system/health'),
    upload: (file) => {
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
    models: (provider) => api.get(`/settings/${provider}/models`),
    update: (provider, payload) => api.post(`/settings/${provider}`, payload)
};
export const chatApi = {
    ask: (message, messages, options) => api.post('/chat/ask', { message, messages }, options),
    stream: (message) => {
        return new EventSource(resolveApiUrl('/api/chat/stream?message=' + encodeURIComponent(message)));
    },
    streamUrl: () => resolveApiUrl('/api/chat/stream'),
    translate: (payload) => api.post('/chat/translate', payload)
};
export const deepSeekApi = {
    ask: (message, messages, options) => api.post('/deepseek/chat/ask', { message, messages }, options),
    streamUrl: () => resolveApiUrl('/api/deepseek/chat/stream'),
    balance: () => api.get('/deepseek/account/balance'),
    usage: () => api.get('/deepseek/account/usage')
};
export const openaiApi = {
    ask: (message, messages, options) => api.post('/openai/chat/ask', { message, messages }, options),
    streamUrl: () => resolveApiUrl('/api/openai/chat/stream')
};
export const geminiApi = {
    ask: (message, messages, mode = 'auto', documentIds, model, options) => api.post('/gemini/chat/ask', { message, messages, mode, documentIds, model }, options),
    streamUrl: () => resolveApiUrl('/api/gemini/chat/stream'),
    capabilities: () => api.get('/gemini/models/capabilities'),
    probe: () => api.post('/gemini/models/probe')
};
export const imageApi = {
    history: () => api.get(`/images/history?t=${Date.now()}`),
    deleteHistory: (id) => api.delete(`/images/history/${id}`),
    clearHistory: () => api.delete('/images/history')
};
export const ttsApi = {
    voices: () => api.get('/tts/voices'),
    history: () => api.get(`/tts/history?t=${Date.now()}`),
    deleteHistory: (id) => api.delete(`/tts/history/${id}`),
    clearHistory: () => api.delete('/tts/history'),
    generate: (payload) => api.post('/tts/tts', payload),
    preview: (payload) => api.post('/tts/preview', payload)
};
export const dataManagementApi = {
    status: () => api.get('/data-management/status'),
    switchMode: (mode) => api.post('/data-management/mode', { mode }),
    testConnection: (mode) => api.post('/data-management/test-connection', { mode })
};
export const documentApi = {
    list: () => api.get('/documents'),
    delete: (id) => api.delete(`/documents/${id}`),
    upload: (file, name) => {
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
