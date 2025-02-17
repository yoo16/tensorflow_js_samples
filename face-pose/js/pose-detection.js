const video = document.getElementById('webcam');
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');

// Webカメラのセットアップ
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    return new Promise((resolve) => {
        video.onloadedmetadata = () => resolve(video);
    });
}

// キーポイントの描画
function drawKeypoints(keypoints) {
    keypoints.forEach(point => {
        if (point.score > 0.5) {
            const x = point.x * canvas.width / video.videoWidth;
            const y = point.y * canvas.height / video.videoHeight;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.fillStyle = 'lime';
            ctx.fill();
        }
    });
}

// 骨格を描画
function drawSkeleton(keypoints, connections) {
    connections.forEach(([start, end]) => {
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
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });
}

async function runPoseDetection() {
    await setupCamera();
    video.play();

    // Pose Detection モデルのロード
    const model = poseDetection.SupportedModels.MoveNet;
    const detector = await poseDetection.createDetector(model, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
    });

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

    // 推論ループ
    async function detectPose() {
        const poses = await detector.estimatePoses(video, { flipHorizontal: false });
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        poses.forEach(pose => {
            drawKeypoints(pose.keypoints);
            drawSkeleton(pose.keypoints, keypointPairs);
        });

        requestAnimationFrame(detectPose);
    }

    detectPose();
}

runPoseDetection();