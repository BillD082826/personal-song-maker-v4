function createStoryGallery(ad) {
  const gallery = document.createElement('div');
  const image = document.createElement('img');
  image.style.cssText = 'width:100%;max-height:550px;object-fit:contain';
  const counter = document.createElement('p');
  counter.setAttribute('aria-live', 'polite');
  const choices = document.createElement('div');
  choices.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:12px 0';
  const select = index => {
    image.src = ad.images[index];
    image.alt = ad.name + ', panel ' + (index + 1) + ' of ' + ad.images.length;
    counter.textContent = 'Panel ' + (index + 1) + ' of ' + ad.images.length;
    choices.querySelectorAll('button').forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i === index));
      b.style.outline = i === index ? '3px solid #9b59f5' : '';
    });
  };
  ad.images.forEach((src, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ad-choice';
    button.style.cssText = 'width:100px;padding:6px';
    const thumb = document.createElement('img');
    thumb.src = src;
    thumb.alt = '';
    thumb.style.cssText = 'width:100%;display:block';
    const label = document.createElement('span');
    label.textContent = 'Panel ' + (index + 1);
    button.append(thumb, label);
    button.onclick = () => select(index);
    choices.append(button);
  });
  const downloads = document.createElement('div');
  const single = document.createElement('a');
  single.className = 'video-download';
  single.textContent = 'Download Selected Panel';
  single.style.marginRight = '16px';
  single.onclick = () => {
    single.href = image.src;
    single.download = new URL(image.src).pathname.split('/').pop();
  };
  const all = document.createElement('a');
  all.className = 'video-download';
  all.textContent = 'Download All 4 (ZIP)';
  all.href = ad.download;
  all.download = ad.download.split('/').pop();
  downloads.append(single, all);
  gallery.append(image, counter, choices, downloads);
  select(0);
  return gallery;
}
