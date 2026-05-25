import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';
import zhTW from './locales/zh-TW.json';
const messages = {
    'zh-CN': zhCN,
    'en-US': enUS,
    'zh-TW': zhTW
};
const savedLocale = localStorage.getItem('weizhi.locale') || 'zh-CN';
export const i18n = createI18n({
    legacy: false,
    locale: savedLocale,
    fallbackLocale: 'en-US',
    messages
});
