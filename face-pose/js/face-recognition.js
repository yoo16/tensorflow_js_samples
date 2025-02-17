import * as THREE from 'three';

const canvasEl = document.getElementById('canvas');
const videoEl = document.getElementById('video');

const videoWidth = 640;
const videoHeight = 480;

let decoMesh;
let detector;
let results;
let faceNormalVector;

let positionX = 0;
let positionY = 0;

let scene, camera, renderer;

// Three.js の初期設定
function setupTHREE() {
    renderer = new THREE.WebGLRenderer({
        canvas: canvasEl,
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(videoWidth, videoHeight);
    renderer.setClearColor(0x000000, 0);

    // シーンの作成
    scene = new THREE.Scene();

    // カメラの作成
    const fov = 45;
    camera = new THREE.PerspectiveCamera(fov, videoWidth / videoHeight, 1, 1000);
    camera.position.set(0, 0, 680);

    // 簡易的なライトを追加
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 0, 1);
    scene.add(light);

    createDecoPlane();
}

// イベントリスナーの追加（ボタンがある場合）
function addEventListeners() {

}

// stamp オブジェクトの作成
function createDecoPlane() {
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    let color = 0xff0000;

    const material = new THREE.MeshStandardMaterial({
        color: color,
        transparent: true,
        opacity: 0.8
    });
    decoMesh = new THREE.Mesh(geometry, material);
    // decoMesh.scale.set(settings.scale, settings.scale, settings.scale);
    scene.add(decoMesh);
}

function updateDecoPlane() {
    if (decoMesh) {
        scene.remove(decoMesh);
        decoMesh.geometry.dispose();
        decoMesh.material.dispose();
        decoMesh = null;
    }
    createDecoPlane();
}

// stamp の位置、回転、スケール更新（顔認識結果に合わせる）
function updateDecoMesh() {
    if (!results || results.length === 0) return;

    const quaternion = calcNormalVector();
    decoMesh.quaternion.copy(quaternion);

    const fixData = fixLandmarkValue(results[0].keypoints);
    const basePoint = fixData[167];

    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/.test(userAgent);
    const isFrontCamera = videoEl.srcObject.getTracks()[0].getSettings().facingMode === 'user';
    const zOffset = isMobile && isFrontCamera ? 300 : 100;

    const faceCenter = new THREE.Vector3(
        basePoint.x + positionX,
        basePoint.y + positionY,
        basePoint.z - zOffset
    );

    // 1: 鼻の中央、127: 右耳、356: 左耳
    const noseTip = fixData[1];
    const rightEar = fixData[127];
    const leftEar = fixData[356];

    const dx = rightEar.x - leftEar.x;
    const dy = rightEar.y - leftEar.y;
    const angle = Math.atan2(dy, dx);

    const distanceToRightEar = Math.hypot(noseTip.x - rightEar.x, noseTip.y - rightEar.y);
    const distanceToLeftEar = Math.hypot(noseTip.x - leftEar.x, noseTip.y - leftEar.y);
    const earDistanceSum = distanceToRightEar + distanceToLeftEar;
    const baseEarDistanceSum = 200;

    const scale = earDistanceSum / baseEarDistanceSum;
    const imageHeight = 1 * scale;
    faceCenter.y += imageHeight / 2;
    const offsetX = (imageHeight / 2) * Math.sin(angle);
    faceCenter.x += offsetX;
    faceCenter.y -= offsetX * Math.sin(angle);

    decoMesh.position.copy(faceCenter);
    decoMesh.rotation.z = angle;
}

// 顔の向き（法線ベクトル）を求める関数
function calcNormalVector() {
    if (!results || results.length === 0) return;
    const fixData = fixLandmarkValue(results[0].keypoints);
    const noseTip = fixData[1];
    const leftNose = fixData[279];
    const rightNose = fixData[49];

    const midpoint = {
        x: (leftNose.x + rightNose.x) / 2,
        y: (leftNose.y + rightNose.y) / 2,
        z: (leftNose.z + rightNose.z) / 2,
    };

    const perpendicularUp = {
        x: midpoint.x,
        y: midpoint.y - 10,
        z: midpoint.z,
    };

    faceNormalVector = new THREE.Vector3(noseTip.x, noseTip.y, noseTip.z)
        .sub(new THREE.Vector3(perpendicularUp.x, perpendicularUp.y, perpendicularUp.z))
        .normalize();

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceNormalVector);
    return quaternion;
}

// ウェブカメラを有効にする関数
async function onWebcam() {
    const constraints = {
        video: {
            width: videoWidth,
            height: videoHeight,
            facingMode: 'user'
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoEl.srcObject = stream;
        return new Promise((resolve) => {
            videoEl.onloadedmetadata = () => resolve(videoEl);
        });
    } catch (error) {
        console.error(error);
    }
}

// モデルセットアップ
async function setupModel() {
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const detectorConfig = {
        runtime: 'mediapipe',
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh'
    };
    detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
}

// 顔を検知
async function detectFace() {
    const estimationConfig = { flipHorizontal: false };
    results = await detector.estimateFaces(videoEl, estimationConfig);
}

// 座標変換関数（Three.js 用に変換）
function fixLandmarkValue(data) {
    const depthStrength = 100;
    return data.map((el) => ({
        x: el.x - videoEl.videoWidth / 2,
        y: -el.y + videoEl.videoHeight / 2,
        z: ((el.z / 100) * -1 + 1) * depthStrength
    }));
}

async function render() {
    await detectFace();
    // updateDecoMesh();
    // renderer.render(scene, camera);
    requestAnimationFrame(render);
}

async function init() {
    addEventListeners();
    await onWebcam();
    await setupModel();
    setupTHREE();
    render();
}

init();
