use std::sync::Arc;

use crate::auth::AuthRepository;
use crate::repository::QuizRepository;

#[derive(Clone)]
pub struct AppState {
    pub quiz_repo: Arc<dyn QuizRepository>,
    pub auth_repo: Arc<dyn AuthRepository>,
    pub jwt_secret: String,
}
