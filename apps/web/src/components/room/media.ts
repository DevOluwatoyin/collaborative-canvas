/** Browser media helpers used when creating image/audio canvas objects. */

/**
 * Opens the OS file picker, resolving with the chosen file or null if dismissed.
 * The input is attached to the document because some browsers ignore `click()` on
 * a detached element, and `cancel` is handled so a dismissed dialog settles the
 * promise rather than leaving the caller pending forever.
 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener("change", () => finish(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => finish(null));
    input.click();
  });
}

type AudioRecording = {
  blob: Blob;
  durationMs: number;
};

export type RecorderHandle = {
  /** Resolves with the recording, or null when cancelled or unsupported. */
  done: Promise<AudioRecording | null>;
  stop: () => void;
  cancel: () => void;
};

export class MicrophoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MicrophoneError";
  }
}

const MAX_RECORDING_MS = 120_000;

/**
 * Starts an open-ended recording that the caller stops explicitly, with a hard
 * cap so a forgotten session cannot grow without bound.
 */
export async function startAudioRecording(): Promise<RecorderHandle> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneError("This browser does not support audio recording.");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    throw new MicrophoneError(
      err instanceof DOMException && err.name === "NotAllowedError"
        ? "Microphone access was denied. Allow it in your browser to record audio."
        : "No microphone is available for recording."
    );
  }

  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type)
  );

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  const startedAt = performance.now();
  let cancelled = false;

  const done = new Promise<AudioRecording | null>((resolve) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(null);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (cancelled || chunks.length === 0) {
        resolve(null);
        return;
      }
      resolve({
        blob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
        durationMs: performance.now() - startedAt,
      });
    };
  });

  recorder.start(250);

  const stopTimer = setTimeout(() => {
    if (recorder.state === "recording") recorder.stop();
  }, MAX_RECORDING_MS);
  void done.finally(() => clearTimeout(stopTimer));

  return {
    done,
    stop: () => {
      if (recorder.state === "recording") recorder.stop();
    },
    cancel: () => {
      cancelled = true;
      if (recorder.state === "recording") recorder.stop();
      else stream.getTracks().forEach((t) => t.stop());
    },
  };
}
