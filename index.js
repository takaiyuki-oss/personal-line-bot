const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- ここから追加 ---
// ユーザーごとの会話履歴を保存する場所（一時的なメモ帳）
const chatHistories = {};
// --- ここまで追加 ---

// LINE Botの設定
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// Google Gemini (AI) の設定
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

// メインの処理
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  // --- ここから変更 ---
  const userId = event.source.userId; // ユーザーを識別
  const userMessage = event.message.text;

  // ユーザーごとの過去の会話履歴を取得（なければ新規作成）
  const history = chatHistories[userId] || [];

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});

    // 過去の会話履歴を含めて、AIとのチャットセッションを開始
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 200, // 返信の長さを制限
      },
    });

    // 新しいメッセージを送信し、AIからの返信を待つ
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const aiReply = response.text();

    // --- 会話履歴を更新 ---
    // 1. ユーザーの今回のメッセージを履歴に追加
    history.push({ role: "user", parts: [{ text: userMessage }] });
    // 2. AIの今回の返信を履歴に追加
    history.push({ role: "model", parts: [{ text: aiReply }] });

    // 古い履歴を削除して、記憶が長くなりすぎないように調整（最新10件まで）
    if (history.length > 10) {
      chatHistories[userId] = history.slice(history.length - 10);
    } else {
      chatHistories[userId] = history;
    }
    // --------------------

    const replyMessage = { type: 'text', text: aiReply };
    const client = new line.Client(config);
    return client.replyMessage(event.replyToken, replyMessage);

  } catch (error) {
    console.error('Gemini Error:', error);
    const errorMessage = { type: 'text', text: 'AIの応答でエラーが発生しました。' };
    const client = new line.Client(config);
    return client.replyMessage(event.replyToken, errorMessage);
  }
  // --- ここまで変更 ---
}

// サーバーを起動
app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('Server listening');
});
