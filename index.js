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
