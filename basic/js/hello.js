// ページの読み込みが完了したら実行
document.addEventListener('DOMContentLoaded', () => {
    // 1次元テンソルの作成
    const tensor1d = tf.tensor1d([1, 2, 3, 4]);
    // 2次元テンソルの作成
    const tensor2d = tf.tensor2d([[1, 2], [3, 4]]);

    // テンソル同士の加算
    const t1 = tf.tensor1d([1, 2]);
    const t2 = tf.tensor1d([3, 4]);
    const resultCalculated = t1.add(t2);

    showResult('tensor-1d', tensor1d);
    showResult('tensor-2d', tensor2d);
    showResult('tensor-calculated', resultCalculated);
});

function showResult(id, tensor) {
    tensor.array().then(data => {
        const div = document.getElementById(id);
        div.textContent = `Tensor: [${data.join(', ')}]`;
    });
}