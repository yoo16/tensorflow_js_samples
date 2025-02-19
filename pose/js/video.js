const videoUpload = document.getElementById('video-upload');
const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const defaultWidth = 640;
const defaultHeight = 480;

// 初期値はデフォルト、後で動画の実際のサイズに合わせる
canvas.width = defaultWidth;
canvas.height = defaultHeight;

// 検出器
let detector;
// 検出器の設定
const detectorConfig = {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
};

/**
 * MoveNet の検出器をロード
 * @return {Promise<PoseDetector>} 検出器の生成が完了したpromise
 */
async function createDetector() {
    // MoveNet の検出器をロード
    detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        detectorConfig
    );
}

/**
 * 毎フレーム動画のポーズ検出を実行
 * - 動画が停止している場合はループ
 * - 動画のサイズが 0 でないか確認
 * - ポーズ検出
 * - 検出結果を描画
 * - requestAnimationFrame で次フレームの呼び出し
 */
async function detectPose() {
    // 動画が停止している場合はループ
    if (video.paused || video.ended) {
        requestAnimationFrame(detectPose);
        return;
    }
    // 推論前に動画のサイズが 0 でないか確認
    if (video.videoWidth === 0 || video.videoHeight === 0) {
        requestAnimationFrame(detectPose);
        return;
    }

    // ポーズ検出
    const poses = await detector.estimatePoses(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (poses.length > 0) {
        const keypoints = poses[0].keypoints;
        keypoints.forEach(point => {
            if (point.score > 0.5) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = 'red';
                ctx.fill();
            }
        });
    }
    requestAnimationFrame(detectPose);
}


// 動画ファイルがアップロードされたら video 要素に設定
videoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const fileURL = URL.createObjectURL(file);
        video.src = fileURL;
        video.load();
        // 動画のメタデータが読み込まれるのを待つ
        video.onloadedmetadata = () => {
            // 動画の実際の解像度に合わせる
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            console.log("onloadedmetadata");
            video.play();
        };
    }
});

// 動画が再生されたら検出を開始
video.addEventListener('play', () => {
    detectPose();
});

/**
 * メインのポーズ検出アプリケーション
 *
 * - MoveNet 検出器をロード
 */
async function app() {
    createDetector();
}

app();