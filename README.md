# Dutch A2 Blitz

A terminal study tool to help you pass the Dutch A2 **Inburgeringsexamen** (civic integration exam required for permanent residency in the Netherlands).

---

## 🇬🇧 English

### What is the Inburgeringsexamen?

The Dutch civic integration exam tests your Dutch language at **A2 level** and your knowledge of Dutch society. Passing it is required to obtain a permanent residence permit (verblijfsvergunning voor onbepaalde tijd).

The exam has **5 sections**:

| Code | Section | What it tests |
|------|---------|--------------|
| LZ | Lezen (Reading) | Read short Dutch texts, answer questions |
| LU | Luisteren (Listening) | Listen to audio, answer comprehension questions |
| SC | Schrijven (Writing) | Write short texts (forms, messages) |
| SP | Spreken (Speaking) | Speak responses to prompts |
| KNM | Kennis van de Nederlandse Maatschappij | Dutch society, history, law, civic life |

A score of **60% or above** in each section is required to pass.

---

### Requirements

- Python 3.10+
- macOS or Linux (uses terminal raw mode)
- Internet connection (for AI-generated content and audio)

```bash
pip install gTTS anthropic
```

---

### Setup

1. Clone or copy this folder into your Obsidian vault (or anywhere you like)
2. Export your Busuu vocabulary:
   - Log in at busuu.com → go to your vocabulary review page
   - Open DevTools (F12) → Console tab
   - Run the export script from [exportVocabBusuu](https://github.com/joeperpetua/exportVocabBusuu)
   - Save the output as `DutchA2/csv/convertcsv.csv`
3. Add your API key to `DutchA2/scripts/.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

---

### Running

```bash
python3 DutchA2/scripts/main.py
```

---

### How to use it to pass A2

**Recommended daily routine:**

| Step | What to do | Time |
|------|-----------|------|
| 1 | STUDY → Flashcards | 10 min |
| 2 | STUDY → Listening | 15 min |
| 3 | STUDY → Sync Vocab (after new Busuu session) | 2 min |
| 4 | MOCK EXAM → Single section (rotate daily) | 30–45 min |
| 5 | MOCK EXAM → Full exam (once per week) | ~3 hrs |

**Tips:**
- Do **flashcards every day** — spaced repetition (SM-2) is the most efficient way to retain vocabulary
- For **KNM**, study the official [Naar Nederland](https://www.naarnederland.nl) materials alongside the mock exam
- For **Luisteren**, use the AI listening mode in STUDY to train your ear on everyday Dutch dialogue
- For **Schrijven**, practise writing short messages and forms — focus on spelling and basic sentence structure
- Take the **full mock exam** weekly to track your progress. You need 60%+ in every section to pass

---

### File structure

```
DutchA2/
├── scripts/
│   ├── main.py           ← start here
│   ├── listening.py      ← AI dialogue + comprehension quiz
│   ├── flashcard.py      ← SM-2 spaced repetition
│   ├── generate_vocab.py ← rebuild Vocabs.md
│   └── sync_vocab.py     ← sync Busuu CSV → vocab_input.csv
├── vocab_input.csv       ← your vocabulary list
├── audio/                ← Dutch pronunciation MP3s
├── csv/
│   └── convertcsv.csv    ← Busuu export (you provide this)
└── Vocabs.md             ← auto-generated Obsidian vocab note
```

**Your personal exam history** is saved to `~/.dutch_a2_blitz/mock_exam_log.json` — each user on the same machine has their own separate log.

---

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `q` inside a module | Return to main menu |
| `Q` in any main menu | Exit the program |
| `B` | Go back one level |
| `E` during mock exam | End section early, see score |
| `X` during mock exam | Extend timer by 5 minutes |

---

### Roadmap — coming soon

These features are planned and will be added to the tool:

**STUDY mode**
| Feature | Description |
|---------|-------------|
| Reading | AI-generated Dutch A2 texts with comprehension questions |
| Dictation | Listen to a sentence, type what you hear — trains spelling and listening at once |
| Grammar | Targeted drills: de/het, word order, verb conjugation, separable verbs |

**MOCK EXAM mode**
| Feature | Description |
|---------|-------------|
| LZ — Real questions | Load official DUO reading passages from oefenexamen.nl |
| LU — Real audio | Play official DUO listening clips |
| SC — AI grading | Submit your written answer, get AI feedback on grammar and vocabulary |
| SP — Speaking practice | Record or type a spoken response, get AI evaluation |
| KNM — Question bank | Full KNM question bank covering Dutch history, law, and civic life |
| Adaptive difficulty | Sections get harder/easier based on your past scores |

**General**
| Feature | Description |
|---------|-------------|
| Progress dashboard | Visual overview of scores over time per section |
| Weak spot report | Identifies which vocab categories and grammar points need more work |
| Windows support | Currently macOS/Linux only; Windows terminal support planned |

---

---

## 🇨🇳 中文说明

### 什么是 Inburgeringsexamen（入籍考试）？

荷兰公民融合考试（Inburgeringsexamen）测试你的荷兰语 **A2 水平**以及对荷兰社会的了解。通过考试是申请永久居留许可（verblijfsvergunning voor onbepaalde tijd）的必要条件。

考试共有 **5 个部分**：

| 代码 | 科目 | 考察内容 |
|------|------|---------|
| LZ | Lezen（阅读） | 读短文，回答问题 |
| LU | Luisteren（听力） | 听音频，回答理解题 |
| SC | Schrijven（写作） | 写短文（表格、信息） |
| SP | Spreken（口语） | 根据提示说话 |
| KNM | 荷兰社会知识 | 荷兰历史、法律、公民生活 |

每个科目需要达到 **60% 或以上**才算通过。

---

### 环境要求

- Python 3.10 或更高版本
- macOS 或 Linux（需要终端原始模式）
- 网络连接（用于 AI 内容生成和音频）

```bash
pip install gTTS anthropic
```

---

### 初始设置

1. 将此文件夹复制到你的 Obsidian 库或任意位置
2. 导出你的 Busuu 词汇：
   - 登录 busuu.com → 前往词汇复习页面
   - 打开 DevTools（F12）→ Console 标签页
   - 运行 [exportVocabBusuu](https://github.com/joeperpetua/exportVocabBusuu) 中的导出脚本
   - 将结果保存为 `DutchA2/csv/convertcsv.csv`
3. 将 API 密钥添加到 `DutchA2/scripts/.env`：
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

---

### 运行方法

```bash
python3 DutchA2/scripts/main.py
```

---

### 如何用它通过 A2 考试

**推荐每日学习计划：**

| 步骤 | 内容 | 时间 |
|------|------|------|
| 1 | STUDY → 单词卡片复习 | 10 分钟 |
| 2 | STUDY → 听力练习 | 15 分钟 |
| 3 | STUDY → 同步词汇（Busuu 新课后） | 2 分钟 |
| 4 | 模拟考试 → 单科练习（每天轮换） | 30–45 分钟 |
| 5 | 模拟考试 → 完整模拟考（每周一次） | 约 3 小时 |

**备考建议：**
- **每天做单词卡片** — SM-2 间隔重复算法是记忆词汇最高效的方法
- **KNM（社会知识）** 部分建议配合官方 [Naar Nederland](https://www.naarnederland.nl) 材料一起学习
- **听力（Luisteren）** 使用 STUDY 模式中的 AI 对话练习，培养对日常荷兰语的语感
- **写作（Schrijven）** 练习写短消息和填表格，重点是拼写和基本句型
- 每周做一次**完整模拟考试**来跟踪进度。每科 60% 以上才能通过

---

### 文件结构

```
DutchA2/
├── scripts/
│   ├── main.py           ← 从这里启动
│   ├── listening.py      ← AI 对话 + 理解测试
│   ├── flashcard.py      ← SM-2 间隔重复单词卡
│   ├── generate_vocab.py ← 重新生成 Vocabs.md
│   └── sync_vocab.py     ← 同步 Busuu CSV → vocab_input.csv
├── vocab_input.csv       ← 你的词汇表
├── audio/                ← 荷兰语发音 MP3
├── csv/
│   └── convertcsv.csv    ← Busuu 导出文件（需自行提供）
└── Vocabs.md             ← 自动生成的 Obsidian 词汇笔记
```

**个人考试历史**保存在 `~/.dutch_a2_blitz/mock_exam_log.json`——同一台电脑上的每个用户有各自独立的记录。

---

### 快捷键

| 按键 | 功能 |
|------|------|
| 模块内按 `q` | 返回主菜单 |
| 主菜单按 `Q` | 退出程序 |
| `B` | 返回上一级 |
| 模拟考试中按 `E` | 提前结束当前科目，查看得分 |
| 模拟考试中按 `X` | 延长计时 5 分钟 |

---

### 路线图 — 即将推出

以下功能正在开发中：

**STUDY 学习模式**
| 功能 | 说明 |
|------|------|
| 阅读练习 | AI 生成的 A2 荷兰语短文 + 理解题 |
| 听写练习 | 听句子，打出你听到的内容 — 同时训练听力和拼写 |
| 语法练习 | 专项练习：de/het、语序、动词变位、可分动词 |

**模拟考试模式**
| 功能 | 说明 |
|------|------|
| LZ — 真题阅读 | 加载 oefenexamen.nl 官方 DUO 阅读材料 |
| LU — 真题音频 | 播放官方 DUO 听力音频 |
| SC — AI 批改 | 提交书面答案，获得语法和词汇的 AI 反馈 |
| SP — 口语练习 | 录音或打字回答，获得 AI 评分 |
| KNM — 题库 | 涵盖荷兰历史、法律和公民生活的完整 KNM 题库 |
| 自适应难度 | 根据历史成绩自动调整题目难度 |

**通用功能**
| 功能 | 说明 |
|------|------|
| 进度仪表盘 | 各科目历史成绩可视化 |
| 薄弱点分析 | 识别需要加强的词汇类别和语法点 |
| Windows 支持 | 目前仅支持 macOS/Linux，Windows 终端支持计划中 |

---

*Good luck with your exam! Veel succes met je examen! 祝考试顺利！*
