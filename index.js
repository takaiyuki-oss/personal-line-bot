const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require("@google/generative-ai");

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

  try {const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
    const result = await model.generateContent(event.message.text);
    const response = await result.response;
    const aiReply = response.text();

    const replyMessage = { type: 'text', text: aiReply };
    const client = new line.Client(config);
    return client.replyMessage(event.replyToken, replyMessage);

  } catch (error) {
    console.error('Gemini Error:', error);
    // エラーが発生した場合は、固定のメッセージを返す
    const errorMessage = { type: 'text', text: 'AIの応答でエラーが発生しました。' };
    const client = new line.Client(config);
    return client.replyMessage(event.replyToken, errorMessage);
  }
}

// サーバーを起動
app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('Server listening');
});
