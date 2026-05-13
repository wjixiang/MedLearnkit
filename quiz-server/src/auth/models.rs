use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub username: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct User {
    pub id: String,
    pub email: String,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct AuthMethod {
    pub id: String,
    pub user_id: String,
    pub provider: String,
    pub provider_id: Option<String>,
    pub password_hash: Option<String>,
}
