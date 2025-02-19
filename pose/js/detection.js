const video = document.getElementById('webcam');
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');

let detector;

// 接続されるキーポイントのインデックスペア
const keypointPairs = [
    // 頭から腕
    [0, 1], [1, 2], [2, 3], [3, 4],
    // 腕のペア
    [5, 6], [6, 7], [7, 8],
    // 胴体
    [5, 11], [6, 12],
    // 左足
    [11, 12], [11, 13], [13, 15],
    // 右足
    [12, 14], [14, 16]
];

// Webカメラのセットアップ
async function setupCamera() {
    const config = {
        video: { width: 640, height: 480 }
    };
    const stream = await navigator.mediaDevices.getUserMedia(config);
    video.srcObject = stream;
    await video.play();
}

/**
 * ポーズ検出結果の各点を描画する
 * @param {PoseLandmark[]} keypoints PoseLandmark 配列
 */
function drawKeypoints(keypoints) {
    keypoints.forEach(point => {
        if (point.score > 0.5) {
            // 座標変換
            const x = point.x * canvas.width / video.videoWidth;
            const y = point.y * canvas.height / video.videoHeight;
            // 描画
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.fillStyle = 'white';
            ctx.fill();
        }
    });
}

/**
 * ポーズ検出結果の各点を結ぶ骨格を描画
 * @param {PoseLandmark[]} keypoints PoseLandmark 配列
 */
function drawSkeleton(keypoints) {
    keypointPairs.forEach(([start, end]) => {
        // 開始座標
        const p1 = keypoints[start];
        // 終了座標
        const p2 = keypoints[end];
        // スコアが 0.3  オーバーの場合
        if (p1.score > 0.3 && p2.score > 0.3) {
            const x1 = p1.x * canvas.width / video.videoWidth;
            const y1 = p1.y * canvas.height / video.videoHeight;
            const x2 = p2.x * canvas.width / video.videoWidth;
            const y2 = p2.y * canvas.height / video.videoHeight;

            // 骨格を描画
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
 * Pose Detection モデルのロード
 * - MoveNet (SINGLEPOSE_THUNDER) を使用
 * - createDetector を使用して検出器を生成
 */
async function setupModel() {
    // Pose Detection モデルのロード
    const model = poseDetection.SupportedModels.MoveNet;
    detector = await poseDetection.createDetector(model, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
    });
}

/**
 * ポーズ検出を実行
 * - ポーズデータ検出
 * - canvasクリア
 * - 骨格のcanvas描画
 * - requestAnimationFrame による次フレームの呼び出し
 */
async function detectPose() {
    // canvasクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const config = { flipHorizontal: false };
    // ポーズデータ検出
    const poses = await detector.estimatePoses(video, config);
    // 骨格のcanvas描画
    poses.forEach(pose => {
        // ポイント
        drawKeypoints(pose.keypoints);
        // 骨格
        drawSkeleton(pose.keypoints);
    });
    requestAnimationFrame(detectPose);
}

/**
 * メインのポーズ検出アプリケーション
 *
 * - Webカメラをセットアップして映像を再生
 * - MoveNetモデルをロードしてポーズ検出器を生成
 * - ポーズ検出と描画のループを実行
 */
async function app() {
    await setupCamera();
    await setupModel();
    detectPose();
}

app();