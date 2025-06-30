const messageDisplay = document.getElementById('message-display');
const video = document.getElementById('webcam');
const canvas = document.getElementById('outputCanvas');

const ctx = canvas.getContext('2d');

// 検出器の初期化
let detector;
// フレームカウント
let frameCount = 0;
// 姿勢が悪いと判断された時間
let badPostureStart = null;
// 音声ファイルのパス
let audioFile = "audio/voice_1_badpose.mp3"
// 音声再生中かどうかのフラグ
let isAudioPlaying = false;
// 最後に音声を再生した時間
let lastAudioPlayTime = 0;
let faceResults = [];
// 姿勢が悪いと判断する閾値（10秒）
const BAD_POSTURE_THRESHOLD = 10 * 1000;
// 音声再生間隔（10秒）
const AUDIO_INTERVAL = 10 * 1000;
// 音声の初期状態
let isAudioEnabled = true; // 初期状態：音声ON
// 音声ファイルの読み込み
const sleepyAudio = new Audio(audioFile);

// 骨格接続定義
// 顔を除いた骨格ライン用
const keypointPairs = [
    [5, 6],             // shoulders
    [5, 7], [7, 9],     // left arm
    [6, 8], [8, 10],    // right arm
    [5, 11], [6, 12],   // shoulders → hips
    [11, 12],           // hips
    [11, 13], [13, 15], // left leg
    [12, 14], [14, 16]  // right leg
];

/**
 * 音声ファイル読み込み完了時の処理
 * - 再生中でなければ再生
 */
sleepyAudio.onended = () => {
    isAudioPlaying = false;
};

// ボタンの表示を更新
function updateAudioButtonLabel() {
    const btn = document.getElementById("toggle-audio");
    btn.textContent = isAudioEnabled ? "🔊 音声ON" : "🔇 音声OFF";
}

/**
 * カメラをセットアップ
 * - カメラのストリームを取得し、ビデオ要素に設定
 */
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    await video.play();
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
 * キーポイントを描画 
 * @param {*} keypoints 
 */
function drawKeypoints(keypoints) {
    // 顔に対応するインデックス: nose(0), eyes(1,2), ears(3,4)
    const faceIndices = [0, 1, 2, 3, 4];

    faceIndices.forEach(index => {
        const point = keypoints[index];
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
    const now = Date.now();

    if (isHeadDroping) {
        if (!badPostureStart) {
            badPostureStart = now; // 初回検出
        }
        const duration = now - badPostureStart;

        if (duration >= BAD_POSTURE_THRESHOLD) {
            messageDisplay.textContent = '居眠り注意！';
            messageDisplay.classList.add('bg-red-500');
            messageDisplay.classList.add('text-white');

            // 音声再生条件：
            // - 再生中でない
            // - 前回再生から10秒以上経過
            if (isAudioEnabled && !isAudioPlaying && now - lastAudioPlayTime > AUDIO_INTERVAL) {
                sleepyAudio.play();
                isAudioPlaying = true;
                lastAudioPlayTime = now;
            }
        } else {
            messageDisplay.textContent = 'うつむき';
            messageDisplay.classList.add('bg-orange-300');
            messageDisplay.classList.add('text-orange-800');
        }
    } else {
        badPostureStart = null;
        messageDisplay.textContent = '良好';
        messageDisplay.classList.remove('bg-red-300', 'bg-red-500', 'bg-orange-300');
        messageDisplay.classList.remove('text-red-800', 'text-white', 'text-orange-800');

        // 姿勢が戻ったときは音声を止めて状態をリセット
        if (isAudioPlaying) {
            sleepyAudio.pause();
            sleepyAudio.currentTime = 0;
            isAudioPlaying = false;
        }
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

// ボタンイベントリスナーを設定
document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("toggle-audio");
    toggleBtn.addEventListener("click", () => {
        isAudioEnabled = !isAudioEnabled;
        updateAudioButtonLabel();
    });
    updateAudioButtonLabel();
});

/**
 * メインアプリケーションの初期化
 */
async function app() {
    await setupCamera();
    await setupModel();
    detectPose();
}

app();