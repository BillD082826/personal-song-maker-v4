let catalogRequest = 0;
const folderOpenState = new Map();
let catalogSelectedKey = null;
let catalogStartCollapsed = false;
document.addEventListener('click', event => {
  if (!event.target.closest('.sidebar a')) return;
  catalogStartCollapsed = true;
  folderOpenState.clear();
  catalogSelectedKey = null;
  catalogRequest++;
  document.querySelectorAll('details.catalog-folder').forEach(folder => { folder.open = false; });
  document.getElementById('ad-selector').replaceChildren();
  document.getElementById('ad-preview').replaceChildren();
  for (const id of ['facebook-caption', 'instagram-caption', 'ad-hashtags']) {
    const field = document.getElementById(id);
    if (field) field.textContent = '';
  }
  if (typeof showPinterestCaption === 'function') showPinterestCaption(null);
}, true);

function setCatalogFolderOpen(details, open) {
  if (open && details.parentElement) {
    for (const sibling of details.parentElement.children) {
      if (sibling !== details && sibling.matches('details.catalog-folder')) {
        sibling.open = false;
        folderOpenState.set(sibling.dataset.folderKey, false);
      }
    }
  }
  details.open = open;
  folderOpenState.set(details.dataset.folderKey, open);
}

function adCatalogKey(ad) { return ad.type + '-' + ad.id; }
function adFolderGroup(ad) {
  if (ad.type === 'video') return 'video';
  if (Array.isArray(ad.images) && ad.images.length > 1) return 'stories';
  if (/pinterest/i.test(ad.name)) return 'pinterest';
  return Number(ad.id) <= 7 ? 'original' : 'concepts';
}
function catalogAdStatus(ad, defaults) {
  return localStorage.getItem('lyribop-status-' + adCatalogKey(ad)) || defaults[adCatalogKey(ad)] || 'Draft';
}
function catalogVisibleAds(ads, defaults, view) {
  return ads.filter(ad => view === 'ready' ? catalogAdStatus(ad, defaults) === 'Ready to Post' :
    view === 'archive' ? catalogAdStatus(ad, defaults) === 'Archive' : true);
}
async function showAllAds(selectedType, selectedId) {
  return renderFolderCatalog('all', selectedType, selectedId);
}
async function showReadyToPost() { return renderFolderCatalog('ready'); }
async function showArchivedAds() { return renderFolderCatalog('archive'); }
async function renderFolderCatalog(view, selectedType, selectedId) {
  const startCollapsed = catalogStartCollapsed && !(selectedType && selectedId != null);
  catalogStartCollapsed = false;
  const request = ++catalogRequest;
  const selector = document.getElementById('ad-selector');
  const preview = document.getElementById('ad-preview');
  const captions = document.querySelector('.caption-section');
  const panel = selector.closest('.panel');
  const labels = {all:'All Ads',ready:'Ready to Post',archive:'Archive',static:'Static Ads',videos:'Video Ads'};
  document.getElementById('section-title').textContent = labels[view];
  captions.style.display = view === 'archive' ? 'none' : '';
  panel.classList.add('folder-catalog-panel');
  selector.replaceChildren();
  preview.replaceChildren();
  selector.textContent = 'Loading advertisements…';
  try {
    const responses = await Promise.all(['all-ads.json','ad-status.json'].map(url => fetch(url,{cache:'no-store'})));
    if (responses.some(response => !response.ok)) throw new Error('Could not load advertisements.');
    const [ads, defaults] = await Promise.all(responses.map(response => response.json()));
    if (request !== catalogRequest || !panel.classList.contains('folder-catalog-panel')) return;
    const scopedAds = ads.filter(ad => view === 'static' ? ad.type !== 'video' : view === 'videos' ? ad.type === 'video' : true);
    const visible = catalogVisibleAds(scopedAds, defaults, view);
    selector.replaceChildren();
    const hint = document.createElement('p');
    hint.className = 'catalog-hint';
    hint.textContent = view === 'ready' ? 'Only ads marked Ready to Post' : 'Open a folder to choose an advertisement';
    selector.append(hint);
    if (!visible.length) {
      preview.textContent = view === 'archive' ? 'No archived advertisements.' : 'No advertisements in this view.';
      if (typeof showPinterestCaption === 'function') showPinterestCaption(null);
      return;
    }
    const explicitKey = selectedType && selectedId != null ? selectedType + '-' + selectedId : null;
    const initialAd = visible.find(ad => adCatalogKey(ad) === (explicitKey || catalogSelectedKey)) || visible[0];
    const initialKey = adCatalogKey(initialAd);
    const buttons = new Map();
    function folder(parent, label, key, count, initiallyOpen) {
      const details = document.createElement('details');
      details.className = 'catalog-folder';
      details.dataset.folderKey = key;
      details.name = parent === selector ? 'catalog-main-folders' : 'catalog-static-folders';
      const shouldOpen = !startCollapsed && (folderOpenState.has(key) ? folderOpenState.get(key) : initiallyOpen);
      const summary = document.createElement('summary');
      const icon = document.createElement('span');
      icon.textContent = '📁';
      icon.setAttribute('aria-hidden','true');
      const title = document.createElement('span');
      title.textContent = label;
      const badge = document.createElement('span');
      badge.className = 'folder-count';
      badge.textContent = String(count);
      summary.append(icon,title,badge);
      details.append(summary);
      details.addEventListener('toggle', () => setCatalogFolderOpen(details, details.open));
      summary.addEventListener('click', event => {
        event.preventDefault();
        setCatalogFolderOpen(details, !details.open);
      });
      parent.append(details);
      setCatalogFolderOpen(details, shouldOpen);
      return details;
    }
    function addAd(parent, ad) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ad-choice catalog-ad';
      button.dataset.adType = ad.type;
      button.dataset.adId = String(ad.id);
      const label = document.createElement('span');
      label.textContent = ad.name;
      button.append(label);
      if (ad.images) {
        const small = document.createElement('small');
        small.textContent = ad.images.length + ' panels';
        button.append(small);
      }
      button.onclick = () => {
        buttons.forEach(b => {b.classList.remove('selected');b.removeAttribute('aria-current');});
        button.classList.add('selected');
        button.setAttribute('aria-current','true');
        catalogSelectedKey = adCatalogKey(ad);
        for (let item = button.parentElement; item && item !== selector; item = item.parentElement) {
          if (item.tagName === 'DETAILS') setCatalogFolderOpen(item, true);
        }
        captions.style.display = view === 'archive' ? 'none' : '';
        renderFolderAdPreview(ad, defaults, view);
      };
      buttons.set(adCatalogKey(ad),button);
      parent.append(button);
    }
    const statics = visible.filter(ad => ad.type !== 'video');
    if (statics.length) {
      const top = folder(selector,'Static Ads','static',statics.length,initialAd.type !== 'video');
      for (const [group,label] of [['original','Original Ads'],['pinterest','Pinterest Ads'],['concepts','New Concepts'],['stories','Story Collections']]) {
        const items = statics.filter(ad => adFolderGroup(ad) === group);
        if (!items.length) continue;
        const sub = folder(top,label,group,items.length,adFolderGroup(initialAd) === group);
        items.forEach(ad => addAd(sub,ad));
      }
    }
    const videos = visible.filter(ad => ad.type === 'video');
    if (videos.length) {
      const top = folder(selector,'Video Ads','video',videos.length,initialAd.type === 'video');
      videos.forEach(ad => addAd(top,ad));
    }
    if (startCollapsed) {
      captions.style.display = 'none';
      preview.textContent = 'Open a folder and select an advertisement to preview it.';
    } else {
      captions.style.display = view === 'archive' ? 'none' : '';
      buttons.get(initialKey).click();
    }
  } catch (error) {
    if (request !== catalogRequest) return;
    selector.replaceChildren();
    preview.textContent = error.message;
  }
}

