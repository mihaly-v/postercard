// ============================================================
// 設計方針：
// プレビューとエクスポート画像を「同じ render() 関数」で描画する。
// ============================================================

const imageLoader = document.getElementById('imageLoader');
const container = document.getElementById('viewer-container');
const mainCanvas = document.getElementById('mainCanvas');
const mainCtx = mainCanvas.getContext('2d');
const cropBox = document.getElementById('crop-box');
const resolutionSelect = document.getElementById('resolutionSelect');
const resetImgBtn = document.getElementById('resetImgBtn');
const saveImgBtn = document.getElementById('saveImgBtn');
const renderStatus = document.getElementById('renderStatus');

const blurIntensityInput = document.getElementById('blurIntensity');
const blurVal = document.getElementById('blurVal');
const grainIntensityInput = document.getElementById('grainIntensity');
const grainVal = document.getElementById('grainVal');
const bgSaturationInput = document.getElementById('bgSaturation');
const satVal = document.getElementById('satVal');
const insideSaturationInput = document.getElementById('insideSaturation');
const insideSatVal = document.getElementById('insideSatVal');
const borderWidthInput = document.getElementById('borderWidth');
const borderColorInput = document.getElementById('borderColor');
const showCrossInput = document.getElementById('showCross');

const titleTextInput = document.getElementById('titleText');
const titlePositionInput = document.getElementById('titlePosition');
const titleSizeInput = document.getElementById('titleSize');
const titleAlignInput = document.getElementById('titleAlign');
const titleVAlignInput = document.getElementById('titleVAlign');
const titleVAlignGroup = document.getElementById('titleVAlignGroup');
const titleAlignNote = document.getElementById('titleAlignNote');
const titleColorInput = document.getElementById('titleColor');

const bodyTextInput = document.getElementById('bodyText');
const bodyPositionInput = document.getElementById('bodyPosition');
const bodySizeInput = document.getElementById('bodySize');
const bodyAlignInput = document.getElementById('bodyAlign');
const bodyVAlignInput = document.getElementById('bodyVAlign');
const bodyVAlignGroup = document.getElementById('bodyVAlignGroup');
const bodyAlignNote = document.getElementById('bodyAlignNote');
const bodyColorInput = document.getElementById('bodyColor');

// TEXT 05 (TOP HEADER TRIPLE TEXT) 用の要素
const topHeaderLeftInput = document.getElementById('topHeaderLeft');
const topHeaderCenterInput = document.getElementById('topHeaderCenter');
const topHeaderRightInput = document.getElementById('topHeaderRight');
const topHeaderSizeInput = document.getElementById('topHeaderSize');
const topHeaderColorInput = document.getElementById('topHeaderColor');

const extraTextInput = document.getElementById('extraText');
const extraTypeInput = document.getElementById('extraType');
const extraSizeInput = document.getElementById('extraSize');
const extraAlignInput = document.getElementById('extraAlign');

const copyTextInput = document.getElementById('copyText');
const copyTypeInput = document.getElementById('copyType');
const copySizeInput = document.getElementById('copySize');
const copyAlignInput = document.getElementById('copyAlign');

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const textureTypeInput = document.getElementById('textureType');

// ------------------------------------------------------------
// 状態
// ------------------------------------------------------------
let loadedImage = null;
let imgScale = 1;
let imgPosX = 0;
let imgPosY = 0;

// コンテナの実サイズ・論理サイズを動的に取得するヘルパー
function getContainerSize() {
    const width = container.clientWidth || 600;
    const isLandscape = container.classList.contains('landscape');
    const height = isLandscape ? width * (1000 / 1593) : width * (1593 / 1000);
    return { width, height };
}

let boxLeftRatio = 175 / 600;
let boxTopRatio = 140 / 600;
let boxWidthRatio = 250 / 600;
let boxHeightRatio = 320 / 600;

let isDraggingBox = false;
let isResizingBox = false;
let isPanningImage = false;
let currentHandle = null;
let startX, startY, startLeft, startTop, startWidth, startHeight;
let panStartX, panStartY;
let renderScheduled = false;

// ピンチズーム用の状態管理
let initialPinchDistance = null;
let initialPinchScale = 1;

let grainTileCanvas = null;
function buildGrainTile() {
    const size = 200;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const v = Math.floor(Math.random() * 255);
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    grainTileCanvas = c;
}
buildGrainTile();

