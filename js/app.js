import { preprocessAudio } from './audioProcessing.js';

Vue.createApp({
    data() {
        return {
            showSettings: false,
            settings: {
                groqApiKey: localStorage.getItem('groqApiKey') || '',
                debugMode: localStorage.getItem('debugMode') === 'true',
                downsampleAudio: localStorage.getItem('downsampleAudio') === 'true'
            },
            debugLogs: [],
            selectedFile: null,
            transcription: '',
            selectedModel: 'distil-whisper-large-v3-en',
            isTranscribing: false,
            progress: 0,
            cancelRequested: false
        }
    },

    methods: {
        saveSettings() {
            localStorage.setItem('groqApiKey', this.settings.groqApiKey);
            localStorage.setItem('debugMode', this.settings.debugMode);
            localStorage.setItem('downsampleAudio', this.settings.downsampleAudio);
            this.showSettings = false;
            this.addLog(`Settings saved. API key length: ${this.settings.groqApiKey.length}`);
        },
        addLog(message) {
            if (this.settings.debugMode) {
                this.debugLogs.push(`${new Date().toISOString()}: ${message}`);
                console.log(message);
            }
        },
        handleFileSelect(event) {
            this.selectedFile = event.target.files[0];
            this.addLog(`File selected: ${this.selectedFile.name}`);
        },
        async transcribeAudio() {
            if (!this.selectedFile) {
                this.addLog('No file selected');
                return;
            }
            this.isTranscribing = true;
            this.progress = 0;
            this.transcription = '';
            this.cancelRequested = false;
            this.addLog('Starting transcription');
            try {
                const chunks = await preprocessAudio(this.selectedFile, this.settings.downsampleAudio, this.addLog);
                let fullTranscription = '';
                for (let i = 0; i < chunks.length; i++) {
                    if (this.cancelRequested) {
                        this.addLog('Transcription cancelled');
                        break;
                    }
                    this.addLog(`Transcribing chunk ${i + 1} of ${chunks.length}`);
                    const chunk = chunks[i];
                    const formData = new FormData();
                    formData.append('file', chunk, 'audio.mp3');
                    formData.append('model', this.selectedModel);

                    const apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
                    this.addLog(`Sending request to: ${apiUrl}`);
                    this.addLog(`Using model: ${this.selectedModel}`);

                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.settings.groqApiKey}`
                        },
                        body: formData
                    });

                    this.addLog(`Response status: ${response.status}`);

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                    }

                    const data = await response.json();
                    fullTranscription += data.text + ' ';
                    this.transcription = fullTranscription;
                    this.progress = ((i + 1) / chunks.length) * 100;
                }
                if (!this.cancelRequested) {
                    this.addLog('Transcription completed');
                }
            } catch (error) {
                this.addLog(`Transcription error: ${error.message}`);
                console.error('Full error:', error);
            } finally {
                this.isTranscribing = false;
                this.cancelRequested = false;
            }
        },

        cancelTranscription() {
            this.cancelRequested = true;
            this.addLog('Cancellation requested');
        },

        resetAll() {
            this.selectedFile = null;
            this.transcription = '';
            this.progress = 0;
            this.isTranscribing = false;
            this.cancelRequested = false;
            this.debugLogs = [];
            this.addLog('All data reset');        
        },
        newTranscription() {
            this.selectedFile = null;
            this.transcription = '';
            this.progress = 0;
            this.addLog('New transcription initiated');
        }
    },
    mounted() {
        this.addLog('Application initialized');
    }
}).mount('#app');