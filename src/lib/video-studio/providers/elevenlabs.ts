import "server-only";

import { readMedia, saveMedia } from "@/lib/media-storage";
import { getVideoProviderConfig, requireProviderKey } from "../config";
import { providerFetch } from "../http";

export interface SpeechResult {
  url?: string;
  storageKey?: string;
  alignment: Array<{ text: string; start: number; end: number }>;
  characterCost?: number;
  mock: boolean;
}

function mockAlignment(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const secondsPerWord = 0.38;
  return words.map((word, index) => ({ text: word, start: index * secondsPerWord, end: (index + 1) * secondsPerWord }));
}

export async function synthesizeSpeech(input: {
  text: string;
  voiceId?: string;
  settings?: { stability?: number; similarityBoost?: number; style?: number; speed?: number };
}): Promise<SpeechResult> {
  const config = await getVideoProviderConfig();
  if (config.mockMode) return { alignment: mockAlignment(input.text), mock: true };
  const apiKey = requireProviderKey("ElevenLabs", config.elevenLabs.apiKey);
  if (!input.voiceId) throw new Error("Voice profile chưa có ElevenLabs voice ID");

  const response = await providerFetch(
    `${config.elevenLabs.baseUrl}/v1/text-to-speech/${encodeURIComponent(input.voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: input.text,
        model_id: config.elevenLabs.model,
        language_code: "vi",
        voice_settings: {
          stability: input.settings?.stability ?? 0.55,
          similarity_boost: input.settings?.similarityBoost ?? 0.78,
          style: input.settings?.style ?? 0.2,
          speed: input.settings?.speed ?? 1,
          use_speaker_boost: true,
        },
      }),
    },
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  const stored = await saveMedia({ folder: "video-studio/audio", buffer, extension: "mp3" });
  const alignment = await alignSpeech({ storageKey: stored.key, text: input.text }).catch(() => mockAlignment(input.text));
  const characterCost = Number(response.headers.get("character-cost") || 0) || undefined;
  return { url: stored.url, storageKey: stored.key, alignment, characterCost, mock: false };
}

export async function alignSpeech(input: { storageKey: string; text: string }) {
  const config = await getVideoProviderConfig();
  if (config.mockMode) return mockAlignment(input.text);
  const apiKey = requireProviderKey("ElevenLabs", config.elevenLabs.apiKey);
  const buffer = await readMedia(input.storageKey);
  const form = new FormData();
  form.set("file", new Blob([buffer], { type: "audio/mpeg" }), "voice.mp3");
  form.set("text", input.text);
  const response = await providerFetch(`${config.elevenLabs.baseUrl}/v1/forced-alignment`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  const data = await response.json() as { words?: Array<{ text?: string; start?: number; end?: number }> };
  return (data.words || []).map((word) => ({ text: word.text || "", start: word.start || 0, end: word.end || 0 }));
}

export async function cloneVoice(input: { name: string; description?: string; storageKey: string }) {
  const config = await getVideoProviderConfig();
  if (config.mockMode) return { voiceId: `mock-voice-${crypto.randomUUID()}` };
  const apiKey = requireProviderKey("ElevenLabs", config.elevenLabs.apiKey);
  const buffer = await readMedia(input.storageKey);
  const form = new FormData();
  form.set("name", input.name);
  form.set("description", input.description || "Giọng nhân viên AutoSpa đã được cấp quyền sử dụng");
  form.append("files", new Blob([buffer], { type: "audio/mpeg" }), "sample.mp3");
  const response = await providerFetch(`${config.elevenLabs.baseUrl}/v1/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  const data = await response.json() as { voice_id?: string };
  if (!data.voice_id) throw new Error("ElevenLabs không trả về voice ID");
  return { voiceId: data.voice_id };
}
