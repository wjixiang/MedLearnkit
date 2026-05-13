use axum::{extract::State, Extension, Json};

use crate::auth::models::{
    AuthResponse, LoginRequest, RegisterRequest, UpdateProfileRequest, UserResponse,
};
use crate::error::AppError;
use crate::state::AppState;

/// Register a new user
#[utoipa::path(
    post,
    path = "/api/auth/register",
    tag = "auth",
    request_body = RegisterRequest,
    responses(
        (status = 200, description = "User registered successfully", body = AuthResponse),
        (status = 400, description = "Invalid request"),
        (status = 409, description = "Email already registered")
    )
)]
pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    if req.email.is_empty() || req.password.is_empty() {
        return Err(AppError::BadRequest("Email and password required".to_string()));
    }

    let existing = state.auth_repo.get_user_by_email(&req.email).await?;
    if existing.is_some() {
        return Err(AppError::Conflict("Email already registered".to_string()));
    }

    let password_hash = crate::auth::password::hash_password(&req.password)?;
    let user = state
        .auth_repo
        .create_user(&req.email, req.username.as_deref())
        .await?;
    state
        .auth_repo
        .create_auth_method(&user.id, "email", None, Some(&password_hash))
        .await?;

    let token = crate::auth::jwt::create_token(&user.id, &state.jwt_secret)?;

    Ok(Json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id,
            email: user.email,
            username: user.username,
            avatar_url: user.avatar_url,
            created_at: user.created_at,
        },
    }))
}

/// Login with email and password
#[utoipa::path(
    post,
    path = "/api/auth/login",
    tag = "auth",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login successful", body = AuthResponse),
        (status = 401, description = "Invalid credentials")
    )
)]
pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    let auth_method = state.auth_repo.get_auth_method_by_email(&req.email).await?;
    let auth_method = auth_method.ok_or(AppError::InvalidCredentials)?;

    let password_hash = auth_method.password_hash.ok_or(AppError::InvalidCredentials)?;
    let valid = crate::auth::password::verify_password(&req.password, &password_hash)?;
    if !valid {
        return Err(AppError::InvalidCredentials);
    }

    let user = state
        .auth_repo
        .get_user_by_id(&auth_method.user_id)
        .await?
        .ok_or(AppError::Internal("User not found".to_string()))?;

    let token = crate::auth::jwt::create_token(&user.id, &state.jwt_secret)?;

    Ok(Json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id,
            email: user.email,
            username: user.username,
            avatar_url: user.avatar_url,
            created_at: user.created_at,
        },
    }))
}

/// Get current user profile
#[utoipa::path(
    get,
    path = "/api/user/profile",
    tag = "auth",
    security(
        ("jwt_auth" = [])
    ),
    responses(
        (status = 200, description = "Profile retrieved", body = UserResponse),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn get_profile(
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
) -> Result<Json<UserResponse>, AppError> {
    let user = state
        .auth_repo
        .get_user_by_id(&user_id)
        .await?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
    }))
}

/// Update current user profile
#[utoipa::path(
    put,
    path = "/api/user/profile",
    tag = "auth",
    security(
        ("jwt_auth" = [])
    ),
    request_body = UpdateProfileRequest,
    responses(
        (status = 200, description = "Profile updated", body = UserResponse),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn update_profile(
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<UserResponse>, AppError> {
    let user = state
        .auth_repo
        .update_user(&user_id, req.username.as_deref(), req.avatar_url.as_deref())
        .await?;

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
    }))
}
