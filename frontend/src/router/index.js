import { createRouter, createWebHashHistory } from 'vue-router';
// Using lazy imports for better code-splitting
const HomeView = () => import('../views/HomeView.vue');
const ChatView = () => import('../views/ChatView.vue');
const SpeechView = () => import('../views/SpeechView.vue');
const ImageHistoryView = () => import('../views/ImageHistoryView.vue');
const TtsHistoryView = () => import('../views/TtsHistoryView.vue');
const SessionsView = () => import('../views/SessionsView.vue');
const TasksView = () => import('../views/TasksView.vue');
const NotificationsView = () => import('../views/NotificationsView.vue');
const PromptsView = () => import('../views/PromptsView.vue');
const AssetsView = () => import('../views/AssetsView.vue');
const FavoritesView = () => import('../views/FavoritesView.vue');
const DiagnosticsView = () => import('../views/DiagnosticsView.vue');
const ExportsView = () => import('../views/ExportsView.vue');
const ApiStatusView = () => import('../views/ApiStatusView.vue');
const LogsView = () => import('../views/LogsView.vue');
const SettingsView = () => import('../views/SettingsView.vue');
const routes = [
    { path: '/', redirect: '/home' },
    { path: '/home', name: 'home', component: HomeView },
    { path: '/chat', name: 'chat', component: ChatView },
    { path: '/speech', name: 'speech', component: SpeechView },
    { path: '/image-history', name: 'imageHistory', component: ImageHistoryView },
    { path: '/tts-history', name: 'ttsHistory', component: TtsHistoryView },
    { path: '/sessions', name: 'sessions', component: SessionsView },
    { path: '/tasks', name: 'tasks', component: TasksView },
    { path: '/notifications', name: 'notifications', component: NotificationsView },
    { path: '/prompts', name: 'prompts', component: PromptsView },
    { path: '/assets', name: 'assets', component: AssetsView },
    { path: '/favorites', name: 'favorites', component: FavoritesView },
    { path: '/diagnostics', name: 'diagnostics', component: DiagnosticsView },
    { path: '/exports', name: 'exports', component: ExportsView },
    { path: '/api-status', name: 'apiStatus', component: ApiStatusView },
    { path: '/logs', name: 'logs', component: LogsView },
    { path: '/settings', name: 'settings', component: SettingsView },
];
const router = createRouter({
    history: createWebHashHistory(),
    routes
});
export default router;
