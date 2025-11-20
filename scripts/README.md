# Load Testing Scripts

## 64クライアントシミュレーター

### 概要
本番環境で64名が同時接続する状況を再現するための負荷テストスクリプトです。

### 使い方

#### 1. 依存関係のインストール
```bash
pnpm install
```

#### 2. LANサーバーの起動
```bash
pnpm dev:lan
```

#### 3. シミュレーターの実行
```bash
# 基本実行（64名接続のみ）
pnpm simulate:64

# 自動タップ有効
ENABLE_AUTO_TAP=true pnpm simulate:64

# 自動クイズ回答有効
ENABLE_AUTO_QUIZ=true pnpm simulate:64

# 全機能有効
ENABLE_AUTO_TAP=true ENABLE_AUTO_QUIZ=true pnpm simulate:64

# カスタム設定
ROOM_ID=my-room CLIENT_COUNT=32 SOCKET_URL=http://localhost:5050 pnpm simulate:64
```

### 環境変数

| 変数 | デフォルト値 | 説明 |
|------|-------------|------|
| `ROOM_ID` | `test-room-64` | ルームID |
| `SOCKET_URL` | `http://localhost:5050` | WebSocketサーバーURL |
| `CLIENT_COUNT` | `64` | 接続クライアント数 |
| `ENABLE_AUTO_TAP` | `false` | 自動タップを有効化（カウントアップゲーム用） |
| `ENABLE_AUTO_QUIZ` | `false` | 自動クイズ回答を有効化（クイズゲーム用） |

### 機能

#### 自動生成される情報
- **表示名**: 日本人の名前 + クライアント番号（例: `太郎1`, `花子2`）
- **テーブル番号**: 1-8のランダム
- **座席番号**: 1-8のランダム

#### イベント送信
- **Hello**: 接続時に自動送信
- **Tap Delta**: `ENABLE_AUTO_TAP=true`で1-3秒ごとにランダムなタップ数（1-10）を送信
- **Quiz Answer**: `ENABLE_AUTO_QUIZ=true`でクイズ受信後1-6秒後にランダムな選択肢で回答

#### 統計情報
5秒ごとに以下の統計情報を表示:
- 接続数 / 切断数
- 送信したイベント数（Hello, Tap, Quiz回答）
- 受信したイベント数（状態更新, クイズ表示, クイズ結果）
- エラー数

#### 終了方法
`Ctrl+C` で終了（最終統計情報が表示されます）

### テストシナリオ例

#### シナリオ1: 接続テスト
```bash
# 64名が同時に接続できるか確認
pnpm simulate:64
```

#### シナリオ2: カウントアップゲーム負荷テスト
```bash
# 64名が同時にタップを送信する負荷テスト
ENABLE_AUTO_TAP=true pnpm simulate:64
```

管理画面で「カウントアップ」モードに切り替えて「ゲーム開始」を実行

#### シナリオ3: クイズゲーム負荷テスト
```bash
# 64名が同時にクイズに回答する負荷テスト
ENABLE_AUTO_QUIZ=true pnpm simulate:64
```

管理画面で「クイズ: 次の問題」を実行

#### シナリオ4: 総合負荷テスト
```bash
# 全機能を有効化した総合テスト
ENABLE_AUTO_TAP=true ENABLE_AUTO_QUIZ=true pnpm simulate:64
```

### トラブルシューティング

#### 接続エラーが発生する
- LANサーバーが起動しているか確認: `http://localhost:5050/health`
- ポート5050が使用可能か確認

#### クライアント数を増やしたい
```bash
CLIENT_COUNT=100 pnpm simulate:64
```

#### 接続が遅い
スクリプトは100msごとにクライアントを作成します。接続間隔を調整したい場合は `simulate-64-clients.mjs` の `setTimeout` の値を変更してください。

### 既存のArtillery負荷テストとの違い

| 項目 | Artillery | このスクリプト |
|------|-----------|--------------|
| 接続タイミング | 1分間に70接続/秒 | 64名を100msずつずらして接続 |
| 制御 | YAMLで設定 | 環境変数で柔軟に設定 |
| リアルタイム監視 | なし | 5秒ごとに統計表示 |
| クイズ対応 | なし | あり |
| 名前の多様性 | `ArtilleryUser-N` | 日本人の名前64種類 |

### 今後の拡張案
- [ ] WebSocketレスポンス時間の測定
- [ ] メモリ使用量の監視
- [ ] ランキング順位の追跡
- [ ] ログをファイル出力
- [ ] グラフィカルなダッシュボード
