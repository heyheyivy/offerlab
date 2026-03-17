import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { fileData, fileName } = req.body;
  if (!fileData || !fileName) return res.status(400).json({ error: "missing file" });

  try {
    const buffer = Buffer.from(fileData, "base64");
    const lower = fileName.toLowerCase();
    let rawText = "";

    if (lower.endsWith(".pdf")) {
      const data = await pdfParse(buffer);
      rawText = data.text || "";
    } else if (lower.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value || "";
    } else if (lower.endsWith(".doc")) {
      return res.status(400).json({ error: "请将 .doc 文件另存为 .docx 后上传" });
    } else {
      return res.status(400).json({ error: "不支持的文件格式，请上传 PDF 或 Word(.docx)" });
    }

    if (!rawText || rawText.trim().length < 50) {
      return res.status(400).json({ error: "文件内容无法读取，请直接粘贴文字" });
    }

    // Use DeepSeek to clean up extracted text
    const aiRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.DEEPSEEK_API_KEY,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content: "你是简历整理助手。将用户提供的原始简历文本整理成清晰易读的纯文本格式，保留所有内容，修复乱码和格式问题，不要添加或删除任何实质内容。直接输出整理后的文本，不要任何解释。",
          },
          {
            role: "user",
            content: "请整理以下简历原始文本：\n\n" + rawText.slice(0, 4000),
          },
        ],
      }),
    });

    const aiData = await aiRes.json();
    const cleaned = aiData?.choices?.[0]?.message?.content || rawText;

    res.status(200).json({ text: cleaned.trim() });
  } catch (e) {
    console.error("parse-resume error:", e);
    res.status(500).json({ error: "解析失败，请直接粘贴文字" });
  }
}