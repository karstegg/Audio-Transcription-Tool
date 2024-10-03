import { createApp, ref, watch } from 'vue';

createApp({
    setup() {
        const showSettingsModal = ref(false);
        const settings = ref({
            groqApiKey: localStorage.getItem('groqApiKey') || '',
            geminiApiKey: localStorage.getItem('geminiApiKey') || '',
            debugMode: localStorage.getItem('debugMode') === 'true'
        });
        const debugLogs = ref([]);

        function addDebugLog(message) {
            if (settings.value.debugMode) {
                debugLogs.value.push(`${new Date().toISOString()}: ${message}`);
                console.log(message);
            }
        }

        watch(() => settings.value, (newSettings) => {
            localStorage.setItem('groqApiKey', newSettings.groqApiKey);
            localStorage.setItem('geminiApiKey', newSettings.geminiApiKey);
            localStorage.setItem('debugMode', newSettings.debugMode);
            addDebugLog('Settings updated');
        }, { deep: true });

        function openSettingsModal() {
            showSettingsModal.value = true;
            addDebugLog('Settings modal opened');
        }

        function closeSettingsModal() {
            showSettingsModal.value = false;
            addDebugLog('Settings modal closed');
        }

        function saveSettings() {
            closeSettingsModal();
            addDebugLog('Settings saved and modal closed');
        }

        // Add a dummy log for testing
        addDebugLog('Application initialized');

        return {
            showSettingsModal,
            settings,
            debugLogs,
            openSettingsModal,
            closeSettingsModal,
            saveSettings
        };
    }
}).mount('#app');