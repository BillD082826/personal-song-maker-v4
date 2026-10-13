window.drawClassicWeddingDisplay = function(ctx, design, price, qrImage, sellerCode) {
  const bg = ctx.createLinearGradient(0, 0, 1200, 1800);
  bg.addColorStop(0, "#30233e");
  bg.addColorStop(0.55, "#74556d");
  bg.addColorStop(1, "#30233e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 1800);

  ctx.strokeStyle = "#f5dfb5";
  ctx.lineWidth = 28;
  ctx.strokeRect(14, 14, 1172, 1772);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#f5dfb5";
  ctx.fillRect(265, 90, 670, 72);
  ctx.fillStyle = "#30233e";
  ctx.font = "bold 30px Arial";
  ctx.fillText(design.badge, 600, 126);

  ctx.fillStyle = "#ffffff";
  ctx.font = "100px Georgia";
  ctx.fillText("♫ LyriBop", 600, 265);

  ctx.fillStyle = "#e6c987";
  ctx.font = "italic 43px Georgia";
  ctx.fillText(design.tagline, 600, 355);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 66px Georgia";
  ctx.fillText("Your Wedding Day", 600, 465);
  ctx.fillStyle = "#e6c987";
  ctx.fillText("Deserves Its Own Song", 600, 575, 1050);

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "38px Arial";
  ctx.fillText(design.detailLine1, 600, 685);
  ctx.fillText(design.detailLine2, 600, 740);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(335, 850, 530, 190);

  ctx.fillStyle = "#123a63";
  ctx.font = "bold 30px Arial";
  ctx.fillText(design.priceLabel, 600, 900);

  ctx.font = "bold 90px Arial";
  ctx.fillText("$" + price, 600, 980);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(175, 1070, 355, 355);
  ctx.drawImage(qrImage, 195, 1090, 315, 315);

  ctx.textAlign = "left";
  ctx.fillStyle = "#e6c987";
  ctx.font = "bold 49px Arial";
  ctx.fillText("SCAN TO", 565, 1150);
  ctx.fillText("CREATE YOUR", 565, 1210);
  ctx.fillText("SONG", 565, 1270);

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "27px Arial";
  ctx.fillText(design.scanDetail1, 565, 1350);
  ctx.fillText(design.scanDetail2, 565, 1390);

  ctx.fillStyle = "#182842";
  ctx.fillRect(28, 1500, 1144, 272);

  ctx.strokeStyle = "#a9b3c4";
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  ctx.moveTo(28, 1500);
  ctx.lineTo(1172, 1500);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "center";
  ctx.fillStyle = "#a9b3c4";
  ctx.font = "bold 28px Arial";

  if (sellerCode) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Seller Code: " + sellerCode, 1140, 1740);
  }
};
