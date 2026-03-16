export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { company, role } = req.body;
  if (!company || !role) return res.status(400).json({ error: "missing params" });

  try {
    // Search for interview experiences
    const queries = [
      `${company} ${role} 面经`,
      `${company} ${role} 面试题`,
      `site:nowcoder.com ${company} ${role}`,
    ];

    const results = [];

    for (const q of queries) {
      const r = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q, gl: "cn", hl: "zh-cn", num: 5 }),
      });
      const data = await r.json();
      if (data.organic) {
        for (const item of data.organic) {
          // Deduplicate by link
          if (!results.find(x => x.link === item.link)) {
            results.push({
              title: item.title,
              link: item.link,
              snippet: item.snippet,
              source: item.displayLink || item.link,
            });
          }
        }
      }
    }

    // Take top 10 results
    const top = results.slice(0, 10);

    // Use DeepSeek to summarize common questions
    const snippets = top.map((r, i) => `[${i+1}] ${r.title}\n${r.snippet}`).join("\n\n");

    const summaryRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.DEEPSEEK_API_KEY,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `根据以下关于「${company} ${role}」的面经搜索结果，总结出5-8个最常见的面试问题或考察点，用简洁的列表呈现。\n\n${snippets}\n\n返回JSON（不含markdown）：{"questions":["问题1","问题2"...],"tips":"一句话备考建议"}`,
          }
        ],
      }),
    });

    const summaryData = await summaryRes.json();
    const summaryText = summaryData?.choices?.[0]?.message?.content || "";

    let summary = null;
    try {
      const clean = summaryText.replace(/```json|```/g, "").trim();
      summary = JSON.parse(clean);
    } catch(e) {}

    res.status(200).json({ results: top, summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}