import { useState, useEffect, useRef, useCallback } from "react";

//  Design tokens 
const T = {
  bg: "#F7F4EF", surface: "#FFFFFF", card: "#FFFFFF", cardHover: "#FAFAF8",
  border: "#ECE7E1", borderBright: "#D6CFC6",
  accent: "#6B7D6D", accentHover: "#5C6F5E", accentGlow: "#6B7D6D14", accentDim: "#F2F5F2",
  green: "#4A7259", greenDim: "#EEF4F0", yellow: "#A07830", yellowDim: "#FBF5EC",
  red: "#8B4848", redDim: "#FAF0F0", blue: "#4A6678", blueDim: "#EEF2F5",
  text: "#1F1F1F", muted: "#5F5F5F", dim: "#E8E4DE", subtle: "#9A9A9A",
  mono: "'Courier Prime', monospace", head: "'Cormorant Garamond', serif", body: "'Inter', system-ui, sans-serif",
};

//  API (calls backend — API key is safe on server)
async function callClaude(prompt, maxTokens = 800, { system, model } = {}) {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens, system }),
  });
  const d = await r.json();
  return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
}
async function safeJSON(system, user, maxTokens = 1200) {
  const raw = await callClaude(user, maxTokens, { system });
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch(e) { return null; }
}
async function haikuJSON(system, user, maxTokens = 1200) {
  const raw = await callClaude(user, maxTokens, { system });
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try { return JSON.parse(cleaned); } catch(e) { return extractJSON(cleaned); }
}

//  JD & Resume Summarizer 
async function summarizeJD(jd) {
  return await callClaude(
    `Extract the key requirements from this job description.
Return only (in Chinese, concise bullet points):
- role: 
- required_skills: 
- experience: 
- bonus_skills: 

JD:
${jd.slice(0, 3000)}`, 250
  );
}

async function summarizeResume(resume) {
  return await callClaude(
    `Extract the key skills and experience from this resume.
Return only (in Chinese, concise bullet points):
- skills: 
- technologies: 
- main_experience: 

Resume:
${resume.slice(0, 3000)}`, 250
  );
}

//  Resume structured JSON 
async function saveResumeJSON(j) {
  try { localStorage.setItem("resume_json", JSON.stringify(j)); } catch(e) {}
}
async function loadResumeJSON() {
  try { const r = localStorage.getItem("resume_json"); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}

// Parse full resume text → compact JSON once, store it, reuse everywhere
async function parseResumeToJSON(text) {
  const result = await haikuJSON(
    "你是简历解析助手，只输出合法JSON，不含markdown，用中文。",
    `请将以下简历解析为结构化JSON，字段含义：name=姓名，contact=联系方式（用/分隔），education=学历（含GPA），skills=技能列表，experience=工作经历列表（每项含company/role/period/bullets），projects=项目列表（每项含name/bullets），languages=语言能力。

简历内容：
${text.slice(0, 3000)}

返回JSON格式：
{
  "name": "",
  "contact": "邮箱/电话/LinkedIn",
  "education": "学校+学位+GPA",
  "skills": ["技能1","技能2"],
  "experience": [{"company":"","role":"","period":"","bullets":["成就1"]}],
  "projects": [{"name":"","bullets":["描述1"]}],
  "languages": "语言能力"
}`, 900
  );
  return result;
}

function resumeJSONToText(j) {
  if (!j) return "";
  const nl = "\n";
  const exp = (j.experience||[]).map(e =>
    [e.company, e.role, e.period].filter(Boolean).join(" · ") + nl +
    (e.bullets||[]).map(b => "• " + b).join(nl)
  ).join(nl + nl);
  const proj = (j.projects||[]).map(p =>
    p.name + nl + (p.bullets||[]).map(b => "• " + b).join(nl)
  ).join(nl + nl);
  return [
    j.name + (j.contact ? " | " + j.contact : ""),
    j.education ? "学历：" + j.education : "",
    j.skills && j.skills.length ? "技能：" + j.skills.join(" · ") : "",
    j.languages ? "语言：" + j.languages : "",
    exp ? "\n工作经历\n" + exp : "",
    proj ? "\n项目经历\n" + proj : "",
  ].filter(Boolean).join(nl).trim();
}

//  Mock transcript 
//  Storage 
async function saveSession(s) {
  try { localStorage.setItem("session:" + s.id, JSON.stringify(s)); } catch(e) {}
}
async function deleteSession(id) {
  try { localStorage.removeItem("session:" + id); } catch(e) {}
}
async function loadAllSessions() {
  try {
    const sessions = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("session:")) {
        try {
          const val = localStorage.getItem(key);
          if (val) sessions.push(JSON.parse(val));
        } catch(e) {}
      }
    }
    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  } catch(e) {
    return [];
  }
}

//  Primitives 
function Btn({ children, onClick, variant = "primary", size = "md", disabled, full, style: s = {} }) {
  const [hov, setHov] = useState(false);
  const base = { fontFamily: T.body, cursor: disabled ? "not-allowed" : "pointer", border: "none", borderRadius: 6, fontWeight: 400, letterSpacing: "0.01em", transition: "all .15s", opacity: disabled ? 0.35 : 1, width: full ? "100%" : undefined, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 };
  const sizes = { sm: { padding: "5px 12px", fontSize: 13 }, md: { padding: "8px 16px", fontSize: 14 }, lg: { padding: "11px 24px", fontSize: 15 } };
  const variants = {
    primary: { background: hov ? T.accentHover : T.accent, color: "#fff" },
    ghost: { background: hov ? "#0000000a" : "transparent", color: T.muted },
    outline: { background: "transparent", color: T.accent, border: "1px solid " + T.accent + "55", ...(hov ? { background: T.accentDim } : {}) },
    success: { background: T.greenDim, color: T.green },
    warn: { background: T.yellowDim, color: T.yellow },
  };
  return <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={disabled ? undefined : onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...s }}>{children}</button>;
}

function Card({ children, style: s = {}, onClick }) {
  const [h, setH] = useState(false);
  return <div
    onMouseEnter={() => onClick && setH(true)}
    onMouseLeave={() => setH(false)}
    onClick={onClick}
    style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 8, padding: "24px 28px", transition: "background .15s", cursor: onClick ? "pointer" : undefined, background: h && onClick ? T.cardHover : T.card, ...s }}>{children}</div>;
}

function Label({ children }) {
  return <p style={{ color: T.subtle, fontSize: 13, fontWeight: 400, fontFamily: T.body, letterSpacing: "0.02em", marginBottom: 6 }}>{children}</p>;
}

function Badge({ children, color = T.accent, bg }) {
  return <span style={{ color, fontSize: 12, fontWeight: 400, whiteSpace: "nowrap", display: "inline-block", opacity: 0.85 }}>{children}</span>;
}

function ScoreRing({ score, size = 80 }) {
  const col = score >= 75 ? T.green : score >= 55 ? T.yellow : T.red;
  const r = (size - 8) / 2, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.dim} strokeWidth={5}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={5} strokeDasharray={dash + " " + circ} strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fill={T.text} fontSize={size/3.8} fontWeight="500" fontFamily={T.body} style={{ transform: "rotate(90deg)", transformOrigin: (size/2) + "px " + (size/2) + "px" }}>{score}</text>
    </svg>
  );
}

function PBar({ v, color = T.accent, h = 4 }) {
  return <div style={{ background: T.dim, borderRadius: 99, height: h, overflow: "hidden" }}><div style={{ width: v + "%", height: "100%", background: color, borderRadius: 99, transition: "width 0.8s ease" }}/></div>;
}

function Spinner() {
  return <div style={{ width: 16, height: 16, border: "2px solid " + T.dim, borderTop: "2px solid " + T.accent, borderRadius: "50%", animation: "spin .7s linear infinite", flexShrink: 0 }}/>;
}

function TA({ value, onChange, placeholder, rows = 5, variant = "default" }) {
  const [foc, setFoc] = useState(false);
  const isCard = variant === "card";
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
    style={{ width: "100%", background: T.surface, border: isCard ? "1px solid " + (foc ? T.accent : T.border) : "none", borderBottom: isCard ? "1px solid " + (foc ? T.accent : T.border) : "1px solid " + (foc ? T.accent : T.border), borderRadius: isCard ? 8 : 0, padding: isCard ? "14px 16px" : "14px 0px", color: T.text, fontSize: 15, fontFamily: T.body, resize: "vertical", outline: "none", lineHeight: 1.85, boxSizing: "border-box", fontWeight: 400, transition: "all .18s" }}/>;
}

function Inp({ value, onChange, placeholder }) {
  const [foc, setFoc] = useState(false);
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
    style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid " + (foc ? T.accent : T.border), padding: "8px 0", color: T.text, fontSize: 15, fontFamily: T.body, outline: "none", boxSizing: "border-box", fontWeight: 400, transition: "border-color .18s" }}/>;
}

function ThinkingBox({ text, elapsed, done }) {
  const [open, setOpen] = useState(!done);
  useEffect(() => { if (done) setOpen(false); }, [done]);
  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", display: "flex", gap: 8, alignItems: "center", cursor: "pointer", padding: 0, marginBottom: open ? 10 : 0 }}>
        {!done ? <Spinner/> : <span style={{ color: T.accent, fontSize: 13 }}>{"✓"}</span>}
        <span style={{ color: T.subtle, fontSize: 13 }}>{done ? "思考完成 · " + elapsed + "s" : "思考中…"}</span>
        <span style={{ color: T.subtle, fontSize: 11, marginLeft: 4 }}>{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div style={{ paddingLeft: 22, borderLeft: "1px solid " + T.border }}>
          <p style={{ color: T.subtle, fontSize: 13, fontFamily: T.mono, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {text}{!done && <span style={{ display: "inline-block", width: 1, height: 11, background: T.accent, marginLeft: 2, animation: "pulse 0.8s infinite", verticalAlign: "middle" }}/>}
          </p>
        </div>
      )}
    </div> );
}

function StepDot({ n, active, done }) {
  return <div style={{ width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 500, fontFamily: T.body, flexShrink: 0, background: active ? T.text : "transparent", color: active ? "#fff" : done ? T.accent : T.subtle, border: "1px solid " + (active ? T.text : done ? T.accent+"55" : T.dim), transition: "all .2s" }}>{done ? "✓" : n}</div>;
}

//  Phase 1: Job Info 
// Company alias map CN->EN for better search coverage
function toEnglishAlias(company) {
  var map = {
    "字节跳动": "ByteDance", "抖音": "TikTok", "快手": "Kuaishou",
    "腾讯": "Tencent", "阿里巴巴": "Alibaba", "阿里": "Alibaba",
    "百度": "Baidu", "京东": "JD.com", "美团": "Meituan",
    "滴滴": "DiDi", "拼多多": "Pinduoduo", "网易": "NetEase",
    "小红书": "RedNote", "哔哩哔哩": "bilibili",
    "蚂蚁": "Ant Group", "华为": "Huawei", "小米": "Xiaomi",
    "商汤": "SenseTime", "微软": "Microsoft",
    "谷歌": "Google", "苹果": "Apple", "亚马逊": "Amazon",
  };
  var keys = Object.keys(map);
  for (var k = 0; k < keys.length; k++) {
    if (company.indexOf(keys[k]) !== -1) return map[keys[k]];
  }
  return "";
}

