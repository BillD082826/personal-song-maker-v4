import NodeID3 from 'node-id3';

// Change ID3 metadata only; retain original encoded audio and its timing headers.
export async function embedMp3Cover(audio, jpeg, title) {
  if (!Buffer.isBuffer(audio) || !Buffer.isBuffer(jpeg)) throw new Error('Invalid MP3 or artwork.');
  const originalPayload = NodeID3.removeTagsFromBuffer(audio);
  if (!Buffer.isBuffer(originalPayload) || originalPayload.length < 4 || originalPayload[0] !== 255 || (originalPayload[1] & 224) !== 224) {
    throw new Error('This audio is not an MP3.');
  }
  const output = NodeID3.update({
    title,
    artist: 'LyriBop',
    image: { mime: 'image/jpeg', type: { id: 3, name: 'front cover' }, description: 'Song cover', imageBuffer: jpeg }
  }, audio, { exclude: ['APIC'] });
  if (!Buffer.isBuffer(output) || !NodeID3.removeTagsFromBuffer(output).equals(originalPayload)) {
    throw new Error('Could not safely attach the MP3 cover.');
  }
  return output;
}
