# 题库系统重新设计 - 实施计划

## 概述
重新设计 quiz-ui 和 quiz-server 的操作逻辑，采用"题库浏览器 + 练习会话"两层架构。
前端使用 react-router，题目详情用右侧抽屉面板展示。

## 后端改动 (quiz-server)

### 1. `src/services/quiz_service.rs` - 新增请求类型
- `QuizFilter` 增加 `include_details: Option<bool>` 字段
- 新增 `BatchIdsRequest { quiz_ids: Vec<String> }`
- 新增 `CreateQuizSetRequest { title: String, quiz_ids: Option<Vec<String>> }`
- 新增 `AddQuizzesToSetRequest { quiz_ids: Vec<String> }`
- 新增 `SubmitPracticeRequest { records: Vec<PracticeRecordInput> }`
- 新增 `PracticeRecordInput { quiz_id, user_answer, is_correct }`

### 2. `src/db/schema.rs` - 新增数据结构
- `PracticeRecord { id, quiz_id, user_answer, is_correct, practiced_at }`
- `QuizSet { id, title, created_at }`
- `QuizSetQuiz { id, quiz_set_id, quiz_id }`

### 3. `src/repository/mod.rs` - 扩展 QuizRepository trait
新增方法:
- `get_quizzes_with_details(&self, filter: &QuizFilter) -> Result<(Vec<QuizWithDetails>, u32), AppError>`
- `get_quizzes_by_ids(&self, ids: &[String]) -> Result<Vec<QuizWithDetails>, AppError>`
- `create_quiz_set(&self, title: &str, quiz_ids: &[String]) -> Result<String, AppError>`
- `list_quiz_sets(&self, page: u32, limit: u32) -> Result<(Vec<QuizSet>, u32), AppError>`
- `get_quiz_set(&self, id: &str) -> Result<Option<QuizSetWithQuizzes>, AppError>`
- `delete_quiz_set(&self, id: &str) -> Result<(), AppError>`
- `add_quizzes_to_set(&self, set_id: &str, quiz_ids: &[String]) -> Result<(), AppError>`
- `remove_quiz_from_set(&self, set_id: &str, quiz_id: &str) -> Result<(), AppError>`
- `submit_practice_records(&self, records: &[(String, String, bool)]) -> Result<(), AppError>`
- `get_wrong_quiz_ids(&self) -> Result<Vec<String>, AppError>`
- `get_practice_stats(&self) -> Result<PracticeStats, AppError>`
- `clear_practice_records(&self) -> Result<(), AppError>`

### 4. `src/repository/sqlite.rs` - 实现新方法
- `get_quizzes_with_details`: LEFT JOIN QuizOption/QuizAnalysis/QuizTag, 按 quizId 分组聚合为 JSON 数组
- `get_quizzes_by_ids`: `WHERE id IN (...)` + JOIN 详情
- QuizSet CRUD: 标准 INSERT/SELECT/DELETE
- PracticeRecord: INSERT + SELECT + DELETE

### 5. `src/handlers/quiz.rs` - 新增路由处理
- 修改 `get_quizzes`: 检查 `include_details`，为 true 时调用 `get_quizzes_with_details`
- 新增 `batch_get_quizzes`: POST /api/quizzes/batch
- 新增 `create_quiz_set`: POST /api/quiz-sets
- 新增 `list_quiz_sets`: GET /api/quiz-sets
- 新增 `get_quiz_set`: GET /api/quiz-sets/:id
- 新增 `delete_quiz_set`: DELETE /api/quiz-sets/:id
- 新增 `add_quizzes_to_set`: POST /api/quiz-sets/:id/quizzes
- 新增 `remove_quiz_from_set`: DELETE /api/quiz-sets/:id/quizzes/:quiz_id
- 新增 `submit_practice`: POST /api/practice/records
- 新增 `get_practice_stats`: GET /api/practice/stats
- 新增 `get_wrong_quiz_ids`: GET /api/practice/wrong-ids
- 新增 `clear_practice_records`: DELETE /api/practice/records

### 6. `src/main.rs` - 注册新路由
新增路由:
```
.route("/api/quizzes/batch", post(quiz::batch_get_quizzes))
.route("/api/quiz-sets", post(quiz::create_quiz_set))
.route("/api/quiz-sets", get(quiz::list_quiz_sets))
.route("/api/quiz-sets/:id", get(quiz::get_quiz_set))
.route("/api/quiz-sets/:id", delete(quiz::delete_quiz_set))
.route("/api/quiz-sets/:id/quizzes", post(quiz::add_quizzes_to_set))
.route("/api/quiz-sets/:id/quizzes/:quiz_id", delete(quiz::remove_quiz_from_set))
.route("/api/practice/records", post(quiz::submit_practice))
.route("/api/practice/records", delete(quiz::clear_practice_records))
.route("/api/practice/stats", get(quiz::get_practice_stats))
.route("/api/practice/wrong-ids", get(quiz::get_wrong_quiz_ids))
```

### 7. 数据库迁移
在 SQLite 中执行:
```sql
CREATE TABLE IF NOT EXISTS PracticeRecord (
  id TEXT PRIMARY KEY,
  quizId TEXT NOT NULL,
  userAnswer TEXT NOT NULL,
  isCorrect INTEGER NOT NULL,
  practicedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_practice_quizId ON PracticeRecord(quizId);
CREATE INDEX IF NOT EXISTS idx_practice_isCorrect ON PracticeRecord(isCorrect);

CREATE TABLE IF NOT EXISTS QuizSet (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS QuizSetQuiz (
  id TEXT PRIMARY KEY,
  quizSetId TEXT NOT NULL,
  quizId TEXT NOT NULL,
  UNIQUE(quizSetId, quizId)
);
```

