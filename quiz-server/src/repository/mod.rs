pub mod postgres;

use crate::db::schema::{Quiz, QuizTag, QuizWithDetails, QuizFilterMeta, Paper, PublicPaper, UserPaper, PracticeRecord, DailyPracticeStats, SubjectPracticeStats, PracticeSummary, CalendarDayData, DiscussionCommentWithAuthor, DiscussionCommentWithReplies, PaperRecord, PaperAnswer};
use crate::error::AppError;
use crate::services::quiz_service::QuizFilter;

#[async_trait::async_trait]
pub trait QuizRepository: Send + Sync {
    async fn get_quizzes(&self, filter: &QuizFilter) -> Result<(Vec<Quiz>, u32), AppError>;
    async fn get_quizzes_with_details(&self, filter: &QuizFilter) -> Result<(Vec<QuizWithDetails>, u32), AppError>;
    async fn get_quiz_by_id(&self, id: &str) -> Result<Option<QuizWithDetails>, AppError>;
    async fn get_quizzes_by_ids(&self, ids: &[String]) -> Result<Vec<QuizWithDetails>, AppError>;
    async fn get_random_quizzes(&self, filter: &QuizFilter, limit: u32) -> Result<Vec<Quiz>, AppError>;
    async fn get_filter_meta(&self) -> Result<FilterMeta, AppError>;

    async fn get_tags(&self, search: Option<&str>, limit: u32) -> Result<Vec<String>, AppError>;
    async fn get_quiz_tags(&self, quiz_id: &str) -> Result<Vec<QuizTag>, AppError>;
    async fn add_tag(&self, quiz_id: &str, value: &str, tag_type: &str) -> Result<String, AppError>;
    async fn delete_tag(&self, tag_id: &str) -> Result<(), AppError>;

    // Legacy paper methods (kept for backward compatibility)
    async fn create_paper(&self, title: &str, quiz_ids: &[String]) -> Result<Paper, AppError>;
    async fn get_papers(&self) -> Result<Vec<Paper>, AppError>;
    async fn get_paper_by_id(&self, id: &str) -> Result<Option<Paper>, AppError>;
    async fn delete_paper(&self, id: &str) -> Result<(), AppError>;

    // Public papers (system-level, visible to all users)
    async fn get_public_papers(&self) -> Result<Vec<PublicPaper>, AppError>;
    async fn get_public_paper_by_id(&self, id: &str) -> Result<Option<PublicPaper>, AppError>;

    // User papers (private, only visible to owner)
    async fn get_user_papers(&self, user_id: &str) -> Result<Vec<UserPaper>, AppError>;
    async fn create_user_paper(&self, user_id: &str, title: &str, quiz_ids: &[String]) -> Result<UserPaper, AppError>;
    async fn update_user_paper(&self, id: &str, user_id: &str, title: Option<&str>, description: Option<&str>, quiz_ids: Option<&[String]>) -> Result<UserPaper, AppError>;
    async fn delete_user_paper(&self, id: &str, user_id: &str) -> Result<(), AppError>;

    // Practice records
    async fn create_practice_record(
        &self,
        user_id: &str,
        quiz_id: &str,
        quiz_type: &str,
        quiz_class: &str,
        user_answer: Option<&str>,
        is_correct: bool,
        time_spent_seconds: i32,
    ) -> Result<PracticeRecord, AppError>;
    async fn get_practice_records(
        &self,
        user_id: &str,
        limit: i32,
    ) -> Result<Vec<PracticeRecord>, AppError>;

    // Paper practice records
    async fn create_paper_record(
        &self,
        user_id: &str,
        paper_id: &str,
        total_questions: i32,
    ) -> Result<PaperRecord, AppError>;

    async fn get_paper_records(
        &self,
        user_id: &str,
        paper_id: &str,
    ) -> Result<Vec<PaperRecord>, AppError>;

    async fn get_paper_record_by_id(
        &self,
        id: &str,
    ) -> Result<Option<PaperRecord>, AppError>;

    async fn update_paper_record(
        &self,
        id: &str,
        correct_count: i32,
        score: f64,
        status: &str,
    ) -> Result<PaperRecord, AppError>;

    async fn create_paper_answer(
        &self,
        paper_record_id: &str,
        quiz_id: &str,
        user_answer: Option<&str>,
        is_correct: bool,
        time_spent_seconds: i32,
        order_index: i32,
    ) -> Result<PaperAnswer, AppError>;

    async fn get_paper_answers(
        &self,
        paper_record_id: &str,
    ) -> Result<Vec<PaperAnswer>, AppError>;

    // Practice statistics
    async fn get_practice_daily_stats(
        &self,
        user_id: &str,
        days: i32,
        quiz_class: Option<&str>,
    ) -> Result<Vec<DailyPracticeStats>, AppError>;

    async fn get_practice_subject_stats(
        &self,
        user_id: &str,
        days: i32,
    ) -> Result<Vec<SubjectPracticeStats>, AppError>;

    async fn get_practice_summary(
        &self,
        user_id: &str,
        days: i32,
    ) -> Result<PracticeSummary, AppError>;

    async fn get_practice_calendar(
        &self,
        user_id: &str,
        year: i32,
    ) -> Result<Vec<CalendarDayData>, AppError>;

    // Discussion comments
    async fn get_discussion_comments(
        &self,
        quiz_id: &str,
        page: i32,
        limit: i32,
    ) -> Result<(Vec<DiscussionCommentWithReplies>, i64), AppError>;

    async fn create_discussion_comment(
        &self,
        quiz_id: &str,
        user_id: &str,
        parent_id: Option<&str>,
        content: &str,
    ) -> Result<DiscussionCommentWithAuthor, AppError>;

    async fn delete_discussion_comment(
        &self,
        comment_id: &str,
        user_id: &str,
    ) -> Result<(), AppError>;
}

pub type FilterMeta = QuizFilterMeta;
