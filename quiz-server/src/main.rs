mod auth;
mod config;
mod db;
mod error;
mod handlers;
mod openapi;
mod repository;
mod services;
mod state;

use std::sync::Arc;

use axum::{
    handler::Handler,
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::auth::handlers::{get_profile, login, register, update_profile};
use crate::auth::middleware::jwt_auth;
use crate::config::Config;
use crate::db::pool::create_postgres_pool;
use crate::handlers::{discussion, paper, paper_record, practice, quiz, stats, tag};
use crate::openapi::ApiDoc;
use crate::repository::postgres::PostgresRepository;
use crate::state::AppState;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let config = Config::default();

    let pool = create_postgres_pool(&config.database.url)
        .await
        .expect("Failed to create PostgreSQL pool");

    let state = AppState {
        quiz_repo: Arc::new(PostgresRepository::new(pool.clone())),
        auth_repo: Arc::new(crate::auth::PostgresAuthRepository::new(pool)),
        jwt_secret: config.jwt.secret,
    };

    tracing::info!(
        "Starting server on {}:{}",
        config.server.host,
        config.server.port
    );

    let app = Router::new()
        // Swagger UI
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        // Auth endpoints (public)
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        // User endpoints (protected)
        .route(
            "/api/user/profile",
            get(get_profile.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/user/profile",
            put(update_profile.layer(middleware::from_fn(jwt_auth))),
        )
        // Quiz endpoints
        .route("/api/quizzes", get(quiz::get_quizzes))
        .route("/api/quizzes/batch", post(quiz::batch_get_quizzes))
        .route("/api/quizzes/search", get(quiz::search_quizzes))
        .route("/api/quizzes/random", get(quiz::get_random_quizzes))
        .route("/api/quizzes/filter-meta", get(quiz::get_filter_meta))
        .route("/api/quizzes/{id}", get(quiz::get_quiz_by_id))
        // Tag endpoints
        .route("/api/tags", get(tag::get_tags))
        .route("/api/quizzes/{id}/tags", get(tag::get_quiz_tags))
        .route("/api/quizzes/{id}/tags", post(tag::add_tag))
        .route(
            "/api/quizzes/{quiz_id}/tags/{tag_id}",
            delete(tag::delete_tag),
        )
        // Discussion endpoints (read public, write protected)
        .route(
            "/api/quizzes/{quiz_id}/comments",
            get(discussion::get_comments),
        )
        .route(
            "/api/quizzes/{quiz_id}/comments",
            post(discussion::create_comment.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/quizzes/{quiz_id}/comments/{comment_id}",
            delete(discussion::delete_comment.layer(middleware::from_fn(jwt_auth))),
        )
        // Paper endpoints (legacy)
        .route("/api/papers", post(paper::create_paper))
        .route("/api/papers", get(paper::get_papers))
        .route("/api/papers/{id}", get(paper::get_paper_by_id))
        .route("/api/papers/{id}", delete(paper::delete_paper))
        // Public papers endpoints
        .route("/api/papers/public", get(paper::get_public_papers))
        .route("/api/papers/public/{id}", get(paper::get_public_paper_by_id))
        // User papers endpoints (protected)
        .route(
            "/api/papers/my",
            get(paper::get_my_papers.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/papers/my",
            post(paper::create_my_paper.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/papers/my/{id}",
            put(paper::update_my_paper.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/papers/my/{id}",
            delete(paper::delete_my_paper.layer(middleware::from_fn(jwt_auth))),
        )
        // Practice record endpoints (protected)
        .route(
            "/api/practices",
            post(practice::create_practice_record.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/practices",
            get(practice::get_practice_records.layer(middleware::from_fn(jwt_auth))),
        )
        // Paper practice record endpoints (protected)
        .route(
            "/api/paper-records",
            post(paper_record::create_paper_record.layer(middleware::from_fn(jwt_auth)))
                .get(paper_record::get_paper_records.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/paper-records/{record_id}",
            put(paper_record::update_paper_record.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/paper-answers",
            post(paper_record::create_paper_answer.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/paper-answers/{record_id}",
            get(paper_record::get_paper_answers.layer(middleware::from_fn(jwt_auth))),
        )
        // Practice statistics endpoints (protected)
        .route(
            "/api/practices/stats/daily",
            get(stats::get_daily_stats.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/practices/stats/subjects",
            get(stats::get_subject_stats.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/practices/stats/summary",
            get(stats::get_summary.layer(middleware::from_fn(jwt_auth))),
        )
        .route(
            "/api/practices/stats/calendar",
            get(stats::get_calendar.layer(middleware::from_fn(jwt_auth))),
        )
        .route_layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    let listener =
        tokio::net::TcpListener::bind(format!("{}:{}", config.server.host, config.server.port))
            .await
            .expect("Failed to bind to port");

    axum::serve(listener, app).await.expect("Server error");
}
