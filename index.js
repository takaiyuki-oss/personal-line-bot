// メインの処理
async function handleEvent(event) {
  if (event.type !== 'message' || event.type !== 'text') {
    return Promise.resolve(null);
  }

  const userId = event.source.userId;
  const userMessage = event.message.text;
  const history = chatHistories[userId] || [];

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});

    // --- ここからが修正部分 ---
    // 過去の会話履歴と、新しい安全設定を含めてチャットセッションを開始
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 200,
      },
      // 安全フィルターを最も低いレベルに設定
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
      ],
    });
    // --- 修正はここまで ---

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const aiReply = response.text();
    
    let replyText;

    if (aiReply && aiReply.trim() !== '') {
      replyText = aiReply;
      
      history.push({ role: "user", parts: [{ text: userMessage }] });
      history.push({ role: "model", parts: [{ text: aiReply }] });

      if (history.length > 10) {
        chatHistories[userId] = history.slice(history.length - 10);
      } else {
        chatHistories[userId] = history;
      }

    } else {
      replyText = '申し訳ありません、うまくお答えできませんでした。';
      console.log('AI returned an empty response.');
    }

    const replyMessage = { type: 'text', text: replyText };
    const client = new line.Client(config);
    return client.replyMessage(event.replyToken, replyMessage);

  } catch (error) {
    console.error('Gemini Error:', error);
    const errorMessage = { type: 'text', text: 'AIの応答でエラーが発生しました。' };
    const client = new line.Client(config);
    return client.replyMessage(event.replyToken, errorMessage);
  }
}
