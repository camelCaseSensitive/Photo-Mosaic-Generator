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
// DRAG-AND-DROP IMAGE LOADERS
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

// -----------------------------------------------------------
// GENERATE MOSAIC
// -----------------------------------------------------------
async function generateMosaic() {
  generating = true;
  redraw();
  const tileH = targetImg.height / scaleFactor;
  const tileW = targetImg.width / scaleFactor;

  // Compute average colors for tiles
  const tileColors = tileImgs.map(img => avgColorScaled(img, tileW, tileH));

  // Compute average colors for each target grid cell
  const spotColors = [];
  for (let y = 0; y < scaleFactor; y++) {
    for (let x = 0; x < scaleFactor; x++) {
      const region = targetImg.get(x * tileW, y * tileH, tileW, tileH);
      spotColors.push(avgColor(region));
    }
  }

  // Send data to worker
  worker.postMessage({ type: "compute", tileColors, spotColors });
  updateProgress(0.1);
  console.log("Sent color data to worker...");
}

// -----------------------------------------------------------
// DRAW MOSAIC FROM ASSIGNMENT
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

  // Blend with original
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
  if (generating) text("Generating mosaic (Web Worker)...", width / 2, height / 2);
  else if (mosaic) image(mosaic, 0, 0, width, height);
}

// -----------------------------------------------------------
// UTILITIES
// -----------------------------------------------------------
function avgColor(img) {
  img.loadPixels();
  let r = 0, g = 0, b = 0;
  const count = img.pixels.length / 4;
  for (let i = 0; i < img.pixels.length; i += 4) {
    r += img.pixels[i];
    g += img.pixels[i + 1];
    b += img.pixels[i + 2];
  }
  return [r / count, g / count, b / count];
}

function avgColorScaled(img, w, h) {
  const temp = createImage(w, h);
  temp.copy(img, 0, 0, img.width, img.height, 0, 0, w, h);
  return avgColor(temp);
}

// -----------------------------------------------------------
// HD DOWNLOAD
// -----------------------------------------------------------
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