function renderFolderAdPreview(ad, defaults, view) {
      const preview = document.getElementById("ad-preview");
      preview.replaceChildren();
      const heading = document.createElement("h2");
      heading.textContent = ad.name;
      const media = document.createElement(ad.type === "video" ? "video" : "img");
      media.src = encodeURI(ad.type === "video" ? ad.video : ad.image);
      media.style.width = "100%";
      media.style.maxHeight = "550px";
      media.style.objectFit = "contain";
      if (ad.type === "video") {
        media.controls = true;
        showVideoCaptions(ad.id);
      } else {
        showAdCaptions(ad.id);
      }
      const statusControls = document.createElement("div");
      statusControls.className = "ad-status-controls";
      const statusKey = ad.type + "-" + ad.id;
      const statuses = ["Draft", "Ready to Post", "Archive", "Record Posting"];
      const currentStatus = catalogAdStatus(ad, defaults);
      for (const status of statuses) {
        const statusButton = document.createElement("button");
        statusButton.textContent = status;
        statusButton.className = "ad-choice";
        statusButton.classList.toggle("status-active", status === currentStatus);
        if (status !== "Record Posting") statusButton.setAttribute("aria-pressed", String(status === currentStatus));
        statusButton.onclick = () => {
          if (status === "Record Posting") {
            recordPosting(ad);
            return;
          }
          localStorage.setItem("lyribop-status-" + statusKey, status);
          if (view === 'ready' || view === 'archive') { renderFolderCatalog(view); return; }
          statusControls.querySelectorAll('[aria-pressed]').forEach(b => {
            b.classList.toggle('status-active', b === statusButton);
            b.setAttribute('aria-pressed', String(b === statusButton));
          });
        };
        statusControls.append(statusButton);
      }
      const downloadButton = document.createElement("button");
      downloadButton.textContent = ad.images ? "Download All 4 (ZIP)" : "Download Advertisement";
      downloadButton.className = "ad-choice";
      downloadButton.onclick = () => {
        const link = document.createElement("a");
        link.href = ad.download || media.src;
        link.download = decodeURIComponent(new URL(link.href, location.href).pathname.split("/").pop());
        document.body.append(link);
        link.click();
        link.remove();
      };
      statusControls.append(downloadButton);
      preview.append(heading, statusControls, ad.images ? createStoryGallery(ad) : media);
}

async function showCaptionsSection() {
  await showAllAds();
  document.getElementById("section-title").textContent = "Captions";
}

async function showHashtagsSection() {
  await showAllAds();
  document.getElementById("section-title").textContent = "Hashtags";
}

function createAllAdsButton(type, id) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ad-choice";
  button.textContent = "View in All Ads";
  button.style.marginBottom = "12px";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await showAllAds(type, id);
      document.querySelectorAll(".sidebar a").forEach(link => {
        link.classList.toggle("active", link.textContent.trim() === "All Ads");
      });
    } catch (error) {
      button.disabled = false;
      alert("Could not open All Ads. Please try again.");
    }
  });
  return button;
}

async function showStaticFolderCatalog() { return renderFolderCatalog('static'); }
async function showVideoFolderCatalog() { return renderFolderCatalog('videos'); }
