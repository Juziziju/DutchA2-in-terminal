# 口语训练系统 — 产品说明与技术架构

**最后更新**: 2026-03-10

---

## 目录

1. [产品概览](#1-产品概览)
2. [学习方法分类](#2-学习方法分类)
   - 2.1 场景输入学习 (Scene Input)
   - 2.2 录音练习 (Record Practice)
   - 2.3 影子跟读 (Shadow Reading)
   - 2.4 模拟考试 (Mock Exam)
   - 2.5 自由对话 (Freestyle Talk)
   - 2.6 AI 复习 (AI Review)
   - 2.7 进度报告 (Progress Report)
   - 2.8 知识总结 (Knowledge Summary / Notebook)
   - 2.9 自定义场景 (Custom Scene Generation)
3. [录音持久化与管理](#3-录音持久化与管理)
4. [Study Material 口语标签页](#4-study-material-口语标签页)
5. [整体技术栈](#5-整体技术栈)
6. [数据模型](#6-数据模型)
7. [评分体系](#7-评分体系)
8. [环境变量](#8-环境变量)
9. [文件索引](#9-文件索引)

---

## 1. 产品概览

DutchA2 口语训练系统是为备考荷兰语 A2 口语考试设计的全链路练习工具。系统围绕真实考试场景，提供 **9 种学习方法**，覆盖"输入 → 模仿 → 练习 → 反馈 → 复习"完整闭环。

**首页入口**: `/study/speaking` — 以卡片网格展示所有学习模块。

```
┌─────────────────┬─────────────────┐
│ 📖 Scene Input  │ 🎙️ Record       │
│                 │    Practice     │
├─────────────────┼─────────────────┤
│ 🤖 AI Review    │ 📊 Progress     │
│                 │    Report       │
├─────────────────┼─────────────────┤
│ 🔊 Shadow       │ 📓 Knowledge    │
│    Reading      │    Summary      │
├─────────────────┼─────────────────┤
│ 💬 Freestyle    │                 │
│    Talk (BETA)  │                 │
└─────────────────┴─────────────────┘
```

---

## 2. 学习方法分类

---

### 2.1 场景输入学习 (Scene Input)

**目标**: 为每个考试场景提供词汇和句型输入，让学生先"知道说什么"再开口。

**用户流程**:
1. 选择场景（如 Self Introduction / Daily Routine / Shopping）
2. 浏览场景词汇表（荷兰语 + 英文 + 例句）
3. 学习模板句子，点击播放 TTS 发音
4. 准备就绪后进入录音练习

**内置场景 (3 个)**:
| 场景 ID | 名称 | 词汇数 | 句型数 | 短题 | 长题 |
|---------|------|--------|--------|------|------|
| `self_intro` | 自我介绍 | 12 | 6 | 3 | 2 |
| `daily_routine` | 日常作息 | 10 | 7 | 3 | 2 |
| `shopping` | 购物 | ~10 | ~6 | 3 | 2 |

**技术栈**:

| 层 | 技术 |
|---|------|
| 内容源 | `backend/core/speaking_bank.py` — 硬编码的 Python 字典 |
| TTS 引擎 | Microsoft Edge TTS (`edge-tts` 库) |
| TTS 语音 | `nl-NL-ColetteNeural` (荷兰语女声) |
| 音频格式 | MP3, 缓存在 `audio_listening/` 目录 |
| 云存储 | Supabase Storage `listening/` 文件夹 |
| API 端点 | `GET /speaking/scenes`, `GET /speaking/scenes/{id}`, `GET /speaking/tts/{scene_id}/{index}` |
| 前端 | `Speaking.tsx` — `scene_detail` phase |

---

### 2.2 录音练习 (Record Practice)

**目标**: 模拟真实考试流程——看题、准备、录音、获得 AI 反馈。

**用户流程**:
1. 选择场景和练习模式 (scene_drill / mixed_drill)
2. 显示题目（荷兰语 + 英文提示）
3. 准备倒计时（短题 15s / 长题 30s）
4. 录音倒计时（短题 30s / 长题 60s）
5. 上传录音 → 等待 AI 分析
6. 查看反馈：总分、三维子分、匹配/缺失短语、语法错误、改进版答案
7. 连续模式下自动进入下一题

**技术栈**:

| 层 | 技术 |
|---|------|
| 录音 | `useAudioRecorder` hook → `MediaRecorder` API |
| 音频格式 | WebM+Opus (首选) / MP4 (fallback) |
| 文件限制 | 最小 100 bytes, 最大 5MB |
| STT 语音转文字 | Qwen Omni Turbo (`qwen-omni-turbo`) — 音频 base64 编码发送 |
| AI 评分 | Qwen Plus (`qwen-plus`, 可通过 `AI_MODEL` 配置) — temperature 0.3 |
| 本地存储 | `audio_speaking/` 目录 |
| 云存储 | Supabase Storage `speaking/` 文件夹 (提交时自动上传) |
| 数据库 | `SpeakingSession` 表 — 存储转录、反馈 JSON、分数 |
| API 端点 | `POST /speaking/submit-recording` |
| 前端 | `Speaking.tsx` — `prep` → `recording` → `uploading` → `review` phases |
| 倒计时组件 | `CountdownTimer.tsx` |

**AI 评分维度**:
- `vocabulary_score` (0-100): 相关荷兰语词汇和预期短语的使用
- `grammar_score` (0-100): 语序、动词变位、冠词 (A2 水平)
- `completeness_score` (0-100): 回答是否切题完整
- `score` (0-100): 综合总分

---

### 2.3 影子跟读 (Shadow Reading)

**目标**: 通过跟读模板句子训练发音和流利度。

**用户流程**:
1. 选择场景
2. 播放模板句子的 TTS 音频
3. 录音模仿
4. AI 对比原句和学生发音
5. 查看结果：相似度分数、匹配词、缺失词、反馈
6. 逐句完成所有模板句子，最后看汇总报告

**技术栈**:

| 层 | 技术 |
|---|------|
| 原音播放 | Edge TTS 生成的 MP3 |
| 录音 | 同录音练习 (`useAudioRecorder`) |
| STT | Qwen Omni Turbo |
| AI 对比 | Qwen Plus — 逐词比较，temperature 0.3 |
| 评分 | `similarity_score` (0-100) |
| 输出 | `word_matches[]`, `word_misses[]`, 文字反馈 |
| API 端点 | `POST /speaking/submit-shadow` |
| 前端 | `Speaking.tsx` — `shadow_setup` → `shadow_play` → `shadow_record` → `shadow_review` → `shadow_report` |

---

### 2.4 模拟考试 (Mock Exam)

**目标**: 完整模拟 A2 口语考试，连续作答多道题目。

**用户流程**:
1. 选择模拟考试套题
2. 连续回答所有题目（短题 + 长题）
3. 每题独立计时（准备 + 录音）
4. 全部完成后查看总成绩报告

**技术栈**:

| 层 | 技术 |
|---|------|
| 题库 | `backend/core/speaking_bank.py` — 预定义的考试套题 |
| 考试流程 | 前端 `continuous` 模式 — 自动串联所有题目 |
| 录音/评分 | 复用录音练习的完整链路 |
| 模式标识 | `mode: "mock_exam"` |
| API 端点 | `GET /speaking/mock-exams`, `GET /speaking/mock-exams/{id}` |
| 前端 | `Speaking.tsx` — `mock_exam_list` → prep/recording/review cycle → `session_report` |

---

### 2.5 自由对话 (Freestyle Talk)

**目标**: 与 AI 进行开放式荷兰语对话，练习真实交流能力。

**用户流程**:
1. 按住麦克风说话（自动静音检测 1.5s 停止）
2. AI 逐句流式回复（SSE），每句附带 TTS 音频
3. 可以来回多轮对话
4. 可展开查看完整对话历史

**技术栈**:

| 层 | 技术 |
|---|------|
| 录音 | `useAudioRecorder` + 静音检测 (阈值 0.03, 90 帧 ≈ 1.5s) |
| 可视化 | Canvas 动画 — 发光球体 + 卫星 + 轨道点 + 脉冲环 |
| 状态机 | `idle` → `recording` → `processing` → `playing` → `idle` |
| STT | Qwen Omni Turbo |
| 对话 LLM | Qwen Plus — 流式输出 |
| TTS | Edge TTS (`nl-NL-ColetteNeural`) — 逐句生成 |
| 传输 | Server-Sent Events (SSE) 流式传输 |
| SSE 事件 | `transcript` (用户转录) → `sentence` (AI 回复 + 音频文件名) → `done` |
| 音频播放 | 前端队列播放，逐句顺序播放 |
| API 端点 | `POST /speaking/freestyle/chat` |
| 前端页面 | `FreestyleTalk.tsx` — 独立路由 `/study/speaking/freestyle` |

---

### 2.6 AI 复习 (AI Review / History)

**目标**: 回顾过往所有练习记录，查看 AI 反馈详情。

**用户流程**:
1. 查看练习历史列表（按时间倒序）
2. 展开单条记录查看：转录文本、分数、反馈详情
3. 播放录音（如果有）
4. 支持按模式和场景筛选

**技术栈**:

| 层 | 技术 |
|---|------|
| 历史查询 | 分页 API，支持 mode/scene 筛选 |
| 录音回放 | Supabase CDN 公开 URL |
| API 端点 | `GET /speaking/history?page=1&per_page=20&mode=&scene=` |
| 前端 | `HistoryView.tsx` 组件 (在 Speaking.tsx 中使用) |

---

### 2.7 进度报告 (Progress Report)

**目标**: 可视化学习进度，识别薄弱环节，获得 AI 个性化建议。

**数据分析 (纯计算，无 LLM)**:
- **周趋势**: 最近 12 周的平均分、词汇/语法/完整性子分、练习次数
- **薄弱环节**: 过去 30 天三维子分平均值，标出最弱/最强项
- **高频缺失词**: Top 20 未掌握短语 (频次 + 最后出现日期)
- **影子跟读缺失词**: Top 15 发音未匹配词
- **语法错误模式**: Top 10 重复语法错误 + 修正建议
- **模式统计**: 按练习模式和场景分别统计次数
- **周对比**: 本周 vs 上周平均分差值

**AI 洞察 (LLM 驱动)**:
- 总结性描述
- 2-4 个学习模式观察
- 2-3 个聚焦建议
- 推荐下一个自定义场景主题

**技术栈**:

| 层 | 技术 |
|---|------|
| 数据聚合 | `backend/core/speaking_analysis.py` — 纯 Python 计算 |
| AI 洞察 | Qwen Plus — temperature 0.5 |
| API 端点 | `GET /speaking/progress` (快), `GET /speaking/progress/ai-insight` (慢) |
| 前端 | `ProgressReport.tsx` 组件 — 图表 + 列表 + AI 洞察卡片 |

---

### 2.8 知识总结 (Knowledge Summary / Notebook)

**目标**: 类似"单词本"，按场景组织所有已学词汇、句型和最佳录音，方便复习。

**用户流程**:
1. 进入 Knowledge Summary 页面
2. 通过场景过滤 pills 筛选场景
3. 搜索框搜索词汇/句型
4. 展开场景卡片查看：
   - 词汇表（荷兰语 | 英语 | 例句）
   - 模板句子（文本 + 英文翻译 + TTS 播放按钮）
   - 最佳录音（每题最高分的录音 + 播放 + 转录文本）
   - 统计信息（练习次数、平均分、最后练习时间）

**技术栈**:

| 层 | 技术 |
|---|------|
| 数据组装 | 后端合并内置场景 + 自定义场景 + 用户 session 记录 |
| 最佳录音 | Python 端按 question_id 分组取最高分 |
| TTS 播放 | 复用 `/speaking/tts/{scene_id}/{index}` 端点 |
| 录音播放 | Supabase CDN `speaking/` 文件夹 |
| API 端点 | `GET /speaking/notebook` |
| 前端页面 | `SpeakingNotebook.tsx` — 路由 `/study/speaking/notebook` |

---

### 2.9 自定义场景生成 (Custom Scene)

**目标**: 用户输入任意主题，AI 自动生成完整的练习场景。

**用户流程**:
1. 输入主题（英文）和难度等级（A1/A2/B1）
2. AI 生成场景：标题、词汇、句型、短题 + 长题
3. 生成完成后像内置场景一样使用

**等级配置**:
| 等级 | 词汇数 | 句型数 | 短题 | 长题 | 语法范围 |
|------|--------|--------|------|------|---------|
| A1 | 8 | 5 | 3 | 2 | 简单现在时，基础词汇 |
| A2 | 12 | 8 | 4 | 3 | 日常话题，允许过去时 |
| B1 | 15 | 10 | 5 | 4 | 观点表达，比较，复杂句 |

**限制**: 每用户最多 5 个自定义场景 (admin 可绕过)

**技术栈**:

| 层 | 技术 |
|---|------|
| LLM 生成 | Qwen Plus (`backend/core/qwen.py` → `generate_custom_scene()`) |
| 重试策略 | 最多 2 次重试，间隔 1-2s |
| 输出格式 | JSON (title, vocab, model_sentences, exam_questions) |
| 数据库 | `CustomScene` 表 — 存储 JSON 字段 |
| API 端点 | `POST /speaking/custom-scenes` |
| 前端 | `Speaking.tsx` — `create_scene` phase |

---

## 3. 录音持久化与管理

### 上传流程
用户提交录音时 (`submit_recording` / `submit_shadow`):
1. 保存到本地 `audio_speaking/` 目录
2. 同步上传到 Supabase Storage `speaking/` 文件夹
3. 文件名: `{user_id}_{timestamp}.webm` 或 `{user_id}_shadow_{timestamp}.webm`

### 自动清理
服务启动时 (`on_startup`):
- 查询 `date < 7天前 AND audio_file IS NOT NULL` 的 session
- 删除 Supabase 文件 + 本地文件
- 设置 `audio_file = None`

### 手动删除
- `DELETE /speaking/recordings/{session_id}`
- 验证用户所有权
- 删除 Supabase + 本地文件
- 设置 `audio_file = None`，返回 204

---

## 4. Study Material 口语标签页

在 Study Material 页面新增 **Speaking** 标签页:
- 模式筛选 pills: All / Scene Drill / Shadow Reading / Mock Exam
- 分页列表: 分数徽章、场景名、日期、转录预览
- 播放按钮: 从 Supabase CDN 播放录音
- 删除按钮: 调用 DELETE 端点移除录音

---

## 5. 整体技术栈

### 后端
| 组件 | 技术 |
|------|------|
| 框架 | FastAPI + SQLModel |
| 数据库 | SQLite (本地) / PostgreSQL via Supabase (生产) |
| LLM | Qwen 系列 (OpenAI SDK 兼容接口, DashScope) |
| STT | `qwen-omni-turbo` — 音频 base64 编码 |
| AI 评分/分析 | `qwen-plus` (可配置) — JSON 结构化输出 |
| TTS | Microsoft Edge TTS (`edge-tts`) — 4 种荷兰语语音 |
| 文件存储 | Supabase Storage (CDN 分发) + 本地文件系统 |
| 认证 | JWT (python-jose) + bcrypt |

### 前端
| 组件 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS |
| 路由 | React Router v6 |
| 录音 | `MediaRecorder` API (WebM+Opus / MP4) |
| 音频分析 | Web Audio API (`AnalyserNode`) — 静音检测 + 可视化 |
| 可视化 | Canvas 2D — 动态球体动画 (Freestyle Talk) |
| 流式传输 | SSE (Server-Sent Events) — `ReadableStream` |
| 图表 | Recharts (进度报告) |

### 基础设施
| 组件 | 服务 |
|------|------|
| 后端托管 | Render.com |
| 前端托管 | Vercel |
| 数据库 | Supabase PostgreSQL |
| 文件 CDN | Supabase Storage |

---

## 6. 数据模型

### SpeakingSession
```
id            INT PRIMARY KEY
user_id       INT FK → user.id
scene         VARCHAR         -- 场景 ID
question_id   VARCHAR         -- 题目 ID
question_type VARCHAR         -- "short" | "long" | "shadow"
mode          VARCHAR         -- "scene_drill" | "mixed_drill" | "mock_exam" | "shadow_reading"
audio_file    VARCHAR NULL    -- 录音文件名 (7天后自动清除)
transcript    TEXT NULL       -- STT 转录文本
feedback_json TEXT            -- AI 反馈 JSON
score_pct     INT NULL        -- 0-100 分
date          DATETIME
duration_seconds INT NULL
```

### CustomScene
```
id              INT PRIMARY KEY
user_id         INT FK → user.id
scene_id        VARCHAR         -- "custom_{user_id}_{timestamp}"
title_en        VARCHAR
title_nl        VARCHAR
level           VARCHAR         -- "A1" | "A2" | "B1"
vocab_json      TEXT            -- JSON 数组
sentences_json  TEXT            -- JSON 数组
questions_json  TEXT            -- JSON {"short": [], "long": []}
created_at      DATETIME
```

---

## 7. 评分体系

### 录音练习评分 (0-100)
| 维度 | 含义 |
|------|------|
| `vocabulary_score` | 是否使用了相关荷兰语词汇和预期短语 |
| `grammar_score` | 语序、动词变位、冠词是否正确 (A2 标准) |
| `completeness_score` | 回答是否完整切题 |
| `score` | 综合总分 |

### 影子跟读评分 (0-100)
| 维度 | 含义 |
|------|------|
| `similarity_score` | 发音与原句的逐词匹配度 |

### 进度指标
| 指标 | 计算方式 |
|------|---------|
| 周趋势 | 最近 12 周，按周聚合平均分 |
| 薄弱环节 | 30 天内三维子分平均值，取最低项 |
| 缺失词频 | 所有 session 的 missing_phrases 聚合 Top 20 |
| 语法模式 | 重复语法错误聚合 Top 10 |
| 周对比 | 本周 vs 上周平均分 delta |

---

## 8. 环境变量

| 变量 | 用途 |
|------|------|
| `DASHSCOPE_API_KEY` | Qwen LLM / STT API 密钥 |
| `AI_MODEL` | LLM 模型名 (默认 `qwen-plus`) |
| `AI_BASE_URL` | OpenAI 兼容 API 端点 |
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_KEY` | Supabase 服务端密钥 |
| `SUPABASE_AUDIO_BUCKET` | 存储桶名称 |
| `SECRET_KEY` | JWT 签名密钥 |
| `DATABASE_URL` | PostgreSQL 连接串 (缺省用 SQLite) |
| `ALLOWED_ORIGINS` | 额外 CORS 源 |

---

## 9. 文件索引

### 后端
| 文件 | 职责 |
|------|------|
| `backend/routers/speaking.py` | 所有口语 API 路由 (场景/录音/历史/进度/模考/自定义/删除/笔记本) |
| `backend/routers/freestyle.py` | Freestyle Talk SSE 流式对话 |
| `backend/core/speaking_ai.py` | STT 转录 (`transcribe_audio`), AI 评分 (`review_speaking`, `review_shadow`), 模式分析 (`analyze_speaking_patterns`) |
| `backend/core/speaking_analysis.py` | 纯数据聚合：周趋势、薄弱环节、缺失词、语法模式、模式统计 |
| `backend/core/speaking_bank.py` | 内置场景内容 (3 场景 + 模拟考试题库) |
| `backend/core/qwen.py` | Qwen LLM 调用, 自定义场景生成 (`generate_custom_scene`) |
| `backend/core/audio.py` | Edge TTS 生成, 语音分配, 音频上传 |
| `backend/core/storage.py` | Supabase Storage CRUD (`upload_file`, `delete_file`, `public_url`) |
| `backend/models/speaking.py` | `SpeakingSession` 数据模型 |
| `backend/models/custom_scene.py` | `CustomScene` 数据模型 |
| `backend/main.py` | 启动时录音清理 (7 天过期) |

### 前端
| 文件 | 职责 |
|------|------|
| `frontend/src/pages/Speaking.tsx` | 口语主页 + 所有练习阶段 (场景列表/录音/复习/影子跟读/模考/自定义场景/进度) |
| `frontend/src/pages/FreestyleTalk.tsx` | 自由对话页面 (Canvas 动画 + SSE + 音频队列) |
| `frontend/src/pages/SpeakingNotebook.tsx` | 知识总结页面 (按场景浏览词汇/句型/最佳录音) |
| `frontend/src/pages/StudyMaterial.tsx` | Study Material 的 Speaking 标签页 (历史/播放/删除) |
| `frontend/src/hooks/useAudioRecorder.ts` | 录音 hook (`MediaRecorder`, 权限管理, MIME 检测) |
| `frontend/src/components/AudioPlayer.tsx` | 音频播放组件 + `useAudioPlay` hook |
| `frontend/src/components/CountdownTimer.tsx` | 倒计时组件 |
| `frontend/src/components/speaking/HistoryView.tsx` | 练习历史列表组件 |
| `frontend/src/components/speaking/ProgressReport.tsx` | 进度报告组件 (图表 + AI 洞察) |
| `frontend/src/api.ts` | 所有口语相关的 API 类型定义和 fetch 封装 |
| `frontend/src/App.tsx` | 路由: `/study/speaking`, `/study/speaking/notebook`, `/study/speaking/freestyle` |
