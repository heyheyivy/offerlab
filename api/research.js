export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { company, role } = req.body;
  if (!company || !role) return res.status(400).json({ error: "missing params" });

  try {
    const queries = [
      // General Google: interview experience
      {
        body: { q: `${company} ${role} 面经`, gl: "cn", hl: "zh-cn", num: 6 },
      },
      // Nowcoder + Zhihu targeted
      {
        body: { q: `${company} ${role} 面试题 site:nowcoder.com OR site:zhihu.com`, gl: "cn", hl: "zh-cn", num: 6 },
      },
      // Xiaohongshu via Baidu — force 面经 intent to avoid job listings
      {
        body: { q: `${company} ${role} 面经 面试经验`, gl: "cn", hl: "zh-cn", num: 6, engine: "baidu" },
      },
    ];

    const searchResults = await Promise.allSettled(
      queries.map(({ body }) =>
        fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": process.env.SERPER_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }).then(r => r.json())
      )
    );

    // Collect xhs items separately for priority
    const xhsItems = [];
    const otherItems = [];

    searchResults.forEach((r) => {
      if (r.status !== "fulfilled") return;
      const organic = r.value.organic || [];
      for (const item of organic) {
        const link = item.link || "";
        // Skip job listing pages — not interview experience posts
        const isJobListing = /recruit|job|jobs|career|careers|hire|hiring|apply|zhaopin|lagou|liepin|51job|boss\.zhipin|job\.toutiao|job\.bytedance/i.test(link);
        if (isJobListing) continue;

        const entry = {
          title: item.title || "",
          link,
          snippet: item.snippet || "",
          source: item.displayLink || link,
        };

        const isXhs = link.includes("xiaohongshu.com") || link.includes("xhslink.com");
        if (isXhs) {
          xhsItems.push(entry);
        } else {
          otherItems.push(entry);
        }
      }
    });

    // Merge: xhs first, dedupe by link
    const seen = new Set();
    const results = [];
    for (const item of [...xhsItems, ...otherItems]) {
      if (item.link && !seen.has(item.link)) {
        seen.add(item.link);
        results.push(item);
      }
    }

    const top = results.slice(0, 10);

    if (top.length === 0) {
      return res.status(200).json({ results: [], summary: null });
    }

    const snippets = top.map((r, i) => `[${i+1}] ${r.title}\n${r.snippet}`).join("\n\n");

    const summaryRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.DEEPSEEK_API_KEY,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `根据以下「${company} ${role}」的面经搜索结果，总结5-7个最常被考察的问题或知识点。\n\n${snippets}\n\n返回JSON（不含markdown）：{"questions":["考察点1","考察点2"],"tips":"一句话备考建议"}`,
        }],
      }),
    });

    const summaryData = await summaryRes.json();
    const summaryText = summaryData?.choices?.[0]?.message?.content || "";

    let summary = null;
    try {
      summary = JSON.parse(summaryText.replace(/```json|```/g, "").trim());
    } catch(e) {}

    res.status(200).json({ results: top, summary });
  } catch (e) {
    console.error("Research error:", e);
    res.status(500).json({ error: e.message });
  }
}