## 前端改动 (quiz-ui)

### 1. 安装依赖
```bash
pnpm add react-router
npx shadcn@latest add sheet dialog badge skeleton scroll-area separator
```

### 2. `src/lib/storage.ts` - localStorage 工具
```ts
const KEYS = {
  BASKET: "quiz-basket",
  FAVORITES: "quiz-favorites",
  SETTINGS: "quiz-settings",
  SESSION: "practice-session",
};
// get/set/remove helpers for each key
```

### 3. `src/lib/api.ts` - 扩展 API 客户端
新增:
- `getQuizzes(filter, includeDetails)` - include_details 参数
- `batchGetQuizzes(ids)` - POST /api/quizzes/batch
- `createQuizSet(title, quizIds)` - POST /api/quiz-sets
- `listQuizSets(page, limit)` - GET /api/quiz-sets
- `getQuizSet(id)` - GET /api/quiz-sets/:id
- `deleteQuizSet(id)` - DELETE /api/quiz-sets/:id
- `submitPractice(records)` - POST /api/practice/records
- `getPracticeStats()` - GET /api/practice/stats
- `getWrongQuizIds()` - GET /api/practice/wrong-ids
- `clearPracticeRecords()` - DELETE /api/practice/records

### 4. `src/lib/types.ts` - 扩展类型
新增:
- `QuizSet`, `QuizSetWithQuizzes`
- `PracticeRecord`, `PracticeStats`
- `BasketState`

### 5. `src/App.tsx` - react-router 路由
```tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<QuizBrowser />} />
    <Route path="/practice" element={<PracticeSession />} />
    <Route path="/practice/:setId" element={<PracticeSession />} />
  </Routes>
</BrowserRouter>
```

### 6. 前端文件结构
```
src/components/
├── quiz/
│   ├── QuizBrowser.tsx        # 首页: 筛选+列表+练习篮浮动栏
│   ├── QuizListItem.tsx       # 列表题目卡片 (带收藏按钮、加入篮按钮)
│   ├── QuizDetailSheet.tsx    # 右侧抽屉: 题目详情 (选项+解析)
│   ├── PracticeBasket.tsx     # 底部浮动: 练习篮预览 + 开始按钮
│   ├── FilterPanel.tsx        # 筛选面板 (增加错题集/收藏夹快捷入口)
│   ├── components/
│   │   ├── OptionItem.tsx     # 保持
│   │   ├── AnswerSection.tsx  # 保持
│   │   ├── QuizAnalysis.tsx   # 保持
│   │   └── QuizPreview.tsx    # 保持
│   └── hooks/
│       └── useQuizLogic.ts    # 保持
├── practice/
│   ├── PracticeSession.tsx    # 练习会话: grid ↔ quiz 切换
│   ├── PracticeGrid.tsx       # 网格总览 (复用 QuizPreview)
│   ├── PracticeQuiz.tsx       # 单题练习 (复用 Quiz.tsx 逻辑)
│   ├── ResultPage.tsx         # 结算页: 正确率/错题/重做
│   └── index.ts
└── ui/
    (现有 + 新增 sheet, scroll-area, separator, skeleton)
```

### 7. 核心交互实现

**题库浏览器 (QuizBrowser)**:
- 顶部: 标题 + 快捷入口按钮 (错题集/收藏夹)
- 筛选栏: FilterPanel (保持)
- 列表: `include_details=true` 一次获取详情, 渲染 QuizListItem
- QuizListItem: 题目摘要 + 收藏星标 + "加入练习篮" 按钮 + 点击打开抽屉
- QuizDetailSheet: shadcn Sheet (右侧), 显示完整题目+选项+解析
- PracticeBasket: fixed 底部栏, 显示篮中题数, "开始练习"/"随机10题" 按钮

**练习会话 (PracticeSession)**:
- URL: /practice 或 /practice/:setId
- 进入时: 创建 QuizSet 或用已有 QuizSet, 获取所有题目详情
- 练习中: 网格总览 → 逐题练习 → 提交 (简单/困难)
- 做题时: 每次提交调用 `submitPractice` API 记录
- 结算: ResultPage 显示统计 + 错题列表 + "重做错题" 按钮

**错题集**:
- 首页 "错题集" 按钮 → 调用 `getWrongQuizIds` → 获取错题详情 → 显示列表
- 等同于带 `quiz_ids` 参数的浏览

## 实施顺序

1. 后端: quiz_service.rs 新增类型
2. 后端: db/schema.rs 新增数据结构
3. 后端: repository/mod.rs 扩展 trait
4. 后端: repository/sqlite.rs 实现
5. 后端: handlers/quiz.rs 新增处理函数
6. 后端: main.rs 注册路由
7. 后端: 创建数据库表 (SQL)
8. 后端: cargo build 验证
9. 前端: 安装依赖 (react-router + shadcn 组件)
10. 前端: lib/storage.ts
11. 前端: lib/api.ts + lib/types.ts
12. 前端: App.tsx 路由
13. 前端: QuizBrowser 重构
14. 前端: QuizListItem + QuizDetailSheet + PracticeBasket
15. 前端: practice/ 目录组件
16. 前端: 错题集/收藏夹
17. 前端: pnpm build 验证
