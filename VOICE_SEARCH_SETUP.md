# Voice Search Feature Setup Guide

## Overview
This guide explains how to set up the microphone input feature that allows users to search for research papers using voice commands.

## Features Implemented
- ✅ Microphone button in SearchBar UI
- ✅ Voice recording using Web Audio API
- ✅ ElevenLabs Speech-to-Text API integration
- ✅ Automatic arXiv paper search with transcribed text
- ✅ Clean card layout for displaying results

## Setup Instructions

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd Hack-Harvard/PromptEngineering
   ```

2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. **IMPORTANT**: Add your ElevenLabs API key to `API_KEY.py`:
   ```python
   ELEVENLABS_API_KEY = 'your_actual_elevenlabs_api_key_here'
   ```
   - Get your API key from: https://elevenlabs.io/
   - Sign up for a free account if you don't have one

4. Start the Flask backend:
   ```bash
   python app.py
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd Hack-Harvard/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```

## How It Works

### User Flow
1. User clicks the microphone button in the search bar
2. Browser requests microphone permission
3. User speaks their research query
4. User clicks the stop button (or the recording stops automatically)
5. Audio is sent to ElevenLabs Speech-to-Text API
6. Transcribed text is used to search arXiv for relevant papers
7. Results are displayed in clean card format

### Technical Implementation
- **Frontend**: React component with Web Audio API for recording
- **Backend**: Flask endpoint `/transcribe` that handles audio processing
- **API Integration**: ElevenLabs for speech-to-text, arXiv for paper search
- **UI**: Responsive design with recording indicators and loading states

## API Endpoints

### New Endpoint: `/transcribe`
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Body**: audio file (WAV format)
- **Response**: JSON with transcribed text

## Browser Compatibility
- Requires HTTPS for microphone access in production
- Works with modern browsers (Chrome, Firefox, Safari, Edge)
- Microphone permission required

## Troubleshooting

### Common Issues
1. **Microphone not working**: Check browser permissions
2. **Transcription fails**: Verify ElevenLabs API key is correct
3. **No papers found**: Try different search terms or check arXiv API status

### Error Handling
- Graceful fallback to text input if voice recording fails
- User-friendly error messages for common issues
- Loading states during transcription and search

## Security Notes
- Audio data is temporarily stored on server during processing
- No audio data is permanently stored
- API keys should be kept secure and not committed to version control

## Next Steps
1. Add your ElevenLabs API key
2. Test the voice search functionality
3. Customize the UI styling if needed
4. Add additional error handling as required
