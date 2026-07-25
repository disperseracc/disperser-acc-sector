/**
 * Converts an AudioBuffer to an MP3 Blob
 * Uses the global lamejs object from index.html
 */
export async function encodeMp3(audioBuffer: AudioBuffer, kbps: number = 128): Promise<Blob> {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  
  // Use the global lamejs object loaded from CDN
  const lame = (window as any).lamejs;
  if (!lame) {
    throw new Error("LameJS not loaded. Please refresh the page.");
  }
  
  const mp3encoder = new lame.Mp3Encoder(channels, sampleRate, kbps);
  const mp3Data: any[] = [];

  const left = audioBuffer.getChannelData(0);
  const right = channels > 1 ? audioBuffer.getChannelData(1) : null;

  // Convert Float32 to Int16
  const sampleBlockSize = 1152;
  const leftInt16 = new Int16Array(left.length);
  const rightInt16 = right ? new Int16Array(right.length) : null;

  for (let i = 0; i < left.length; i++) {
    leftInt16[i] = left[i] < 0 ? left[i] * 0x8000 : left[i] * 0x7FFF;
    if (rightInt16 && right) {
      rightInt16[i] = right[i] < 0 ? right[i] * 0x8000 : right[i] * 0x7FFF;
    }
  }

  // Encode in blocks
  for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    let mp3buf;
    if (rightInt16) {
      const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    }
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  return new Blob(mp3Data, { type: 'audio/mpeg' });
}
