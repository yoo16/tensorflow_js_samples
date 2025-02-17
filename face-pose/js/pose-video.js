async function run() {
    const videoUpload = document.getElementById('video-upload');
    const video = document.getElementById('video');
    const canvas = document.getElementById('output');
    const ctx = canvas.getContext('2d');
    const defaultWidth = 640;
    const defaultHeight = 480;
    // 初期値はデフォルトですが、後で動画の実際のサイズに合わせる
    canvas.width = defaultWidth;
    canvas.height = defaultHeight;

    // MoveNet の検出器をロード
    const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
    };
    const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        detectorConfig
    );

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

    // ポーズ検出と描画のループ
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

    video.addEventListener('play', () => {
        detectPose();
    });
}

run();