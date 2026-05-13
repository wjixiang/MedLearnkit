use utoipa::OpenApi;

use crate::auth::models::{AuthResponse, LoginRequest, RegisterRequest, UpdateProfileRequest, UserResponse};
use crate::handlers::paper::{CreatePaperRequest, PaperResponse};
use crate::handlers::tag::AddTagRequest;
use crate::repository::FilterMeta;
use crate::services::quiz_service::QuizFilter;

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::auth::handlers::register,
        crate::auth::handlers::login,
        crate::auth::handlers::get_profile,
        crate::auth::handlers::update_profile,
        crate::handlers::quiz::get_quizzes,
        crate::handlers::quiz::batch_get_quizzes,
        crate::handlers::quiz::search_quizzes,
        crate::handlers::quiz::get_random_quizzes,
        crate::handlers::quiz::get_filter_meta,
        crate::handlers::quiz::get_quiz_by_id,
        crate::handlers::tag::get_tags,
        crate::handlers::tag::get_quiz_tags,
        crate::handlers::tag::add_tag,
        crate::handlers::tag::delete_tag,
        crate::handlers::paper::create_paper,
        crate::handlers::paper::get_papers,
        crate::handlers::paper::get_paper_by_id,
        crate::handlers::paper::delete_paper,
    ),
    components(
        schemas(
            RegisterRequest,
            LoginRequest,
            AuthResponse,
            UserResponse,
            UpdateProfileRequest,
            CreatePaperRequest,
            PaperResponse,
            AddTagRequest,
            QuizFilter,
            FilterMeta,
        )
    ),
    tags(
        (name = "auth", description = "Authentication endpoints"),
        (name = "quizzes", description = "Quiz management endpoints"),
        (name = "tags", description = "Tag management endpoints"),
        (name = "papers", description = "Paper management endpoints")
    ),
    info(
        title = "MedQuiz API",
        version = "1.0.0",
        description = "API for MedQuiz medical quiz platform"
    )
)]
pub struct ApiDoc;
