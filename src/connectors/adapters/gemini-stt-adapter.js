"use strict";

require("../../config");

const fs = require("node:fs");
const { GoogleGenAI } = require("@google/genai");

const MODEL = "gemini-3.5-transcribe";
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

const MIME_TYPES = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
]);

function fail(type, message, extra = {}) {
  return {
    success: false,
    type,
    message,
    model: MODEL,
    executionAllowed: false,
    externalExecution: false,
    actionExecution: "plan_only",
    requiresApproval: true,
    failClosed: true,
    ...extra,
  };
}

function normalizeMimeType(value) {
  const mime = typeof value === "string"
    ? value.trim().toLowerCase()
    : "";

  return MIME_TYPES.has(mime) ? mime : "";
}

function extractTranscript(result) {
  if (!result) return "";

  // Canonical Gemini Interactions API transcription output.
  if (
    typeof result.output_text === "string" &&
    result.output_text.trim()
  ) {
    return result.output_text.trim();
  }

  // Defensive compatibility for SDK/object naming variants.
  if (
    typeof result.outputText === "string" &&
    result.outputText.trim()
  ) {
    return result.outputText.trim();
  }

  if (
    typeof result.text === "string" &&
    result.text.trim()
  ) {
    return result.text.trim();
  }

  const outputs = Array.isArray(result.outputs)
    ? result.outputs
    : [];

  const outputText = outputs
    .map((item) =>
      item && typeof item.text === "string"
        ? item.text.trim()
        : ""
    )
    .filter(Boolean)
    .join("\n")
    .trim();

  if (outputText) return outputText;

  const candidates = Array.isArray(result.candidates)
    ? result.candidates
    : [];

  const parts = candidates.flatMap((candidate) => {
    const content = candidate && candidate.content;
    return content && Array.isArray(content.parts)
      ? content.parts
      : [];
  });

  const candidateText = parts
    .map((part) =>
      part && typeof part.text === "string"
        ? part.text.trim()
        : ""
    )
    .filter(Boolean)
    .join("\n")
    .trim();

  if (candidateText) return candidateText;

  const steps = Array.isArray(result.steps)
    ? result.steps
    : [];

  return steps
    .flatMap((step) =>
      Array.isArray(step && step.content)
        ? step.content
        : []
    )
    .map((content) =>
      content && typeof content.text === "string"
        ? content.text.trim()
        : ""
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

class GeminiSTTAdapter {
  constructor() {
    this.model = MODEL;
  }

  async transcribe(audio, context = {}) {
    const audioPath =
      audio && typeof audio.filePath === "string"
        ? audio.filePath.trim()
        : "";

    const mimeType = normalizeMimeType(
      audio && audio.mimeType ? audio.mimeType : ""
    );

    if (!audioPath) {
      return fail(
        "stt_audio_path_required",
        "Audio file path is required."
      );
    }

    if (!mimeType) {
      return fail(
        "stt_audio_mime_type_unsupported",
        "Unsupported audio MIME type."
      );
    }

    if (!fs.existsSync(audioPath)) {
      return fail(
        "stt_audio_file_missing",
        "Audio file does not exist."
      );
    }

    let stat;

    try {
      stat = fs.statSync(audioPath);
    } catch (error) {
      return fail(
        "stt_audio_stat_failed",
        error instanceof Error ? error.message : "Unable to inspect audio file."
      );
    }

    if (!stat.isFile()) {
      return fail(
        "stt_audio_not_file",
        "Audio path is not a regular file."
      );
    }

    if (stat.size <= 0) {
      return fail(
        "stt_audio_empty",
        "Audio file is empty."
      );
    }

    if (stat.size > MAX_AUDIO_BYTES) {
      return fail(
        "stt_audio_too_large",
        "Audio file exceeds the STT input limit.",
        {
          maxAudioBytes: MAX_AUDIO_BYTES,
          audioBytes: stat.size,
        }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      return fail(
        "stt_provider_not_configured",
        "Gemini API key is not configured."
      );
    }

    const client = new GoogleGenAI({
      apiKey: apiKey.trim(),
    });

    let uploadedFile = null;

    try {
      uploadedFile = await client.files.upload({
        file: audioPath,
        config: {
          mimeType,
        },
      });

      if (
        !uploadedFile ||
        typeof uploadedFile.uri !== "string" ||
        !uploadedFile.uri.trim()
      ) {
        return fail(
          "stt_upload_failed",
          "Gemini Files API did not return a usable file URI."
        );
      }

      const languageHint =
        context &&
        typeof context.languageCode === "string" &&
        context.languageCode.trim()
          ? context.languageCode.trim()
          : "ar-SD";

      const prompt =
        "Generate a faithful speech-to-text transcript of this audio. " +
        "Preserve the speaker's original wording and Sudanese Arabic when present. " +
        "Do not answer the speaker. " +
        "Do not summarize. " +
        "Do not explain. " +
        "Do not add commentary. " +
        "Return only the transcript text. " +
        `Preferred language hint: ${languageHint}.`;

      /*
       * Gemini 3.5 Transcribe uses Google's documented Generate Content
       * transcription contract. The response is treated strictly as
       * transcription data, never as an executable instruction.
       */

      try {
        const result = await client.interactions.create({
          model: MODEL,
          input: [
            {
              type: "audio",
              uri: uploadedFile.uri,
              mime_type: uploadedFile.mimeType || mimeType,
            },
          ],
          generation_config: {
            transcription_config: {
              language_codes: ["ar"],
              mode: "smart",
            },
          },
        });

        const transcript = extractTranscript(result);

        if (transcript) {
          return {
            success: true,
            type: "gemini_stt_transcription",
            model: MODEL,
            requestedModel: MODEL,
            fallbackUsed: false,
            transcript,
            text: transcript,
            executionAllowed: false,
            externalExecution: false,
            actionExecution: "plan_only",
            requiresApproval: true,
            failClosed: false,
            audioBytes: stat.size,
            mimeType,
          };
        }

        return fail(
          "stt_empty_transcript",
          "Gemini returned no transcript.",
          {
            model: MODEL,
            requestedModel: MODEL,
            fallbackUsed: false,
            retryable: false,
          }
        );
      } catch (error) {
        const message =
          error && typeof error.message === "string"
            ? error.message
            : "Gemini STT request failed.";

        const status =
          error && typeof error.status === "number"
            ? error.status
            : null;

        const retryable =
          status === 408 ||
          status === 425 ||
          status === 429 ||
          (status >= 500 && status <= 599) ||
          message.includes("RESOURCE_EXHAUSTED") ||
          message.includes("UNAVAILABLE") ||
          message.includes("high demand") ||
          message.includes("quota");

        return fail(
          "gemini_stt_failed",
          message,
          {
            model: MODEL,
            requestedModel: MODEL,
            fallbackUsed: false,
            status,
            retryable,
            providerType: "gemini-3.5-transcribe",
            providerError:
              error && typeof error === "object"
                ? {
                    name:
                      typeof error.name === "string"
                        ? error.name
                        : null,
                    status,
                    message,
                  }
                : null,
          }
        );
      }

    } catch (error) {
      const message =
        error && typeof error.message === "string"
          ? error.message
          : "Gemini STT request failed.";

      return fail(
        "gemini_stt_failed",
        message,
        {
          retryable: true,
          providerType: "gemini-3.5-transcribe",
          providerError:
            error && typeof error === "object"
              ? {
                  name:
                    typeof error.name === "string"
                      ? error.name
                      : null,
                  status:
                    typeof error.status === "number"
                      ? error.status
                      : null,
                  message,
                }
              : null,
        }
      );
    } finally {
      /*
       * The caller owns the local audio lifecycle.
       * This adapter never deletes or modifies the source recording.
       */
      uploadedFile = null;
    }
  }
}

module.exports = GeminiSTTAdapter;
