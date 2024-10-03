const { createApp, ref, watch } = Vue;

createApp({
    setup() {
        const selectedModel = ref('distil-whisper-large-v3-en');
        const selectedLanguage = ref('');
        const selectedFile = ref(null);
        const generateMinutesSummary = ref(false);
        const isTranscribing = ref(false);
        const status = ref('');
        const hasError = ref(false);
        const transcription = ref('');
        const streamingTranscription = ref('');
        const formattedMinutes = ref('');
        const groqApiKey = ref(localStorage.getItem('groqApiKey') || '');
        const geminiApiKey = ref(localStorage.getItem('geminiApiKey') || '');
        const debugMode = ref(localStorage.getItem('debugMode') === 'true');
        const debugLogs = ref([]);
        const showSettingsModal = ref(false);
        const mainSections = ref('');
        const downsampleAudio = ref(localStorage.getItem('downsampleAudio') === 'true');
        const currentChunk = ref(0);
        const totalChunks = ref(0);
        const transcriptionProgress = ref(0);

        watch(groqApiKey, (newValue) => {
            localStorage.setItem('groqApiKey', newValue);
        });

        watch(geminiApiKey, (newValue) => {
            localStorage.setItem('geminiApiKey', newValue);
        });

        watch(debugMode, (newValue) => {
            localStorage.setItem('debugMode', newValue);
        });

        watch(downsampleAudio, (newValue) => {
            localStorage.setItem('downsampleAudio', newValue);
        });

        const addDebugLog = (message) => {
            if (debugMode.value) {
                debugLogs.value.push(`${new Date().toISOString()}: ${message}`);
                if (debugLogs.value.length > 100) {
                    debugLogs.value.shift();
                }
            }
        };

        const handleFileUpload = (event) => {
            selectedFile.value = event.target.files[0];
            addDebugLog(`File selected: ${selectedFile.value.name}`);
        };

        const preprocessAudio = async (file) => {
            addDebugLog('Starting audio preprocessing');
            const reader = new FileReader();
            
            return new Promise((resolve, reject) => {
                reader.onload = async (e) => {
                    try {
                        const arrayBuffer = e.target.result;
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        
                        addDebugLog('Decoding audio data');
                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                        
                        addDebugLog('Converting to mono');
                        const monoBuffer = convertToMono(audioBuffer);
                        
                        if (downsampleAudio.value) {
                            addDebugLog('Resampling to 16kHz');
                            const resampledBuffer = await resampleAudio(audioContext, monoBuffer, 16000);
                            addDebugLog('Converting to MP3');
                            const mp3Data = convertToMp3(resampledBuffer);
                            addDebugLog('Chunking MP3 data');
                            const chunks = chunkMp3Data(mp3Data);
                            addDebugLog('Audio preprocessing completed');
                            resolve(chunks);
                        } else {
                            addDebugLog('Converting to MP3');
                            const mp3Data = convertToMp3(monoBuffer);
                            addDebugLog('Chunking MP3 data');
                            const chunks = chunkMp3Data(mp3Data);
                            addDebugLog('Audio preprocessing completed');
                            resolve(chunks);
                        }
                    } catch (error) {
                        addDebugLog('Error during audio preprocessing: ' + error.message);
                        reject(error);
                    }
                };
                reader.onerror = (error) => reject(error);
                reader.readAsArrayBuffer(file);
            });
        };
        
        const convertToMono = (audioBuffer) => {
            const numChannels = audioBuffer.numberOfChannels;
            const length = audioBuffer.length;
            const monoBuffer = new AudioBuffer({
                length: length,
                numberOfChannels: 1,
                sampleRate: audioBuffer.sampleRate
            });
            const monoData = monoBuffer.getChannelData(0);
        
            for (let i = 0; i < length; i++) {
                let sum = 0;
                for (let channel = 0; channel < numChannels; channel++) {
                    sum += audioBuffer.getChannelData(channel)[i];
                }
                monoData[i] = sum / numChannels;
            }
        
            return monoBuffer;
        };
        
        const resampleAudio = async (audioContext, audioBuffer, targetSampleRate) => {
            const offlineContext = new OfflineAudioContext(1, audioBuffer.duration * targetSampleRate, targetSampleRate);
            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineContext.destination);
            source.start();
            return await offlineContext.startRendering();
        };
        
        const convertToMp3 = (audioBuffer) => {
            const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);
            const samples = new Int16Array(audioBuffer.length);
            const channelData = audioBuffer.getChannelData(0);
            
            for (let i = 0; i < audioBuffer.length; i++) {
                samples[i] = channelData[i] * 32767;
            }
        
            const mp3Data = [];
            const blockSize = 1152;
            for (let i = 0; i < samples.length; i += blockSize) {
                const sampleChunk = samples.subarray(i, i + blockSize);
                const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(new Int8Array(mp3buf));
                }
            }
        
            const mp3buf = mp3encoder.flush();
            if (mp3buf.length > 0) {
                mp3Data.push(new Int8Array(mp3buf));
            }
        
            return mp3Data;
        };

        const chunkMp3Data = (mp3Data) => {
            const chunks = [];
            let currentChunk = [];
            let currentSize = 0;
            const maxChunkSize = 5 * 1024 * 1024; // 5MB

            for (const data of mp3Data) {
                if (currentSize + data.length > maxChunkSize) {
                    chunks.push(new Blob(currentChunk, { type: 'audio/mp3' }));
                    currentChunk = [];
                    currentSize = 0;
                }
                currentChunk.push(data);
                currentSize += data.length;
            }

            if (currentChunk.length > 0) {
                chunks.push(new Blob(currentChunk, { type: 'audio/mp3' }));
            }

            return chunks;
        };

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const transcribeChunk = async (chunk, retries = 3) => {
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    const formData = new FormData();
                    formData.append('file', chunk, 'audio.mp3');
                    formData.append('model', selectedModel.value);
                    if (selectedModel.value === 'whisper-large-v3' && selectedLanguage.value) {
                        formData.append('language', selectedLanguage.value);
                    }

                    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${groqApiKey.value}`
                        },
                        body: formData
                    });

                    if (!response.ok) {
                        if (response.status === 429) {
                            const waitTime = Math.pow(2, attempt) * 1000;
                            addDebugLog(`Rate limited. Waiting ${waitTime}ms before retry.`);
                            await delay(waitTime);
                            continue;
                        }
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    return data.text;
                } catch (error) {
                    if (attempt === retries - 1) {
                        throw error;
                    }
                    addDebugLog(`Attempt ${attempt + 1} failed. Retrying...`);
                }
            }
        };

        const transcribeFile = async () => {
            if (!selectedFile.value) {
                status.value = 'Please select a file';
                hasError.value = true;
                addDebugLog('Transcription attempted without file selection');
                return;
            }

            if (!groqApiKey.value) {
                status.value = 'Please set your Groq API key in the settings';
                hasError.value = true;
                addDebugLog('Transcription attempted without Groq API key');
                return;
            }

            isTranscribing.value = true;
            status.value = 'Preprocessing audio...';
            hasError.value = false;
            transcription.value = '';
            streamingTranscription.value = '';
            addDebugLog('Starting audio preprocessing');

            try {
                const preprocessedChunks = await preprocessAudio(selectedFile.value);
                totalChunks.value = preprocessedChunks.length;
                status.value = 'Transcribing...';
                addDebugLog('Audio preprocessing completed, starting transcription');

                let fullTranscription = '';
                for (let i = 0; i < preprocessedChunks.length; i++) {
                    if (!isTranscribing.value) {
                        addDebugLog('Transcription cancelled');
                        break;
                    }
                    const chunk = preprocessedChunks[i];
                    currentChunk.value = i + 1;
                    addDebugLog(`Transcribing chunk ${currentChunk.value} of ${totalChunks.value}`);
                    status.value = `Transcribing chunk ${currentChunk.value} of ${totalChunks.value}`;

                    const chunkTranscription = await transcribeChunk(chunk);
                    fullTranscription += chunkTranscription + ' ';
                    streamingTranscription.value = fullTranscription;
                    transcriptionProgress.value = (currentChunk.value / totalChunks.value) * 100;
                }

                transcription.value = fullTranscription.trim();
                status.value = 'Transcription complete';
                addDebugLog('Transcription completed successfully');
            } catch (error) {
                console.error('Transcription error:', error);
                status.value = 'Error during transcription: ' + error.message;
                hasError.value = true;
                addDebugLog(`Transcription error: ${error.message}`);
            } finally {
                isTranscribing.value = false;
                currentChunk.value = 0;
                totalChunks.value = 0;
                transcriptionProgress.value = 0;
            }
        };

        const cancelTranscription = () => {
            isTranscribing.value = false;
            status.value = 'Transcription canceled';
            addDebugLog('Transcription canceled by user');
        };

        const newTranscription = () => {
            selectedFile.value = null;
            transcription.value = '';
            streamingTranscription.value = '';
            formattedMinutes.value = '';
            status.value = '';
            hasError.value = false;
            debugLogs.value = [];
            currentChunk.value = 0;
            totalChunks.value = 0;
            transcriptionProgress.value = 0;
            addDebugLog('New transcription initiated');
        };

        const generateMinutes = async () => {
            if (!transcription.value) {
                status.value = 'No transcription available';
                hasError.value = true;
                addDebugLog('Minutes generation attempted without transcription');
                return;
            }

            if (!geminiApiKey.value) {
                status.value = 'Please set your Gemini API key in the settings';
                hasError.value = true;
                addDebugLog('Minutes generation attempted without Gemini API key');
                return;
            }

            status.value = 'Generating minutes...';
            hasError.value = false;
            addDebugLog('Starting minutes generation');

            try {
                const prompt = `Generate meeting minutes from the following transcription:
                ${mainSections.value ? `\nUse the following main sections: ${mainSections.value}` : ''}
                \n\n${transcription.value}`;

                const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${geminiApiKey.value}`
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 2048
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                formattedMinutes.value = data.candidates[0].content.parts[0].text;
                status.value = 'Minutes generated';
                addDebugLog('Minutes generated successfully');
            } catch (error) {
                console.error('Minutes generation error:', error);
                status.value = 'Error generating minutes: ' + error.message;
                hasError.value = true;
                addDebugLog(`Minutes generation error: ${error.message}`);
            }
        };

        const copyTranscription = () => {
            navigator.clipboard.writeText(transcription.value);
            status.value = 'Transcription copied to clipboard';
            addDebugLog('Transcription copied to clipboard');
        };

        const copyMinutes = () => {
            navigator.clipboard.writeText(formattedMinutes.value);
            status.value = 'Minutes copied to clipboard';
            addDebugLog('Minutes copied to clipboard');
        };

        const openSettingsModal = () => {
            showSettingsModal.value = true;
            addDebugLog('Settings modal opened');
        };

        const closeSettingsModal = () => {
            showSettingsModal.value = false;
            addDebugLog('Settings modal closed');
        };

        return {
            selectedModel,
            selectedLanguage,
            selectedFile,
            generateMinutesSummary,
            isTranscribing,
            status,
            hasError,
            transcription,
            streamingTranscription,
            formattedMinutes,
            groqApiKey,
            geminiApiKey,
            debugMode,
            debugLogs,
            showSettingsModal,
            mainSections,
            downsampleAudio,
            currentChunk,
            totalChunks,
            transcriptionProgress,
            handleFileUpload,
            transcribeFile,
            cancelTranscription,
            newTranscription,
            generateMinutes,
            copyTranscription,
            copyMinutes,
            openSettingsModal,
            closeSettingsModal
        };
    }
}).mount('#app');