function PhaseJobInfo({ session, update, onNext }) {
  const [summarizing, setSummarizing] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState(false);
  const [research, setResearch] = useState(session.research || null);

  // Sync if session.research changes (e.g. navigating back to step 1)
  useEffect(() => {
    if (session.research) setResearch(session.research);
  }, [session.id]);

  const handleNext = async () => {
    onNext();
    try {
      const [jdSum, resSum] = await Promise.all([
        session.jd ? summarizeJD(session.jd) : Promise.resolve(""),
        session.resume ? summarizeResume(session.resume) : Promise.resolve(""),
      ]);
      update({ jdSummary: jdSum, resumeSummary: resSum });
    } catch(e) {}
  };

  const handleResearch = async () => {
    if (!session.company || !session.role) return;
    setResearching(true);
    try {
      const r = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: session.company, role: session.role, companyEn: toEnglishAlias(session.company) }),
      });
      const data = await r.json();
      setResearch(data);
      update({ research: data });
    } catch(e) { console.error(e); setResearchError(true); }
    finally { setResearching(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <div>
        <h2 style={{ color: T.text, fontSize: 28, fontWeight: 400, letterSpacing: "-0.03em", marginBottom: 12, fontFamily: T.head }}>面试信息</h2>
        <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.8 }}>填写基本信息和 JD，AI 将生成针对性面试题</p>
      </div>
      <div>
        <p style={{ color: T.subtle, fontSize: 13, marginBottom: 16 }}>面试轮次</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {INTERVIEW_ROUNDS.map(r => {
            const active = (session.interviewRound||"") === r.label;
            return (
              <button key={r.id} onClick={() => { const wasRound = session.interviewRound; if (wasRound && wasRound !== r.label) { update({ interviewRound: r.label, interviewFocus: r.focus, questions: [] }); } else { update({ interviewRound: r.label, interviewFocus: r.focus }); } }}
                style={{ background: active ? T.accent : T.surface, border: "1.5px solid " + (active ? T.accent : T.border), borderRadius: 8, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all .15s" }}>
                <p style={{ color: active ? "#fff" : T.text, fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{r.label}</p>
                <p style={{ color: active ? "rgba(255,255,255,0.7)" : T.subtle, fontSize: 12 }}>{r.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p style={{ color: T.subtle, fontSize: 13, marginBottom: 20 }}>{"公司 \u00b7 职位"}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div><Label>公司</Label><Inp value={session.company} onChange={v => update({ company: v })} placeholder="ByteDance / OpenAI / Shopee"/></div>
          <div><Label>职位</Label><Inp value={session.role} onChange={v => update({ role: v })} placeholder="AI Product / Growth Lead"/></div>
        </div>
        {session.company && session.role && (
          <div style={{ marginTop: 16 }}>
            <button onClick={handleResearch} disabled={researching}
              style={{ background: "none", border: "none", color: researching ? T.subtle : T.accent, fontSize: 13, cursor: researching ? "default" : "pointer", fontFamily: T.body, padding: 0, letterSpacing: "0.01em" }}>
              {researching ? "搜索中..." : "搜索面经"}
            </button>
            {researchError && <span style={{ color: T.red, fontSize: 12, marginLeft: 10 }}>搜索失败，请重试</span>}
          </div>
        )}
        {research && (
          <div style={{ marginTop: 20, animation: "fadeUp .3s ease both" }}>
            {research.summary && (
              <div style={{ marginBottom: 24, padding: "18px 20px", background: T.surface, borderRadius: 10, border: "1px solid " + T.border }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                  <p style={{ color: T.subtle, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>常见考察点</p>
                  <p style={{ color: T.subtle, fontSize: 11 }}>已纳入面试题生成</p>
                </div>
                {(research.summary.questions || []).map((q, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, paddingBottom: 10, borderBottom: i < (research.summary.questions.length - 1) ? "1px solid " + T.border : "none" }}>
                    <span style={{ color: T.accent, fontSize: 11, fontWeight: 500, minWidth: 18, flexShrink: 0, marginTop: 2 }}>{String(i+1).padStart(2,"0")}</span>
                    <p style={{ color: T.text, fontSize: 13, lineHeight: 1.7 }}>{q}</p>
                  </div>
                ))}
                {research.summary.tips && (
                  <p style={{ color: T.muted, fontSize: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid " + T.border, lineHeight: 1.7 }}>{research.summary.tips}</p>
                )}
              </div>
            )}
            {research.results && research.results.length > 0 && (
              <div style={{ padding: "18px 20px", background: T.surface, borderRadius: 10, border: "1px solid " + T.border }}>
                <p style={{ color: T.subtle, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>相关面经</p>
                {research.results.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < 4 ? "1px solid " + T.border : "none" }}>
                    <a href={r.link} target="_blank" rel="noopener noreferrer"
                      style={{ color: T.text, fontSize: 13, textDecoration: "none", fontWeight: 500, lineHeight: 1.5, display: "block", marginBottom: 3 }}>
                      {r.title}
                    </a>
                    <p style={{ color: T.subtle, fontSize: 11, marginBottom: r.snippet ? 4 : 0 }}>{r.source}</p>
                    {r.snippet && <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.6 }}>{r.snippet.slice(0, 120)}...</p>}
                  </div>
                ))}
              </div>
            )}
            <button onClick={handleResearch} disabled={researching}
              style={{ background: "none", border: "none", color: T.subtle, fontSize: 12, cursor: "pointer", fontFamily: T.body, marginTop: 10, padding: 0 }}>
              {researching ? "搜索中..." : "重新搜索"}
            </button>
          </div>
        )}
      </div>
      <div>
        <p style={{ color: T.subtle, fontSize: 13, marginBottom: 20 }}>面试安排（可选）</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div><Label>日期</Label><Inp value={session.interviewDate||""} onChange={v => update({ interviewDate: v })} placeholder="2026-03-15"/></div>
          <div><Label>时间</Label><Inp value={session.interviewTime||""} onChange={v => update({ interviewTime: v })} placeholder="14:00"/></div>
          <div><Label>地点 / 形式</Label><Inp value={session.interviewLocation||""} onChange={v => update({ interviewLocation: v })} placeholder="线下 / 视频"/></div>
          <div><Label>面试官</Label><Inp value={session.interviewer||""} onChange={v => update({ interviewer: v })} placeholder="HR / 技术负责人"/></div>
        </div>
        <div style={{ marginTop: 20 }}><Label>备注</Label><Inp value={session.interviewNote||""} onChange={v => update({ interviewNote: v })} placeholder="注意事项、着装要求等"/></div>
      </div>
      <div>
        <p style={{ color: T.subtle, fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>职位描述 (JD)</p>
        <TA value={session.jd} onChange={v => update({ jd: v })} placeholder="粘贴职位描述 JD..." rows={8}/>
      </div>
      <div>
        <p style={{ color: T.subtle, fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>简历（可选）</p>
        {(() => {
          // Auto-read from resume library
          let libResumes = [];
          try { libResumes = JSON.parse(localStorage.getItem("resumes") || "[]"); } catch(e) {}
          const hasLib = libResumes.length > 0;
          const hasResume = session.resume && session.resume.trim().length > 0;
          if (hasResume) {
            const wordCount = session.resume.trim().length;
            return (
              <div style={{ padding: "12px 14px", background: T.greenDim, borderRadius: 8, border: "1px solid " + T.green + "44", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: T.green, fontSize: 13, fontWeight: 500, margin: 0 }}>已读取简历 · {wordCount} 字</p>
                  <p style={{ color: T.green, fontSize: 11, margin: "2px 0 0", opacity: 0.8 }}>AI 将根据此简历生成更有针对性的题目</p>
                </div>
                <button onClick={() => update({ resume: "" })} style={{ background: "none", border: "none", color: T.green, fontSize: 12, cursor: "pointer", fontFamily: T.body, opacity: 0.7 }}>移除</button>
              </div>
            );
          }
          if (hasLib) {
            return (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {libResumes.map(r => (
                    <button key={r.id} onClick={() => update({ resume: r.text })}
                      style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 8, padding: "10px 14px", cursor: "pointer", textAlign: "left", fontFamily: T.body, transition: "border-color .15s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
                      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                      <p style={{ color: T.text, fontSize: 13, fontWeight: 500, margin: 0 }}>{r.name}</p>
                      <p style={{ color: T.subtle, fontSize: 11, margin: "2px 0 0" }}>{r.text.length} 字</p>
                    </button>
                  ))}
                </div>
                <p style={{ color: T.subtle, fontSize: 11, marginTop: 8 }}>选择简历后 AI 将生成更有针对性的题目</p>
              </div>
            );
          }
          return (
            <div style={{ padding: "12px 14px", background: T.bg, borderRadius: 8, border: "1px dashed " + T.border }}>
              <p style={{ color: T.subtle, fontSize: 13, margin: 0 }}>简历库为空，可先在「投递追踪」中添加简历</p>
            </div>
          );
        })()}
      </div>
      <Btn onClick={handleNext} disabled={!session.company || !session.role} full size="lg">生成面试题 →</Btn>
    </div>
  );
}


// Robust JSON extractor — works even if AI adds preamble/postamble
function extractJSON(text) {
  if (!text) return null;
  // Strip all markdown code block variants
  let cleaned = text
    .replace(/```[\w]*\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  // Try full JSON first
  const end = cleaned.lastIndexOf("}");
  if (end > start) {
    const candidate = cleaned.slice(start, end + 1);
    try { return JSON.parse(candidate); } catch(e) {}
    try { return JSON.parse(candidate.replace(/[\x00-\x1F\x7F]/g, "")); } catch(e) {}
  }
  // JSON was truncated — patch it and try to recover partial data
  try {
    const partial = cleaned.slice(start);
    // Close any open arrays and objects
    let patched = partial;
    let opens = 0;
    for (const c of patched) { if (c==="{") opens++; else if (c==="}") opens--; }
    // Close open string if needed (count unescaped quotes)
    const quoteCount = (patched.split('"').length - 1);
    if (quoteCount % 2 !== 0) patched += '"';
    // Close open arrays and objects
    const arrOpen = (patched.match(/\[/g)||[]).length - (patched.match(/\]/g)||[]).length;
    patched += "]".repeat(Math.max(0, arrOpen));
    patched += "}".repeat(Math.max(0, opens));
    return JSON.parse(patched);
  } catch(e) { return null; }
}

//  Phase 1: Mock Interview 
const Q_TYPES = ["行为", "技术", "情景", "动机", "综合", "案例", "认知", "压力"];

function PhaseMock({ session, update, onNext }) {
  const [questions, setQuestions] = useState(session.questions || []);
  const [loading, setLoading] = useState(false);
  // Reset questions when round changes (user went back and picked a different round)
  const prevRoundRef = useRef(session.interviewRound);
  useEffect(() => {
    if (prevRoundRef.current !== session.interviewRound) {
      prevRoundRef.current = session.interviewRound;
      setQuestions([]);
      setAnswers([]);
      setFeedbacks([]);
    }
  }, [session.interviewRound]);
  const [loadingStep, setLoadingStep] = useState(0);
  const [genError, setGenError] = useState("");
  const [activeQ, setActiveQ] = useState(0);
  const activeQRef = useRef(0); // ref版本，避免语音回调闭包问题
  const setActiveQSafe = (idx) => { activeQRef.current = idx; setActiveQ(idx); stopListeningRef.current && stopListeningRef.current(); };
  const [answers, setAnswers] = useState(() => (session.questions||[]).map(q => q.userAnswer || ""));
  const [feedbacks, setFeedbacks] = useState(() => (session.questions||[]).map(q => q.feedback || null));
  const [evalLoading, setEvalLoading] = useState(false);
  const [showRef, setShowRef] = useState({});

  const [rounds, setRounds] = useState(() => (session.questions||[]).map(q => q.rounds || 0));

  // Voice input state
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState("");
  const srRef = useRef(null);
  const stopListeningRef = useRef(null);

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("请使用 Chrome 或 Edge 浏览器"); return; }
    if (srRef.current) return;

    const createSR = () => {
      const sr = new SR();
      sr.lang = "zh-CN";
      sr.continuous = false; // 每句话单独识别，更稳定
      sr.interimResults = true;
      sr.onstart = () => setVoiceListening(true);
      sr.onresult = (e) => {
        let final = "";
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        if (final) {
          setAnswers(a => { const n = [...a]; n[activeQRef.current] = (n[activeQRef.current] ? n[activeQRef.current] + " " : "") + final; return n; });
          setVoiceInterim("");
        } else {
          setVoiceInterim(interim);
        }
      };
      sr.onerror = (e) => {
        console.error("SR error:", e.error);
        if (e.error === "no-speech" && srRef.current) {
          // 没检测到声音，自动重启
          try { srRef.current = createSR(); srRef.current.start(); } catch(err) {}
          return;
        }
        srRef.current = null; setVoiceListening(false); setVoiceInterim("");
      };
      sr.onend = () => {
        // 如果还在录音模式，自动重启（实现真正的连续录音）
        if (srRef.current) {
          try { srRef.current = createSR(); srRef.current.start(); } catch(err) { srRef.current = null; setVoiceListening(false); setVoiceInterim(""); }
        }
      };
      return sr;
    };

    srRef.current = createSR();
    try { srRef.current.start(); } catch(e) { console.error(e); srRef.current = null; }
  };

  const stopVoice = () => {
    if (srRef.current) { srRef.current.stop(); srRef.current = null; }
    setVoiceListening(false);
    setVoiceInterim("");
    setVoiceMode(false);
  };

  const stopListening = () => {
    if (srRef.current) { srRef.current.stop(); srRef.current = null; }
    setVoiceListening(false);
    setVoiceInterim("");
  };
  stopListeningRef.current = stopListening;

  const THINK_STEPS = [
    "分析岗位要求和 JD 关键词...",
    "结合简历匹配候选人背景...",
    "设计覆盖核心能力的问题...",
    "生成参考答案与评分维度...",
    "完成",
  ];

  const generateQuestions = async () => {
    setLoading(true); setLoadingStep(0); setGenError(""); setStreamingAnswer("");
    setThinkingText(""); setThinkingDone(false); setThinkingElapsed(0);
    const t0 = Date.now();
    const round = session.interviewRound || "";

    let stepIdx = 0;
    setThinkingText(THINK_STEPS[0]);
    const stepTimer = setInterval(() => {
      if (stepIdx < THINK_STEPS.length - 2) {
        stepIdx++;
        setThinkingText(THINK_STEPS[stepIdx]);
      }
    }, 1800);

    const roundGuide = {
      "一面": "结合候选人简历经历和公司背景出题：1-2题自我介绍/动机类，3-4题基于简历具体经历的行为题（STAR），2题与JD匹配的基础能力题。难度中等，避免过于抽象的战略题",
      "二面": "业务面深度考察：以情景题和案例分析为主，要求候选人展示业务判断力和数据思维。结合JD核心岗位职责出题，2-3题需要候选人给出具体方案或数字，难度较高",
      "三面": "高管视角考察：职业规划、商业判断、跨团队协作、行业认知。题目开放性强，考察战略思维和价值观，难度高",
      "HR面": "只出HR类问题（期望薪资、入职时间、离职原因、职业规划、团队适配），不出任何业务或技术题，难度低",
    }[round] || "综合考察：结合简历经历出行为题，结合JD出能力题，行为题与业务题各半，难度适中";

    const jdText = session.jdSummary || (session.jd||"").slice(0,400);
    const resumeText = session.resumeSummary || (session.resume||"").slice(0,400);
    const hasEnglish = (t) => (t.match(/[a-zA-Z]{3,}/g)||[]).length > 5;
    const needBilingual = hasEnglish(jdText) || hasEnglish(resumeText);
    const langRule = needBilingual
      ? "语言规则：检测到英文简历或JD，每道题先用中文出题，附英文翻译，格式：中文题目 (English: English translation)"
      : "语言规则：全部用中文出题。";
    const researchHints = session.research?.summary?.questions?.length
      ? "\n网上面经中常见考察点（参考这些出题，不要照抄）：\n" + session.research.summary.questions.slice(0,5).map((q,i) => `${i+1}. ${q}`).join("\n")
      : "";
    const prompt = `你是一位专业面试官，请为以下候选人生成${round || ""}面试题。\n\n面试重点：${roundGuide}\n岗位：${session.company} | ${session.role}\nJD摘要：${jdText}\n简历摘要：${resumeText}${researchHints}\n\n请生成7道有针对性的面试题，覆盖不同考察维度。${langRule}\n\nreference字段要求（重要）：\n- 写一段完整的示范回答，150-250字，用第一人称\n- 行为题用STAR结构：先说情境和任务，再说具体行动，最后说量化结果\n- 技术/综合题：先说核心观点，再用1-2个具体例子支撑，最后总结\n- 语气自然，像真人在面试中说话，不要列要点\n\n返回JSON：\n{"questions":[{"id":"q1","type":"行为/技术/情景/动机/综合","question":"具体问题","reference":"完整示范回答150-250字","tips":"一句话回答思路"}]}\n共7题，严格按照面试重点控制难度，覆盖不同题型，不要重复同一类型超过2题。`;

    try {
      const system = "你是专业面试官，只输出合法JSON，不含任何markdown，不含代码块，直接输出{开头的JSON，用中文。";
      const raw = await callClaude(prompt, 3200, { system });
      const fullText = raw.startsWith("{") ? raw : '{"questions":[' + raw;
      const result = extractJSON(fullText);
      let qs;
      if (result && result.questions) {
        qs = result.questions.map((q, i) => ({ ...q, type: Q_TYPES[i] || q.type, userAnswer: "", feedback: null, rounds: 0 }));
      } else {
        setGenError("题目生成失败，请重试");
        clearInterval(stepTimer); setLoading(false); return;
      }
      setQuestions(qs); setAnswers(qs.map(() => "")); setFeedbacks(qs.map(() => null)); setRounds(qs.map(() => 0));
      update({ questions: qs, phase: 1 });
    } catch(e) {
      setGenError(String(e.message));
    }
    clearInterval(stepTimer);
    setThinkingDone(true);
    setThinkingElapsed(Math.round((Date.now() - t0) / 1000));
    setLoading(false);
  };

  const evalAnswer = async (idx) => {
    if (!(answers[idx] && answers[idx].trim())) return;
    if (rounds[idx] >= 3) return;
    setEvalLoading(true);
    const q = questions[idx];
    let result;
    {
      result = await haikuJSON(
        "你是严格专业的面试教练，只输出合法JSON，不含markdown。评估要具体，直接指出问题，给出可操作的改进。语言规则：全部用中文回复，如果需要引用英文原文可以保留英文词汇，但主体必须是中文。",
        `请对以下面试回答进行深度评估：

问题：${q.question}
参考答案要点：${q.reference}
候选人回答：${answers[idx]}

评估要求：
- strengths：列出2-3个具体优点，用分号分隔，每点引用原话亮点说明为什么好
- improve：列出1-2个最关键的不足，用分号分隔，具体说缺了什么或哪里表达有问题
- suggestion：给出3-4句具体的改进建议，包括：1)结构上如何优化 2)应该补充哪些具体内容/数据 3)可以直接用的一句改写示例

返回JSON：{"score":0-10的数字,"dimensions":{"逻辑清晰":0-10,"内容深度":0-10,"表达效果":0-10,"岗位匹配":0-10},"strengths":"具体优点（引用原话亮点）","improve":"最关键的不足（具体说缺什么）","suggestions":["结构建议：具体说明","内容建议：应补充什么数据或细节","改写示例：一句可以直接用的示范回答开头"]}`, 1200
      );
    } // end result block
    if (result) {
      const newFeedbacks = [...feedbacks]; newFeedbacks[idx] = result;
      const newRounds = [...rounds]; newRounds[idx] = (rounds[idx]||0) + 1;
      const newQs = questions.map((q,i) => i===idx ? {...q, userAnswer: answers[idx], feedback: result, rounds: newRounds[idx]} : q);
      setFeedbacks(newFeedbacks); setRounds(newRounds); setQuestions(newQs);
      update({ questions: newQs });
    }
    setEvalLoading(false);
  };

  const [thinkingText, setThinkingText] = useState("");
  const [thinkingDone, setThinkingDone] = useState(false);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const [streamingAnswer, setStreamingAnswer] = useState("");

  // Auto-generate on first load if no questions yet
  useEffect(() => {
    if (!questions.length && !genError) generateQuestions();
  }, []);

  const allDone = questions.length > 0 && questions.every(q => q.rounds > 0);
  const [finishing, setFinishing] = useState(false);
  const typeColor = { "行为": T.blue, "技术": T.accent, "情景": T.yellow, "动机": T.green, "综合": T.muted };

  if (!questions.length) return (
    <div>
      <h2 style={{ color: T.text, fontSize: 28, fontWeight: 400, letterSpacing: "-0.03em", marginBottom: 12, fontFamily: T.head }}>AI 面试模拟</h2>
      <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.8, marginBottom: 48 }}>正在生成 7 道{session.interviewRound ? " " + session.interviewRound : ""}面试题...</p>
      {genError ? (
        <div>
          <div style={{ borderLeft: "1.5px solid " + T.red, paddingLeft: 14, marginBottom: 28, color: T.red, fontSize: 14 }}>{genError}</div>
          <Btn size="lg" onClick={generateQuestions} full>重新生成题目</Btn>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <Spinner/>
            <span style={{ color: T.muted, fontSize: 14 }}>AI 生成题目中...</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {THINK_STEPS.slice(0, -1).map((step, i) => {
              const currentIdx = THINK_STEPS.indexOf(thinkingText);
              const isDone = i < currentIdx;
              const isActive = i === currentIdx;
              return (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", height: 28, flexShrink: 0, opacity: isDone ? 0.3 : isActive ? 1 : 0.15, transition: "opacity 0.4s ease" }}>
                  <span style={{ fontSize: 11, color: isDone ? T.green : T.accent, width: 10, flexShrink: 0 }}>{isDone ? "✓" : "·"}</span>
                  <span style={{ color: T.muted, fontSize: 13, whiteSpace: "nowrap" }}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
  const q = questions[activeQ];
  const fb = feedbacks[activeQ];
  const score = (fb && fb.score);
  const scoreCol = score >= 8 ? T.green : score >= 6 ? T.yellow : T.red;

  return (
    <div>
      <div style={{ display: "flex", gap: 0, marginBottom: 36, borderBottom: "1px solid " + T.border }}>
        {questions.map((qItem, i) => {
          const done = qItem.rounds > 0;
          const s = (qItem.feedback && qItem.feedback.score);
          const scoreColor = s >= 8 ? T.green : s >= 6 ? T.yellow : T.red;
          return (
            <button key={i} onClick={() => setActiveQSafe(i)} style={{ background: "none", border: "none", borderBottom: activeQ===i ? "1.5px solid " + T.text : "1.5px solid transparent", marginBottom: -1, padding: "10px 14px", color: activeQ===i ? T.text : done ? T.muted : T.subtle, fontSize: 13, fontWeight: activeQ===i ? 500 : 400, cursor: "pointer", fontFamily: T.body, transition: "color .15s" }}>
              Q{i+1}{done && <span style={{ color: scoreColor, fontSize: 11, marginLeft: 4 }}>{s}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <span style={{ color: typeColor[q.type]||T.subtle, fontSize: 12, letterSpacing: "0.04em" }}>{q.type}</span>
          <span style={{ color: T.subtle, fontSize: 12 }}>{"\u00b7"} {rounds[activeQ]||0}/3 次</span>
        </div>
        <div>
          <p style={{ color: T.text, fontSize: 18, fontWeight: 500, lineHeight: 1.65, marginBottom: 24, letterSpacing: "-0.01em", textAlign: "left" }}>{q.question}</p>
          {showRef[activeQ+"_tips"] ? (
            <div style={{ borderLeft: "2px solid " + T.accent + "55", paddingLeft: 16, marginBottom: 20 }}>
              {q.tips && <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.75, marginBottom: 12 }}>{q.tips}</p>}
              <p style={{ color: T.subtle, fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>参考答案</p>
              <p style={{ color: T.text, fontSize: 15, lineHeight: 1.8, marginBottom: 12 }}>{q.reference}</p>
              <button onClick={() => setShowRef(r => ({...r, [activeQ+"_tips"]: false}))} style={{ background: "none", border: "none", color: T.subtle, fontSize: 12, cursor: "pointer", fontFamily: T.body }}>收起</button>
            </div>
          ) : (
            <button onClick={() => setShowRef(r => ({...r, [activeQ+"_tips"]: true}))}
              style={{ background: "none", border: "none", color: T.accent, fontSize: 13, cursor: "pointer", marginBottom: 20, display: "block", fontFamily: T.body, textDecoration: "underline", textDecorationColor: T.accent+"55", padding: 0 }}>
              查看参考答案
            </button>
          )}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Label>你的回答</Label>
              <button
                onClick={voiceListening ? stopListening : startVoice}
                style={{ display: "flex", alignItems: "center", gap: 6, background: voiceListening ? T.red+"11" : "none", border: "1px solid " + (voiceListening ? T.red : T.border), borderRadius: 20, padding: "5px 14px", color: voiceListening ? T.red : T.muted, fontSize: 12, cursor: "pointer", fontFamily: T.body, transition: "all .2s", boxShadow: voiceListening ? "0 0 0 3px " + T.red + "18" : "none" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: voiceListening ? T.red : T.subtle, display: "inline-block", flexShrink: 0, animation: voiceListening ? "pulse 1s infinite" : "none" }}/>
                {voiceListening ? "录音中" : "语音输入"}
              </button>
            </div>
            {/* Inline interim preview — shows above textarea while speaking */}
            {voiceListening && (
              <div style={{ marginBottom: 8, padding: "10px 14px", borderRadius: 8, background: T.red+"08", border: "1px solid " + T.red+"33", minHeight: 36 }}>
                <p style={{ color: T.red, fontSize: 13, lineHeight: 1.6, margin: 0, fontStyle: voiceInterim ? "normal" : "italic" }}>
                  {voiceInterim || "请说话..."}
                </p>
              </div>
            )}
          </div>
          {/* Main answer textarea — final recognized text flows directly here */}
          <TA
            value={answers[activeQ]}
            onChange={v => { const a=[...answers]; a[activeQ]=v; setAnswers(a); }}
            rows={5}
            placeholder="在这里输入你的回答，或点击右上角语音输入..."
          />

          <div style={{ display: "flex", gap: 16, marginTop: 16, alignItems: "center" }}>
            <Btn onClick={() => { if (!evalLoading) evalAnswer(activeQ); }} disabled={!(answers[activeQ] && answers[activeQ].trim()) || rounds[activeQ]>=3} style={{ width: 120, opacity: evalLoading ? 0.85 : 1 }}>
              {evalLoading ? <><Spinner/> 评分中...</> : rounds[activeQ]>=3 ? "已练习 3 次" : rounds[activeQ]>0 ? "再次评分 (" + rounds[activeQ] + "/3)" : "提交回答"}
            </Btn>
            {activeQ < questions.length-1 && (
              <>{activeQ > 0 && <button onClick={() => setActiveQSafe(activeQ-1)} style={{ background: "none", border: "none", color: T.muted, fontSize: 14, cursor: "pointer", fontFamily: T.body }}>{"\u2190 上一题"}</button>}<button onClick={() => setActiveQSafe(activeQ+1)} style={{ background: "none", border: "none", color: T.muted, fontSize: 14, cursor: "pointer", fontFamily: T.body }}>{"下一题 \u2192"}</button></>
            )}
          </div>
        </div>
      </div>
      {fb && (
        <div style={{ marginBottom: 28, paddingTop: 32, borderTop: "1px solid " + T.border }}>
          {/* Score */}
          <div style={{ display: "flex", gap: 16, alignItems: "baseline", marginBottom: 24 }}>
            <span style={{ color: scoreCol, fontSize: 48, fontWeight: 300, fontFamily: T.head, lineHeight: 1, letterSpacing: "-0.02em" }}>{fb.score}</span>
            <span style={{ color: T.subtle, fontSize: 13 }}>/ 10</span>
          </div>
          {/* Strengths block */}
          {fb.strengths && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: T.subtle, fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>优点</p>
              {fb.strengths.split(/[；;]|\d+[)）.．]\s*/).filter(s => s.trim()).map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <span style={{ color: T.green, fontSize: 13, fontWeight: 500, flexShrink: 0, minWidth: 16 }}>{i + 1}</span>
                  <p style={{ color: T.text, fontSize: 14, lineHeight: 1.8, margin: 0 }}>{s.trim()}</p>
                </div>
              ))}
            </div>
          )}
          {/* Improve block */}
          {fb.improve && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: T.subtle, fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>不足之处</p>
              {fb.improve.split(/[；;]|\d+[)）.．]\s*/).filter(s => s.trim()).map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <span style={{ color: T.yellow, fontSize: 13, fontWeight: 500, flexShrink: 0, minWidth: 16 }}>{i + 1}</span>
                  <p style={{ color: T.text, fontSize: 14, lineHeight: 1.8, margin: 0 }}>{s.trim()}</p>
                </div>
              ))}
            </div>
          )}
          {/* Dimensions */}
          {fb.dimensions && (
            <div style={{ marginBottom: 24 }}>
              {Object.entries(fb.dimensions).map(([k,v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid " + T.border }}>
                  <span style={{ color: T.subtle, fontSize: 13 }}>{k}</span>
                  <span style={{ color: v>=8?T.green:v>=6?T.yellow:T.red, fontSize: 15, fontFamily: T.head, fontWeight: 300 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
          {/* Suggestions */}
          {(fb.suggestion || fb.suggestions) && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: T.accent, fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>改进建议</p>
              {Array.isArray(fb.suggestions) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {fb.suggestions.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 10 }}>
                      <span style={{ color: T.accent, fontSize: 12, fontWeight: 500, flexShrink: 0, minWidth: 16, marginTop: 3 }}>{i + 1}</span>
                      <p style={{ color: T.text, fontSize: 14, lineHeight: 1.8, margin: 0 }}>{s}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(fb.suggestion || "").split(/\d+[\)）]\s*/).filter(Boolean).map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 10 }}>
                      <span style={{ color: T.accent, fontSize: 12, fontWeight: 500, flexShrink: 0, minWidth: 16, marginTop: 3 }}>{i + 1}</span>
                      <p style={{ color: T.text, fontSize: 14, lineHeight: 1.8, margin: 0 }}>{s.trim()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            {showRef[activeQ] ? (
              <div style={{ paddingTop: 12 }}>
                <p style={{ color: T.subtle, fontSize: 12, marginBottom: 8 }}>参考答案</p>
                <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.8 }}>{q.reference}</p>
                <button onClick={() => setShowRef(r => ({...r, [activeQ]: false}))} style={{ background: "none", border: "none", color: T.subtle, fontSize: 13, cursor: "pointer", fontFamily: T.body, marginTop: 8 }}>收起</button>
              </div>
            ) : (
              <button onClick={() => setShowRef(r => ({...r, [activeQ]: true}))}
                style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: T.body, padding: "10px 0", textDecoration: "underline", textDecorationColor: T.dim }}>
                查看参考答案
              </button>
            )}
          </div>
        </div>
      )}

      {allDone && (
        <div style={{ paddingTop: 36, borderTop: "1px solid " + T.border, marginTop: 20 }}>
          <Btn full size="lg" disabled={finishing} onClick={async () => {
          setFinishing(true);
          const qs = questions;
          const avgScore = qs.length ? Math.round(qs.reduce((s,q) => s+((q.feedback && q.feedback.score)||0),0)/qs.length*10)/10 : 0;
          const summary = qs.map((q,i) => `Q${i+1}(${q.type})${q.question}\n${(q.feedback && q.feedback.score)}/10${(q.feedback && q.feedback.improve)}`).join("\n");
          const result = await haikuJSON(
            "你是专业面试教练，只输出合法JSON，不含markdown，用中文。",
            `请生成面试总结报告。\n候选人：${session.company}|${session.role}\n各题摘要：\n${summary}\n平均分：${avgScore}\n返回JSON：{"overallScore":数字,"grade":"A/B/C/D","summary":"一句话总结","strengths":["优势1","优势2","优势3"],"improvements":["待提升1","待提升2","待提升3"],"nextSteps":"下一步建议2句"}`, 800
          );
          update({ analysis: result || { overallScore: avgScore, grade: avgScore>=8?"A":avgScore>=6?"B":avgScore>=4?"C":"D", summary:"模拟完成", strengths:["完成了全部题目"], improvements:["可进一步提升"], nextSteps:"查看各题反馈，针对性练习" }, phase: 3 });
        }}> {finishing ? <><Spinner/> 生成报告中...</> : "完成模拟，查看总结报告"}
        </Btn> </div> )}
    </div> );
}

//  Phase 2: Analysis (auto-generate report) 
function PhaseAnalysis({ session, update, onDone }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      const qs = session.questions || [];
      const avgScore = qs.length ? Math.round(qs.reduce((s,q) => s+((q.feedback && q.feedback.score)||0), 0) / qs.length * 10) / 10 : 0;
      const summary = qs.map((q,i) => `Q${i+1}【${q.type}】${q.question}\n候选人回答：${q.userAnswer && q.userAnswer.slice(0,200)}\n得分：${(q.feedback && q.feedback.score)}/10\n评价：${(q.feedback && q.feedback.improve)||""}`).join("\n\n");
      const result = await haikuJSON(
        "你是专业面试教练，只输出合法JSON，不含任何markdown代码块，直接以{开头，用中文。",
        `根据以下面试详情生成有深度的总结报告。不要输出空洞的套话，要结合具体表现给出实质性评价。\n候选人：${session.company} | ${session.role}\n各题详情：\n${summary}\n平均分：${avgScore}\n\n返回JSON：{"overallScore":数字,"grade":"A/B/C/D","summary":"基于具体表现的两句话整体评价","strengths":["结合具体回答的优势1","优势2","优势3"],"improvements":["具体需要提升的点1（说明原因）","提升点2","提升点3"],"nextSteps":"针对薄弱点的具体备考建议两句话"}`, 1200
      );
      if (result) { update({ analysis: result, phase: 3 }); onDone(); }
      else { setError("生成失败，请重试"); setLoading(false); }
    };
    run();
  }, []);

  if (error) return <div style={{ textAlign: "center", padding: 40 }}><p style={{ color: T.red }}>{error}</p><Btn onClick={onDone}>返回</Btn></div>;
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}> <Spinner/><p style={{ color: T.muted, fontSize: 14, marginTop: 16 }}>AI 生成分析报告中...</p> </div> );
}

//  Phase 3: Results 
function PhaseResults({ session, onNextRound, onReview }) {
  const a = session.analysis;
  const qs = session.questions || [];
  const round = session.interviewRound || "";
  const avgScore = qs.length ? (qs.reduce((s,q) => s+((q.feedback && q.feedback.score)||0),0)/qs.length).toFixed(1) : 0;
  const gradeCol = { A: T.green, B: T.blue, C: T.yellow, D: T.red }[(a && a.grade)] || T.muted;

  const ROUND_OPTIONS = ["一面", "二面", "三面", "HR面", "笔试", "终面", "其他"];
  const [showRoundPicker, setShowRoundPicker] = useState(false);
  const [customRound, setCustomRound] = useState("");

  if (!a) return <p style={{ color: T.muted, padding: "40px 0", fontSize: 15 }}>暂无分析结果</p>;
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 52, paddingBottom: 40, borderBottom: "1px solid " + T.border }}>
        <p style={{ color: T.muted, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500, marginBottom: 32 }}>{round || "面试"} · 模拟结果</p>
        <div style={{ display: "flex", gap: 24, alignItems: "baseline", marginBottom: 24 }}>
          <span style={{ color: gradeCol, fontFamily: T.head, fontSize: 88, fontWeight: 300, lineHeight: 0.9, letterSpacing: "-0.04em" }}>{a.grade}</span>
          <div>
            <span style={{ color: T.text, fontSize: 32, fontWeight: 300, fontFamily: T.head, letterSpacing: "-0.02em" }}>{avgScore}</span>
            <span style={{ color: T.subtle, fontSize: 14, marginLeft: 6 }}>/ 10</span>
          </div>
        </div>
        <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.85 }}>{a.summary}</p>
      </div>

      {/* Strengths */}
      {(a.strengths||[]).length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <p style={{ color: T.muted, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500, marginBottom: 20 }}>核心优势</p>
          {(a.strengths||[]).map((s,i) => (
            <div key={i} style={{ display: "flex", gap: 16, paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid " + T.border }}>
              <span style={{ color: T.subtle, fontSize: 11, marginTop: 3, flexShrink: 0, letterSpacing: "0.05em" }}>{"0" + (i+1)}</span>
              <p style={{ color: T.text, fontSize: 14, lineHeight: 1.75, margin: 0 }}>{s}</p>
            </div>
          ))}
        </div>
      )}

      {/* Improvements */}
      {(a.improvements||[]).length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <p style={{ color: T.muted, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500, marginBottom: 20 }}>待改进</p>
          {(a.improvements||[]).map((s,i) => (
            <div key={i} style={{ display: "flex", gap: 16, paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid " + T.border }}>
              <span style={{ color: T.subtle, fontSize: 11, marginTop: 3, flexShrink: 0, letterSpacing: "0.05em" }}>{"0" + (i+1)}</span>
              <p style={{ color: T.text, fontSize: 14, lineHeight: 1.75, margin: 0 }}>{s}</p>
            </div>
          ))}
        </div>
      )}

      {/* Next Steps */}
      {a.nextSteps && (
        <div style={{ marginBottom: 48 }}>
          <p style={{ color: T.muted, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500, marginBottom: 16 }}>下一步</p>
          <p style={{ color: T.text, fontSize: 15, lineHeight: 1.9 }}>{a.nextSteps}</p>
        </div>
      )}

      {/* Per-question scores */}
      <div style={{ marginBottom: 48 }}>
        <p style={{ color: T.muted, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500, marginBottom: 20 }}>各题得分</p>
        {qs.map((q,i) => {
          const s = (q.feedback && q.feedback.score) || 0;
          const col = s>=8?T.green:s>=6?T.yellow:T.red;
          return (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", padding: "13px 0", borderBottom: "1px solid " + T.border }}>
              <span style={{ color: T.subtle, fontSize: 11, width: 24, flexShrink: 0, letterSpacing: "0.05em" }}>Q{i+1}</span>
              <span style={{ color: T.muted, fontSize: 13, flex: 1, lineHeight: 1.5 }}>{q.question.slice(0,52)}{q.question.length > 52 ? "…" : ""}</span>
              <span style={{ color: col, fontSize: 15, fontWeight: 400, flexShrink: 0, fontFamily: T.head }}>{s}</span>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ borderTop: "1px solid " + T.border, paddingTop: 32, marginBottom: 20, display: "flex", gap: 20, alignItems: "center" }}>
        <Btn size="sm" onClick={onReview}>真实面试复盘</Btn>
        {!showRoundPicker
          ? <button onClick={() => setShowRoundPicker(true)} style={{ background: "none", border: "none", color: T.muted, fontSize: 14, cursor: "pointer", fontFamily: T.body }}>{"继续下一轮 \u2192"}</button>
          : null}
      </div>
      {showRoundPicker && (
        <div style={{ paddingTop: 24 }}>
          <p style={{ color: T.muted, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500, marginBottom: 16 }}>选择下一轮</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {ROUND_OPTIONS.map(r => (
              <button key={r} onClick={() => { setShowRoundPicker(false); onNextRound(r); }} style={{ background: "transparent", border: "1px solid " + T.border, borderRadius: 4, padding: "5px 12px", color: T.text, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>{r}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Inp value={customRound} onChange={setCustomRound} placeholder="自定义轮次名称"/>
            <Btn size="sm" disabled={!customRound.trim()} onClick={() => onNextRound(customRound.trim())}>确认</Btn>
            <button onClick={() => setShowRoundPicker(false)} style={{ background: "none", border: "none", color: T.subtle, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

//  Phase 4: Review (real interview debrief) 
function PhaseReview({ session, update, onBack, onNextRound }) {
  const [transcript, setTranscript] = useState(session.reviewTranscript || "");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(session.reviewResult || null);
  const [error, setError] = useState("");
  const [showNextRound, setShowNextRound] = useState(false);
  const [inputMode, setInputMode] = useState("paste"); // "paste" | "record" | "upload"

  const qs = session.questions || [];
  const round = session.interviewRound || "";

  // — 实时录音 —
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const srRef = useRef(null);

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("请使用 Chrome 或 Edge 浏览器"); return; }
    if (srRef.current) return;

    const createSR = () => {
      const sr = new SR();
      sr.lang = "zh-CN"; sr.continuous = false; sr.interimResults = true;
      let lastFinalIndex = 0;
      sr.onstart = () => setRecording(true);
      sr.onresult = (e) => {
        let newFinal = "", interimText = "";
        for (let i = lastFinalIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) { newFinal += e.results[i][0].transcript; lastFinalIndex = i + 1; }
          else interimText += e.results[i][0].transcript;
        }
        if (newFinal) { setTranscript(t => (t ? t + " " : "") + newFinal); setInterim(""); }
        else setInterim(interimText);
      };
      sr.onerror = (e) => {
        if (e.error === "no-speech" && srRef.current) {
          try { srRef.current = createSR(); srRef.current.start(); } catch(err) {}
          return;
        }
        setError("录音错误：" + e.error); srRef.current = null; setRecording(false); setInterim("");
      };
      sr.onend = () => {
        if (srRef.current) {
          try { srRef.current = createSR(); srRef.current.start(); } catch(err) { srRef.current = null; setRecording(false); setInterim(""); }
        }
      };
      return sr;
    };

    srRef.current = createSR();
    try { srRef.current.start(); } catch(e) { setError(String(e)); srRef.current = null; }
  };

  const stopRecording = () => {
    if (srRef.current) { srRef.current.stop(); srRef.current = null; }
    setRecording(false); setInterim("");
  };

  // — 上传音频文件（需要 OpenAI Whisper API Key）—
  const [uploadStatus, setUploadStatus] = useState(""); // "" | "uploading" | "done" | "error"
  const [whisperKey, setWhisperKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const fileRef = useRef(null);

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (!whisperKey) { setShowKeyInput(true); return; }
    const allowed = ["audio/mp3","audio/mpeg","audio/mp4","audio/m4a","audio/wav","audio/webm","audio/ogg"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|mp4|m4a|wav|webm|ogg)$/i)) {
      setError("支持格式：mp3、m4a、wav、mp4、webm"); return;
    }
    if (file.size > 25 * 1024 * 1024) { setError("文件最大 25MB"); return; }
    setUploadStatus("uploading"); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("model", "whisper-1");
      fd.append("language", "zh");
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + whisperKey },
        body: fd,
      });
      const data = await res.json();
      if (data.error) { setError("Whisper 错误：" + data.error.message); setUploadStatus("error"); return; }
      setTranscript((data.text || "").trim());
      setUploadStatus("done");
    } catch(e) {
      setError("上传失败：" + e.message); setUploadStatus("error");
    }
  };

  const [segmentStatus, setSegmentStatus] = useState([]);

  const analyze = async () => {
    if (!transcript.trim()) return;
    setLoading(true); setProgress(0); setError(""); setSegmentStatus([]);
    try {
      // Step 1: Compress transcript — extract real Q&A from actual interview
      setSegmentStatus([{ i: 0, status: "analyzing" }]);
      setProgress(15);

      const compressed = await callClaude(
        `请从以下面试录音转录中，提取所有面试官提问和候选人回答，格式如下：
Q1: [面试官问题]
A: [候选人回答]
Q2: [面试官问题]
A: [候选人回答]

每个回答压缩到2-3句核心内容。转录内容（共${transcript.length}字）：
${transcript.slice(0, 8000)}`,
        1200,
        { system: "你是面试记录提取助手，只提取真实的问答对，不添加评价。" }
      );

      setSegmentStatus([{ i: 0, status: "done" }, { i: 1, status: "analyzing" }]);
      setProgress(55);

      // Step 2: Full analysis on compressed content (one call)
      const finalRaw = await callClaude(
        `你是顶级面试教练，请对以下真实面试录音进行深度、具体的复盘分析。要求每条建议都结合面试中的实际表现，不要泛泛而谈。

岗位：${session.role} | 公司：${session.company||""} | 轮次：${round}

面试问答摘要：
${compressed.slice(0, 2000)}

请返回JSON格式分析报告（严格合法JSON，不含markdown，内容要具体详实）：
{
  "overallScore": 数字1-10,
  "summary": "结合具体回答的两句话整体评价，指出最突出的优势和最需改进的点",
  "highlights": ["结合具体回答的亮点1（说明哪道题、如何体现）", "亮点2", "亮点3", "亮点4"],
  "weaknesses": ["结合具体回答的短板1（说明哪道题、具体问题是什么）", "短板2", "短板3", "短板4"],
  "structureTips": "回答逻辑结构的具体建议，指出哪些回答结构有问题、如何用STAR法则改善，3-4句",
  "businessTips": "内容深度与专业性的具体建议，指出哪些回答缺乏深度、如何补充行业洞察，3-4句",
  "persuasionTips": "表达效果与说服力的具体建议，指出哪些表达不够有力、如何改进，3-4句",
  "actionList": ["针对本次面试暴露问题的具体行动1（可操作的）", "具体行动2", "具体行动3", "具体行动4", "具体行动5"],
  "nextRoundFocus": ["下轮面试需要重点准备的方向1（具体到知识点或案例类型）", "重点2", "重点3", "重点4", "重点5"]
}`,
        4000,
        { system: "你是专业面试教练，只输出合法JSON，不含任何markdown代码块，直接以{开头，用中文。内容要具体，结合实际面试表现，不要输出空洞套话。" }
      );

      setSegmentStatus([{ i: 0, status: "done" }, { i: 1, status: "done" }]);
      setProgress(92);

      const r = extractJSON(finalRaw);
      if (r) {
        setResult(r);
        update({ reviewTranscript: transcript, reviewResult: r });
      } else {
        setError(String((finalRaw||"").slice(0, 100)));
      }
    } catch(e) {
      setError("" + e.message);
    } finally {
      setProgress(100);
      setTimeout(() => setLoading(false), 300);
    }
  };

  const scoreCol = s => s >= 8 ? T.green : s >= 6 ? T.yellow : T.red;

  return (
    <div>
      <div style={{ marginBottom: 44 }}>
        <h2 style={{ color: T.text, fontSize: 28, fontWeight: 400, letterSpacing: "-0.03em", marginBottom: 10, fontFamily: T.head }}>面试复盘</h2>
        <p style={{ color: T.muted, fontSize: 14 }}>{session.company}{session.role ? " · " + session.role : ""}{round ? " · " + round : ""}</p>
      </div>
      {!result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <p style={{ color: T.subtle, fontSize: 12, marginBottom: 8 }}>粘贴面试内容</p>
            <TA value={transcript} onChange={setTranscript} rows={12} variant="card" placeholder={"面试官：请做一个自我介绍\n我：\n\n面试官：你为什么选择我们公司？\n我："}/>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <p style={{ color: T.subtle, fontSize: 11, margin: 0 }}>支持凭记忆整理、会议字幕、语音转文字 · 请确保内容符合当地法规及面试方要求</p>
              {transcript.length > 0 && <button onClick={() => setTranscript("")} style={{ background: "none", border: "none", color: T.subtle, fontSize: 12, cursor: "pointer", fontFamily: T.body, flexShrink: 0, marginLeft: 12 }}>清空</button>}
            </div>
          </div>

          {qs.length > 0 && (
            <div>
              <p style={{ color: T.subtle, fontSize: 12, fontWeight: 500, letterSpacing: "0.06em", marginBottom: 12 }}>本轮模拟题（供参考）</p>
              {qs.map((q, i) => (
                <p key={i} style={{ color: T.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 6 }}>
                  <span style={{ color: T.subtle, marginRight: 8 }}>Q{i+1}</span>{q.question.slice(0, 70)}{q.question.length > 70 ? "..." : ""}
                </p>
              ))}
            </div>
          )}

          {loading ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Spinner/>
                <span style={{ color: T.muted, fontSize: 14 }}>{progress < 50 ? "提取关键问答..." : progress < 92 ? "深度分析中..." : "整理报告..."}</span>
                <span style={{ color: T.subtle, fontSize: 13, marginLeft: "auto" }}>{progress}%</span>
              </div>
              <div style={{ height: 1, background: T.border }}><div style={{ height: "100%", background: T.accent, width: progress+"%", transition: "width 0.4s ease" }}/></div>
            </div>
          ) : (
            <Btn onClick={analyze} disabled={!transcript.trim() || loading} size="lg" full>开始深度分析</Btn>
          )}
          {error && <p style={{ color: T.red, fontSize: 14, borderLeft: "2px solid " + T.red, paddingLeft: 12 }}>{error}</p>}
        </div>
      )}

      {result && (() => {
        const sc = scoreCol(result.overallScore);
        const Section = ({ title, children }) => (
          <div style={{ paddingTop: 40, marginTop: 40, borderTop: "1px solid " + T.border }}>
            <p style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted, fontWeight: 500, marginBottom: 24 }}>{title}</p>
            {children}
          </div>
        );
        const Lines = ({ items, color }) => (
          <div>
            {items.map((s,i) => (
              <div key={i} style={{ display: "flex", gap: 16, paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid " + T.border }}>
                <span style={{ color: T.subtle, fontSize: 11, marginTop: 3, flexShrink: 0, letterSpacing: "0.05em" }}>{"0"+(i+1)}</span>
                <p style={{ color: T.text, fontSize: 14, lineHeight: 1.75, margin: 0 }}>{s}</p>
              </div>
            ))}
          </div>
        );
        return (
          <div>
            {/* Score + Summary */}
            <div style={{ paddingBottom: 40, borderBottom: "1px solid " + T.border }}>
              <div style={{ display: "flex", gap: 20, alignItems: "baseline", marginBottom: 20 }}>
                <span style={{ fontSize: 64, fontWeight: 300, color: sc, fontFamily: T.head, letterSpacing: "-0.03em", lineHeight: 1 }}>{result.overallScore}</span>
                <span style={{ color: T.subtle, fontSize: 14 }}>/ 10</span>
              </div>
              <p style={{ fontSize: 15, color: T.muted, lineHeight: 1.85 }}>{result.summary}</p>
            </div>

            {((result.highlights||[]).length > 0 || (result.weaknesses||[]).length > 0) && (
              <Section title="表现评估">
                {(result.highlights||[]).length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <p style={{ fontSize: 11, color: T.muted, fontWeight: 500, letterSpacing: "0.06em", marginBottom: 16 }}>做得好的地方</p>
                    <Lines items={result.highlights} color={T.green}/>
                  </div>
                )}
                {(result.weaknesses||[]).length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: T.muted, fontWeight: 500, letterSpacing: "0.06em", marginBottom: 16 }}>需要改进</p>
                    <Lines items={result.weaknesses} color={T.yellow}/>
                  </div>
                )}
              </Section>
            )}

            {(result.structureTips || result.businessTips || result.persuasionTips) && (
              <Section title="教练建议">
                {[
                  { label: "回答逻辑", val: result.structureTips },
                  { label: "内容深度", val: result.businessTips },
                  { label: "表达效果", val: result.persuasionTips },
                ].filter(x => x.val).map((x,i,arr) => (
                  <div key={i} style={{ marginBottom: i < arr.length-1 ? 28 : 0 }}>
                    <p style={{ color: T.subtle, fontSize: 11, letterSpacing: "0.08em", marginBottom: 8 }}>{x.label}</p>
                    <p style={{ color: T.text, fontSize: 14, lineHeight: 1.8, margin: 0 }}>{x.val}</p>
                  </div>
                ))}
              </Section>
            )}

            {(result.actionList||[]).length > 0 && (
              <Section title="行动清单">
                <Lines items={result.actionList}/>
              </Section>
            )}

            {(result.nextRoundFocus||[]).length > 0 && (
              <Section title="下轮备考重点">
                <Lines items={result.nextRoundFocus} color={T.accent}/>
              </Section>
            )}

            <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid " + T.border }}>
              <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 20 }}>
                <Btn size="sm" onClick={() => onNextRound && setShowNextRound(true)}>继续下一轮面试 →</Btn>
                <button onClick={() => setResult(null)} style={{ background: "none", border: "none", color: T.subtle, fontSize: 13, cursor: "pointer", fontFamily: T.body, padding: 0 }}>← 重新分析</button>
              </div>
              {showNextRound && (
                <div style={{ paddingTop: 20, borderTop: "1px solid " + T.border }}>
                  <p style={{ color: T.muted, fontSize: 12, fontWeight: 500, letterSpacing: "0.06em", marginBottom: 14 }}>选择下一轮</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["一面","二面","三面","HR面","终面","其他"].map(r => (
                      <button key={r} onClick={() => { setShowNextRound(false); onNextRound(r); }} style={{ background: "transparent", border: "1px solid " + T.border, borderRadius: 4, padding: "6px 14px", color: T.text, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>{r}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div> );
}

//  Claude Vision OCR helper 
async function fileToBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result.split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

async function resizeBase64(b64, maxWidth = 1600, quality = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      res(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
    };
    img.onerror = rej;
    img.src = "data:image/jpeg;base64," + b64;
  });
}

async function ocrImages(files) {
  const msgs = [];
  for (const file of Array.from(files).slice(0, 4)) {
    const raw = await fileToBase64(file);
    const b64 = await resizeBase64(raw);
    msgs.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } });
  }
  msgs.push({ type: "text", text: "请将图片中的所有文字完整提取出来，保持原始排版结构，输出纯文本，不需要添加任何解释或markdown格式。" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, messages: [{ role: "user", content: msgs }] }),
    });
    clearTimeout(timeout);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return (d.content && d.content[0] && d.content[0].text) || "";
  } catch(e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") throw new Error("");
    throw e;
  }
}

//  Word download helper (browser-side) 
function downloadAsWord(text, filename) {
  const esc = (s) => s
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/[^\x00-\x7F]/g, c => {
      const code = c.charCodeAt(0);
      if (code < 32768) return "\\u" + code + "?";
      return "\\u" + (code - 65536) + "?";
    });

  const lines = text.split("\n").map(l => l.trim());
  let body = "";
  let isFirst = true;
  const DATE_RE = /\d{4}[./]\d{2}|\d{4}\s*[-\u2013]\s*(\d{4}|present|\u81f3\u4eca|now)/i;

  for (const line of lines) {
    if (!line) { body += "{\\pard\\sb0\\sa15\\par}\n"; continue; }

    const isName = isFirst;
    const upperLine = line.toUpperCase();
    const isSection =
      !isFirst && line.length < 40 && !DATE_RE.test(line) && (
        /^(EDUCATION|EXPERIENCE|SKILLS|PROFESSIONAL|SUMMARY|WORK|PROJECTS|AWARDS|LANGUAGES|AI|\u6559\u80b2|\u5de5\u4f5c\u7ecf\u5386|\u5b9e\u4e60\u7ecf\u5386|\u6280\u80fd|\u9879\u76ee|\u8363\u8a89|\u8bc1\u4e66|\u8bed\u8a00|\u7ec4\u7ec7|\u6d3b\u52a8)/.test(upperLine) ||
        (line.length < 25 && /^[\u4e00-\u9fa5A-Z]/.test(line) && !/[|\u00b7\u2022\-]/.test(line))
      );
    const isBullet = /^[\u2022\u00b7\-\*]/.test(line);
    const isContact = !isFirst && !isSection && !isBullet && line.includes("|") && line.length < 150 && !DATE_RE.test(line);
    const hasDate = DATE_RE.test(line);

    if (isName) {
      body += "{\\pard\\qc\\sb0\\sa30\\b\\fs24 " + esc(line) + "\\b0\\par}\n";
      isFirst = false;
    } else if (isContact) {
      body += "{\\pard\\qc\\sb0\\sa25\\fs17 " + esc(line) + "\\par}\n";
    } else if (isSection) {
      body += "{\\pard\\sb100\\sa25\\brdrb\\brdrs\\brdrw8\\brdrcf1\\b\\fs20 " + esc(line) + "\\b0\\par}\n";
    } else if (isBullet) {
      const cnt = line.replace(/^[\u2022\u00b7\-\*]\s*/, "");
      body += "{\\pard\\li280\\fi-140\\sb0\\sa15\\fs18 \\bullet  " + esc(cnt) + "\\par}\n";
    } else if (hasDate) {
      const dateMatch = line.match(/(\d{4}[./\s\-\u2013].{3,20}?)\s*$/);
      if (dateMatch) {
        const dateStr = dateMatch[1].trim();
        const mainStr = line.slice(0, line.lastIndexOf(dateStr)).replace(/[|\u00b7\s]+$/, "").trim();
        if (mainStr) {
          body += "{\\pard\\sb40\\sa8\\fs18\\tqr\\tx10800 \\b " + esc(mainStr) + "\\b0\\tab " + esc(dateStr) + "\\par}\n";
        } else {
          body += "{\\pard\\sb40\\sa8\\fs18 " + esc(line) + "\\par}\n";
        }
      } else {
        body += "{\\pard\\sb40\\sa8\\b\\fs18 " + esc(line) + "\\b0\\par}\n";
      }
    } else {
      body += "{\\pard\\sb0\\sa15\\fs18 " + esc(line) + "\\par}\n";
    }
  }

  const rtf = "{\\rtf1\\ansi\\ansicpg936\\deff0\n" +
    "{\\fonttbl{\\f0\\fswiss\\fcharset134 Microsoft YaHei;}{\\f1\\fswiss\\fcharset0 Calibri;}}\n" +
    "{\\colortbl;\\red80\\green80\\blue80;}\n" +
    "{\\*\\generator OfferLab;}\n" +
    "\\paperw12240\\paperh15840\n" +
    "\\margl720\\margr720\\margt600\\margb600\n" +
    "\\widowctrl\\hyphauto\n" +
    "\\f0\\fs18\n" +
    body + "}";

  const blob = new Blob([rtf], { type: "application/rtf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.doc$/, ".rtf");
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

//  App Toolkit:  + 
function AppToolkit({ app, baseResume, resumes = [] }) {
  const [tab, setTab] = useState("greet");
  const [data, setData] = useState(() => {
    try { const s = localStorage.getItem("toolkit:" + app.id); return s ? JSON.parse(s) : {}; } catch(e) { return {}; }
  });
  const [resumeSource, setResumeSource] = useState(data.resumeSource || (baseResume ? "base" : "custom"));
  const [jd, setJd] = useState(data.jd || "");
  const [resume, setResume] = useState(data.resume || "");
  const [jdSaved, setJdSaved] = useState(!!(data.jd && data.jd.trim()));
  const [jdSummary, setJdSummary] = useState(data.jdSummary || "");
  const [resumeSummary, setResumeSummary] = useState(data.resumeSummary || "");
  const [summarizing, setSummarizing] = useState(false);
  const effectiveResume = resumeSource === "custom" ? resume :
    (resumes.find(r => r.id === resumeSource)?.text || (resumeSource === "base" ? baseResume : resume) || "");

  // Greet state
  const [greetings, setGreetings] = useState(data.greetings || []);
  const [greetLoading, setGreetLoading] = useState(false);
  const [greetProgress, setGreetProgress] = useState(0);
  const [genStatus, setGenStatus] = useState("idle"); // idle | running | timeout | done
  const [genStep, setGenStep] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [enGreeting, setEnGreeting] = useState(data.enGreeting || "");
  const [enGreetLoading, setEnGreetLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  // Resume state
  const [suggestions, setSuggestions] = useState(data.suggestions || []);
  const [optimized, setOptimized] = useState(data.optimized || "");
  const [matchScore, setMatchScore] = useState(data.matchScore || null);
  const [matchSummary, setMatchSummary] = useState(data.matchSummary || "");
  const [resumeTab, setResumeTab] = useState("suggestions");
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeProgress, setResumeProgress] = useState(0);
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [wordLoading, setWordLoading] = useState(false);
  const [resumeCopied, setResumeCopied] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);

  const [greetStreamText, setGreetStreamText] = useState("");
  const [resumeStreamText, setResumeStreamText] = useState("");
  const [buildStreamText, setBuildStreamText] = useState("");
  const [greetThinking, setGreetThinking] = useState({ text: "", done: false, elapsed: 0 });
  const [resumeThinking, setResumeThinking] = useState({ text: "", done: false, elapsed: 0 });
  const [buildThinking, setBuildThinking] = useState({ text: "", done: false, elapsed: 0 });

  const persist = (patch) => {
    const next = { ...data, ...patch };
    setData(next);
    try { localStorage.setItem("toolkit:" + app.id, JSON.stringify(next)); } catch(e) {}
  };

  // Poll + progress steps + auto-retry on timeout
  useEffect(() => {
    if (greetings.length > 0 && suggestions.length > 0) return;
    if (!jdSaved) return;
    setGenStatus("running");
    const steps = ["分析 JD 与简历匹配度...", "生成招呼语...", "整理优化建议..."];
    let stepIdx = 0;
    setGenStep(steps[0]);
    let elapsed = 0;
    let retried = false;

    const interval = setInterval(() => {
      elapsed += 2;
      // Rotate through steps for progress feel
      if (elapsed % 4 === 0 && stepIdx < steps.length - 1) {
        stepIdx++;
        setGenStep(steps[stepIdx]);
      }
      try {
        const s = localStorage.getItem("toolkit:" + app.id);
        if (s) {
          const d = JSON.parse(s);
          if ((d.greetings && d.greetings.length)) setGreetings(d.greetings);
          if ((d.suggestions && d.suggestions.length)) {
            setSuggestions(d.suggestions);
            setMatchScore(d.matchScore);
            setMatchSummary(d.matchSummary || "");
          }
          if ((d.greetings && d.greetings.length) && (d.suggestions && d.suggestions.length)) {
            setGenStatus("done");
            clearInterval(interval);
            return;
          }
        }
      } catch(e) {}
      // Auto-retry once at 20s
      if (elapsed === 20 && !retried) {
        retried = true;
        try {
          const stored = JSON.parse(localStorage.getItem("toolkit:" + app.id) || "{}");
          const resumeToUse = stored.effectiveResume || stored.resume || "";
          if (stored.jd && resumeToUse) {
            backgroundGenerate(app.id, app.company, app.role, stored.jd, resumeToUse, stored.resumeSource);
          }
        } catch(e) {}
      }
      // Give up at 45s
      if (elapsed >= 45) {
        setGenStatus("timeout");
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jdSaved]);

  useEffect(() => {
    if (jdSaved && !greetings.length && !greetLoading) generateGreetings();
  }, [jdSaved]);

  const saveJd = async () => {
    setSummarizing(true);
    const [jdSum, resSum] = await Promise.all([
      jd ? summarizeJD(jd) : Promise.resolve(""),
      effectiveResume ? summarizeResume(effectiveResume) : Promise.resolve(""),
    ]);
    setJdSummary(jdSum);
    setResumeSummary(resSum);
    persist({ jd, resume, resumeSource, jdSummary: jdSum, resumeSummary: resSum });
    setSummarizing(false);
    setJdSaved(true);
  };

  //  Greetings 
  const saveEdit = (id, text) => {
    const next = greetings.map(g => g.id === id ? { ...g, custom: text } : g);
    setGreetings(next); persist({ greetings: next }); setEditingId(null);
  };
  const copyGreet = (id, text) => {
    const el = document.createElement("textarea"); el.value = text; el.style.position="fixed"; el.style.opacity="0"; document.body.appendChild(el); el.focus(); el.select(); document.execCommand("copy"); document.body.removeChild(el);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  //  Resume analysis 
  const [autoBuildTimer, setAutoBuildTimer] = useState(null);
  const setStatus = (id, status, custom) => {
    const next = suggestions.map(s => s.id === id ? { ...s, status, custom: custom !== undefined ? custom : s.custom } : s);
    setSuggestions(next); persist({ suggestions: next });
    // Auto-build optimized resume 1.5s after last status change
    const hasAccepted = next.some(s => s.status === "accepted" || s.status === "custom");
    if (hasAccepted && !building) {
      if (autoBuildTimer) clearTimeout(autoBuildTimer);
      const t = setTimeout(() => buildOptimized(next), 1500);
      setAutoBuildTimer(t);
    }
  };

  // Shared stream helper — separates <think> block from answer
  const streamText = async (system, user, maxTokens, onChunk, onThink) => {
    const thinkSystem = system + "\n<think>1-3";
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, stream: true, system: thinkSystem, messages: [{ role: "user", content: user }] })
    });
    let full = "";
    const reader = resp.body.getReader();
    const dec = new TextDecoder("utf-8", { fatal: false });
    let buf = "";
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const d = JSON.parse(line.slice(6));
            if ((d.delta && d.delta.text)) {
              full += d.delta.text;
              // Separate think block from answer
              const thinkEnd = full.indexOf("</think>");
              if (thinkEnd >= 0) {
                const thinkStart = full.indexOf("<think>");
                const thinkText = thinkStart >= 0 ? full.slice(thinkStart + 7, thinkEnd) : "";
                const answer = full.slice(thinkEnd + 8);
                if (onThink) onThink(thinkText, true);
                onChunk(answer);
              } else {
                const thinkStart = full.indexOf("<think>");
                if (thinkStart >= 0 && onThink) {
                  onThink(full.slice(thinkStart + 7), false);
                } else {
                  onChunk(full);
                }
              }
            }
          } catch(e) {}
        }
      }
    }
    // Return only the answer part
    const thinkEnd = full.indexOf("</think>");
    return thinkEnd >= 0 ? full.slice(thinkEnd + 8) : full;
  };

  const generateGreetings = async () => {
    setGreetLoading(true); setGreetProgress(0);
    const timer = setInterval(() => setGreetProgress(p => p < 85 ? p + 5 : p), 300);
    try {
      let gs;
      {
        const raw = await callClaude(
          "你是顶尖求职文案专家，专门写让HR眼前一亮、忍不住回复的招呼语。\n\n写作要求：\n- 180-220字，分3段，第一人称，用中文写\n- 第一段（2-3句）：用最强的一个经历开场，必须包含具体公司名/项目名/数字，让HR立刻知道你是谁\n- 第二段（2-3句）：精准对应JD，直接引用JD中的2-3个关键词，说明你的经历如何匹配这个岗位的核心需求\n- 第三段（1-2句）：表达主动性和对这家公司的了解，体现你做过research，结尾自然有力\n- 禁止：「您好」「贵公司」「非常感兴趣」「期待与您」「希望能」等套话\n- 每句话都要有实质信息，不允许废话\n\n" +
          "公司：" + app.company + "\n职位：" + app.role +
          "\nJD原文（必须引用其中2-3个关键词）：" + (jd||"").slice(0,600) +
          "\n求职者简历（提取最强经历）：" + effectiveResume.slice(0,800) +
          '\n\n返回JSON：{"greetings":[{"id":"g1","text":"招呼语正文（180-220字，中文）","highlight":"3个引用的JD关键词"}]}',
          1000
        );
        const result = extractJSON(raw);
        if (result && result.greetings) gs = result.greetings.map(g => ({ ...g, custom: "" }));
      } // end fetch
      if (gs) {
        clearInterval(timer); setGreetProgress(100); setGreetLoading(false);
        setGreetings(gs); persist({ greetings: gs }); return;
      }
    } catch(e) {}
    clearInterval(timer); setGreetProgress(100); setGreetLoading(false);
  };

  const generateEnGreeting = async () => {
    if (!jd.trim() && !effectiveResume.trim()) return;
    setEnGreetLoading(true);
    try {
      const raw = await callClaude(
        "Write a compelling English greeting message (150-200 words, 3 paragraphs, first person) for a job application.\n\nParagraph 1: Open with your strongest experience - must include specific company name/project/number.\nParagraph 2: Quote 2-3 keywords directly from the JD, explain how your experience matches.\nParagraph 3: Show you researched the company, end confidently.\nNO clichés. Every sentence must have substance.\nOUTPUT ONLY ENGLISH. Do not use any Chinese characters.\n\n" +
        "Company: " + app.company + "\nRole: " + app.role +
        "\nJD keywords to reference: " + (jd||"").slice(0,600) +
        "\nResume (extract strongest points): " + effectiveResume.slice(0,800) +
        '\n\nReturn JSON only: {"text":"your English greeting here"}',
        900,
        { system: "You are an English copywriting expert. Always respond in English only. Output valid JSON with no markdown." }
      );
      const result = extractJSON(raw);
      if (result && result.text) {
        setEnGreeting(result.text);
        persist({ enGreeting: result.text });
      } else if (raw && raw.trim().length > 50) {
        // Fallback: use raw text if JSON parse failed
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const fallback = cleaned.startsWith("{") ? extractJSON(cleaned) : null;
        const text = fallback?.text || cleaned;
        setEnGreeting(text);
        persist({ enGreeting: text });
      }
    } finally { setEnGreetLoading(false); }
  };

  const analyzeResume = async () => {
    if (!effectiveResume.trim()) return;
    setResumeLoading(true); setSuggestions([]); setOptimized(""); setResumeProgress(0);
    const timer = setInterval(() => setResumeProgress(p => p < 85 ? p + 3 : p), 300);
    try {
      let result;
      {
        const raw = await callClaude(
          "你是顶级简历优化顾问，专注于帮助候选人针对特定岗位优化简历。请深度分析以下简历与JD的匹配情况。\n\n分析原则：\n1. 给出5-7条有价值的修改建议，覆盖不同模块\n2. 每条建议必须直接引用简历原文，\"original\"字段必须是简历中实际存在的文字（逐字引用）\n3. \"suggested\"必须是完整的改写后文字，可以直接复制替换原文\n4. \"reason\"必须说明：这条改动对应JD哪个具体要求，为什么能提升匹配度\n5. 优先处理：量化数据补充（加数字/比例/规模）、与JD高频关键词对齐、删除低相关内容、强化核心亮点\n6. 禁止：格式/排版/字体建议；不要建议添加不存在的经历\n7. 语言规则：用与简历相同的语言输出所有建议（简历是英文则全部用英文，简历是中文则全部用中文）\n\n公司：" + app.company + "\n职位：" + app.role + "\nJD全文：" + (jd||"").slice(0,800) + "\nJD要点摘要：" + (jdSummary||"") + "\n\n简历全文：\n" + effectiveResume.slice(0,2500) + '\n\n返回JSON（不含markdown），5-7条建议：{"matchScore":0到100,"matchSummary":"一句话指出最核心的匹配差距和最大优势","suggestions":[{"id":"s1","module":"工作经历/技能/项目/自我介绍","type":"强化/补充/删减/重写","original":"简历原文（完整引用）","suggested":"完整的优化后文字（可直接替换）","reason":"对应JD哪个要求，具体说明价值"}]}',
          3000
        );
        result = extractJSON(raw);
      }
      if (result) {
        const suggs = (result.suggestions||[]).map(s => ({ ...s, custom: "", status: "pending" }));
        setSuggestions(suggs); setMatchScore(result.matchScore); setMatchSummary(result.matchSummary);
        persist({ suggestions: suggs, matchScore: result.matchScore, matchSummary: result.matchSummary });
        setTimeout(() => buildOptimized(suggs), 300);
      }
    } finally { clearInterval(timer); setResumeProgress(100); setTimeout(() => setResumeLoading(false), 300); }
  };

  const buildOptimized = async (allSuggestions) => {
    setBuilding(true); setBuildProgress(10); setBuildStreamText("");
    const src = allSuggestions || suggestions;
    const accepted = src.filter(s => s.status === "accepted" || s.status === "custom");
    const base = effectiveResume || "";
    let cleanText = base;
    setBuildProgress(30);
    if (accepted.length) {
      const changeList = accepted.map(s => `• ${s.original}${(s.custom || s.suggested).replace(/\*\*/g,"").replace(/^#+\s*/gm,"").replace(/^[-*]\s/gm,"")}`).join("\n");
      setBuildProgress(50);
      // Fake progress while waiting
      const timer = setInterval(() => setBuildProgress(p => p < 85 ? p + 3 : p), 400);
      let raw = "";
      try {
        raw = await callClaude(
          `请根据以下修改建议，对简历进行优化。要求：
1. 只修改建议中提到的部分，保持其他内容不变
2. 保持简历整体结构和格式
3. 语言简洁专业
4. 不要添加markdown格式符号
5. 输出完整的优化后简历文本
6. 语言规则：用与原始简历相同的语言输出（简历是英文则用英文，简历是中文则用中文）

原始简历：
${base}

修改建议：
${changeList}

请输出优化后的完整简历：`,
          3000,
          { system: "你是专业简历优化师，直接输出优化后的简历文本，不加任何解释。用与原始简历相同的语言输出。" }
        );
      } finally {
        clearInterval(timer);
      }
      setBuildProgress(90);
      const cleaned = raw.replace(/\*\*/g,"").replace(/\*/g,"").replace(/^#+\s*/gm,"").replace(/^[-]\s/gm,"• ").replace(/\n{3,}/g,"\n\n").trim();
      // Safety check: if output is less than 60% of original length, model rewrote too aggressively — fallback
      cleanText = (cleaned.length >= base.length * 0.6) ? cleaned : base;
    }
    setOptimized(cleanText); persist({ optimized: cleanText });
    setBuildProgress(100);
    setTimeout(() => { setBuilding(false); setBuildProgress(0); setBuildStreamText(""); setResumeTab("preview"); }, 400);
    return cleanText;
  };

  const handleWordDownload = () => {
    if (!optimized) return;
    setWordLoading(true);
    try {
      downloadAsWord(optimized, "_" + (app.company || "") + "_" + (app.role || "") + ".doc".replace(/\s+/g, "_"));
    } catch(e) { console.error("Word", e); }
    finally { setWordLoading(false); }
  };

  const acceptedCount = suggestions.filter(s => s.status === "accepted" || s.status === "custom").length;
  const typeColor = { "强化": T.blue, "补充": T.yellow, "删减": T.green, "重写": T.accent };
  const matchCol = matchScore >= 70 ? T.green : matchScore >= 50 ? T.yellow : T.red;
  const needsJd = !jdSaved;

  return (
    <div style={{ borderTop: "1px solid " + T.border, paddingTop: 28 }}>
      {needsJd ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <p style={{ color: T.text, fontSize: 15, letterSpacing: "-0.01em" }}>填写 JD，AI 将生成招呼语与简历建议</p>
          <div>
            <Label>职位描述 (JD)</Label>
            <TA value={jd} onChange={setJd} rows={4} placeholder="粘贴职位描述..."/>
          </div>
          <div>
            <Label>简历</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {resumes.map(r => (
                <button key={r.id} onClick={() => { setResumeSource(r.id); }}
                  style={{ background: resumeSource === r.id ? T.accent : T.surface, border: "1px solid " + (resumeSource === r.id ? T.accent : T.border), borderRadius: 6, padding: "5px 12px", color: resumeSource === r.id ? "#fff" : T.text, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>
                  {r.name}
                </button>
              ))}
              {resumes.length === 0 && baseResume && (
                <button onClick={() => setResumeSource("base")}
                  style={{ background: resumeSource === "base" ? T.accent : T.surface, border: "1px solid " + (resumeSource === "base" ? T.accent : T.border), borderRadius: 6, padding: "5px 12px", color: resumeSource === "base" ? "#fff" : T.text, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>
                  基础简历
                </button>
              )}
              <button onClick={() => setResumeSource("custom")}
                style={{ background: resumeSource === "custom" ? T.accent : T.surface, border: "1px solid " + (resumeSource === "custom" ? T.accent : T.border), borderRadius: 6, padding: "5px 12px", color: resumeSource === "custom" ? "#fff" : T.text, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>
                手动输入
              </button>
            </div>
            {resumeSource !== "custom" && (() => {
              const found = resumes.find(r => r.id === resumeSource);
              const text = found ? found.text : (resumeSource === "base" ? baseResume : "");
              return text ? <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.7 }}>{text.slice(0, 100)}...</p> : null;
            })()}
            {resumeSource === "custom" && (
              <TA value={resume} onChange={setResume} rows={4} placeholder="粘贴简历内容..."/>
            )}
          </div>
          <div>
            <Btn size="sm" onClick={saveJd} disabled={!jd.trim() || summarizing}>{summarizing ? "分析中..." : "保存并生成"}</Btn>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ color: T.subtle, fontSize: 13 }}>{"JD \u00b7 "}{resumeSource === "base" ? "基础简历" : "自定义简历"}</p>
          <button onClick={() => setJdSaved(false)} style={{ background: "none", border: "none", color: T.accent, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>编辑</button>
        </div>
      )}

      {!needsJd && (
        <>
          <div style={{ display: "flex", gap: 24, marginBottom: 24, borderBottom: "1px solid " + T.border }}>
            {[{ id: "greet", label: "招呼语" }, { id: "resume", label: "简历优化" }].map(t => (
              <button key={t.id} onClick={() => {
                setTab(t.id);
                if (t.id === "greet" && !greetings.length && !greetLoading) generateGreetings();
                if (t.id === "resume" && !suggestions.length && !resumeLoading) analyzeResume();
              }} style={{ background: "none", border: "none", borderBottom: tab === t.id ? "1.5px solid " + T.text : "1.5px solid transparent", marginBottom: -1, color: tab === t.id ? T.text : T.subtle, fontSize: 14, fontWeight: tab === t.id ? 500 : 400, cursor: "pointer", fontFamily: T.body, paddingBottom: 10 }}>{t.label}</button>
            ))}
          </div>
          {tab === "greet" && (
            <div style={{ paddingBottom: 20 }}>
              {greetLoading && (
                <div style={{ paddingBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Spinner/>
                    <span style={{ color: T.muted, fontSize: 13 }}>生成招呼语中...</span>
                    <span style={{ color: T.subtle, fontSize: 12, marginLeft: "auto" }}>{greetProgress}%</span>
                  </div>
                  <div style={{ height: 1, background: T.border }}><div style={{ height: "100%", background: T.accent, width: greetProgress + "%", transition: "width 0.3s ease" }}/></div>
                </div>
              )}
              {greetings.map((g, idx) => (
                <div key={g.id} style={{ marginBottom: 32, paddingBottom: 32, borderBottom: "1px solid " + T.border }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <span style={{ color: T.subtle, fontSize: 12, letterSpacing: "0.04em" }}>招呼语 {idx + 1}</span>
                    {idx === 0 && <button onClick={generateGreetings} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>重新生成</button>}
                  </div>
                  {g.highlight && <p style={{ color: T.accent, fontSize: 13, marginBottom: 10 }}>{g.highlight}</p>}
                  {editingId === g.id ? (
                    <div>
                      <TA value={editDraft} onChange={setEditDraft} rows={4}/>
                      <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                        <Btn size="sm" onClick={() => saveEdit(g.id, editDraft)}>保存</Btn>
                        <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: T.subtle, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ color: T.text, fontSize: 15, lineHeight: 1.9, whiteSpace: "pre-wrap", marginBottom: 14 }}>
                        {(g.custom || g.text).replace(/\*\*/g,"").replace(/^#+\s*/gm,"")}
                      </p>
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <Btn size="sm" onClick={() => copyGreet(g.id, g.custom || g.text)}>{copiedId === g.id ? "✓ 已复制" : "复制"}</Btn>
                        <button onClick={() => { setEditDraft(g.custom || g.text); setEditingId(g.id); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>编辑</button>
                        {g.custom && <button onClick={() => saveEdit(g.id, "")} style={{ background: "none", border: "none", color: T.subtle, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>还原</button>}
                        <button onClick={generateEnGreeting} disabled={enGreetLoading} style={{ background: "none", border: "none", color: T.accent, fontSize: 13, cursor: "pointer", fontFamily: T.body, opacity: enGreetLoading ? 0.5 : 1 }}>{enGreetLoading ? "生成中..." : "英文版"}</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {tab === "greet" && enGreeting && (
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid " + T.border }}>
              <p style={{ color: T.subtle, fontSize: 12, letterSpacing: "0.06em", marginBottom: 12 }}>英文版招呼语</p>
              <p style={{ color: T.text, fontSize: 15, lineHeight: 1.9, whiteSpace: "pre-wrap", marginBottom: 14 }}>{enGreeting}</p>
              <div style={{ display: "flex", gap: 14 }}>
                <Btn size="sm" onClick={() => { navigator.clipboard.writeText(enGreeting); }}>复制英文版</Btn>
                <button onClick={generateEnGreeting} disabled={enGreetLoading} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>{enGreetLoading ? "生成中..." : "重新生成"}</button>
              </div>
            </div>
          )}
          {tab === "resume" && (
            <div style={{ paddingBottom: 24 }}> {resumeLoading && (
                <div style={{ padding: "8px 0 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Spinner/>
                    <span style={{ color: T.muted, fontSize: 14 }}>AI 分析简历中... {resumeProgress}%</span>
                  </div>
                  <div style={{ height: 2, background: T.border, borderRadius: 2 }}>
                    <div style={{ height: "100%", background: T.accent, width: resumeProgress + "%", borderRadius: 2, transition: "width 0.4s ease" }}/>
                  </div>
                </div>
              )}

              {suggestions.length > 0 && (
                <>
                  {matchSummary && (
                    <div style={{ marginBottom: 32, paddingBottom: 28, borderBottom: "1px solid " + T.border }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                        <span style={{ color: matchCol, fontSize: 28, fontWeight: 300, fontFamily: T.head, letterSpacing: "-0.03em" }}>{matchScore}</span>
                        <span style={{ color: T.subtle, fontSize: 13 }}>/ 100 匹配度</span>
                      </div>
                      <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.75 }}>{matchSummary}</p>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
                    <p style={{ color: T.subtle, fontSize: 13 }}>{"优化建议 \u00b7 已采用 "}{acceptedCount}/{suggestions.length}</p>
                    <button onClick={analyzeResume} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>重新分析</button>
                  </div>
                  {suggestions.map((s, i) => {
                    const accepted = s.status === "accepted" || s.status === "custom";
                    const ignored = s.status === "ignored";
                    const typeCol = typeColor[s.type] || T.subtle;
                    return (
                      <div key={s.id} style={{ marginBottom: 20, borderRadius: 8, border: "1px solid " + (accepted ? T.green+"44" : T.border), padding: "20px 20px 16px", opacity: ignored ? 0.3 : 1, transition: "opacity .2s, border-color .2s", background: accepted ? T.greenDim : T.surface }}>
                        {/* Header row: type badge + module + accepted status */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ background: typeCol+"22", color: typeCol, fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", padding: "2px 8px", borderRadius: 4 }}>{s.type}</span>
                            <span style={{ color: T.muted, fontSize: 14, fontWeight: 500 }}>{s.module}</span>
                          </div>
                          {accepted && <span style={{ color: T.green, fontSize: 13 }}>{"✓ 已采用"}</span>}
                        </div>
                        {/* Reason - the "why" - most important context */}
                        <p style={{ color: T.text, fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>{s.reason}</p>
                        {/* Before/After comparison */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                          <div style={{ background: T.bg, borderRadius: 6, padding: "12px 14px" }}>
                            <p style={{ color: T.subtle, fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", marginBottom: 6 }}>原文</p>
                            <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.65 }}>{s.original}</p>
                          </div>
                          <div style={{ background: accepted ? T.green+"11" : T.accentDim, borderRadius: 6, padding: "12px 14px" }}>
                            <p style={{ color: T.subtle, fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", marginBottom: 6 }}>建议改为</p>
                            {editingId === s.id ? (
                              <div>
                                <TA value={editDraft} onChange={setEditDraft} rows={3}/>
                                <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                                  <Btn size="sm" onClick={() => { setStatus(s.id, "custom", editDraft); setEditingId(null); }}>保存</Btn>
                                  <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: T.subtle, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>取消</button>
                                </div>
                              </div>
                            ) : (
                              <p style={{ color: accepted ? T.green : T.text, fontSize: 13, lineHeight: 1.65, fontWeight: accepted ? 400 : 400 }}>
                                {(s.custom || s.suggested).replace(/\*\*/g,"").replace(/^#+\s*/gm,"").replace(/^[-*]\s/gm,"")}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Actions */}
                        {editingId !== s.id && (
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            {!accepted && <Btn size="sm" onClick={() => setStatus(s.id, "accepted")}>采用</Btn>}
                            {accepted && <button onClick={() => setStatus(s.id, "pending")} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>撤销</button>}
                            <button onClick={() => { setEditDraft(s.custom||s.suggested); setEditingId(s.id); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>编辑</button>
                            {!ignored
                              ? <button onClick={() => setStatus(s.id, "ignored")} style={{ background: "none", border: "none", color: T.subtle, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>忽略</button>
                              : <button onClick={() => setStatus(s.id, "pending")} style={{ background: "none", border: "none", color: T.subtle, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>恢复</button>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ paddingTop: 8 }}>
                    {building ? (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <Spinner/>
                          <span style={{ color: T.muted, fontSize: 14 }}>生成优化简历... {buildProgress}%</span>
                        </div>
                        <div style={{ height: 2, background: T.border, borderRadius: 2 }}>
                          <div style={{ height: "100%", background: T.accent, width: buildProgress + "%", borderRadius: 2, transition: "width 0.4s ease" }}/>
                        </div>
                      </div>
                    ) : optimized ? (
                      <p style={{ color: T.green, fontSize: 13, marginBottom: 16 }}>已根据 {acceptedCount} 条建议生成优化简历</p>
                    ) : null}
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <Btn size="sm" disabled={!optimized || building || acceptedCount === 0} onClick={() => { const el = document.createElement("textarea"); el.value = optimized; el.style.position="fixed"; el.style.opacity="0"; document.body.appendChild(el); el.focus(); el.select(); document.execCommand("copy"); document.body.removeChild(el); setResumeCopied(true); setTimeout(() => setResumeCopied(false), 2000); }}>{resumeCopied ? "已复制" : building ? "生成中..." : "复制优化简历"}</Btn>
                      <Btn variant="ghost" size="sm" disabled={!optimized || wordLoading || building || acceptedCount === 0} onClick={() => handleWordDownload()}>{wordLoading ? "生成中..." : "下载 Word"}</Btn>
                      {optimized && !building && acceptedCount > 0 && <button onClick={() => setShowResumePreview(v => !v)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>{showResumePreview ? "收起" : "预览"}</button>}
                    </div>
                    {showResumePreview && optimized && (
                      <div style={{ marginTop: 20, borderTop: "1px solid " + T.border, paddingTop: 16 }}>
                        <pre style={{ color: T.text, fontSize: 13, lineHeight: 1.9, whiteSpace: "pre-wrap", fontFamily: T.body, maxHeight: 360, overflowY: "auto" }}>{optimized}</pre>
                      </div>
                    )}
                  </div>
                </> )}
            </div> )}
        </> )}
    </div> );
}
//  Application Tracker 
const INTERVIEW_ROUNDS = [
  { id: "first",  label: "一面",  desc: "基础考察 · 技能匹配 · 自我介绍",   focus: "first_round" },
  { id: "second", label: "二面",  desc: "深度技术 · 项目追问 · 案例分析",     focus: "second_round" },
  { id: "third",  label: "三面",  desc: "高管面试 · 战略思维 · 领导力",     focus: "leader_round" },
  { id: "hr",     label: "HR面",  desc: "薪资期望 · 入职时间 · 文化契合",     focus: "hr_round" },
];

const APP_STATUSES = ["已投递", "已读/沟通中", "约面试", "已面试", "已拒绝", "拿到 Offer"];
const STATUS_COLOR = {
  "已投递": T.muted, "已读/沟通中": T.blue, "约面试": T.accent,
  "已面试": T.muted, "已拒绝": T.red, "拿到 Offer": T.green,
};

async function saveApps(apps) {
  try { localStorage.setItem("applications", JSON.stringify(apps)); } catch(e) {}
}
async function loadApps() {
  try { const r = localStorage.getItem("applications"); return r ? JSON.parse(r) : []; } catch(e) { return []; }
}
async function saveBaseResume(r) {
  try { localStorage.setItem("base_resume", r); } catch(e) {}
}
async function loadBaseResume() {
  try { return localStorage.getItem("base_resume") || ""; } catch(e) { return ""; }
}

function newApp(prefill = {}) {
  return { id: "a_" + Date.now(), company: "", role: "", platform: "BOSS", appliedAt: new Date().toISOString().slice(0, 10), status: "", note: "", sessionId: null, ...prefill };
}

// Background generation — runs after addApp, writes results into localStorage
async function extractJDKeywords(jd) {
  if (!jd || jd.length < 200) return jd;
  const result = await callClaude(jd.slice(0, 1500), 300, {
    system: "请提取JD中的核心要求，输出150字以内的中文摘要，包含：岗位职责、必备技能、经验要求。"
  });
  return result || jd.slice(0, 400);
}

async function compressResume(resumeText) {
  if (resumeText.length < 800) return resumeText;
  const result = await callClaude(resumeText.slice(0, 3000), 700, {
    system: "请提取简历核心内容，输出600字以内的中文摘要，包含：工作经历、核心技能、主要成就。"
  });
  return result || resumeText.slice(0, 800);
}

async function backgroundGenerate(appId, company, role, jd, resumeText, resumeSource) {
  if (!(resumeText && resumeText.trim())) { console.warn("backgroundGenerate: empty resumeText"); return; }
  try {
    const existing = JSON.parse(localStorage.getItem("toolkit:" + appId) || "{}");

    // Single call — greetings + analysis in one shot
    const combined = await haikuJSON(
      "你是顶级求职顾问，只输出合法JSON，不含markdown，用中文。",
      `请为以下求职者同时生成：1条高质量的BOSS直聘主动招呼语 + 简历优化建议。\n\n招呼语要求：120字以内，第一人称，开头直接说核心经历（用具体公司名/数字），中间引用JD关键词说明匹配点，禁止套话开头。\n\n简历建议要求：只给3-5条真正有价值的建议，original必须是简历原文，suggested必须是具体改写内容。\n\n公司：${company}\n职位：${role}\nJD核心要求：${jd.slice(0, 500)}\n简历全文：${resumeText.slice(0, 1500)}\n\n返回JSON：{"greetings":[{"id":"g1","text":"招呼语正文","highlight":"核心差异化亮点"}],"matchScore":0到100,"matchSummary":"一句话点出最核心匹配差距","suggestions":[{"id":"s1","module":"工作经历/技能/项目/自我介绍","type":"强化/补充/删减/重写","original":"简历原文","suggested":"具体优化后文字","reason":"为什么这样改"}]}`, 2500
    );

    if (combined) {
      const next = {
        ...existing,
        greetings: (existing.greetings && existing.greetings.length) ? existing.greetings : (combined.greetings||[]).map(g => ({ ...g, custom: "" })),
        suggestions: (combined.suggestions||[]).map(s => ({ ...s, custom: "" })),
        matchScore: combined.matchScore || null,
        matchSummary: combined.matchSummary || "",
      };
      localStorage.setItem("toolkit:" + appId, JSON.stringify(next));
    }
  } catch(e) { console.error("Background generate failed:", e); }
}

function AppTracker({ sessions, onStartPrep }) {
  const [apps, setApps] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(newApp());
  const [draftJd, setDraftJd] = useState("");
  const [draftResumeSource, setDraftResumeSource] = useState("base");
  const [draftResume, setDraftResume] = useState("");
  const [jumpPromptApp, setJumpPromptApp] = useState(null);
  const [filterStatus, setFilterStatus] = useState("全部");
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [resumes, setResumes] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("resume_library") || "null");
      if (stored && Array.isArray(stored)) return stored;
      // Migrate old single resume
      const old = localStorage.getItem("base_resume");
      if (old) return [{ id: "r1", name: "默认简历", text: old }];
      return [];
    } catch(e) { return []; }
  });
  const [editingResumeId, setEditingResumeId] = useState(null);
  const [resumeDraft, setResumeDraft] = useState("");
  const [resumeNameDraft, setResumeNameDraft] = useState("");
  const [addingResume, setAddingResume] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const resumeImgRef = useRef();

  const saveResumes = (list) => {
    localStorage.setItem("resume_library", JSON.stringify(list));
    // Keep base_resume in sync for backward compat
    if (list.length > 0) localStorage.setItem("base_resume", list[0].text);
  };

  // baseResume = first resume text for backward compat
  const baseResume = resumes.length > 0 ? resumes[0].text : "";

  useEffect(() => {
    loadApps().then(setApps);
  }, []);

  const persist = (next) => { setApps(next); saveApps(next); };
  const addApp = () => {
    if (!draft.company || !draft.role) return;
    const newA = { ...draft, id: "a_" + Date.now() };
    persist([newA, ...apps]);
    // Save JD + resume into toolkit storage so AppToolkit loads them immediately
    const effectiveResume = draftResumeSource === "custom" ? draftResume :
      (resumes.find(r => r.id === draftResumeSource)?.text || (draftResumeSource === "base" ? baseResume : draftResume) || "");
    const toolkitData = { jd: draftJd, resume: draftResume, resumeSource: draftResumeSource, effectiveResume };
    try { localStorage.setItem("toolkit:" + newA.id, JSON.stringify(toolkitData)); } catch(e) {}
    // Kick off background generation if JD provided
    if (draftJd.trim() && effectiveResume.trim()) {
      backgroundGenerate(newA.id, newA.company, newA.role, draftJd, effectiveResume, draftResumeSource);
    }
    setDraft(newApp()); setDraftJd(""); setDraftResume(""); setAdding(false);
    setExpandedId(newA.id);
  };
  const updateStatus = (id, status) => {
    persist(apps.map(a => a.id === id ? { ...a, status } : a));
    if (status === "约面试") {
      const app = apps.find(a => a.id === id);
      if (app) setJumpPromptApp(app);
    }
  };
  const deleteApp = (id) => { persist(apps.filter(a => a.id !== id)); if (expandedId === id) setExpandedId(null); };
  const filtered = filterStatus === "全部" ? apps : apps.filter(a => (a.status || "已投递") === filterStatus);
  const stats = APP_STATUSES.reduce((acc, s) => ({ ...acc, [s]: apps.filter(a => (a.status || "已投递") === s).length }), {});

  return (
    <div>
      <div style={{ marginBottom: 48, paddingBottom: 28, borderBottom: "1px solid " + T.border }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: T.subtle }}>简历库 <span style={{ color: T.dim }}>({resumes.length}/3)</span></p>
          {resumes.length < 3 && !addingResume && (
            <button onClick={() => { setResumeDraft(""); setResumeNameDraft(""); setAddingResume(true); setEditingResumeId(null); }}
              style={{ background: "none", border: "none", color: T.accent, fontSize: 13, cursor: "pointer", fontFamily: T.body, padding: 0 }}>+ 添加简历</button>
          )}
        </div>

        {resumes.map((r) => (
          <div key={r.id} style={{ marginBottom: 12, padding: "12px 14px", background: T.surface, borderRadius: 8, border: "1px solid " + T.border }}>
            {editingResumeId === r.id ? (
              <div>
                <Inp value={resumeNameDraft} onChange={setResumeNameDraft} placeholder="简历名称（如：中文版、英文版、产品岗）"/>
                <div style={{ marginTop: 8 }}>
                  <TA value={resumeDraft} onChange={setResumeDraft} placeholder="粘贴简历文字内容..." rows={6}/>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Btn size="sm" onClick={() => {
                    if (!resumeDraft.trim()) return;
                    const updated = resumes.map(x => x.id === r.id ? { ...x, name: resumeNameDraft || x.name, text: resumeDraft } : x);
                    setResumes(updated); saveResumes(updated); setEditingResumeId(null);
                  }} disabled={!resumeDraft.trim()}>保存</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setEditingResumeId(null)}>取消</Btn>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 2 }}>{r.name}</p>
                  <p style={{ fontSize: 13, color: T.subtle }}>{r.text.length} 字</p>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => { setResumeDraft(r.text); setResumeNameDraft(r.name); setEditingResumeId(r.id); setAddingResume(false); }}
                    style={{ background: "none", border: "none", color: T.accent, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>编辑</button>
                  <button onClick={() => { const updated = resumes.filter(x => x.id !== r.id); setResumes(updated); saveResumes(updated); }}
                    style={{ background: "none", border: "none", color: T.red, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>删除</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {resumes.length === 0 && !addingResume && (
          <p style={{ color: T.subtle, fontSize: 13 }}>还没有简历，点「添加简历」上传</p>
        )}

        {addingResume && (
          <div style={{ padding: "16px 18px", background: T.surface, borderRadius: 10, border: "1px solid " + T.border }}>
            <Inp value={resumeNameDraft} onChange={setResumeNameDraft} placeholder="简历名称（如：中文版、英文版、产品岗）"/>
            <div style={{ marginTop: 16, marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: fileUploading ? "default" : "pointer", padding: "14px", border: "1.5px dashed " + (fileUploading ? T.dim : T.accent + "66"), borderRadius: 8, background: fileUploading ? T.bg : T.accentDim, transition: "all .15s" }}
                onMouseEnter={e => { if (!fileUploading) { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = T.accentDim; }}}
                onMouseLeave={e => { if (!fileUploading) { e.currentTarget.style.borderColor = T.accent + "66"; }}}>
                {fileUploading ? <Spinner/> : <span style={{ fontSize: 16, color: T.accent }}>↑</span>}
                <div>
                  <p style={{ color: fileUploading ? T.subtle : T.accent, fontSize: 13, fontWeight: 500, margin: 0, fontFamily: T.body }}>{fileUploading ? "解析中..." : "上传简历文件"}</p>
                  {!fileUploading && <p style={{ color: T.subtle, fontSize: 11, margin: 0, fontFamily: T.body }}>支持 PDF、Word (.docx)</p>}
                </div>
                <input type="file" accept=".pdf,.docx" style={{ display: "none" }} disabled={fileUploading} onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (!resumeNameDraft) setResumeNameDraft(file.name.replace(/\.[^.]+$/, ""));
                  setFileUploading(true);
                  setFileError("");
                  if (file.size > 4 * 1024 * 1024) {
                    setFileError("文件过大（最大 4MB），请直接粘贴文字");
                    setFileUploading(false);
                    e.target.value = "";
                    return;
                  }
                  const isPdf = file.name.toLowerCase().endsWith(".pdf");
                  if (isPdf) {
                    const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
                    const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
                    const loadScript = (src) => new Promise((resolve, reject) => {
                      if (document.querySelector("script[data-pdfjs]")) { resolve(); return; }
                      const s = document.createElement("script");
                      s.src = src; s.setAttribute("data-pdfjs", "1");
                      s.onload = resolve; s.onerror = reject;
                      document.head.appendChild(s);
                    });
                    loadScript(PDFJS_CDN)
                      .then(function() {
                        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
                        return file.arrayBuffer();
                      })
                      .then(function(ab) {
                        return window.pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
                      })
                      .then(function(pdf) {
                        var pages = [];
                        for (var i = 1; i <= pdf.numPages; i++) pages.push(i);
                        return pages.reduce(function(chain, pageNum) {
                          return chain.then(function(texts) {
                            return pdf.getPage(pageNum).then(function(page) {
                              return page.getTextContent();
                            }).then(function(tc) {
                              texts.push(tc.items.map(function(it) { return it.str; }).join(" "));
                              return texts;
                            });
                          });
                        }, Promise.resolve([]));
                      })
                      .then(function(texts) {
                        var text = texts.join("\n").trim();
                        if (!text || text.length < 30) {
                          setFileError("PDF 内容无法读取，请直接粘贴文字");
                        } else {
                          setResumeDraft(text);
                        }
                      })
                      .catch(function() { setFileError("PDF 解析失败，请直接粘贴文字"); })
                      .finally(function() { setFileUploading(false); e.target.value = ""; });
                  } else {
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                      const base64 = ev.target.result.split(",")[1];
                      fetch("/api/parse-resume", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ fileData: base64, fileName: file.name }),
                      })
                        .then(function(r) {
                          if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || "服务器错误 " + r.status); });
                          return r.json();
                        })
                        .then(function(d) {
                          if (d.text) setResumeDraft(d.text);
                          else setFileError(d.error || "解析失败，请直接粘贴文字");
                        })
                        .catch(function(err) { setFileError(err.message || "上传失败，请直接粘贴文字"); })
                        .finally(function() { setFileUploading(false); e.target.value = ""; });
                    };
                    reader.readAsDataURL(file);
                  }
                }}/>
              </label>
              {fileError && <p style={{ color: T.red, fontSize: 12, margin: "6px 0 0", fontFamily: T.body }}>{fileError}</p>}
              {resumeDraft && !fileUploading && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: T.greenDim, borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: T.green, fontSize: 13 }}>✓</span>
                  <span style={{ color: T.green, fontSize: 12, fontFamily: T.body }}>已识别 {resumeDraft.length} 字，可在下方确认或修改</span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 6 }}>
              <p style={{ color: T.subtle, fontSize: 11, marginBottom: 4, fontFamily: T.body }}>或直接粘贴文字内容</p>
              <TA value={resumeDraft} onChange={setResumeDraft} placeholder="粘贴简历文字内容..." rows={resumeDraft ? 6 : 3}/>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Btn size="sm" onClick={() => {
                if (!resumeDraft.trim()) return;
                const newR = { id: "r_" + Date.now(), name: resumeNameDraft || "简历 " + (resumes.length + 1), text: resumeDraft };
                const updated = [...resumes, newR];
                setResumes(updated); saveResumes(updated); setAddingResume(false); setResumeDraft(""); setResumeNameDraft(""); setFileError("");
              }} disabled={!resumeDraft.trim()}>保存</Btn>
              <Btn variant="ghost" size="sm" onClick={() => { setAddingResume(false); setFileError(""); }}>取消</Btn>
            </div>
          </div>
        )}
      </div>
      {jumpPromptApp && (
        <div style={{ paddingLeft: 16, borderLeft: "2px solid " + T.accent + "66", marginBottom: 40, display: "flex", gap: 20, alignItems: "baseline", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: T.text, fontSize: 15, marginBottom: 3 }}>{jumpPromptApp.company}{" \u00b7 "}{jumpPromptApp.role}</p>
            <p style={{ color: T.muted, fontSize: 14 }}>已约面试，开始备考？</p>
          </div>
          <Btn size="sm" onClick={() => { onStartPrep(null, jumpPromptApp); setJumpPromptApp(null); }}>开始准备</Btn>
          <button onClick={() => setJumpPromptApp(null)} style={{ background: "none", border: "none", color: T.subtle, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>{"\u00d7"}</button>
        </div>
      )}
      {apps.length > 0 && (
        <div style={{ display: "flex", gap: 0, marginBottom: 40, borderBottom: "1px solid " + T.border, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {[["全部", apps.length], ["已投递", stats["已投递"]], ["已读/沟通中", stats["已读/沟通中"]], ["约面试", stats["约面试"]], ["已面试", stats["已面试"]], ["拿到 Offer", stats["拿到 Offer"]], ["已拒绝", stats["已拒绝"]]].map(([label, count]) => (
            <button key={label} onClick={() => setFilterStatus(label)} style={{ background: "none", border: "none", borderBottom: filterStatus === label ? "1.5px solid " + T.text : "1.5px solid transparent", marginBottom: -1, cursor: "pointer", padding: "0 0 12px 0", marginRight: 20, fontSize: 13, fontFamily: T.body, color: filterStatus === label ? T.text : T.subtle, fontWeight: filterStatus === label ? 500 : 400, transition: "color .15s", whiteSpace: "nowrap", flexShrink: 0 }}>
              {label}{count > 0 ? <span style={{ color: T.subtle, marginLeft: 4, fontWeight: 400 }}>{count}</span> : ""}
            </button>
          ))}
        </div>
      )}
      {!adding ? (
        <button onClick={() => { setDraft(newApp()); setDraftJd(""); setDraftResumeSource(resumes.length > 0 ? resumes[0].id : "custom"); setDraftResume(""); setAdding(true); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 14, cursor: "pointer", fontFamily: T.body, padding: "0 0 36px 0", display: "block", textAlign: "left", letterSpacing: "-0.01em" }}>
          <span style={{ color: T.subtle, marginRight: 6 }}>+</span> 添加新投递
        </button>
      ) : (
        <div style={{ borderTop: "1px solid " + T.border, paddingTop: 28, marginBottom: 40 }}>
          <p style={{ fontSize: 20, fontWeight: 400, color: T.text, marginBottom: 32, letterSpacing: "-0.02em", fontFamily: T.head }}>新增投递</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div><Label>公司</Label><Inp value={draft.company} onChange={v => setDraft(p => ({ ...p, company: v }))} placeholder="公司名称"/></div>
              <div><Label>职位</Label><Inp value={draft.role} onChange={v => setDraft(p => ({ ...p, role: v }))} placeholder="应聘职位"/></div>
              <div>
                <Label>平台</Label>
                <select value={draft.platform} onChange={e => setDraft(p => ({ ...p, platform: e.target.value }))} style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid " + T.border, padding: "8px 0", color: T.text, fontSize: 15, fontFamily: T.body, outline: "none" }}>
                  {["BOSS直聘", "LinkedIn", "官网", "智联招聘", "前程无忧", "拉勾网", "猎聘", "其他"].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div><Label>投递日期</Label><Inp value={draft.appliedAt} onChange={v => setDraft(p => ({ ...p, appliedAt: v }))} placeholder="2025-03-01"/></div>
            </div>
            <div><Label>备注</Label><Inp value={draft.note} onChange={v => setDraft(p => ({ ...p, note: v }))} placeholder="渠道/备注"/></div>
            <div>
              <Label>职位描述 (JD)</Label>
              <TA value={draftJd} onChange={setDraftJd} rows={4} placeholder="粘贴职位描述 JD..."/>
            </div>
            <div>
              <Label>选择简历</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {resumes.map(r => (
                  <button key={r.id} onClick={() => { setDraftResumeSource(r.id); setDraftResume(r.text); }}
                    style={{ background: draftResumeSource === r.id ? T.accent : T.surface, border: "1px solid " + (draftResumeSource === r.id ? T.accent : T.border), borderRadius: 6, padding: "5px 12px", color: draftResumeSource === r.id ? "#fff" : T.text, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>
                    {r.name}
                  </button>
                ))}
                <button onClick={() => setDraftResumeSource("custom")}
                  style={{ background: draftResumeSource === "custom" ? T.accent : T.surface, border: "1px solid " + (draftResumeSource === "custom" ? T.accent : T.border), borderRadius: 6, padding: "5px 12px", color: draftResumeSource === "custom" ? "#fff" : T.text, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>
                  手动输入
                </button>
              </div>
              {draftResumeSource !== "custom" && (() => {
                const found = resumes.find(r => r.id === draftResumeSource);
                const text = found ? found.text : (draftResumeSource === "base" ? baseResume : "");
                return text ? <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.7, marginTop: 8 }}>{text.slice(0, 100)}...</p> : null;
              })()}
              {draftResumeSource === "custom" && (
                <TA value={draftResume} onChange={setDraftResume} rows={4} placeholder="粘贴简历内容..."/>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Btn size="sm" onClick={addApp} disabled={!draft.company || !draft.role}>添加</Btn>
              <button onClick={() => setAdding(false)} style={{ background: "none", border: "none", color: T.subtle, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {apps.length === 0 && !adding && (
        <div style={{ padding: "48px 0", animation: "fadeUp .5s ease both" }}>
          <p style={{ fontSize: 24, color: T.text, marginBottom: 8, letterSpacing: "-0.03em", fontFamily: T.head, fontWeight: 400 }}>从投递到拿 Offer</p>
          <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.8, marginBottom: 36 }}>三步走完整求职流程，AI 全程辅助</p>
          <div style={{ display: "flex", gap: 12, marginBottom: 40 }}>
            {[
              { n: "01", label: "投递", desc: "记录岗位，生成招呼语" },
              { n: "02", label: "备考", desc: "模拟面试，AI 评分" },
              { n: "03", label: "复盘", desc: "分析表现，改进建议" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, padding: "14px 16px", borderLeft: "2px solid " + T.accent + "55" }}>
                <p style={{ color: T.accent, fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", marginBottom: 8 }}>{s.n}</p>
                <p style={{ color: T.text, fontSize: 15, fontWeight: 500, marginBottom: 5 }}>{s.label}</p>
                <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: T.subtle }}>点击上方「+ 添加新投递」开始</p>
        </div>
      )}
      {filtered.map((a, i) => {
        const linkedSession = sessions.find(s => s.id === a.sessionId);
        const col = STATUS_COLOR[a.status] || T.muted;
        const isExpanded = expandedId === a.id;
        const isConfirmDelete = confirmDeleteId === a.id;
        return (
          <div key={a.id} style={{ borderTop: "1px solid " + T.border, animation: "fadeUp .3s ease both", animationDelay: (i * 0.04) + "s" }}>
            <div style={{ padding: "20px 0", display: "flex", gap: 16, alignItems: "center" }}>
              <div onClick={() => setExpandedId(isExpanded ? null : a.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 4, flexWrap: "nowrap", overflow: "hidden" }}>
                  <p style={{ color: T.text, fontWeight: 500, fontSize: 16, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{a.role}</p>
                  {a.company && <span style={{ color: T.muted, fontSize: 14, whiteSpace: "nowrap", flexShrink: 0 }}>{a.company}</span>}
                  {a.platform && <span style={{ color: T.subtle, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>{a.platform}</span>}
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ color: T.subtle, fontSize: 13 }}>{a.appliedAt}</span>
                  {a.note && <span style={{ color: T.subtle, fontSize: 13 }}>{a.note}</span>}
                </div>
              </div>
              <select value={a.status || "已投递"} onChange={e => updateStatus(a.id, e.target.value)}
                style={{ background: T.surface, border: "1px solid " + col + "66", borderRadius: 6, padding: "4px 8px", color: col, fontSize: 12, fontFamily: T.body, outline: "none", cursor: "pointer", flexShrink: 0 }}>
                {APP_STATUSES.map(s => <option key={s} style={{ background: T.surface, color: T.text }}>{s}</option>)}
              </select>
              {isConfirmDelete ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                  <button onClick={() => { deleteApp(a.id); setConfirmDeleteId(null); }} style={{ background: "none", border: "none", color: T.red, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>删除</button>
                  <button onClick={() => setConfirmDeleteId(null)} style={{ background: "none", border: "none", color: T.subtle, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>取消</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteId(a.id)} style={{ background: "none", border: "none", color: T.subtle, fontSize: 18, cursor: "pointer", padding: "0 4px", flexShrink: 0, lineHeight: 1, opacity: 0.4 }}>{"···"}</button>
              )}
            </div>
            {isExpanded && (
              <div style={{ paddingBottom: 32 }}>
                <AppToolkit app={a} baseResume={baseResume} resumes={resumes}/>
                <div style={{ paddingTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
                  {linkedSession
                    ? <Btn variant="outline" size="sm" onClick={() => onStartPrep(linkedSession)}>继续面试准备</Btn>
                    : <Btn size="sm" onClick={() => onStartPrep(null, a)}>开始面试准备</Btn>
                  }
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div> );
}

//  Root App 
// Phases: 0=面试信息, 1=模拟练习, 2=生成报告(auto-skip), 3=模拟结果, 4=真实复盘
// Steps shown in header: only phases 0,1,3,4 (phase 2 is auto)
const PHASE_LABELS = ["面试信息", "模拟练习", "模拟结果", "真实复盘"];
// Maps visible step index → actual phase number
const PHASE_STEP_MAP = [0, 1, 3, 4];

function newSession(prefill = {}) {
  return { id: "s_" + Date.now(), createdAt: Date.now(), company: "", role: "", jd: "", resume: "", questions: [], transcript: [], analysis: null, report: "", phase: 0, completedAt: null, interviewDate: "", interviewTime: "", interviewLocation: "", interviewNote: "", interviewRound: "", rounds: [], ...prefill };
}

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState(null);
  const [current, setCurrent] = useState(null);
  const [view, setView] = useState("home");
  const [homeTab, setHomeTab] = useState("tracker");
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = `
      @import url('https://fonts.loli.net/css2?family=Inter:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Courier+Prime&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      body{background:${T.bg};color:${T.text};font-family:${T.body};-webkit-font-smoothing:antialiased;text-align:left;}
      #root{text-align:left;}
      input,textarea,select{font-family:${T.body};color:${T.text};}
      input::placeholder,textarea::placeholder{color:${T.subtle};opacity:1;}
      select option{background:${T.surface};color:${T.text};}
      ::selection{background:${T.accent}22;color:${T.text};}
      @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
      ::-webkit-scrollbar{width:3px;height:3px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:${T.dim};border-radius:99px;}
    `;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  useEffect(() => { loadAllSessions().then(s => { setSessions(s); setLoadingHistory(false); }); }, []);

  const updateCurrent = useCallback((patch) => {
    setCurrent(prev => {
      const next = { ...prev, ...patch };
      saveSession(next);
      setSessions(all => { const idx = all.findIndex(s => s.id === next.id); return idx >= 0 ? all.map(s => s.id === next.id ? next : s) : [next, ...all]; });
      return next;
    });
  }, []);

  const advancePhase = useCallback(() => {
    setCurrent(prev => {
      // Report generated inline in PhaseMock finish button, goes directly to phase 3 (Results)
      const nextPhase = prev.phase === 1 ? 3 : Math.min(prev.phase + 1, 3);
      const next = { ...prev, phase: nextPhase };
      saveSession(next);
      setSessions(all => all.map(s => s.id === next.id ? next : s));
      return next;
    });
    setTimeout(() => window.scrollTo(0, 0), 50);
  }, []);

  const startNextRound = useCallback((nextRoundLabel) => {
    setCurrent(prev => {
      // Create a completely new session — inherit only basic info, not mock/review data
      const next = newSession({
        company: prev.company,
        role: prev.role,
        jd: prev.jd,
        jdSummary: prev.jdSummary,
        resume: prev.resume,
        resumeSummary: prev.resumeSummary,
        interviewRound: nextRoundLabel,
        phase: 0,
      });
      saveSession(next);
      setSessions(all => [next, ...all]);
      return next;
    });
  }, []);

  const handleStartPrep = useCallback((existingSession, appPrefill) => {
    if (existingSession) { setCurrent(existingSession); } else {
      // Pull JD + optimized resume from the app toolkit localStorage
      let prefillJd = "", prefillResume = "";
      if ((appPrefill && appPrefill.id)) {
        try {
          const stored = JSON.parse(localStorage.getItem("toolkit:" + appPrefill.id) || "{}");
          prefillJd = stored.jd || "";
          // Use optimized resume if available, else effectiveResume
          prefillResume = stored.optimized || stored.effectiveResume || stored.resume || "";
        } catch(e) {}
      }
      const s = newSession({
        company: (appPrefill && appPrefill.company) || "",
        role: (appPrefill && appPrefill.role) || "",
        jd: prefillJd,
        resume: prefillResume,
      });
      setCurrent(s); setSessions(all => [s, ...all]); saveSession(s);
    }
    setView("session");
    setTimeout(() => window.scrollTo(0, 0), 50);
  }, []);

  if (view === "home") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg }}>
        <div style={{ padding: "22px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, background: T.bg, borderBottom: "1px solid " + T.border }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="7" fill="#6B7D6D"/>
              <text x="16" y="17" fontFamily="Georgia, serif" fontSize="15" fontWeight="400" fill="white" textAnchor="middle" dominantBaseline="middle">O</text>
              <rect x="7" y="21.5" width="18" height="0.7" fill="white" opacity="0.35"/>
              <text x="16" y="27" fontFamily="Arial, sans-serif" fontSize="4" fontWeight="500" fill="white" textAnchor="middle" letterSpacing="2.5" opacity="0.9">LAB</text>
            </svg>
            <span style={{ color: T.text, fontWeight: 500, fontSize: 15, fontFamily: T.body, letterSpacing: "-0.02em" }}>OfferLab</span>
          </div>
          <Btn size="sm" onClick={() => handleStartPrep(null, {})}>新建面试准备</Btn>
        </div>

        <div style={{ maxWidth: 660, margin: "0 auto", padding: "40px 16px 80px" }}>

          <div style={{ display: "flex", gap: 28, marginBottom: 52, borderBottom: "1px solid " + T.border, paddingBottom: 0 }}>
            {[{ id: "tracker", label: "投递追踪" }, { id: "sessions", label: "面试准备" }].map(t => (
              <button key={t.id} onClick={() => setHomeTab(t.id)} style={{ fontFamily: T.body, background: "transparent", color: homeTab === t.id ? T.text : T.subtle, border: "none", borderBottom: homeTab === t.id ? "1.5px solid " + T.text : "1.5px solid transparent", marginBottom: -1, fontSize: 15, fontWeight: homeTab === t.id ? 500 : 400, cursor: "pointer", transition: "color .15s", padding: "0 0 14px 0" }}>{t.label}</button>
            ))}
          </div>

          {homeTab === "tracker" && <AppTracker sessions={sessions} onStartPrep={handleStartPrep}/>}

          {homeTab === "sessions" && (
            <div>
              {loadingHistory && <div style={{ padding: "32px 0" }}><Spinner/></div>}
              {!loadingHistory && sessions.length === 0 ? (
                <div style={{ padding: "60px 0", animation: "fadeUp .5s ease both" }}>
                  <p style={{ color: T.text, fontSize: 22, fontWeight: 400, marginBottom: 12, letterSpacing: "-0.02em", fontFamily: T.head }}>还没有面试准备记录</p>
                  <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.85, marginBottom: 32 }}>在投递追踪中找到已约面试的岗位，开始备考</p>
                  <Btn onClick={() => setHomeTab("tracker")}>去投递追踪</Btn>
                </div>
              ) : (
                <div>
                  <p style={{ color: T.subtle, fontSize: 13, marginBottom: 32 }}>{sessions.length} 条记录</p>
                  {sessions.map((s, i) => (
                    <div key={s.id} style={{ borderTop: "1px solid " + T.border, animation: "fadeUp .3s ease both", animationDelay: (i * 0.04) + "s" }}>
                      <div style={{ padding: "22px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                        <div style={{ flex: 1, cursor: "pointer", minWidth: 0 }} onClick={() => { setCurrent(s); setView("session"); }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 5 }}>
                            <span style={{ color: T.text, fontWeight: 500, fontSize: 16, letterSpacing: "-0.01em" }}>{s.role || "未命名"}</span>
                            {s.company && <span style={{ color: T.muted, fontSize: 14 }}>{s.company}</span>}
                            {s.interviewRound && <span style={{ color: T.accent, fontSize: 12, background: T.accentDim, padding: "1px 8px", borderRadius: 4 }}>{s.interviewRound}</span>}
                          </div>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span style={{ color: T.subtle, fontSize: 13 }}>{new Date(s.createdAt).toLocaleDateString("zh-CN")}</span>
                            <span style={{ color: s.reviewResult ? T.green : s.analysis ? T.accent : T.subtle, fontSize: 13 }}>
                              {s.reviewResult ? "✓ 复盘完成" : s.analysis ? "模拟得分 " + s.analysis.overallScore + "/10" : "准备中"}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
                          {confirmDeleteSessionId === s.id ? (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); setSessions(all => all.filter(x => x.id !== s.id)); setConfirmDeleteSessionId(null); }} style={{ background: "none", border: "none", color: T.red, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>删除</button>
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteSessionId(null); }} style={{ background: "none", border: "none", color: T.subtle, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>取消</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setCurrent(s); setView("session"); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: T.body }}>{"打开 \u2192"}</button>
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteSessionId(s.id); }} style={{ background: "none", border: "none", color: T.subtle, fontSize: 20, cursor: "pointer", padding: "2px", lineHeight: 1, opacity: 0.4 }}>{"···"}</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "session" && current) {
    const phase = current.phase;
    const phaseVisible = [0, 1, 3, 4];
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return (
      <div style={{ minHeight: "100vh", background: T.bg }}>
        <div style={{ background: T.bg, borderBottom: "1px solid " + T.border, padding: "18px 48px", display: "flex", alignItems: "center", gap: 20, position: "sticky", top: 0, zIndex: 100 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: T.subtle, cursor: "pointer", fontSize: 13, fontFamily: T.body, padding: 0, flexShrink: 0 }}>{"← 返回"}</button>
          <div style={{ width: 1, height: 14, background: T.border }}/>
          <p style={{ color: T.muted, fontSize: 14, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {current.role || "面试准备"}{current.company ? <span style={{ color: T.subtle }}>{" \u00b7 "}{current.company}</span> : ""}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            {PHASE_LABELS.map((label, i) => {
              const actualPhase = PHASE_STEP_MAP[i];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div title={label} onClick={() => updateCurrent({ phase: actualPhase })} style={{ cursor: "pointer" }}>
                    <StepDot n={i+1} active={phase === actualPhase} done={phase > actualPhase && !(phase === 2 && actualPhase === 1)}/>
                  </div>
                  {i < PHASE_LABELS.length - 1 && <div style={{ width: 14, height: 1, background: phase > actualPhase ? T.accent+"44" : T.dim }}/>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ maxWidth: 620, margin: "0 auto", padding: "40px 16px 80px", animation: "fadeUp .3s ease both" }}>
          <p style={{ color: T.subtle, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 40 }}>{PHASE_LABELS[PHASE_STEP_MAP.indexOf(phase)] || ""}</p>

          {/* Scroll to top only when phase changes */}

          {phase === 0 && <PhaseJobInfo session={current} update={updateCurrent} onNext={advancePhase}/>}
          {phase === 1 && <PhaseMock session={current} update={updateCurrent} onNext={advancePhase}/>}
          {phase === 2 && <PhaseAnalysis session={current} update={updateCurrent} onDone={advancePhase}/>}
          {phase === 3 && <PhaseResults session={current} onNextRound={startNextRound} onReview={() => { updateCurrent({ phase: 4 }); setTimeout(() => window.scrollTo(0, 0), 50); }}/>}
          {phase === 4 && <PhaseReview session={current} update={updateCurrent} onBack={() => updateCurrent({ phase: 3 })} onNextRound={startNextRound}/>}
        </div>
      </div>
    );
  }

  return null;
}