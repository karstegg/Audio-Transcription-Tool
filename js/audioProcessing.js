export async function preprocessAudio(file, shouldDownsample, addLog) {
    addLog('Starting audio preprocessing');
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    addLog('Decoding audio data');
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    addLog('Converting to mono');
    const monoBuffer = convertToMono(audioBuffer);
    
    let processedBuffer = monoBuffer;
    if (shouldDownsample) {
        addLog('Downsampling to 16kHz');
        processedBuffer = await resampleAudio(audioContext, monoBuffer, 16000);
    }
    
    addLog('Chunking audio data');
    const chunks = chunkAudioData(processedBuffer, audioContext.sampleRate);
    
    addLog('Audio preprocessing completed');
    return chunks;
}

function convertToMono(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const monoData = new Float32Array(length);

    for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let channel = 0; channel < numChannels; channel++) {
            sum += audioBuffer.getChannelData(channel)[i];
        }
        monoData[i] = sum / numChannels;
    }

    return monoData;
}

async function resampleAudio(audioContext, audioData, targetSampleRate) {
    const offlineContext = new OfflineAudioContext(1, audioData.length * targetSampleRate / audioContext.sampleRate, targetSampleRate);
    const source = offlineContext.createBufferSource();
    const audioBuffer = audioContext.createBuffer(1, audioData.length, audioContext.sampleRate);
    audioBuffer.getChannelData(0).set(audioData);
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    const renderedBuffer = await offlineContext.startRendering();
    return renderedBuffer.getChannelData(0);
}

function chunkAudioData(audioData, sampleRate) {
    const bytesPerSample = 2; // 16-bit audio
    const maxChunkSize = 5 * 1024 * 1024; // 5MB
    const samplesPerChunk = Math.floor(maxChunkSize / bytesPerSample);
    const chunks = [];

    for (let i = 0; i < audioData.length; i += samplesPerChunk) {
        const chunkData = audioData.slice(i, i + samplesPerChunk);
        const wavBuffer = createWavBuffer(chunkData, sampleRate);
        chunks.push(new Blob([wavBuffer], { type: 'audio/wav' }));
    }

    return chunks;
}

function createWavBuffer(audioData, sampleRate) {
    const buffer = new ArrayBuffer(44 + audioData.length * 2);
    const view = new DataView(buffer);

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + audioData.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, audioData.length * 2, true);

    // Write audio data
    floatTo16BitPCM(view, 44, audioData);

    return buffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(view, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}