import { GoogleGenAI, Modality } from "@google/genai";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helpers for Audio encoding/decoding
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const generateSpeechSample = async (text: string, voice: 'Kore' | 'Puck' | 'Fenrir' = 'Kore'): Promise<ArrayBuffer | null> => {
  try {
    const model = 'gemini-2.5-flash-preview-tts';
    
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: `Say this clearly for a music track: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      const bytes = decode(base64Audio);
      return bytes.buffer;
    }
    return null;

  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};