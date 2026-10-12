window.LyriBopDrawText = function(ctx, text, x, y, maxWidth) {
  ctx.save();
  try {
    ctx.font = "bold 40px Arial";
    const width = ctx.measureText(text).width;
    if (width > maxWidth) throw new Error("Text too wide: " + text);
    window.LyriBopStoreDisplay.validateBounds(x - maxWidth / 2, y - 40, maxWidth, 50);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y);
  } finally { ctx.restore(); }
};