let frostedTileCanvas = null;
function buildFrostedTile() {
    const size = 1000;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 250; i++) {
        const r = 35 + Math.random() * 80; 
        const x = Math.random() * size;
        const y = Math.random() * size;
        const shadeVal = Math.random() > 0.5 ? 230 : 25;
        const alpha = 0.1 + Math.random() * 0.15;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(${shadeVal}, ${shadeVal}, ${shadeVal}, ${alpha})`);
        grad.addColorStop(1, 'rgba(128, 128, 128, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    const w = size, h = size;
    const copyData = new Uint8ClampedArray(data);

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            const leftIdx = (y * w + (x - 1)) * 4;
            const topIdx = ((y - 1) * w + x) * 4;

            const diffX = copyData[leftIdx] - copyData[idx];
            const diffY = copyData[topIdx] - copyData[idx];

            const noise = (Math.random() - 0.5) * 30;
            let v = copyData[idx] + noise + (diffX * 0.7) + (diffY * 0.7);
            v = Math.min(255, Math.max(0, v));

            data[idx]     = v;
            data[idx + 1] = v;
            data[idx + 2] = v;
        }
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.filter = 'blur(1.2px)';
    ctx.drawImage(c, 0, 0);
    ctx.filter = 'none';

    frostedTileCanvas = c;
}
buildFrostedTile();

// ------------------------------------------------------------
// iOS Safari 対策: ctx.filter (blur+saturate等の複合指定) は
// iOS Safari で反応しないことがあるため、ピクセル処理で自前実装する。
// ------------------------------------------------------------

// 彩度・コントラストを行列演算で適用 (CSS filter: saturate() contrast() 相当)
function applySaturationContrast(imageData, saturation, contrast) {
    const data = imageData.data;
    const lumR = 0.3086, lumG = 0.6094, lumB = 0.0820;
    const s = saturation;

    const m00 = (1 - s) * lumR + s, m01 = (1 - s) * lumG, m02 = (1 - s) * lumB;
    const m10 = (1 - s) * lumR, m11 = (1 - s) * lumG + s, m12 = (1 - s) * lumB;
    const m20 = (1 - s) * lumR, m21 = (1 - s) * lumG, m22 = (1 - s) * lumB + s;

    // contrast: (v - 128) * contrast + 128
    const cOffset = 128 * (1 - contrast);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        let nr = r * m00 + g * m01 + b * m02;
        let ng = r * m10 + g * m11 + b * m12;
        let nb = r * m20 + g * m21 + b * m22;

        data[i]     = nr * contrast + cOffset;
        data[i + 1] = ng * contrast + cOffset;
        data[i + 2] = nb * contrast + cOffset;
    }
    return imageData;
}

// 高速ボックスブラー(複数回重ねてガウスブラーに近似)
function boxBlur(imageData, radius) {
    if (radius < 1) return imageData;
    const { data, width, height } = imageData;
    const passes = 3;
    for (let p = 0; p < passes; p++) {
        boxBlurHorizontal(data, width, height, radius);
        boxBlurVertical(data, width, height, radius);
    }
    return imageData;
}

function boxBlurHorizontal(data, width, height, radius) {
    const temp = new Uint8ClampedArray(data.length);
    const size = radius * 2 + 1;

    for (let y = 0; y < height; y++) {
        let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
        const rowStart = y * width * 4;

        for (let i = -radius; i <= radius; i++) {
            const x = Math.min(width - 1, Math.max(0, i));
            const idx = rowStart + x * 4;
            rSum += data[idx]; gSum += data[idx + 1];
            bSum += data[idx + 2]; aSum += data[idx + 3];
        }

        for (let x = 0; x < width; x++) {
            const idx = rowStart + x * 4;
            temp[idx] = rSum / size;
            temp[idx + 1] = gSum / size;
            temp[idx + 2] = bSum / size;
            temp[idx + 3] = aSum / size;

            const addX = Math.min(width - 1, x + radius + 1);
            const subX = Math.max(0, x - radius);
            const addIdx = rowStart + addX * 4;
            const subIdx = rowStart + subX * 4;

            rSum += data[addIdx] - data[subIdx];
            gSum += data[addIdx + 1] - data[subIdx + 1];
            bSum += data[addIdx + 2] - data[subIdx + 2];
            aSum += data[addIdx + 3] - data[subIdx + 3];
        }
    }
    data.set(temp);
}

function boxBlurVertical(data, width, height, radius) {
    const temp = new Uint8ClampedArray(data.length);
    const size = radius * 2 + 1;

    for (let x = 0; x < width; x++) {
        let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

        for (let i = -radius; i <= radius; i++) {
            const y = Math.min(height - 1, Math.max(0, i));
            const idx = (y * width + x) * 4;
            rSum += data[idx]; gSum += data[idx + 1];
            bSum += data[idx + 2]; aSum += data[idx + 3];
        }

        for (let y = 0; y < height; y++) {
            const idx = (y * width + x) * 4;
            temp[idx] = rSum / size;
            temp[idx + 1] = gSum / size;
            temp[idx + 2] = bSum / size;
            temp[idx + 3] = aSum / size;

            const addY = Math.min(height - 1, y + radius + 1);
            const subY = Math.max(0, y - radius);
            const addIdx = (addY * width + x) * 4;
            const subIdx = (subY * width + x) * 4;

            rSum += data[addIdx] - data[subIdx];
            gSum += data[addIdx + 1] - data[subIdx + 1];
            bSum += data[addIdx + 2] - data[subIdx + 2];
            aSum += data[addIdx + 3] - data[subIdx + 3];
        }
    }
    data.set(temp);
}

// 画像を指定位置に描画したうえで、彩度・コントラスト・ぼかしを
// ピクセル処理で適用したオフスクリーンcanvasを返す。
// (ctx.filterを使わないので clip との組み合わせでも iOS Safari で確実に動く)
function makeProcessedBackground(img, W, H, offsetX, offsetY, drawW, drawH, saturationPct, contrastPct, blurPx) {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const offCtx = off.getContext('2d');
    offCtx.drawImage(img, offsetX, offsetY, drawW, drawH);

    const saturation = saturationPct / 100;
    const contrast = contrastPct / 100;
    if (saturation !== 1 || contrast !== 1 || blurPx > 0) {
        const imageData = offCtx.getImageData(0, 0, W, H);
        applySaturationContrast(imageData, saturation, contrast);
        if (blurPx > 0) boxBlur(imageData, Math.round(blurPx));
        offCtx.putImageData(imageData, 0, 0);
    }
    return off;
}

// ------------------------------------------------------------
// 画像読み込み
// ------------------------------------------------------------
imageLoader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const imgObj = new Image();
        imgObj.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_DIM = 2000;
            let width = imgObj.width;
            let height = imgObj.height;
            if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) {
                    height = Math.round((height * MAX_DIM) / width);
                    width = MAX_DIM;
                } else {
                    width = Math.round((width * MAX_DIM) / height);
                    height = MAX_DIM;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgObj, 0, 0, width, height);

            const resized = new Image();
            resized.onload = () => {
                loadedImage = resized;
                resetImageTransform();
                scheduleRender();
            };
            resized.src = canvas.toDataURL('image/jpeg', 0.92);
        };
        imgObj.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function resetImageTransform() {
    imgScale = 1;
    imgPosX = 0;
    imgPosY = 0;
    scheduleRender();
}
resetImgBtn.addEventListener('click', resetImageTransform);

function changeResolution() {
    const val = resolutionSelect.value;
    if (val === '1000x1593') {
        container.classList.remove('landscape');
    } else if (val === '1593x1000') {
        container.classList.add('landscape');
    }
    resetImageTransform();
}
resolutionSelect.addEventListener('change', changeResolution);

// ------------------------------------------------------------
// コントロール変更時の同期制御（LEFT/RIGHT時のALIGN・V-ALIGN制御）
// ------------------------------------------------------------
function updateFieldStates() {
    if (titlePositionInput.value === 'left') {
        titleAlignInput.value = 'right';
        titleAlignInput.disabled = true;
        titleAlignNote.textContent = '(FIXED: RIGHT)';
        titleVAlignGroup.style.display = 'flex';
    } else if (titlePositionInput.value === 'right') {
        titleAlignInput.value = 'left';
        titleAlignInput.disabled = true;
        titleAlignNote.textContent = '(FIXED: LEFT)';
        titleVAlignGroup.style.display = 'flex';
    } else {
        titleAlignInput.disabled = false;
        titleAlignNote.textContent = '';
        titleVAlignGroup.style.display = 'none';
    }

    if (bodyPositionInput.value === 'left') {
        bodyAlignInput.value = 'right';
        bodyAlignInput.disabled = true;
        bodyAlignNote.textContent = '(FIXED: RIGHT)';
        bodyVAlignGroup.style.display = 'flex';
    } else if (bodyPositionInput.value === 'right') {
        bodyAlignInput.value = 'left';
        bodyAlignInput.disabled = true;
        bodyAlignNote.textContent = '(FIXED: LEFT)';
        bodyVAlignGroup.style.display = 'flex';
    } else {
        bodyAlignInput.disabled = false;
        bodyAlignNote.textContent = '';
        bodyVAlignGroup.style.display = 'none';
    }
}

bodySizeInput.addEventListener('input', () => {
    topHeaderSizeInput.value = bodySizeInput.value;
    onControlsChanged();
});

function onControlsChanged() {
    updateFieldStates();
    blurVal.textContent = blurIntensityInput.value;
    grainVal.textContent = grainIntensityInput.value;
    satVal.textContent = bgSaturationInput.value;
    insideSatVal.textContent = insideSaturationInput.value;
    scheduleRender();
}

[
    blurIntensityInput, grainIntensityInput, bgSaturationInput, insideSaturationInput, textureTypeInput,
    borderWidthInput, borderColorInput, showCrossInput,
    titleTextInput, titlePositionInput, titleSizeInput, titleAlignInput, titleVAlignInput, titleColorInput,
    bodyTextInput, bodyPositionInput, bodySizeInput, bodyAlignInput, bodyVAlignInput, bodyColorInput,
    topHeaderLeftInput, topHeaderCenterInput, topHeaderRightInput, topHeaderSizeInput, topHeaderColorInput,
    extraTextInput, extraSizeInput, extraAlignInput, extraTypeInput,
    copyTextInput, copyTypeInput, copySizeInput, copyAlignInput
].forEach(el => {
    if (el) {
        el.addEventListener('input', onControlsChanged);
        el.addEventListener('change', onControlsChanged);
    }
});

// ------------------------------------------------------------
// 画像パン・ズーム・クロップボックスの操作（マウス・タッチ共通）
// ------------------------------------------------------------

container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { width: containerW, height: containerH } = getContainerSize();
    const rect = container.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (containerW / rect.width);
    const mouseY = (e.clientY - rect.top) * (containerH / rect.height);

    const zoomFactor = 1.1;
    let newScale = imgScale;
    if (e.deltaY < 0) newScale *= zoomFactor;
    else newScale /= zoomFactor;
    newScale = Math.max(0.1, Math.min(newScale, 10));

    imgPosX = mouseX - (mouseX - imgPosX) * (newScale / imgScale);
    imgPosY = mouseY - (mouseY - imgPosY) * (newScale / imgScale);
    imgScale = newScale;

    scheduleRender();
}, { passive: false });

container.addEventListener('mousedown', (e) => {
    if (e.target === cropBox || e.target.classList.contains('handle')) return;
    isPanningImage = true;
    const { width: containerW, height: containerH } = getContainerSize();
    const rect = container.getBoundingClientRect();
    const scaleX = containerW / rect.width;
    const scaleY = containerH / rect.height;
    panStartX = (e.clientX - rect.left) * scaleX - imgPosX;
    panStartY = (e.clientY - rect.top) * scaleY - imgPosY;
});

container.addEventListener('touchstart', (e) => {
    if (e.target === cropBox || e.target.classList.contains('handle')) return;
    
    if (e.touches.length === 2) {
        isPanningImage = false;
        initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        initialPinchScale = imgScale;
        e.preventDefault();
    } else if (e.touches.length === 1) {
        isPanningImage = true;
        const { width: containerW, height: containerH } = getContainerSize();
        const rect = container.getBoundingClientRect();
        const scaleX = containerW / rect.width;
        const scaleY = containerH / rect.height;
        panStartX = (e.touches[0].clientX - rect.left) * scaleX - imgPosX;
        panStartY = (e.touches[0].clientY - rect.top) * scaleY - imgPosY;
    }
}, { passive: false });

function getBoxPixelRect(W, H) {
    return {
        left: boxLeftRatio * W,
        top: boxTopRatio * H,
        width: boxWidthRatio * W,
        height: boxHeightRatio * H
    };
}

function syncCropBoxDom() {
    const { width: containerW, height: containerH } = getContainerSize();
    const r = getBoxPixelRect(containerW, containerH);
    const rect = container.getBoundingClientRect();
    const scaleX = rect.width / containerW;
    const scaleY = rect.height / containerH;
    cropBox.style.left = `${r.left * scaleX}px`;
    cropBox.style.top = `${r.top * scaleY}px`;
    cropBox.style.width = `${r.width * scaleX}px`;
    cropBox.style.height = `${r.height * scaleY}px`;
}

cropBox.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('handle')) {
        isResizingBox = true;
        currentHandle = e.target.getAttribute('data-handle');
    } else if (e.target === cropBox) {
        isDraggingBox = true;
    } else {
        return;
    }
    startX = e.clientX;
    startY = e.clientY;
    const { width: containerW, height: containerH } = getContainerSize();
    const r = getBoxPixelRect(containerW, containerH);
    startLeft = r.left;
    startTop = r.top;
    startWidth = r.width;
    startHeight = r.height;
    e.stopPropagation();
});

cropBox.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    if (e.target.classList.contains('handle')) {
        isResizingBox = true;
        currentHandle = e.target.getAttribute('data-handle');
    } else if (e.target === cropBox) {
        isDraggingBox = true;
    } else {
        return;
    }
    startX = touch.clientX;
    startY = touch.clientY;
    const { width: containerW, height: containerH } = getContainerSize();
    const r = getBoxPixelRect(containerW, containerH);
    startLeft = r.left;
    startTop = r.top;
    startWidth = r.width;
    startHeight = r.height;
    e.stopPropagation();
}, { passive: false });

function handleMove(clientX, clientY) {
    if (!isDraggingBox && !isResizingBox && !isPanningImage) return;

    const { width: containerW, height: containerH } = getContainerSize();
    const rect = container.getBoundingClientRect();
    const scaleX = containerW / rect.width;
    const scaleY = containerH / rect.height;
    const dx = (clientX - startX) * scaleX;
    const dy = (clientY - startY) * scaleY;

    if (isDraggingBox) {
        let newLeft = Math.max(0, Math.min(startLeft + dx, containerW - startWidth));
        let newTop = Math.max(0, Math.min(startTop + dy, containerH - startHeight));
        boxLeftRatio = newLeft / containerW;
        boxTopRatio = newTop / containerH;
    } else if (isResizingBox) {
        let newLeft = startLeft, newTop = startTop, newWidth = startWidth, newHeight = startHeight;
        if (currentHandle.includes('r')) newWidth = Math.max(50, startWidth + dx);
        if (currentHandle.includes('b')) newHeight = Math.max(50, startHeight + dy);
        if (currentHandle.includes('l')) {
            const pw = startWidth - dx;
            if (pw > 50) { newWidth = pw; newLeft = startLeft + dx; }
        }
        if (currentHandle.includes('t')) {
            const ph = startHeight - dy;
            if (ph > 50) { newHeight = ph; newTop = startTop + dy; }
        }
        boxLeftRatio = newLeft / containerW;
        boxTopRatio = newTop / containerH;
        boxWidthRatio = newWidth / containerW;
        boxHeightRatio = newHeight / containerH;
    } else if (isPanningImage) {
        const mouseX = (clientX - rect.left) * scaleX;
        const mouseY = (clientY - rect.top) * scaleY;
        imgPosX = mouseX - panStartX;
        imgPosY = mouseY - panStartY;
    }
    scheduleRender();
}

document.addEventListener('mousemove', (e) => {
    handleMove(e.clientX, e.clientY);
});

document.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDistance !== null) {
        e.preventDefault();
        const currentDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const zoomFactor = currentDistance / initialPinchDistance;
        let newScale = Math.max(0.1, Math.min(initialPinchScale * zoomFactor, 10));

        const { width: containerW, height: containerH } = getContainerSize();
        const rect = container.getBoundingClientRect();
        const centerX = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) * (containerW / rect.width);
        const centerY = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) * (containerH / rect.height);

        imgPosX = centerX - (centerX - imgPosX) * (newScale / imgScale);
        imgPosY = centerY - (centerY - imgPosY) * (newScale / imgScale);
        imgScale = newScale;

        scheduleRender();
    } else if (e.touches.length === 1 && (isDraggingBox || isResizingBox || isPanningImage)) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: false });

function endInteraction() {
    isDraggingBox = false;
    isResizingBox = false;
    isPanningImage = false;
    currentHandle = null;
    initialPinchDistance = null;
}

document.addEventListener('mouseup', endInteraction);
document.addEventListener('touchend', endInteraction);
document.addEventListener('touchcancel', endInteraction);

window.addEventListener('resize', () => {
    syncCropBoxDom();
});

function computeImageDrawRect(img, W, H) {
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    const containerAspect = W / H;
    const imgAspect = naturalWidth / naturalHeight;

    let drawW, drawH, offsetX, offsetY;
    if (imgAspect > containerAspect) {
        drawW = W * imgScale;
        drawH = (W / imgAspect) * imgScale;
        offsetX = imgPosX;
        offsetY = imgPosY + (H - (W / imgAspect)) * imgScale / 2;
    } else {
        drawW = (H * imgAspect) * imgScale;
        drawH = H * imgScale;
        offsetX = imgPosX + (W - (H * imgAspect)) * imgScale / 2;
        offsetY = imgPosY;
    }
    return { drawW, drawH, offsetX, offsetY };
}

// ------------------------------------------------------------
// メイン描画関数
// ------------------------------------------------------------
function render(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, W, H);

    const box = getBoxPixelRect(W, H);
    const satValNum = parseInt(bgSaturationInput.value, 10);
    const insideSatValNum = parseInt(insideSaturationInput.value, 10);
    const blurPx = parseInt(blurIntensityInput.value, 10);
    const grainValNum = parseInt(grainIntensityInput.value, 10);
    const borderWidth = parseInt(borderWidthInput.value, 10);
    const borderColor = borderColorInput.value;
    const showCross = showCrossInput.value === 'show';

    const satFilter = `saturate(${satValNum}%) contrast(120%)`;
    const insideSatFilter = `saturate(${insideSatValNum}%) contrast(120%)`;

    if (loadedImage) {
        const { drawW, drawH, offsetX, offsetY } = computeImageDrawRect(loadedImage, W, H);

        // 1. 背景
        // ctx.filter (saturate+blurの複合指定) は iOS Safari で反応しない
        // ことがあるため、オフスクリーンcanvasにピクセル処理で適用してから
        // drawImage で合成する(drawImageはclipに正しく従う)。
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.rect(box.left, box.top, box.width, box.height);
        ctx.clip('evenodd');

        const bgCanvas = makeProcessedBackground(
            loadedImage, W, H, offsetX, offsetY, drawW, drawH,
            satValNum, 120, blurPx
        );
        ctx.drawImage(bgCanvas, 0, 0);

        if (blurPx > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();

        // 2. テクスチャ
        if (grainValNum > 0) {
            const textureType = textureTypeInput.value;
            const tile = textureType === 'frosted' ? frostedTileCanvas : grainTileCanvas;
            if (tile) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, W, H);
                ctx.rect(box.left, box.top, box.width, box.height);
                ctx.clip('evenodd');

                if (textureType === 'frosted') {
                    ctx.globalCompositeOperation = 'overlay';
                    ctx.globalAlpha = Math.min(1, grainValNum / 100 * 1.3);
                } else {
                    ctx.globalAlpha = grainValNum / 100;
                }

                const tileSize = tile.width;
                for (let y = 0; y < H; y += tileSize) {
                    for (let x = 0; x < W; x += tileSize) {
                        ctx.drawImage(tile, x, y);
                    }
                }
                ctx.restore();
            }
        }

        // 3. クロップ内
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.left, box.top, box.width, box.height);
        ctx.clip();
        ctx.filter = insideSatFilter;
        ctx.drawImage(loadedImage, offsetX, offsetY, drawW, drawH);
        ctx.filter = 'none';

        if (showCross) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1;
            const cx = box.left + box.width / 2;
            const cy = box.top + box.height / 2;
            const crossSize = Math.min(box.width, box.height) * 0.12;
            ctx.beginPath();
            ctx.moveTo(cx - crossSize, cy);
            ctx.lineTo(cx + crossSize, cy);
            ctx.moveTo(cx, cy - crossSize);
            ctx.lineTo(cx, cy + crossSize);
            ctx.stroke();
        }
        ctx.restore();

        // 4. 枠線
        if (borderWidth > 0) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = borderWidth;
            ctx.strokeRect(box.left, box.top, box.width, box.height);
        }

        // 5. テキスト描画
        drawTexts(ctx, W, H, box, loadedImage, offsetX, offsetY, drawW, drawH, satFilter);
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = `14px ${FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('// UPLOAD IMAGE TO START', W / 2, H / 2);
    }
}

