# Audio Transcription with Formatted Meeting Minutes (Vue.js & Groq)

This project demonstrates audio transcription using the Groq API for OpenAI's Whisper model, built with Vue.js. It provides a simple interface to upload audio files (.mp3, .mp4, etc.), select a Whisper model, and generate a transcription.  While the ultimate goal is to format the transcription into meeting minutes, this functionality is not yet implemented.

## Features

* **Audio File Upload:** Supports various audio formats.
* **Model Selection:** Choose between `distil-whisper-large-v3-en` (English only, faster) and `whisper-large-v3` (Multilingual).
* **Transcription Display:** Shows the generated transcription text.
* **Progress Bar:** Indicates transcription progress.
* **Cancellation:** Allows interrupting the transcription process.
* **Settings:** Configure Groq API key, debug mode, and audio downsampling.
* **Chunking and Preprocessing:** Handles large audio files by splitting them into smaller chunks and optionally downsampling to 16kHz.
* **Debug Logging:** Provides detailed logs for troubleshooting.

## Future Enhancements (Planned)

* **Meeting Minutes Formatting:** Structure the transcription into a formatted meeting minutes document.
* **Speaker Identification (Diarization):**  Identify different speakers in the audio.
* **Timestamping:** Include timestamps in the transcription and meeting minutes.
* **Summarization:** Generate summaries of the meeting.
* **Action Item Extraction:** Automatically extract action items.

## Getting Started

1. **Clone the repository:** `git clone https://github.com/your-username/your-repo-name.git`
2. **Install dependencies:** `npm install`
3. **Obtain a Groq API key:**  [Get a Groq API Key](https://groq.com/docs/guides/how-to-get-an-api-key)
4. **Configure settings:**
    * Open the application in your browser.
    * Click the "Settings" button.
    * Enter your Groq API key.
    * Optionally enable debug mode and audio downsampling.
    * Click "Save."
5. **Transcribe audio:**
    * Select an audio file.
    * Choose a model.
    * Click "Transcribe."

## Project Structure

* `index.html`: Main HTML file.
* `styles.css`: Styles for the application.
* `js/app.js`: Main Vue.js application logic.
* `js/audioProcessing.js`: Functions for audio preprocessing (chunking, downsampling, WAV conversion).


## Dependencies

* **Vue.js 3:** JavaScript framework for building user interfaces.

## Contributing

Contributions are welcome! Please feel free to submit pull requests.


## License

This project is licensed under the [MIT License](LICENSE).
