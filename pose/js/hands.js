const video = document.getElementById('webcam');
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');

let detector;

/**
 * Webカメラのセットアップ
 */
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
    });
    video.srcObject = stream;
    await video.play();
}

/**
 * モデルの初期化
 */
async function setupModel() {
    const model = handPoseDetection.SupportedModels.MediaPipeHands;
    detector = await handPoseDetection.createDetector(model, {
        runtime: 'mediapipe',
        modelType: 'full',
        maxHands: 1,
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
    });
}

/**
 * 手のランドマークと骨格を描画
 */
function drawHand(keypoints) {
    const fingers = [
        [0, 1, 2, 3, 4],     // 親指
        [0, 5, 6, 7, 8],     // 人差し指
        [0, 9, 10, 11, 12],  // 中指
        [0, 13, 14, 15, 16], // 薬指
        [0, 17, 18, 19, 20]  // 小指
    ];

    // 骨格ライン
    fingers.forEach(finger => {
        ctx.beginPath();
        finger.forEach((idx, i) => {
            const pt = keypoints[idx];
            const x = pt.x * canvas.width / video.videoWidth;
            const y = pt.y * canvas.height / video.videoHeight;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.strokeStyle = 'cyan';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // 関節点
    keypoints.forEach(point => {
        const x = point.x * canvas.width / video.videoWidth;
        const y = point.y * canvas.height / video.videoHeight;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
    });
}

/**
 * 指の本数をカウント（右手基準）
 */
function countExtendedFingers(keypoints) {
    let count = 0;

    // 親指（角度で判定　
    if (isThumbExtended(keypoints)) count++;

    // 他の指（tipが中間関節より上）
    if (keypoints[8].y < keypoints[6].y) count++;   // 人差し指
    if (keypoints[12].y < keypoints[10].y) count++; // 中指
    if (keypoints[16].y < keypoints[14].y) count++; // 薬指
    if (keypoints[20].y < keypoints[18].y) count++; // 小指

    return count;
}

/**
 * 親指が伸びているかどうかをベクトルの角度から判定
 */
function isThumbExtended(keypoints) {
    const wrist = keypoints[0];
    const mcp = keypoints[2]; // 母指中手骨（親指の根元）
    const tip = keypoints[4]; // 親指先端

    // ベクトル1: wrist → mcp, ベクトル2: mcp → tip
    const v1 = { x: mcp.x - wrist.x, y: mcp.y - wrist.y };
    const v2 = { x: tip.x - mcp.x, y: tip.y - mcp.y };

    // 内積から角度を計算（cosθ = A・B / |A||B|）
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(cosAngle) * (180 / Math.PI); // ラジアン → 度

    // 角度が一定以上なら「伸びている」と判定（しきい値は調整可能）
    return angle < 50; // 伸びていれば角度は鋭角になる
}

/**
 * 手を検出して描画・カウント
 */
async function detectHands() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hands = await detector.estimateHands(video, {
        flipHorizontal: false
    });

    hands.forEach(hand => {
        const keypoints = hand.keypoints;
        drawHand(keypoints);
        const count = countExtendedFingers(keypoints);

        // 手首位置に数字を描画
        const x = keypoints[0].x * canvas.width / video.videoWidth;
        const y = keypoints[0].y * canvas.height / video.videoHeight;
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = 'yellow';
        ctx.fillText(count.toString(), x - 10, y - 10);
    });

    requestAnimationFrame(detectHands);
}

/**
 * 初期化・開始
 */
async function app() {
    await setupCamera();
    await setupModel();
    canvas.width = 640;
    canvas.height = 480;
    detectHands();
}

app();