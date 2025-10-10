// 必要な部品を読み込む
const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ユーザーごとの会話履歴を保存する場所（一時的なメモ帳）
const chatHistories = {};

// LINE Botの設定（Renderの環境変数から読み込む）
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// Google Gemini (AI) の設定（Renderの環境変数から読み込む）
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// サーバーの準備
const app = express();
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// Botのメイン処理
async function handleEvent(event) {
  // テキストメッセージ以外のイベントは無視する
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userId = event.source.userId; // ユーザーを識別
  const userMessage = event.message.text;

  // ユーザーごとの過去の会話履歴を取得（なければ新規作成）
  const history = chatHistories[userId] || [];

  try {
    // 正しいAIモデル名を指定
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});

    // 過去の会話履歴を含めて、AIとのチャットセッションを開始
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 200, // 返信が長くなりすぎないように制限
      },
    });

    // 新しいメッセージをAIに送信し、返信を待つ
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const aiReply = response.text();
    
    let replyText;

    // AIの返信が空でないかチェック
    if (aiReply && aiReply.trim() !== '') {
      replyText = aiReply;
      
      // 成功した場合のみ会話履歴を更新
      history.push({ role: "user", parts: [{ text: userMessage }] });
      history.push({ role: "model", parts: [{ text: aiReply }] });

      // 古い履歴を削除して、記憶が長くなりすぎないように調整（最新10件まで）
      if (history.length > 10) {
        chatHistories[userId] = history.slice(history.length - 10);
      } else {
        chatHistories[userId] = history;
      }

    } else {
      // AIの返信が空だった場合の代替メッセージ
      replyText = '申し訳ありません、うまくお答えできませんでした。別の言葉で質問してみてください。';
      console.log('AI returned an empty response.'); // ログに記録
    }

    // LINEに返信するメッセージを作成
    const replyMessage = { type: 'text', text: replyText };
    const client = new line.Client(config);
    return client.replyMessage(event.replyToken, replyMessage);

  } catch (error) {
    // AIとの通信でエラーが発生した場合の処理
    console.error('Gemini Error:', error);
    const errorMessage = { type: 'text', text: 'AIの応答でエラーが発生しました。しばらくしてからもう一度お試しください。' };
    const client = new line.Client(config);
    return client.replyMessage(event.replyToken, errorMessage);
  }
}

// サーバーを起動
app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('Server listening');
});
