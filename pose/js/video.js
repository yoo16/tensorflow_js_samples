const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const statusElement = document.getElementById('status');
const fileInput = document.getElementById('fileInput');

statusElement.textContent = 'モデル読み込み中...';
fileInput.disabled = true;

let detector;
let modelReady = false; // モデル読み込み状態

async function loadModel() {
    await tf.setBackend('webgl');
    await tf.ready();

    detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
            // modelType: poseDetection.movenet.modelType.MULTIPOSE_THUNDER
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
        }
    );

    modelReady = true;
    console.log("モデル読み込み完了");
}

function drawKeypoints(keypoints) {
    for (const keypoint of keypoints) {
        if (keypoint.score > 0.4) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
        }
    }
}

async function render() {
    if (video.paused || video.ended) {
        requestAnimationFrame(render);
        return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const poses = await detector.estimatePoses(video);
    for (const pose of poses) {
        drawKeypoints(pose.keypoints);
    }

    requestAnimationFrame(render);
}

// ユーザーが動画ファイルを選択したときの処理
document.getElementById('fileInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        video.src = url;

        // モデルが読み込まれてから再生
        const waitForModel = async () => {
            while (!modelReady) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 動画読み込み後、サイズをキャンバスに反映
            video.addEventListener('loadeddata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                video.play();
            });
            video.load();
        };
        waitForModel();
    }
});


async function main() {
    // モデルの読み込み
    await loadModel();

    // UIの更新
    statusElement.textContent = 'モデル読み込み完了！動画を選択してください';
    fileInput.disabled = false;

    // Video再生後に描画を開始
    video.addEventListener('play', () => {
        render();
    });
}

main();
