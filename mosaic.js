let targetImg = null;
let tileImgs = [];
let mosaic;
let scaleFactor = 10;
let generating = false;
let blendFactor = 0.3;

function setup() {
  const c = createCanvas(800, 600);
  c.parent(document.body);
  noLoop();
  background(240);
  textAlign(CENTER, CENTER);
  text("Upload images to begin", width / 2, height / 2);
  setupDropZones();
  setupControls();
}

// ---------- UI SETUP ----------
function setupControls() {
  const gridSlider = document.getElementById("gridSlider");
  const gridLabel = document.getElementById("gridValue");
  gridSlider.oninput = () => { scaleFactor = int(gridSlider.value); gridLabel.textContent = scaleFactor; };

  const blendSlider = document.getElementById("blendSlider");
  const blendLabel = document.getElementById("blendValue");
  blendSlider.oninput = () => { blendFactor = parseFloat(blendSlider.value); blendLabel.textContent = blendFactor.toFixed(2); };

  document.getElementById("generateBtn").onclick = generateMosaic;
  document.getElementById("downloadBtn").onclick = downloadHD;
}

function setupDropZones() {
  const targetDrop = document.getElementById("targetDrop");
  const tileDrop = document.getElementById("tileDrop");

  function handleDrop(e, isTarget) {
    e.preventDefault(); e.stopPropagation();
    const files = e.dataTransfer.files;
    if (isTarget) {
      loadImage(URL.createObjectURL(files[0]), img => {
        targetImg = img;
        targetDrop.textContent = "✅ Target Loaded";
        enableGenerateIfReady();
      });
    } else {
      tileImgs = [];
      for (let f of files) {
        loadImage(URL.createObjectURL(f), img => {
          tileImgs.push(img);
          if (tileImgs.length === files.length) {
            tileDrop.textContent = `✅ ${tileImgs.length} Tiles Loaded`;
            enableGenerateIfReady();
          }
        });
      }
    }
  }

  for (let dz of [targetDrop, tileDrop]) {
    dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("dragover"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
  }
  targetDrop.addEventListener("drop", e => { targetDrop.classList.remove("dragover"); handleDrop(e, true); });
  tileDrop.addEventListener("drop", e => { tileDrop.classList.remove("dragover"); handleDrop(e, false); });
}

function enableGenerateIfReady() {
  if (targetImg && tileImgs.length > 0) document.getElementById("generateBtn").disabled = false;
}

// ---------- PROGRESS ----------
function updateProgress(p) {
  document.getElementById("progressBar").style.width = nf(p * 100, 2, 1) + "%";
}

// ---------- MOSAIC GENERATION ----------
async function generateMosaic() {
  generating = true;
  redraw();
  const tStart = millis();
  mosaic = createGraphics(targetImg.width, targetImg.height);
  mosaic.background(255);

  const tileH = targetImg.height / scaleFactor;
  const tileW = targetImg.width / scaleFactor;

  // Compute average colors
  const tileColors = [];
  for (let i = 0; i < tileImgs.length; i++) {
    let resized = createImage(tileW, tileH);
    resized.copy(tileImgs[i], 0, 0, tileImgs[i].width, tileImgs[i].height, 0, 0, tileW, tileH);
    tileColors.push(avgColor(resized));
    updateProgress((i + 1) / (tileImgs.length * 2)); // 50% mark
    await sleep(1);
  }

  const spotColors = [];
  for (let y = 0; y < scaleFactor; y++) {
    for (let x = 0; x < scaleFactor; x++) {
      let region = targetImg.get(x * tileW, y * tileH, tileW, tileH);
      spotColors.push(avgColor(region));
    }
  }

  updateProgress(0.55);

  // Cost matrix + Hungarian
  const costMatrix = Array.from({ length: spotColors.length }, () => []);
  for (let i = 0; i < spotColors.length; i++) {
    for (let j = 0; j < tileColors.length; j++) {
      const diff =
        (spotColors[i][0] - tileColors[j][0]) ** 2 +
        (spotColors[i][1] - tileColors[j][1]) ** 2 +
        (spotColors[i][2] - tileColors[j][2]) ** 2;
      costMatrix[i][j] = diff;
    }
  }

  updateProgress(0.6);
  const assignment = hungarian(costMatrix);
  updateProgress(0.7);

  // Render mosaic preview
  let idx = 0;
  for (let y = 0; y < scaleFactor; y++) {
    for (let x = 0; x < scaleFactor; x++) {
      const tileIdx = assignment[idx] ?? int(random(tileImgs.length));
      mosaic.image(tileImgs[tileIdx], x * tileW, y * tileH, tileW, tileH);
      idx++;
    }
  }

  // Blend with target
  mosaic.push();
  mosaic.tint(255, blendFactor * 255);
  mosaic.image(targetImg, 0, 0, targetImg.width, targetImg.height);
  mosaic.pop();

  updateProgress(1);
  generating = false;
  document.getElementById("downloadBtn").disabled = false;
  redraw();
  console.log("Mosaic done in", nf((millis() - tStart) / 1000, 1, 2), "sec");
}

// ---------- RENDER LOOP ----------
function draw() {
  background(230);
  if (generating) text("Generating mosaic...", width / 2, height / 2);
  else if (mosaic) image(mosaic, 0, 0, width, height);
}

// ---------- UTILITIES ----------
function avgColor(img) {
  img.loadPixels();
  let r = 0, g = 0, b = 0;
  let count = img.pixels.length / 4;
  for (let i = 0; i < img.pixels.length; i += 4) {
    r += img.pixels[i];
    g += img.pixels[i + 1];
    b += img.pixels[i + 2];
  }
  return [r / count, g / count, b / count];
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

// ---------- HD DOWNLOAD ----------
function downloadHD() {
  const upscale = 4; // 4× higher resolution for saved image
  const hd = createGraphics(targetImg.width * upscale, targetImg.height * upscale);
  const tileH = hd.height / scaleFactor;
  const tileW = hd.width / scaleFactor;

  let idx = 0;
  for (let y = 0; y < scaleFactor; y++) {
    for (let x = 0; x < scaleFactor; x++) {
      const tileIdx = idx % tileImgs.length;
      hd.image(tileImgs[tileIdx], x * tileW, y * tileH, tileW, tileH);
      idx++;
    }
  }

  // Blend original target image
  hd.push();
  hd.tint(255, blendFactor * 255);
  hd.image(targetImg, 0, 0, hd.width, hd.height);
  hd.pop();

  save(hd, "mosaic_HD.png");
}

// ---------- HUNGARIAN ALGORITHM ----------
function hungarian(costMatrix) {
  const nRows = costMatrix.length;
  const nCols = costMatrix[0].length;
  const n = Math.max(nRows, nCols);
  const C = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i < nRows && j < nCols ? costMatrix[i][j] : 0
    )
  );

  // Row & column minima
  for (let i = 0; i < n; i++) {
    const minVal = Math.min(...C[i]);
    for (let j = 0; j < n; j++) C[i][j] -= minVal;
  }
  for (let j = 0; j < n; j++) {
    let colMin = Infinity;
    for (let i = 0; i < n; i++) colMin = Math.min(colMin, C[i][j]);
    for (let i = 0; i < n; i++) C[i][j] -= colMin;
  }

  const colUsed = new Array(n).fill(false);
  const assignment = new Array(nRows).fill(null);

  for (let i = 0; i < nRows; i++) {
    let bestJ = -1, bestVal = Infinity;
    for (let j = 0; j < nCols; j++) {
      if (!colUsed[j] && C[i][j] < bestVal) {
        bestVal = C[i][j];
        bestJ = j;
      }
    }
    if (bestJ >= 0) { assignment[i] = bestJ; colUsed[bestJ] = true; }
  }
  for (let i = 0; i < nRows; i++) if (assignment[i] === null) assignment[i] = int(random(nCols));
  return assignment;
}
