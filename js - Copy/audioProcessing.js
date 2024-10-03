export const convertToMono = (audioBuffer) => {
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

export const resampleAudio = async (audioContext, audioBuffer, targetSampleRate) => {
    const offlineContext = new OfflineAudioContext(1, audioBuffer.duration * targetSampleRate, targetSampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    return await offlineContext.startRendering();
};

export const convertToMp3 = (audioBuffer) => {
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

export const chunkMp3Data = (mp3Data) => {
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

export const preprocessAudio = async (file, downsampleAudio, addDebugLog) => {
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
                
                if (downsampleAudio) {
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
