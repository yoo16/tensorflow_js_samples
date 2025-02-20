// DOM取得
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('canvas');
const partSelectEl = document.getElementById('partSelect'); // 追加

// キャンバスのコンテキスト
const ctx = canvasEl.getContext('2d');

// 映像サイズ
const videoWidth = 640;
const videoHeight = 480;

// 顔検出器
let detector;
let selectedPart = "nose"; // デフォルトは上唇

/**
 * 顔検出機械学習モデルの設定
 */
async function loadModel() {
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const detectorConfig = {
        runtime: 'mediapipe',
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
    };
    detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
}

/**
 * Webカメラを有効化
 */
async function setupCamera() {
    const config = {
        video: { width: videoWidth, height: videoHeight, facingMode: 'user' },
        audio: false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(config);
    videoEl.srcObject = stream;
    await videoEl.play();
}

/**
 * 顔検出処理
 */
async function detectFace() {
    const estimationConfig = { flipHorizontal: false };
    const faces = await detector.estimateFaces(videoEl, estimationConfig);
    return faces;
}

/**
 * 顔検出結果を描画
 */
function drawResults(faces) {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.fillStyle = 'red';

    if (faces && faces.length > 0) {
        faces.forEach((face) => {
            const landmarks = face.landmarks || face.keypoints;
            const indices = landmarkParts[selectedPart]; // 選択された部位のランドマーク番号を取得

            landmarks.forEach((point, index) => {
                if (indices.includes(index)) { // 選択された部位のみ描画
                    const x = point.x * canvasEl.width / videoWidth;
                    const y = point.y * canvasEl.height / videoHeight;
                    ctx.beginPath();
                    ctx.arc(x, y, 1, 0, 2 * Math.PI);
                    ctx.fill();
                }
            });
        });
    }
}

/**
 * 部位を変更する処理
 */
function changePart() {
    selectedPart = partSelectEl.value;
}

// 毎フレーム実行するループ
async function render() {
    const faces = await detectFace();
    drawResults(faces);
    requestAnimationFrame(render);
}

/**
 * メインアプリケーション
 */
async function app() {
    await loadModel();
    await setupCamera();
    render();
}


Object.keys(landmarkParts).forEach((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = key;
    partSelectEl.appendChild(option);
});

// イベントリスナー追加
partSelectEl.addEventListener('change', changePart);

// アプリ起動
app();