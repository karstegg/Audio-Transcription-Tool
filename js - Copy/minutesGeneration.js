export const generateMinutes = async (transcription, mainSections, geminiApiKey, addDebugLog) => {
    const prompt = `Generate meeting minutes from the following transcription:
    ${mainSections ? `\nUse the following main sections: ${mainSections}` : ''}
    \n\n${transcription}`;

    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${geminiApiKey}`
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
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
            addDebugLog('Minutes generated successfully');
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('Unexpected response format from Gemini API');
        }
    } catch (error) {
        addDebugLog(`Minutes generation error: ${error.message}`);
        throw error;
    }
};
