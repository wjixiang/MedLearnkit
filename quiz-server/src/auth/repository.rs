use async_trait::async_trait;

use crate::auth::models::{AuthMethod, User};
use crate::error::AppError;

#[async_trait]
pub trait AuthRepository: Send + Sync {
    async fn create_user(&self, email: &str, username: Option<&str>) -> Result<User, AppError>;
    async fn get_user_by_id(&self, id: &str) -> Result<Option<User>, AppError>;
    async fn get_user_by_email(&self, email: &str) -> Result<Option<User>, AppError>;
    async fn update_user(
        &self,
        id: &str,
        username: Option<&str>,
        avatar_url: Option<&str>,
    ) -> Result<User, AppError>;

    async fn create_auth_method(
        &self,
        user_id: &str,
        provider: &str,
        provider_id: Option<&str>,
        password_hash: Option<&str>,
    ) -> Result<String, AppError>;
    async fn get_auth_method_by_email(&self, email: &str) -> Result<Option<AuthMethod>, AppError>;

    async fn is_user_admin(&self, id: &str) -> Result<bool, AppError>;
}
