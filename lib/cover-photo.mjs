// Browser-normalized, bounded PNGs only; no external URLs or executable SVG uploads.
export function validateCoverPhoto(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 1400000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Choose a PNG or JPEG photo using the photo upload control.');
  const bytes = Buffer.from(value.split(',')[1], 'base64');
  if (bytes.length < 45 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.toString('ascii',12,16) !== 'IHDR' || bytes.readUInt32BE(16) < 1 || bytes.readUInt32BE(20) < 1 || bytes.readUInt32BE(16) > 1000 || bytes.readUInt32BE(20) > 1000 || bytes.toString('ascii',bytes.length-8,bytes.length-4) !== 'IEND') throw new Error('Photo could not be read. Please choose another PNG or JPEG image.');
  return value;
}
export function defaultOrderCover(order) {
  return {template:'other', title:String(order.song_title || 'Your Personal Song').slice(0,40), names:String(order.person || 'Made for you').slice(0,60), message:'', photo:order.cover_photo || null};
}
export function coverForOrder(order) {
  return order.album_cover ? {...order.album_cover, photo:order.album_cover.photo_data ?? order.cover_photo ?? null} : defaultOrderCover(order);
}
