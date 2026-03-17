export const maxDuration = 30;

// Helper: extract text from PDF using pure JS (no native deps)
async function extractPdfText(buffer) {
  // Use pdf-parse via dynamic require — installed as dependency
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const data = await pdfParse(buffer);
  return data.text || "";
}

// Helper: extract text from docx using mammoth
async function extractDocxText(buffer) {
  const mammoth = (await import("mammoth")).default || (await import("mammoth"));
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { fileData, fileName } = req.body;
  if (!fileData || !fileName) return res.status(400).json({ error: "missing file" });

  try {
    const buffer = Buffer.from(fileData, "base64");
    const lower = fileName.toLowerCase();
    let rawText = "";

    if (lower.endsWith(".pdf")) {
      rawText = await extractPdfText(buffer);
    } else if (lower.endsWith(".docx")) {
      rawText = await extractDocxText(buffer);
    } else if (lower.endsWith(".doc")) {
      // .doc is binary — just return error, ask user to save as .docx
      return res.status(400).json({ error: "请将 .doc 文件另存为 .docx 后上传" });
    } else {
      return res.status(400).json({ error: "不支持的文件格式" });
    }

    if (!rawText || rawText.trim().length < 50) {
      return res.status(400).json({ error: "文件内容无法读取，请粘贴文字" });
    }

    // Use DeepSeek to clean up and structure the extracted text
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
    // Fallback: return raw extracted text if AI fails
    res.status(200).json({ text: "", error: e.message });
  }
}
