
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const extractReportData = async (text: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: text,
    config: {
      systemInstruction: "You are a network expert. Extract network incident information from the provided text into a JSON object. Ensure the 'updates' field is an array of objects with 'time' and 'text' keys.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          siteA: { type: Type.STRING },
          siteB: { type: Type.STRING },
          ttNumber: { type: Type.STRING },
          occurTime: { type: Type.STRING },
          dispatchTime: { type: Type.STRING },
          pic: { type: Type.STRING },
          rootcause: { type: Type.STRING },
          cutPoint: { type: Type.STRING },
          updates: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                text: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });
  
  return JSON.parse(response.text || '{}');
};

export const suggestRootCause = async (context: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze logs: ${context}`,
    config: {
      systemInstruction: "Identify the technical Root Cause of the network incident. Return only a short Indonesian description.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rootcause: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const generateSummary = async (data: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Data: ${data}`,
    config: {
      systemInstruction: "Generate a professional executive summary for WhatsApp/Email in Indonesian.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const translateBatch = async (items: string[]) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: JSON.stringify(items),
    config: {
      systemInstruction: "Translate the following Indonesian network updates into technical English. Return a JSON array of strings.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  return JSON.parse(response.text || '[]');
};
