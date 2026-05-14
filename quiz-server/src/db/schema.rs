use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quiz {
    pub id: String,
    #[serde(rename = "type")]
    pub quiz_type: String,
    pub class: String,
    pub unit: String,
    pub question: Option<String>,
    pub main_question: Option<String>,
    pub answer: Option<String>,
    pub source: Option<String>,
    pub extracted_year: Option<i32>,
    pub processed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizOption {
    pub id: String,
    pub quiz_id: String,
    pub oid: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubQuestion {
    pub question_id: i32,
    pub question_text: String,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizAnalysis {
    pub id: String,
    pub quiz_id: String,
    pub point: String,
    pub discuss: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizTag {
    pub id: String,
    pub quiz_id: String,
    pub user_id: String,
    pub value: String,
    #[serde(rename = "type")]
    pub tag_type: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizWithDetails {
    #[serde(flatten)]
    pub quiz: Quiz,
    pub options: Vec<QuizOption>,
    pub options_map: Option<std::collections::HashMap<String, Vec<QuizOption>>>,
    pub sub_questions: Option<Vec<SubQuestion>>,
    pub analysis: Option<QuizAnalysis>,
    pub tags: Vec<QuizTag>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QuizFilterMeta {
    pub types: Vec<String>,
    pub classes: Vec<String>,
    pub units: Vec<String>,
    pub sources: Vec<String>,
    pub years: Vec<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Paper {
    pub id: String,
    pub title: String,
    pub quiz_ids: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicPaper {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub quiz_ids: Vec<String>,
    pub quiz_count: i32,
    pub source: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserPaper {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub description: Option<String>,
    pub quiz_ids: Vec<String>,
    pub quiz_count: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PracticeRecord {
    pub id: String,
    pub user_id: String,
    pub quiz_id: String,
    pub quiz_type: String,
    pub quiz_class: String,
    pub user_answer: Option<String>,
    pub is_correct: bool,
    pub time_spent_seconds: i32,
    pub created_at: String,
}

// Practice statistics types

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DailyPracticeStats {
    pub date: String,
    pub total_count: i64,
    pub correct_count: i64,
    pub accuracy: f64,
    pub avg_time_seconds: f64,
    pub by_class: Vec<ClassBreakdown>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ClassBreakdown {
    pub quiz_class: String,
    pub count: i64,
    pub correct_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SubjectPracticeStats {
    pub quiz_class: String,
    pub total_count: i64,
    pub correct_count: i64,
    pub accuracy: f64,
    pub avg_time_seconds: f64,
    pub by_type: Vec<TypeBreakdown>,
    pub by_source: Vec<SourceBreakdown>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TypeBreakdown {
    pub quiz_type: String,
    pub count: i64,
    pub correct_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SourceBreakdown {
    pub source: String,
    pub count: i64,
    pub correct_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PracticeSummary {
    pub total_practiced: i64,
    pub total_correct: i64,
    pub overall_accuracy: f64,
    pub avg_time_seconds: f64,
    pub current_streak: i32,
    pub longest_streak: i32,
    pub total_days_practiced: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CalendarDayData {
    pub date: String,
    pub count: i64,
    pub correct_count: i64,
}

// Paper practice record types

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PaperRecord {
    pub id: String,
    pub user_id: String,
    pub paper_id: String,
    pub score: Option<f64>,
    pub total_questions: i32,
    pub correct_count: i32,
    pub status: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PaperAnswer {
    pub id: String,
    pub paper_record_id: String,
    pub quiz_id: String,
    pub user_answer: Option<String>,
    pub is_correct: bool,
    pub time_spent_seconds: i32,
    pub order_index: i32,
    pub created_at: String,
}

// Discussion types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscussionComment {
    pub id: String,
    pub quiz_id: String,
    pub user_id: String,
    pub parent_id: Option<String>,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscussionCommentWithAuthor {
    pub id: String,
    pub quiz_id: String,
    pub user_id: String,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub parent_id: Option<String>,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscussionCommentWithReplies {
    #[serde(flatten)]
    pub comment: DiscussionCommentWithAuthor,
    pub replies: Vec<DiscussionCommentWithAuthor>,
}
