export function loadSettings() {
    return {
        groqApiKey: localStorage.getItem('groqApiKey') || '',
        geminiApiKey: localStorage.getItem('geminiApiKey') || '',
        debugMode: localStorage.getItem('debugMode') === 'true'
    };
}

export function saveSettings(settings) {
    localStorage.setItem('groqApiKey', settings.groqApiKey);
    localStorage.setItem('geminiApiKey', settings.geminiApiKey);
    localStorage.setItem('debugMode', settings.debugMode);
}