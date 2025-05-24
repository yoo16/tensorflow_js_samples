const video = document.getElementById('webcam');
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');

let detector;

/**
 * Webカメラのセットアップ
 */
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        advanced: [{ zoom: 1.0 }]
    });
    video.srcObject = stream;
    await video.play();
}

/**
 * 手の関節ランドマークを描画
 */
function drawHandLandmarks(keypoints) {
    keypoints.forEach((point) => {
        const x = point.x * canvas.width / video.videoWidth;
        const y = point.y * canvas.height / video.videoHeight;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = 'lime';
        ctx.fill();
    });
}

/**
 * 指の骨格ラインを描画（21点を指の構造に基づき接続）
 */
function drawHandSkeleton(keypoints) {
    // 指ごとのインデックスグループ
    const fingers = [
        [0, 1, 2, 3, 4],     // 親指
        [0, 5, 6, 7, 8],     // 人差し指
        [0, 9, 10, 11, 12],  // 中指
        [0, 13, 14, 15, 16], // 薬指
        [0, 17, 18, 19, 20]  // 小指
    ];

    fingers.map(finger => {
        ctx.beginPath();
        finger.forEach((idx, i) => {
            const point = keypoints[idx];
            const x = point.x * canvas.width / video.videoWidth;
            const y = point.y * canvas.height / video.videoHeight;
            // --- 線（骨格）を描画 ---
            if (i === 0) {
                ctx.beginPath();
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.strokeStyle = 'cyan';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    fingers.map(finger => {
        finger.forEach((idx, i) => {
            const point = keypoints[idx];
            const x = point.x * canvas.width / video.videoWidth;
            const y = point.y * canvas.height / video.videoHeight;

            // --- 点（関節）を描画 ---
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
        });
    });
}

/**
 * 手の検出器（MediaPipe Hands）をセットアップ
 */
async function setupModel() {
    const model = handPoseDetection.SupportedModels.MediaPipeHands;
    detector = await handPoseDetection.createDetector(model, {
        runtime: 'mediapipe',
        modelType: 'full', // 'lite', 'full'
        maxHands: 2,
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
    });
}

/**
 * 手の検出と描画
 */
async function detectHands() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hands = await detector.estimateHands(video, {
        flipHorizontal: false
    });

    hands.forEach(hand => {
        drawHandLandmarks(hand.keypoints3D || hand.keypoints); // 3D が使えるなら優先
        drawHandSkeleton(hand.keypoints);
    });

    requestAnimationFrame(detectHands);
}

/**
 * アプリ起動
 */
async function app() {
    await setupCamera();
    await setupModel();
    detectHands();
}

app();
