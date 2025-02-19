async function classify() {
    const audioFileInput = document.getElementById('audioFile');
    if (!audioFileInput.files.length) return;

    // Read the file using Web Audio API
    const file = audioFileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        const context = new AudioContext();
        const buffer = await context.decodeAudioData(arrayBuffer);
        const audio = buffer.getChannelData(0); // Mono channel

        // console.log(audio);

        // パラメータ（例）
        const sampleRate = 16000;
        const hopLength = 512;
        const nFFT = 512;
        const nMelFilters = 26;
        const nDCT = 13;

        // Compute MFCCs → 各フレームごとに nDCT 個のMFCCを計算（2次元配列：[numFrames, nDCT]）
        const mfccFeatures = computeMFCCs(audio, sampleRate, hopLength, nFFT, nMelFilters, nDCT);
        // モデルの入力としてはバッチ次元を追加：形状 [1, numFrames, nDCT]
        const featuresTensor = tf.tensor(mfccFeatures, [1, mfccFeatures.length, nDCT], 'float32');

        // Load the model (assuming a pre-trained model is loaded)
        const model = await tf.loadLayersModel('model.json'); // 実際のパスに変更してください
        const prediction = await model.predict(featuresTensor);
        const resultIndex = prediction.argMax(-1).dataSync()[0];
        document.getElementById('result').innerText = `Predicted Genre: ${genreLabels[resultIndex]}`;
    };
    reader.readAsArrayBuffer(file);
}

function computeMFCCs(audio, sampleRate, hopLength, nFFT, nMelFilters, nDCT) {
    // 1. ウィンドウ作成 & STFT
    const window = blackmanHarris(nFFT);
    const frames = stft(audio, window, hopLength); // 各フレームの長さは nFFT

    // 2. メルフィルタバンク作成
    const numFreqBins = Math.floor(nFFT / 2) + 1;
    const melFilterBank = createMelFilterBank(nMelFilters, numFreqBins, sampleRate, nFFT);

    let mfccs = [];
    // 各フレームに対して MFCC を計算
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i]; // 長さ nFFT のウィンドウ済み信号
        // Fourier 変換 → 振幅スペクトル（numFreqBins 個）
        const spectrum = fourierTransform(frame);
        // パワースペクトル
        let powerSpectrum = spectrum.map(x => x * x);
        // 対数パワースペクトル
        powerSpectrum = powerSpectrum.map(x => Math.log(x + 1e-8));

        // メルフィルタバンク適用（フィルタごとにエネルギーを算出）
        let melEnergies = [];
        for (let m = 0; m < nMelFilters; m++) {
            let sum = 0;
            for (let k = 0; k < numFreqBins; k++) {
                sum += melFilterBank[m][k] * powerSpectrum[k];
            }
            melEnergies.push(sum);
        }
        // 4. DCT (Type-II) で MFCC を得る
        const mfcc = dct(melEnergies, nDCT);
        mfccs.push(mfcc);
    }
    return mfccs; // 形状: [numFrames, nDCT]
}

function blackmanHarris(n) {
    const a0 = 0.35875;
    const a1 = 0.48829;
    const a2 = 0.14128;
    const a3 = 0.01168;
    let window = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        window[i] = a0 -
            a1 * Math.cos((2 * Math.PI * i) / (n - 1)) +
            a2 * Math.cos((4 * Math.PI * i) / (n - 1)) -
            a3 * Math.cos((6 * Math.PI * i) / (n - 1));
    }
    return window;
}

/**
 * STFT: 入力信号に対して、ウィンドウをかけたフレームの配列を返す。
 */
function stft(signal, window, hop) {
    const N = window.length;
    const L = signal.length;
    const frames = [];
    for (let s = 0; s <= L - N; s += hop) {
        const frameSlice = signal.slice(s, s + N);
        const frame = new Float32Array(N);
        // 各要素ごとにウィンドウを乗算
        for (let i = 0; i < N; i++) {
            frame[i] = frameSlice[i] * window[i];
        }
        frames.push(frame);
    }
    return frames;
}

/**
 * Fourier 変換（Naive 実装）
 * フレーム（長さ nFFT）の実数入力に対して、0〜nFFT/2 の振幅スペクトルを返す。
 */
function fourierTransform(x) {
    const n = x.length;
    const numFreqBins = Math.floor(n / 2) + 1;
    let spectrum = new Array(numFreqBins).fill(0);
    for (let k = 0; k < numFreqBins; k++) {
        let re = 0, im = 0;
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * k * i) / n;
            re += x[i] * Math.cos(angle);
            im -= x[i] * Math.sin(angle);
        }
        spectrum[k] = Math.sqrt(re * re + im * im);
    }
    return spectrum;
}

/**
 * メルフィルタバンクの作成
 * @param {number} nMelFilters - フィルタ数
 * @param {number} numFreqBins - FFT の出力数（nFFT/2+1）
 * @param {number} sampleRate
 * @param {number} nFFT
 * @returns {Array[]} 形状 [nMelFilters][numFreqBins] の2次元配列
 */
function createMelFilterBank(nMelFilters, numFreqBins, sampleRate, nFFT) {
    const melLowFreq = hzToMel(0);
    const melHighFreq = hzToMel(sampleRate / 2);
    const melPoints = linspace(melLowFreq, melHighFreq, nMelFilters + 2);
    const hzPoints = melPoints.map(mel => melToHz(mel));
    const bin = hzPoints.map(hz => Math.floor((nFFT + 1) * hz / sampleRate));

    let filterBank = [];
    for (let m = 1; m <= nMelFilters; m++) {
        let filter = new Array(numFreqBins).fill(0);
        for (let k = bin[m - 1]; k < bin[m]; k++) {
            if (k < numFreqBins)
                filter[k] = (k - bin[m - 1]) / (bin[m] - bin[m - 1]);
        }
        for (let k = bin[m]; k < bin[m + 1]; k++) {
            if (k < numFreqBins)
                filter[k] = (bin[m + 1] - k) / (bin[m + 1] - bin[m]);
        }
        filterBank.push(filter);
    }
    return filterBank;
}

function hzToMel(hz) {
    return 1125 * Math.log(1 + hz / 700);
}

function melToHz(mel) {
    return 700 * (Math.exp(mel / 1125) - 1);
}

function linspace(start, stop, num) {
    let arr = new Array(num);
    for (let i = 0; i < num; i++) {
        arr[i] = start + (i * (stop - start)) / (num - 1);
    }
    return arr;
}

/**
 * DCT (Type-II) の計算
 * @param {number[]} vector - 入力配列（例: メルフィルタバンク適用後の対数パワースペクトル）
 * @param {number} nDCT - 出力する係数数
 * @returns {number[]} DCT 係数の配列（長さ nDCT）
 */
function dct(vector, nDCT) {
    const N = vector.length;
    let result = new Array(nDCT).fill(0);
    for (let k = 0; k < nDCT; k++) {
        let sum = 0;
        for (let n = 0; n < N; n++) {
            sum += vector[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
        }
        result[k] = sum;
    }
    return result;
}
