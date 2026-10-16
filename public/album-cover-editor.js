let albumCoverDialog;
let albumCoverPreviewUrl;
let albumCoverRevision = 0;

function albumCoverFields() {
  return Object.fromEntries(['template', 'title', 'names', 'message'].map(field =>
    [field, document.getElementById(`albumEditor-${field}`).value]
  ));
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
          <select id="albumEditor-template" style="display:block;width:100%;padding:10px;margin:6px 0 14px;"><option value="anniversary">Anniversary — Sunset Lake</option></select>
          <p>Anniversary is the first available template. Other occasions will be added separately.</p>
          <label for="albumEditor-title">Cover title (required, up to 40 characters)</label>
          <input id="albumEditor-title" maxlength="40" style="display:block;width:100%;padding:10px;margin:6px 0 14px;">
          <label for="albumEditor-names">Names (required, up to 60 characters)</label>
          <input id="albumEditor-names" maxlength="60" style="display:block;width:100%;padding:10px;margin:6px 0 14px;">
          <label for="albumEditor-message">Short message (optional, up to 90 characters)</label>
          <textarea id="albumEditor-message" maxlength="90" rows="3" style="display:block;width:100%;padding:10px;margin-top:6px;"></textarea>
          <button type="button" id="albumEditorPreviewButton" onclick="previewEditedAlbumCover()">Preview Cover</button>
          <button type="button" id="albumEditorSaveButton" onclick="saveEditedAlbumCover()">Save Cover to Order</button>
          <p id="albumEditorStatus" role="status"></p>
        </div>
        <img id="albumEditorImage" hidden alt="Album cover preview" style="flex:1 1 320px;width:100%;max-width:460px;height:auto;border-radius:12px;">
      </div>`;
    document.body.appendChild(albumCoverDialog);
    albumCoverDialog.addEventListener('close', () => {
      ++albumCoverRevision;
      if (albumCoverPreviewUrl) URL.revokeObjectURL(albumCoverPreviewUrl);
      albumCoverPreviewUrl = null;
    });
    for (const field of ['template', 'title', 'names', 'message']) {
      document.getElementById(`albumEditor-${field}`).addEventListener('input', () => {
        document.getElementById('albumEditorImage').hidden = true;
        document.getElementById('albumEditorSaveButton').disabled = true;
        document.getElementById('albumEditorStatus').textContent = 'Wording changed. Preview before saving.';
      });
    }
  }
  albumCoverDialog.dataset.orderId = orderId;
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
    const cover = data.cover || data.defaults;
    for (const field of ['template', 'title', 'names', 'message']) document.getElementById(`albumEditor-${field}`).value = cover[field];
    document.getElementById('albumEditorPreviewButton').disabled = false;
    document.getElementById('albumEditorStatus').textContent = data.existingArtwork && !data.cover
      ? 'This order keeps its original artwork until you save a replacement. Preview the new editable template first.'
      : 'Edit the wording, then preview before saving.';
  } catch (error) {
    if (revision === albumCoverRevision) document.getElementById('albumEditorStatus').textContent = error.message;
  }
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
