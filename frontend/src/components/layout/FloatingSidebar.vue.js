/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { inject } from 'vue';
import { Terminal, Home, Bell, BookOpen, Activity, FolderOpen, Star, Wrench, Download, FileText, Settings, History, Trash2, Cpu, Image as ImageIcon, Volume2, Database } from 'lucide-vue-next';
// Inject all required state and methods from App.vue
const appState = inject('appState');
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "floating-sidebar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand" },
});
const __VLS_0 = {}.Cpu;
/** @type {[typeof __VLS_components.Cpu, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "icon-accent" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "icon-accent" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "nav-group" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.appState.openHome) },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'home' }) },
});
const __VLS_4 = {}.Home;
/** @type {[typeof __VLS_components.Home, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    size: (16),
}));
const __VLS_6 = __VLS_5({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
(__VLS_ctx.$t('nav.home'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.switchProvider('minimax');
        } },
    ...{ class: "nav-item provider-entry minimax-entry" },
    ...{ class: ({ active: __VLS_ctx.appState.activeProvider.value === 'minimax' }) },
});
const __VLS_8 = {}.Terminal;
/** @type {[typeof __VLS_components.Terminal, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    size: (16),
}));
const __VLS_10 = __VLS_9({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.$t('nav.minimaxSession'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
(__VLS_ctx.$t('nav.minimaxDesc'));
if (__VLS_ctx.appState.showMiniMaxSubnav.value) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "nav-subgroup" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.appState.openSpeech) },
        ...{ class: "nav-subitem" },
        ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'speech' }) },
    });
    const __VLS_12 = {}.Volume2;
    /** @type {[typeof __VLS_components.Volume2, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        size: (14),
    }));
    const __VLS_14 = __VLS_13({
        size: (14),
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    (__VLS_ctx.$t('nav.speechSynthesis'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.appState.showMiniMaxSubnav.value))
                    return;
                __VLS_ctx.appState.activeView.value = 'translation';
            } },
        ...{ class: "nav-subitem" },
        ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'translation' }) },
    });
    const __VLS_16 = {}.FileText;
    /** @type {[typeof __VLS_components.FileText, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        size: (14),
    }));
    const __VLS_18 = __VLS_17({
        size: (14),
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    (__VLS_ctx.$t('nav.translation'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.appState.showMiniMaxSubnav.value))
                    return;
                __VLS_ctx.appState.openMiniMaxHistory('imageHistory');
            } },
        ...{ class: "nav-subitem" },
        ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'imageHistory' }) },
    });
    const __VLS_20 = {}.ImageIcon;
    /** @type {[typeof __VLS_components.ImageIcon, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        size: (14),
    }));
    const __VLS_22 = __VLS_21({
        size: (14),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    (__VLS_ctx.$t('nav.imageHistory'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.appState.showMiniMaxSubnav.value))
                    return;
                __VLS_ctx.appState.openMiniMaxHistory('ttsHistory');
            } },
        ...{ class: "nav-subitem" },
        ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'ttsHistory' }) },
    });
    const __VLS_24 = {}.Volume2;
    /** @type {[typeof __VLS_components.Volume2, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        size: (14),
    }));
    const __VLS_26 = __VLS_25({
        size: (14),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    (__VLS_ctx.$t('nav.speechHistory'));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.switchProvider('deepseek');
        } },
    ...{ class: "nav-item provider-entry deepseek-entry" },
    ...{ class: ({ active: __VLS_ctx.appState.activeProvider.value === 'deepseek' }) },
});
const __VLS_28 = {}.Terminal;
/** @type {[typeof __VLS_components.Terminal, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    size: (16),
}));
const __VLS_30 = __VLS_29({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.$t('nav.deepseekSession'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
(__VLS_ctx.$t('nav.deepseekDesc'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.switchProvider('openai');
        } },
    ...{ class: "nav-item provider-entry openai-entry" },
    ...{ class: ({ active: __VLS_ctx.appState.activeProvider.value === 'openai' }) },
});
const __VLS_32 = {}.Terminal;
/** @type {[typeof __VLS_components.Terminal, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    size: (16),
}));
const __VLS_34 = __VLS_33({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.$t('nav.openaiSession'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
(__VLS_ctx.$t('nav.openaiDesc'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.activeView.value = 'sessions';
        } },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'sessions' }) },
});
const __VLS_36 = {}.History;
/** @type {[typeof __VLS_components.History, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    size: (16),
}));
const __VLS_38 = __VLS_37({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
(__VLS_ctx.$t('nav.sessions'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.activeView.value = 'tasks';
        } },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'tasks' }) },
});
const __VLS_40 = {}.Activity;
/** @type {[typeof __VLS_components.Activity, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    size: (16),
}));
const __VLS_42 = __VLS_41({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
(__VLS_ctx.$t('nav.tasks'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.activeView.value = 'notifications';
            __VLS_ctx.appState.markNotificationsRead();
        } },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'notifications' }) },
});
const __VLS_44 = {}.Bell;
/** @type {[typeof __VLS_components.Bell, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    size: (16),
}));
const __VLS_46 = __VLS_45({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
(__VLS_ctx.$t('nav.notifications'));
if (__VLS_ctx.appState.unreadNotificationCount.value) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({
        ...{ class: "nav-badge" },
    });
    (__VLS_ctx.appState.unreadNotificationCount.value);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.activeView.value = 'prompts';
        } },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'prompts' }) },
});
const __VLS_48 = {}.BookOpen;
/** @type {[typeof __VLS_components.BookOpen, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    size: (16),
}));
const __VLS_50 = __VLS_49({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
(__VLS_ctx.$t('nav.prompts'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.appState.openAssets) },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'assets' }) },
});
const __VLS_52 = {}.FolderOpen;
/** @type {[typeof __VLS_components.FolderOpen, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    size: (16),
}));
const __VLS_54 = __VLS_53({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
(__VLS_ctx.$t('nav.assets'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.activeView.value = 'favorites';
        } },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'favorites' }) },
});
const __VLS_56 = {}.Star;
/** @type {[typeof __VLS_components.Star, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    size: (16),
}));
const __VLS_58 = __VLS_57({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
(__VLS_ctx.$t('nav.favorites'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.appState.openDiagnostics) },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'diagnostics' }) },
});
const __VLS_60 = {}.Wrench;
/** @type {[typeof __VLS_components.Wrench, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    size: (16),
}));
const __VLS_62 = __VLS_61({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
(__VLS_ctx.$t('nav.diagnostics'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.appState.openExports) },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'exports' }) },
});
const __VLS_64 = {}.Download;
/** @type {[typeof __VLS_components.Download, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    size: (16),
}));
const __VLS_66 = __VLS_65({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
(__VLS_ctx.$t('nav.exports'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.appState.openApiStatus) },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'apiStatus' }) },
});
const __VLS_68 = {}.Activity;
/** @type {[typeof __VLS_components.Activity, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    size: (16),
}));
const __VLS_70 = __VLS_69({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
(__VLS_ctx.$t('nav.apiStatus'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.appState.openLogs) },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'logs' }) },
});
const __VLS_72 = {}.FileText;
/** @type {[typeof __VLS_components.FileText, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    size: (16),
}));
const __VLS_74 = __VLS_73({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
(__VLS_ctx.$t('nav.logs'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.appState.openDataManagement) },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'dataManagement' }) },
});
const __VLS_76 = {}.Database;
/** @type {[typeof __VLS_components.Database, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    size: (16),
}));
const __VLS_78 = __VLS_77({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
(__VLS_ctx.$t('nav.dataManagement'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.appState.openSettings) },
    ...{ class: "nav-item" },
    ...{ class: ({ active: __VLS_ctx.appState.activeView.value === 'settings' }) },
});
const __VLS_80 = {}.Settings;
/** @type {[typeof __VLS_components.Settings, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    size: (16),
}));
const __VLS_82 = __VLS_81({
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
(__VLS_ctx.$t('nav.settings'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "bottom-controls" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "lang-switcher" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.setLang('zh-CN');
        } },
    ...{ class: "lang-btn" },
    ...{ class: ({ active: __VLS_ctx.appState.locale.value === 'zh-CN' }) },
});
(__VLS_ctx.$t("lang.zhCN"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.setLang('zh-TW');
        } },
    ...{ class: "lang-btn" },
    ...{ class: ({ active: __VLS_ctx.appState.locale.value === 'zh-TW' }) },
});
(__VLS_ctx.$t("lang.zhTW"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.setLang('en-US');
        } },
    ...{ class: "lang-btn" },
    ...{ class: ({ active: __VLS_ctx.appState.locale.value === 'en-US' }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "theme-switcher" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.setTheme('midnight');
        } },
    ...{ class: "theme-btn" },
    ...{ class: ({ active: __VLS_ctx.appState.currentTheme.value === 'midnight' }) },
    title: (__VLS_ctx.$t('theme.midnight')),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "color-dot midnight" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.setTheme('light');
        } },
    ...{ class: "theme-btn" },
    ...{ class: ({ active: __VLS_ctx.appState.currentTheme.value === 'light' }) },
    title: (__VLS_ctx.$t('theme.light')),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "color-dot light" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.setTheme('obsidian');
        } },
    ...{ class: "theme-btn" },
    ...{ class: ({ active: __VLS_ctx.appState.currentTheme.value === 'obsidian' }) },
    title: (__VLS_ctx.$t('theme.obsidian')),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "color-dot obsidian" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.setTheme('green');
        } },
    ...{ class: "theme-btn" },
    ...{ class: ({ active: __VLS_ctx.appState.currentTheme.value === 'green' }) },
    title: (__VLS_ctx.$t('theme.green')),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "color-dot green" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.appState.setTheme('pink');
        } },
    ...{ class: "theme-btn" },
    ...{ class: ({ active: __VLS_ctx.appState.currentTheme.value === 'pink' }) },
    title: (__VLS_ctx.$t('theme.pink')),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "color-dot pink" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.appState.clearCurrentConversation) },
    ...{ class: "btn-clear" },
});
const __VLS_84 = {}.Trash2;
/** @type {[typeof __VLS_components.Trash2, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    size: (14),
}));
const __VLS_86 = __VLS_85({
    size: (14),
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
(__VLS_ctx.$t('nav.clearSession'));
/** @type {__VLS_StyleScopedClasses['floating-sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['brand']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-group']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-entry']} */ ;
/** @type {__VLS_StyleScopedClasses['minimax-entry']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-subgroup']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-subitem']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-subitem']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-subitem']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-subitem']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-entry']} */ ;
/** @type {__VLS_StyleScopedClasses['deepseek-entry']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-entry']} */ ;
/** @type {__VLS_StyleScopedClasses['openai-entry']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['lang-switcher']} */ ;
/** @type {__VLS_StyleScopedClasses['lang-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['lang-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['lang-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-switcher']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['color-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['midnight']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['color-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['light']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['color-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['obsidian']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['color-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['green']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['color-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['pink']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-clear']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Terminal: Terminal,
            Home: Home,
            Bell: Bell,
            BookOpen: BookOpen,
            Activity: Activity,
            FolderOpen: FolderOpen,
            Star: Star,
            Wrench: Wrench,
            Download: Download,
            FileText: FileText,
            Settings: Settings,
            History: History,
            Trash2: Trash2,
            Cpu: Cpu,
            ImageIcon: ImageIcon,
            Volume2: Volume2,
            Database: Database,
            appState: appState,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
