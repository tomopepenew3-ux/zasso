<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>雑草すっぽん！</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app">
        <div class="header">
            <div class="header-left">
                <span class="header-icon">🌱</span>
                <div class="header-title">雑草すっぽん！</div>
            </div>
            <button class="zukan-btn" id="zukanOpenBtn">📖 図鑑 <span id="zukanCount">0/9</span></button>
            <button class="mute-btn" id="muteBtn">🔊</button>
        </div>
        <div class="progress-wrap">
            <div class="progress-row"><span id="progressLabel">エリア達成率</span><span id="pctText">0%</span></div>
            <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
        </div>
        <div class="field" id="field"><div class="grid" id="grid"></div></div>
        <div class="footer"><button class="reset-btn" id="resetBtn">🔄 庭をリセット</button></div>
    </div>
    <div class="modal-overlay" id="modalOverlay">
        <div class="modal">
            <div class="modal-header"><h2>レア草図鑑</h2><button class="modal-close" id="zukanCloseBtn">❌</button></div>
            <div id="zukanList"></div>
        </div>
    </div>
    <div id="gauge-overlay"><span class="gauge-emoji" id="gaugeEmoji">🌟</span></div>
    <script src="script.js?v=999"></script>
</body>
</html>
