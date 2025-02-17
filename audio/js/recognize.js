const consoleEl = document.getElementById('console');

let recognizer;

/**
 * 1フレームのオーディオデータを分析し、単語を予測する
 * @throws {Error} SpeechCommandsRecognizerが初期化されていない場合
 */
function predictWord() {
    try {
        // SpeechCommandsRecognizeの 単語ラベル：0 - 9, left, right ...
        const words = recognizer.wordLabels();

        // マイク入力をリアルタイム監視
        // 音声スコアで75%の確率で単語検索
        recognizer.listen(({ scores }) => {
            // 音声入力に対する各単語の確率
            scores = Array.from(scores).map((s, i) => ({ score: s, word: words[i] }));
            console.log(scors);

            // スコアから最も近いワードを検索
            scores.sort((s1, s2) => s2.score - s1.score);

            // コンソール表示
            consoleEl.textContent = scores[0].word;
        }, { probabilityThreshold: 0.75 });
    } catch (error) {
        console.log(error);
    }
}

/**
 * SpeechCommandsRecognizerを初期化し、音声認識を開始する
 * @returns {Promise<void>} SpeechCommandsRecognizerの初期化完了を示すPromise
 */
async function app() {
    // SpeechCommands の作成
    recognizer = speechCommands.create('BROWSER_FFT');
    // モデル読み込みまで待機
    await recognizer.ensureModelLoaded();
    predictWord();
}

// メインアプリ実行
app();