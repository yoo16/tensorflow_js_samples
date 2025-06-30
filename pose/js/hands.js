const video = document.getElementById('webcam');
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');

let detector;
let currentSpokenNumber = 0;      // 直前に再生された数字（連続再生防止用）
let isAudioPlaying = false;       // 音声が再生中かどうか
let lastAudioPlayTime = 0;        // 最後に音声が再生された時間
let lastNumber = 0;            // 最後に認識された指の本数
const AUDIO_INTERVAL = 1500;      // 最低再生間隔（ミリ秒）

// 手のランドマークの接続定義（MediaPipe Handsの仕様に基づく）
const fingers = [
    [0, 1, 2, 3, 4],     // 親指
    [0, 5, 6, 7, 8],     // 人差し指
    [0, 9, 10, 11, 12],  // 中指
    [0, 13, 14, 15, 16], // 薬指
    [0, 17, 18, 19, 20]  // 小指
];

const selectVoiceActor = 2;

// 音声ファイルのパス（手の本数に応じて変化）
const audioFiles = {
    1: {
        1: "audio/voice_1_1.mp3",
        2: "audio/voice_1_2.mp3",
        3: "audio/voice_1_3.mp3",
        4: "audio/voice_1_4.mp3",
        5: "audio/voice_1_5.mp3",
    },
    2: {
        1: "audio/voice_2_1.mp3",
        2: "audio/voice_2_2.mp3",
        3: "audio/voice_2_3.mp3",
        4: "audio/voice_2_4.mp3",
        5: "audio/voice_2_5.mp3",
    },
}

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

        const xRate = canvas.width / video.videoWidth
        const yRate = canvas.height / video.videoHeight
        // 手首位置に数字を描画
        const x = keypoints[0].x * xRate;
        const y = keypoints[0].y * yRate;

        if (count > 0 && count <= 5) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 96px Arial';
            // 指の一番高い位置を取得
            const maxY = Math.min(
                keypoints[4].y * yRate, // 親指
                keypoints[8].y * yRate,  // 人差し指
                keypoints[12].y * yRate, // 中指
                keypoints[16].y * yRate, // 薬指
                keypoints[20].y * yRate  // 小指
            );
            ctx.fillText(count.toString(), x, maxY);
        }
    });

    requestAnimationFrame(detectHands);
}
function playNumberAudio(fingerCount) {
    const now = Date.now();
    const audioFile = audioFiles[selectVoiceActor][fingerCount];
    console.log(`指の本数: ${fingerCount}, 音声ファイル: ${audioFile}`);
    if (!isAudioPlaying && audioFile) {
        const audio = new Audio(audioFile);
        isAudioPlaying = true;
        currentSpokenNumber = fingerCount;
        lastAudioPlayTime = now;

        audio.play().catch(err => {
            console.error("音声再生失敗:", err);
        });

        audio.onended = () => {
            isAudioPlaying = false;
        };
    }
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