let targetImg = null;
let tileImgs = [];
let mosaic;
let scaleFactor = 10;
let blendFactor = 0.3;
let generating = false;
let worker;

function setup() {
  const c = createCanvas(800, 600);
  c.parent(document.body);
  noLoop();
  background(230);
  textAlign(CENTER, CENTER);
  text("Upload images to begin", width / 2, height / 2);

  setupDropZones();
  setupControls();
  setupWorker();
}

// -----------------------------------------------------------
// WEB WORKER SETUP
// -----------------------------------------------------------
function setupWorker() {
  worker = new Worker("worker.js");
  worker.onmessage = e => {
    const { type, progress, assignment } = e.data;

    if (type === "progress") {
      updateProgress(progress);
    } else if (type === "done") {
      console.log("Worker completed global matching!");
      drawMosaic(assignment);
    }
  };
}

// -----------------------------------------------------------
// UI SETUP
// -----------------------------------------------------------
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

// -----------------------------------------------------------
// IMAGE LOADERS
// -----------------------------------------------------------
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

function updateProgress(p) {
  document.getElementById("progressBar").style.width = (p * 100).toFixed(1) + "%";
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

// -----------------------------------------------------------
// GENERATE MOSAIC
// -----------------------------------------------------------
async function generateMosaic() {
  generating = true;
  redraw();
  const tileH = targetImg.height / scaleFactor;
  const tileW = targetImg.width / scaleFactor;

  

  // Build features for tiles
  const tileFeatures = [];
  for (let img of tileImgs) {
    tileFeatures.push(tinyGrayFeature(img)); // 48-element feature
  }
  
  // Build features for target grid
  const spotFeatures = [];
  for (let y = 0; y < scaleFactor; y++) {
    for (let x = 0; x < scaleFactor; x++) {
      const region = targetImg.get(
        x * targetImg.width / scaleFactor,
        y * targetImg.height / scaleFactor,
        targetImg.width / scaleFactor,
        targetImg.height / scaleFactor
      );
      spotFeatures.push(tinyGrayFeature(region));
    }
  }
  
  // Send to worker
  worker.postMessage({ type: "compute", tileFeatures, spotFeatures });
  updateProgress(0.1);
  console.log("Sent data to worker...");
}

// -----------------------------------------------------------
// RECEIVE RESULTS
// -----------------------------------------------------------
function drawMosaic(assignment) {
  mosaic = createGraphics(targetImg.width, targetImg.height);
  const tileH = targetImg.height / scaleFactor;
  const tileW = targetImg.width / scaleFactor;

  let idx = 0;
  for (let y = 0; y < scaleFactor; y++) {
    for (let x = 0; x < scaleFactor; x++) {
      const tileIdx = assignment[idx] ?? int(random(tileImgs.length));
      mosaic.image(tileImgs[tileIdx], x * tileW, y * tileH, tileW, tileH);
      idx++;
    }
  }

  mosaic.push();
  mosaic.tint(255, blendFactor * 255);
  mosaic.image(targetImg, 0, 0, targetImg.width, targetImg.height);
  mosaic.pop();

  generating = false;
  document.getElementById("downloadBtn").disabled = false;
  redraw();
  updateProgress(1);
  console.log("Mosaic ready!");
}

function draw() {
  background(230);
  if (generating) text("Generating mosaic (using Web Worker)...", width / 2, height / 2);
  else if (mosaic) image(mosaic, 0, 0, width, height);
}

// -----------------------------------------------------------
// UTILITIES
// -----------------------------------------------------------
// --- Compute 8×6 grayscale downsample feature (48-D) ---
// --- Compute 8×6 grayscale feature with brightness normalization ---
function tinyGrayFeature(img, w = 8, h = 6) {
  const feature = new Array(w * h);
  const small = createImage(w, h);
  small.copy(img, 0, 0, img.width, img.height, 0, 0, w, h);
  small.loadPixels();

  // 1. Compute grayscale values
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = 4 * (y * w + x);
      const r = small.pixels[idx];
      const g = small.pixels[idx + 1];
      const b = small.pixels[idx + 2];
      feature[y * w + x] = (r + g + b) / 3;
    }
  }

  // 2. Normalize brightness (zero-mean)
  let mean = 0;
  for (let v of feature) mean += v;
  mean /= feature.length;
  for (let i = 0; i < feature.length; i++) feature[i] -= mean;

  return feature;
}

// ---------- HD DOWNLOAD ----------
function downloadHD() {
  const upscale = 4;
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

  hd.push();
  hd.tint(255, blendFactor * 255);
  hd.image(targetImg, 0, 0, hd.width, hd.height);
  hd.pop();

  save(hd, "mosaic_HD.png");
}
