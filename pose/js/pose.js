const messageDisplay = document.getElementById('message-display');
const video = document.getElementById('webcam');
const canvas = document.getElementById('outputCanvas');

const ctx = canvas.getContext('2d');

// 検出器の初期化
let detector;
let frameCount = 0;

// 骨格接続定義
const keypointPairs = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [5, 6], [6, 7], [7, 8],
    [5, 11], [6, 12],
    [11, 12], [11, 13], [13, 15],
    [12, 14], [14, 16]
];

async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    await video.play();
}

/**
 * キーポイントを描画 
 * @param {*} keypoints 
 */
function drawKeypoints(keypoints) {
    keypoints.forEach(point => {
        if (point.score > 0.5) {
            const x = point.x * canvas.width / video.videoWidth;
            const y = point.y * canvas.height / video.videoHeight;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = 'white';
            ctx.fill();
        }
    });
}

/**
 * 骨格を描画
 * @param {Array} keypoints - 検出されたキーポイントの配列
 */
function drawSkeleton(keypoints) {
    keypointPairs.forEach(([start, end]) => {
        const p1 = keypoints[start];
        const p2 = keypoints[end];
        if (p1.score > 0.3 && p2.score > 0.3) {
            const x1 = p1.x * canvas.width / video.videoWidth;
            const y1 = p1.y * canvas.height / video.videoHeight;
            const x2 = p2.x * canvas.width / video.videoWidth;
            const y2 = p2.y * canvas.height / video.videoHeight;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });
}

/**
 * 姿勢結果を表示 
 * @param {*} isHeadDroping 
 */
function showPostureResult(isHeadDroping) {
    messageDisplay.textContent = isHeadDroping ? '猫背' : '良好';
    if (isHeadDroping) {
        messageDisplay.classList.add('bg-red-300');
        messageDisplay.classList.add('text-red-800');
    } else {
        messageDisplay.classList.remove('bg-red-300');
        messageDisplay.classList.remove('text-red-800');
    }
}

/**
 * 前傾角度を計算
 * @param {*} keypoints 
 * @returns 
 */
function isHeadDroping(keypoints) {
    const leftEye = keypoints[1];
    const rightEye = keypoints[2];
    const leftEar = keypoints[3];
    const rightEar = keypoints[4];

    // 信頼度確認
    const leftDrop = leftEar.y < leftEye.y;
    const rightDrop = rightEar.y < rightEye.y;

    // 目の方が下ならうつむきと判定
    return leftDrop || rightDrop;
}

/**
 * Pose Detection モデルをセットアップ
 */
async function setupModel() {
    const model = poseDetection.SupportedModels.MoveNet;
    detector = await poseDetection.createDetector(model, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
    });
    messageDisplay.textContent = 'Pose Detection モデルがロードされました。';
}

/**
 * 姿勢を検出し、描画
 */
async function detectPose() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const poses = await detector.estimatePoses(video);

    if (poses.length > 0) {
        const keypoints = poses[0].keypoints;

        drawKeypoints(keypoints);
        drawSkeleton(keypoints);

        const headDroping = isHeadDroping(keypoints);
        showPostureResult(headDroping)
    }
    requestAnimationFrame(detectPose);
}

async function app() {
    await setupCamera();
    await setupModel();
    detectPose();
}

app();