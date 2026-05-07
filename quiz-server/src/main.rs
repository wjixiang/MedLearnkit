mod config;
mod db;
mod error;
mod handlers;
mod services;

use axum::{
    routing::{get, post, delete},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber;

use crate::config::Config;
use crate::db::pool::create_pool;
use crate::handlers::{quiz, tag};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let config = Config::default();

    let pool = create_pool(&config.database.path)
        .expect("Failed to create database pool");

    tracing::info!("Starting server on {}:{}", config.server.host, config.server.port);

    let app = Router::new()
        // Quiz endpoints
        .route("/api/quizzes", get(quiz::get_quizzes))
        .route("/api/quizzes/search", get(quiz::search_quizzes))
        .route("/api/quizzes/random", get(quiz::get_random_quizzes))
        .route("/api/quizzes/filter-meta", get(quiz::get_filter_meta))
        .route("/api/quizzes/:id", get(quiz::get_quiz_by_id))
        // Tag endpoints
        .route("/api/tags", get(tag::get_tags))
        .route("/api/quizzes/:id/tags", get(tag::get_quiz_tags))
        .route("/api/quizzes/:id/tags", post(tag::add_tag))
        .route("/api/quizzes/:quiz_id/tags/:tag_id", delete(tag::delete_tag))
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", config.server.host, config.server.port))
        .await
        .expect("Failed to bind to port");

    axum::serve(listener, app)
        .await
        .expect("Server error");
}
