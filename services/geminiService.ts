import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from "../types";

const GEMINI_API_KEY = process.env.API_KEY || '';

export const generateSpeech = async (text: string, voiceName: VoiceName): Promise<string> => {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing Gemini API Key");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  // Using the specific TTS model as per instructions
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!base64Audio) {
    throw new Error("No audio data returned from Gemini");
  }

  return base64Audio;
};