function drawTexts(ctx, W, H, box, img, offsetX, offsetY, drawW, drawH, satFilter) {
    const tPos = titlePositionInput.value;
    const bPos = bodyPositionInput.value;
    const gap = 12;

    const titleText = titleTextInput.value;
    const titleSize = parseInt(titleSizeInput.value, 10);
    const titleAlign = titleAlignInput.value;
    const titleVAlign = titleVAlignInput.value;
    const titleColor = titleColorInput.value;

    const bodyText = bodyTextInput.value;
    const bodySize = parseInt(bodySizeInput.value, 10);
    const bodyAlign = bodyAlignInput.value;
    const bodyVAlign = bodyVAlignInput.value;
    const bodyColor = bodyColorInput.value;

    let titleH = 0;
    let bodyH = 0;

    if (titleText) {
        ctx.font = `bold ${titleSize}px ${FONT_STACK}`;
        titleH = titleText.split('\n').length * titleSize * 1.3;
    }
    if (bodyText) {
        ctx.font = `${bodySize}px ${FONT_STACK}`;
        bodyH = bodyText.split('\n').length * bodySize * 1.3;
    }

    function renderBlock(text, pos, size, align, vAlign, color, bold, currentY) {
        if (!text) return 0;
        ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT_STACK}`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = color;
        ctx.textAlign = align;

        const lines = text.split('\n');
        const blockH = lines.length * size * 1.3;

        let x = box.left;
        if (align === 'center') x = box.left + box.width / 2;
        if (align === 'right') x = box.left + box.width;

        if (pos === 'inside-bottom' || pos === 'inside-top') {
            const padding = 16;
            x = padding;
            if (align === 'center') x = W / 2;
            if (align === 'right') x = W - padding;
            lines.forEach((line, idx) => ctx.fillText(line, x, currentY + idx * size * 1.3));
            return blockH;
        }

        if (pos === 'left' || pos === 'right') {
            let y = currentY;
            if (pos === 'left') x = box.left - gap;
            if (pos === 'right') x = box.left + box.width + gap;
            lines.forEach((line, idx) => ctx.fillText(line, x, y + idx * size * 1.3));
            return blockH;
        }

        let y = currentY;
        lines.forEach((line, idx) => ctx.fillText(line, x, y + idx * size * 1.3));
        return blockH;
    }

    if (tPos === bPos && titleText && bodyText) {
        if (tPos === 'bottom') {
            const startY1 = box.top + box.height + gap;
            renderBlock(titleText, tPos, titleSize, titleAlign, titleVAlign, titleColor, true, startY1);
            const startY2 = startY1 + titleH + 8;
            renderBlock(bodyText, bPos, bodySize, bodyAlign, bodyVAlign, bodyColor, false, startY2);
        } else if (tPos === 'top') {
            const totalH = titleH + 8 + bodyH;
            const startY1 = box.top - gap - totalH;
            renderBlock(titleText, tPos, titleSize, titleAlign, titleVAlign, titleColor, true, startY1);
            const startY2 = startY1 + titleH + 8;
            renderBlock(bodyText, bPos, bodySize, bodyAlign, bodyVAlign, bodyColor, false, startY2);
        } else if (tPos === 'inside-top') {
            const padding = 16;
            const startY1 = padding;
            renderBlock(titleText, tPos, titleSize, titleAlign, titleVAlign, titleColor, true, startY1);
            const startY2 = startY1 + titleH + 8;
            renderBlock(bodyText, bPos, bodySize, bodyAlign, bodyVAlign, bodyColor, false, startY2);
        } else if (tPos === 'inside-bottom') {
            const padding = 16;
            const totalH = titleH + 8 + bodyH;
            const startY1 = H - padding - totalH;
            renderBlock(titleText, tPos, titleSize, titleAlign, titleVAlign, titleColor, true, startY1);
            const startY2 = startY1 + titleH + 8;
            renderBlock(bodyText, bPos, bodySize, bodyAlign, bodyVAlign, bodyColor, false, startY2);
        } else if (tPos === 'left' || tPos === 'right') {
            let startY1 = box.top;
            if (titleVAlign === 'bottom') {
                const totalH = titleH + 8 + bodyH;
                startY1 = box.top + box.height - totalH;
            }
            renderBlock(titleText, tPos, titleSize, titleAlign, titleVAlign, titleColor, true, startY1);
            const startY2 = startY1 + titleH + 8;
            renderBlock(bodyText, bPos, bodySize, bodyAlign, bodyVAlign, bodyColor, false, startY2);
        }
    } else {
        if (titleText) {
            let startY = box.top + box.height + gap;
            if (tPos === 'top') startY = box.top - gap - titleH;
            else if (tPos === 'inside-top') startY = 16;
            else if (tPos === 'inside-bottom') startY = H - 16 - titleH;
            else if (tPos === 'left' || tPos === 'right') {
                startY = titleVAlign === 'bottom' ? box.top + box.height - titleH : box.top;
            }
            renderBlock(titleText, tPos, titleSize, titleAlign, titleVAlign, titleColor, true, startY);
        }

        if (bodyText) {
            let startY = box.top + box.height + gap;
            if (bPos === 'top') startY = box.top - gap - bodyH;
            else if (bPos === 'inside-top') startY = 16;
            else if (bPos === 'inside-bottom') startY = H - 16 - bodyH;
            else if (bPos === 'left' || bPos === 'right') {
                startY = bodyVAlign === 'bottom' ? box.top + box.height - bodyH : box.top;
            }
            renderBlock(bodyText, bPos, bodySize, bodyAlign, bodyVAlign, bodyColor, false, startY);
        }
    }

    const padding = 24;

    const tLeftText = topHeaderLeftInput ? topHeaderLeftInput.value : '';
    const tCenterText = topHeaderCenterInput ? topHeaderCenterInput.value : '';
    const tRightText = topHeaderRightInput ? topHeaderRightInput.value : '';
    const tHeaderSize = topHeaderSizeInput ? (parseInt(topHeaderSizeInput.value, 10) || parseInt(bodySizeInput.value, 10)) : 11;
    const tHeaderColor = topHeaderColorInput ? topHeaderColorInput.value : '#ffffff';

    if (tLeftText || tCenterText || tRightText) {
        ctx.save();
        ctx.font = `${tHeaderSize}px ${FONT_STACK}`;
        ctx.fillStyle = tHeaderColor;
        ctx.textBaseline = 'top';
        const topPadding = 24;

        if (tLeftText) {
            ctx.textAlign = 'left';
            ctx.fillText(tLeftText, padding * 2, topPadding);
        }
        if (tCenterText) {
            ctx.textAlign = 'center';
            ctx.fillText(tCenterText, W / 2, topPadding);
        }
        if (tRightText) {
            ctx.textAlign = 'right';
            ctx.fillText(tRightText, W - padding * 2, topPadding);
        }
        ctx.restore();
    }

    // TEXT 03
    const extraText = extraTextInput.value;
    const extraSize = parseInt(extraSizeInput.value, 10);
    const extraAlign = extraAlignInput.value;
    const extraType = extraTypeInput.value;

    if (extraText) {
        let x = W / 2;
        if (extraAlign === 'left') x = padding;
        if (extraAlign === 'right') x = W - padding;

        const copySizeTemp = parseInt(copySizeInput.value, 10) || 12;
        const y = H - padding - copySizeTemp - 15 - extraSize;

        if (extraType === 'reveal' && img) {
            const dpr = 2; 
            const textCanvas = document.createElement('canvas');
            textCanvas.width = W * dpr;
            textCanvas.height = H * dpr;
            const tCtx = textCanvas.getContext('2d');
            tCtx.scale(dpr, dpr);

            tCtx.font = `900 ${extraSize}px ${FONT_STACK}`;
            tCtx.textBaseline = 'top';
            tCtx.textAlign = extraAlign;
            tCtx.fillStyle = '#ffffff';
            tCtx.fillText(extraText, x, y);

            tCtx.globalCompositeOperation = 'source-in';
            tCtx.filter = satFilter;
            tCtx.drawImage(img, offsetX, offsetY, drawW, drawH);

            ctx.drawImage(textCanvas, 0, 0, W, H);
        } else if (extraType === 'white') {
            ctx.save();
            ctx.font = `900 ${extraSize}px ${FONT_STACK}`;
            ctx.textBaseline = 'top';
            ctx.textAlign = extraAlign;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(extraText, x, y);
            ctx.restore();
        } else if (extraType === 'outline') {
            ctx.save();
            ctx.font = `900 ${extraSize}px ${FONT_STACK}`;
            ctx.textBaseline = 'top';
            ctx.textAlign = extraAlign;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeText(extraText, x, y);
            ctx.restore();
        }
    }

    // TEXT 04
    const copyText = copyTextInput.value;
    const copySize = parseInt(copySizeInput.value, 10);
    const copyAlign = copyAlignInput.value;
    const copyType = copyTypeInput.value;

    if (copyText) {
        let cx = W / 2;
        if (copyAlign === 'left') cx = padding;
        if (copyAlign === 'right') cx = W - padding;

        const y = H - padding - copySize;

        if (copyType === 'reveal' && img) {
            const dpr = 2; 
            const textCanvas = document.createElement('canvas');
            textCanvas.width = W * dpr;
            textCanvas.height = H * dpr;
            const tCtx = textCanvas.getContext('2d');
            tCtx.scale(dpr, dpr);

            tCtx.font = `600 ${copySize}px ${FONT_STACK}`;
            tCtx.textBaseline = 'top';
            tCtx.textAlign = copyAlign;
            tCtx.fillStyle = '#ffffff';
            tCtx.fillText(copyText, cx, y);

            tCtx.globalCompositeOperation = 'source-in';
            tCtx.filter = satFilter;
            tCtx.drawImage(img, offsetX, offsetY, drawW, drawH);

            ctx.drawImage(textCanvas, 0, 0, W, H);
        } else if (copyType === 'white') {
            ctx.save();
            ctx.font = `400 ${copySize}px ${FONT_STACK}`;
            ctx.textBaseline = 'top';
            ctx.textAlign = copyAlign;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(copyText, cx, y);
            ctx.restore();
        } else if (copyType === 'outline') {
            ctx.save();
            ctx.font = `400 ${copySize}px ${FONT_STACK}`;
            ctx.textBaseline = 'top';
            ctx.textAlign = copyAlign;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.3;
            ctx.strokeText(copyText, cx, y);
            ctx.restore();
        }
    }
}

// ------------------------------------------------------------
// 描画スケジュール・初期化
// ------------------------------------------------------------
function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
        renderScheduled = false;
        doScreenRender();
    });
}

function doScreenRender() {
    const { width: containerW, height: containerH } = getContainerSize();
    const dpr = window.devicePixelRatio || 1;
    mainCanvas.width = containerW * dpr;
    mainCanvas.height = containerH * dpr;
    mainCanvas.style.width = '100%';
    mainCanvas.style.height = '100%';

    mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render(mainCtx, containerW, containerH);
    syncCropBoxDom();
}

function generateExportDataUrl() {
    const { width: containerW, height: containerH } = getContainerSize();
    const exportScale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = containerW * exportScale;
    canvas.height = containerH * exportScale;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(exportScale, 0, 0, exportScale, 0, 0);
    render(ctx, containerW, containerH);
    return canvas.toDataURL('image/png');
}

saveImgBtn.addEventListener('click', () => {
    if (!loadedImage) {
        renderStatus.textContent = 'NO IMAGE';
        return;
    }
    saveImgBtn.disabled = true;
    const originalLabel = saveImgBtn.textContent;
    saveImgBtn.textContent = '// GENERATING...';
    renderStatus.textContent = 'GENERATING...';

    requestAnimationFrame(() => {
        try {
            const dataUrl = generateExportDataUrl();
            openSaveModal(dataUrl);
            renderStatus.textContent = 'READY';
        } catch (err) {
            console.error('Export failed:', err);
            renderStatus.textContent = 'ERROR';
        } finally {
            saveImgBtn.disabled = false;
            saveImgBtn.textContent = originalLabel;
        }
    });
});

const saveModalOverlay = document.getElementById('saveModalOverlay');
const modalImage = document.getElementById('modalImage');
const modalDownloadLink = document.getElementById('modalDownloadLink');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCloseBtn2 = document.getElementById('modalCloseBtn2');

function openSaveModal(dataUrl) {
    modalImage.src = dataUrl;
    modalDownloadLink.href = dataUrl;
    saveModalOverlay.classList.add('is-open');
}
function closeSaveModal() {
    saveModalOverlay.classList.remove('is-open');
}

modalCloseBtn.addEventListener('click', closeSaveModal);
modalCloseBtn2.addEventListener('click', closeSaveModal);
saveModalOverlay.addEventListener('click', (e) => {
    if (e.target === saveModalOverlay) closeSaveModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && saveModalOverlay.classList.contains('is-open')) {
        closeSaveModal();
    }
});

window.addEventListener('load', () => {
    changeResolution();
    onControlsChanged();
    scheduleRender();
});