let albumCoverDialog;
let albumCoverPreviewUrl;
let albumCoverRevision = 0;
let albumCoverTemplates = [];
let albumCoverOrderTitle = "";
let albumCoverPhoto = null;

function albumCoverFields() {
  return {...Object.fromEntries(['template', 'title', 'names', 'message'].map(field =>
    [field, document.getElementById(`albumEditor-${field}`).value]
  )), photo:albumCoverPhoto};
}

async function openAlbumCoverEditor(button) {
  const orderId = button.dataset.orderId;
  const revision = ++albumCoverRevision;
  if (!albumCoverDialog) {
    albumCoverDialog = document.createElement('dialog');
    albumCoverDialog.id = 'albumCoverEditor';
    albumCoverDialog.setAttribute('aria-labelledby', 'albumEditorHeading');
    albumCoverDialog.style.cssText = 'width:min(1000px,calc(100vw - 32px));max-height:90vh;overflow:auto;border:1px solid #cbd5e1;border-radius:14px;padding:24px;';
    albumCoverDialog.innerHTML = `
      <form method="dialog" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <h2 id="albumEditorHeading" style="margin:0;">Album Cover</h2><button autofocus>Close</button>
      </form>
      <p id="albumEditorOrder"></p>
      <p>Choose an occasion template and edit its wording. Preview does not save. Saving replaces the cover shown on this order's delivery page.</p>
      <div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;">
        <div style="flex:1 1 280px;min-width:0;">
          <label for="albumEditor-template">Occasion template</label>
          <select id="albumEditor-template" style="display:block;width:100%;padding:10px;margin:6px 0 14px;"><option value="">Loading templates...</option></select>
          <p>Other uses the same generic music artwork regardless of the occasion description. Choose from the occasion templates below.</p>
          <label for="albumEditor-title">Cover title (required, up to 40 characters)</label>
          <input id="albumEditor-title" maxlength="40" style="display:block;width:100%;padding:10px;margin:6px 0 14px;">
          <button type="button" id="albumEditorOrderTitleButton" onclick="useAlbumCoverSongTitle()" style="margin:0 0 14px;">Use Song Title</button>
          <label for="albumEditor-names">Names (required, up to 60 characters)</label>
          <input id="albumEditor-names" maxlength="60" style="display:block;width:100%;padding:10px;margin:6px 0 14px;">
          <label for="albumEditor-message">Short message (optional, up to 90 characters)</label>
          <textarea id="albumEditor-message" maxlength="90" rows="3" style="display:block;width:100%;padding:10px;margin-top:6px;"></textarea>
          <label for="albumEditorPhoto">Optional photo (PNG, JPEG or WebP, up to 12 MB)</label>
          <input id="albumEditorPhoto" type="file" accept="image/png,image/jpeg,image/webp" onchange="changeAlbumCoverPhoto(this)">
          <button type="button" onclick="removeAlbumCoverPhoto()">Remove photo</button>
          <p id="albumEditorPhotoStatus"></p>
          <button type="button" id="albumEditorPreviewButton" onclick="previewEditedAlbumCover()">Preview Cover</button>
          <button type="button" id="albumEditorSaveButton" onclick="saveEditedAlbumCover()">Save Cover to Order</button>
          <p id="albumEditorStatus" role="status"></p>
        </div>
        <img id="albumEditorImage" hidden alt="Album cover preview" style="flex:1 1 320px;width:100%;max-width:460px;height:auto;border-radius:12px;">
      </div>`;
    document.body.appendChild(albumCoverDialog);
    document.getElementById('albumEditor-template').addEventListener('change', () => {
      const selected = albumCoverTemplates.find(item => item.id === document.getElementById('albumEditor-template').value);
      const title = document.getElementById('albumEditor-title');
      if (selected && !title.value.trim()) {
        title.value = albumCoverOrderTitle || selected.defaultTitle;
      }
      document.getElementById('albumEditorImage').hidden = true;
      document.getElementById('albumEditorSaveButton').disabled = true;
      document.getElementById('albumEditorStatus').textContent = 'Template changed. Preview before saving.';
    });
    albumCoverDialog.addEventListener('close', () => {
      ++albumCoverRevision;
      if (albumCoverPreviewUrl) URL.revokeObjectURL(albumCoverPreviewUrl);
      albumCoverPreviewUrl = null;
    });
    for (const field of ['template', 'title', 'names', 'message']) {
      document.getElementById(`albumEditor-${field}`).addEventListener('input', () => {
        document.getElementById('albumEditorImage').hidden = true;
        document.getElementById('albumEditorSaveButton').disabled = true;
        document.getElementById('albumEditorStatus').textContent = 'Template or wording changed. Preview before saving.';
      });
    }
  }
  albumCoverDialog.dataset.orderId = orderId;
  albumCoverOrderTitle = '';
  document.getElementById('albumEditorOrderTitleButton').disabled = true;
  document.getElementById('albumEditorOrder').textContent = `Order ${orderId}`;
  document.getElementById('albumEditorImage').hidden = true;
  document.getElementById('albumEditorPreviewButton').disabled = true;
  document.getElementById('albumEditorSaveButton').disabled = true;
  document.getElementById('albumEditorStatus').textContent = 'Loading cover settings...';
  albumCoverDialog.showModal();
  try {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/album-cover`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load cover settings.');
    if (revision !== albumCoverRevision) return;
    albumCoverTemplates = data.templates || [];
    const select = document.getElementById('albumEditor-template');
    select.replaceChildren();
    for (const template of albumCoverTemplates) {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.label;
      select.appendChild(option);
    }
    albumCoverOrderTitle = data.defaults.title;
    document.getElementById('albumEditorOrderTitleButton').disabled = false;
    const cover = { ...(data.cover || data.defaults) };
    albumCoverPhoto = cover.photo || null;
    document.getElementById('albumEditorPhoto').value='';
    document.getElementById('albumEditorPhotoStatus').textContent=albumCoverPhoto?'This cover includes a photo.':'No photo selected.';
    const oldGenericTitle = data.cover?.template === 'other' && cover.title === 'Your Personal Song' && albumCoverOrderTitle !== cover.title;
    if (oldGenericTitle) cover.title = albumCoverOrderTitle;
    for (const field of ['template', 'title', 'names', 'message']) document.getElementById(`albumEditor-${field}`).value = cover[field];
    document.getElementById('albumEditorPreviewButton').disabled = false;
    document.getElementById('albumEditorStatus').textContent = oldGenericTitle
      ? 'The actual song title is filled in. Preview and save to replace the old generic wording; the current cover is unchanged until then.'
      : data.existingArtwork && !data.cover
        ? 'This order keeps its original artwork until you save a replacement. Preview the new editable template first.'
        : 'Song title and recipient are filled from the order for new covers. Edit the wording, then preview before saving.';
  } catch (error) {
    if (revision === albumCoverRevision) document.getElementById('albumEditorStatus').textContent = error.message;
  }
}

function useAlbumCoverSongTitle() {
  document.getElementById('albumEditor-title').value = albumCoverOrderTitle;
  document.getElementById('albumEditorImage').hidden = true;
  document.getElementById('albumEditorSaveButton').disabled = true;
  document.getElementById('albumEditorStatus').textContent = 'Song title filled from the order. Preview before saving. Shorten it if it exceeds 40 characters.';
}

async function previewEditedAlbumCover() {
  const revision = ++albumCoverRevision;
  const fields = albumCoverFields();
  const button = document.getElementById('albumEditorPreviewButton');
  button.disabled = true;
  document.getElementById('albumEditorSaveButton').disabled = true;
  document.getElementById('albumEditorStatus').textContent = 'Creating preview...';
  try {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(albumCoverDialog.dataset.orderId)}/album-cover/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields)
    });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Could not preview cover.'); }
    const blob = await response.blob();
    if (revision !== albumCoverRevision || JSON.stringify(fields) !== JSON.stringify(albumCoverFields())) return;
    if (albumCoverPreviewUrl) URL.revokeObjectURL(albumCoverPreviewUrl);
    albumCoverPreviewUrl = URL.createObjectURL(blob);
    const image = document.getElementById('albumEditorImage');
    image.onload = () => {
      if (revision !== albumCoverRevision || JSON.stringify(fields) !== JSON.stringify(albumCoverFields())) return;
      image.hidden = false;
      document.getElementById('albumEditorSaveButton').disabled = false;
      document.getElementById('albumEditorStatus').textContent = 'Preview ready. Check the wording before saving.';
    };
    image.onerror = () => { document.getElementById('albumEditorStatus').textContent = 'Preview image could not load. Please retry.'; };
    image.src = albumCoverPreviewUrl;
  } catch (error) {
    if (revision === albumCoverRevision) document.getElementById('albumEditorStatus').textContent = error.message;
  } finally {
    if (revision === albumCoverRevision) button.disabled = false;
  }
}

async function saveEditedAlbumCover() {
  const orderId = albumCoverDialog.dataset.orderId;
  const fields = albumCoverFields();
  if (!confirm(`Save this cover to order ${orderId}? It will replace the artwork on the customer's delivery page.`)) return;
  const revision = ++albumCoverRevision;
  document.getElementById('albumEditorSaveButton').disabled = true;
  try {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/album-cover`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save cover.');
    if (revision === albumCoverRevision) document.getElementById('albumEditorStatus').textContent = 'Cover saved. Refresh Customer Delivery to see it.';
  } catch (error) {
    if (revision === albumCoverRevision) document.getElementById('albumEditorStatus').textContent = error.message;
  }
}

function invalidateAlbumPhoto() {
  ++albumCoverRevision;
  document.getElementById('albumEditorImage').hidden=true;
  document.getElementById('albumEditorSaveButton').disabled=true;
  document.getElementById('albumEditorPreviewButton').disabled=false;
}
async function changeAlbumCoverPhoto(input) {
  invalidateAlbumPhoto(); const revision=albumCoverRevision;
  document.getElementById('albumEditorPreviewButton').disabled=true;
  try {
    const photo=await prepareLyriBopPhoto(input.files[0]);
    if(revision!==albumCoverRevision)return;
    albumCoverPhoto=photo;document.getElementById('albumEditorPhotoStatus').textContent='Photo ready. Preview before saving.';
  }catch(error){if(revision===albumCoverRevision)document.getElementById('albumEditorPhotoStatus').textContent=error.message;}
  finally{if(revision===albumCoverRevision)document.getElementById('albumEditorPreviewButton').disabled=false;}
}
function removeAlbumCoverPhoto(){invalidateAlbumPhoto();albumCoverPhoto=null;document.getElementById('albumEditorPhoto').value='';document.getElementById('albumEditorPhotoStatus').textContent='Photo removed from this draft. Preview and save to apply.';}
