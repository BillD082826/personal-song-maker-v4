/* Normalize locally; original file and location metadata are never uploaded. */
window.prepareLyriBopPhoto = async function(file) {
  if (!file) return null;
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 12*1024*1024) throw new Error('Choose a PNG, JPEG or WebP photo up to 12 MB.');
  const url=URL.createObjectURL(file), image=new Image();
  try {
    image.src=url; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Photo could not be read.');
    const scale=Math.min(1,800/image.naturalWidth,800/image.naturalHeight);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/png');
    if(data.length>1400000) throw new Error('This photo is too detailed. Please choose a smaller image.');
    return data;
  } finally {URL.revokeObjectURL(url);}
};
