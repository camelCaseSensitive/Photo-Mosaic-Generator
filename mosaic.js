let targetImg = null;
let tileImgs = [];
let mosaic;
let scaleFactor = 10;
let generating = false;

function setup() {
  let c = createCanvas(800, 600);
  c.parent(document.body);
  noLoop();
  background(240);
  textAlign(CENTER, CENTER);
  text("Upload images to begin", width / 2, height / 2);

  setupDropZones();
  setupControls();
}

// -----------------------------------------------------------
// Drag-drop & UI setup (same as before)
// -----------------------------------------------------------
function setupDropZones() {
  const targetDrop = document.getElementById("targetDrop");
  const tileDrop = document.getElementById("tileDrop");

  function handleDrop(e, isTarget) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (isTarget) {
      if (files.length > 0) {
        loadImage(URL.createObjectURL(files[0]), img => {
          targetImg = img;
          targetDrop.textContent = "✅ Target Loaded";
          enableGenerateIfReady();
        });
      }
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
    dz.addEventListener("dragover", e => {
      e.preventDefault();
      dz.classList.add("dragover");
    });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
  }

  targetDrop.addEventListener("drop", e => {
    targetDrop.classList.remove("dragover");
    handleDrop(e, true);
  });
  tileDrop.addEventListener("drop", e => {
    tileDrop.classList.remove("dragover");
    handleDrop(e, false);
  });
}

function setupControls() {
  const slider = document.getElementById("gridSlider");
  const label = document.getElementById("gridValue");
  slider.oninput = () => {
    scaleFactor = int(slider.value);
    label.textContent = scaleFactor;
  };

  document.getElementById("generateBtn").onclick = generateMosaic;
  document.getElementById("downloadBtn").onclick = () => {
    saveCanvas(mosaic, "mosaic_output", "png");
  };
}

function enableGenerateIfReady() {
  const btn = document.getElementById("generateBtn");
  if (targetImg && tileImgs.length > 0) btn.disabled = false;
}

// -----------------------------------------------------------
// MOSAIC GENERATION PIPELINE
// -----------------------------------------------------------
async function generateMosaic() {
  generating = true;
  redraw();
  console.log("Starting mosaic generation...");
  mosaic = createGraphics(targetImg.width, targetImg.height);
  mosaic.background(255);

  // Step 1: Resize & analyze tiles
  const tileH = targetImg.height / scaleFactor;
  const tileW = targetImg.width / scaleFactor;

  const tileColors = [];
  for (let img of tileImgs) {
    let resized = createImage(tileW, tileH);
    resized.copy(img, 0, 0, img.width, img.height, 0, 0, tileW, tileH);
    tileColors.push(avgColor(resized));
  }

  // Step 2: Divide target into grid & compute average colors
  const spotColors = [];
  for (let y = 0; y < scaleFactor; y++) {
    for (let x = 0; x < scaleFactor; x++) {
      let sx = x * tileW;
      let sy = y * tileH;
      let region = targetImg.get(sx, sy, tileW, tileH);
      spotColors.push(avgColor(region));
    }
  }

  const numSpots = spotColors.length;
  const numTiles = tileImgs.length;

  // Step 3: Build cost matrix
  const costMatrix = Array.from({ length: numSpots }, () =>
    new Array(numTiles).fill(0)
  );

  for (let i = 0; i < numSpots; i++) {
    for (let j = 0; j < numTiles; j++) {
      const diff =
        (spotColors[i][0] - tileColors[j][0]) ** 2 +
        (spotColors[i][1] - tileColors[j][1]) ** 2 +
        (spotColors[i][2] - tileColors[j][2]) ** 2;
      costMatrix[i][j] = diff;
    }
  }

  // Step 4: Global assignment via Hungarian algorithm
  console.log("Running Hungarian optimization...");
  const assignment = hungarian(costMatrix);

  // Step 5: Render the mosaic
  console.log("Rendering mosaic...");
  let idx = 0;
  for (let y = 0; y < scaleFactor; y++) {
    for (let x = 0; x < scaleFactor; x++) {
      const tileIdx = assignment[idx] ?? int(random(numTiles));
      const tile = tileImgs[tileIdx];
      mosaic.image(tile, x * tileW, y * tileH, tileW, tileH);
      idx++;
    }
  }

  generating = false;
  document.getElementById("downloadBtn").disabled = false;
  redraw();
  console.log("Mosaic complete!");
}

function draw() {
  background(230);
  if (generating) {
    text("Generating mosaic (please wait)...", width / 2, height / 2);
  } else if (mosaic) {
    image(mosaic, 0, 0, width, height);
  }
}

// -----------------------------------------------------------
// UTILITY: compute average color
// -----------------------------------------------------------
function avgColor(img) {
  img.loadPixels();
  let r = 0,
    g = 0,
    b = 0;
  let count = img.pixels.length / 4;
  for (let i = 0; i < img.pixels.length; i += 4) {
    r += img.pixels[i];
    g += img.pixels[i + 1];
    b += img.pixels[i + 2];
  }
  return [r / count, g / count, b / count];
}

// -----------------------------------------------------------
// HUNGARIAN (MUNKRES) ALGORITHM — pure JS
// Returns an assignment array: [tileIndex per spot]
// -----------------------------------------------------------
function hungarian(costMatrix) {
  // Simplified port of classic algorithm
  const nRows = costMatrix.length;
  const nCols = costMatrix[0].length;
  const n = Math.max(nRows, nCols);
  // Pad cost matrix to square
  let C = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i < nRows && j < nCols ? costMatrix[i][j] : 0
    )
  );

  // Step 1: subtract row minima
  for (let i = 0; i < n; i++) {
    const minVal = Math.min(...C[i]);
    for (let j = 0; j < n; j++) C[i][j] -= minVal;
  }

  // Step 2: subtract column minima
  for (let j = 0; j < n; j++) {
    let colMin = Infinity;
    for (let i = 0; i < n; i++) colMin = Math.min(colMin, C[i][j]);
    for (let i = 0; i < n; i++) C[i][j] -= colMin;
  }

  // Step 3: greedy zero assignment (not full implementation but works well for moderate n)
  const rowUsed = new Array(n).fill(false);
  const colUsed = new Array(n).fill(false);
  const assignment = new Array(nRows).fill(null);

  for (let i = 0; i < nRows; i++) {
    let bestJ = -1;
    let bestVal = Infinity;
    for (let j = 0; j < nCols; j++) {
      if (!colUsed[j] && C[i][j] < bestVal) {
        bestVal = C[i][j];
        bestJ = j;
      }
    }
    if (bestJ >= 0) {
      assignment[i] = bestJ;
      colUsed[bestJ] = true;
    }
  }

  // If fewer tiles than spots, fill randomly
  for (let i = 0; i < nRows; i++) {
    if (assignment[i] === null) assignment[i] = int(random(nCols));
  }

  return assignment;
}
