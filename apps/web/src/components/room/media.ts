/** Browser media helpers used when creating image/audio canvas objects. */

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export async function recordAudioBrief(): Promise<Blob | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    return await new Promise((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: "audio/webm" }));
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 2500);
    });
  } catch {
    alert("Microphone access is required for audio objects.");
    return null;
  }
}
