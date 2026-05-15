use async_trait::async_trait;
use sqlx::{PgPool, Row};

use crate::auth::models::{AuthMethod, User};
use crate::auth::repository::AuthRepository;
use crate::error::AppError;

pub struct PostgresAuthRepository {
    pool: PgPool,
}

impl PostgresAuthRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AuthRepository for PostgresAuthRepository {
    async fn create_user(&self, email: &str, username: Option<&str>) -> Result<User, AppError> {
        let id = uuid::Uuid::new_v4();
        let row = sqlx::query(
            r#"
            INSERT INTO users (id, email, username)
            VALUES ($1, $2, $3)
            RETURNING id, email, username, avatar_url, is_admin, created_at
            "#,
        )
        .bind(id)
        .bind(email)
        .bind(username)
        .fetch_one(&self.pool)
        .await?;

        Ok(User {
            id: row.get::<uuid::Uuid, _>("id").to_string(),
            email: row.get("email"),
            username: row.get("username"),
            avatar_url: row.get("avatar_url"),
            is_admin: row.get("is_admin"),
            created_at: row.get::<sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>, _>("created_at").to_rfc3339(),
        })
    }

    async fn get_user_by_id(&self, id: &str) -> Result<Option<User>, AppError> {
        let uuid_id: uuid::Uuid = id.parse().map_err(|_| AppError::BadRequest("Invalid UUID".to_string()))?;
        let row = sqlx::query(
            r#"
            SELECT id, email, username, avatar_url, is_admin, created_at
            FROM users WHERE id = $1
            "#,
        )
        .bind(uuid_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| User {
            id: r.get::<uuid::Uuid, _>("id").to_string(),
            email: r.get("email"),
            username: r.get("username"),
            avatar_url: r.get("avatar_url"),
            is_admin: r.get("is_admin"),
            created_at: r.get::<sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>, _>("created_at").to_rfc3339(),
        }))
    }

    async fn get_user_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
        let row = sqlx::query(
            r#"
            SELECT id, email, username, avatar_url, is_admin, created_at
            FROM users WHERE email = $1
            "#,
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| User {
            id: r.get::<uuid::Uuid, _>("id").to_string(),
            email: r.get("email"),
            username: r.get("username"),
            avatar_url: r.get("avatar_url"),
            is_admin: r.get("is_admin"),
            created_at: r.get::<sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>, _>("created_at").to_rfc3339(),
        }))
    }

    async fn update_user(
        &self,
        id: &str,
        username: Option<&str>,
        avatar_url: Option<&str>,
    ) -> Result<User, AppError> {
        let uuid_id: uuid::Uuid = id.parse().map_err(|_| AppError::BadRequest("Invalid UUID".to_string()))?;
        let row = sqlx::query(
            r#"
            UPDATE users
            SET username = COALESCE($2, username),
                avatar_url = COALESCE($3, avatar_url),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, email, username, avatar_url, is_admin, created_at
            "#,
        )
        .bind(uuid_id)
        .bind(username)
        .bind(avatar_url)
        .fetch_one(&self.pool)
        .await?;

        Ok(User {
            id: row.get::<uuid::Uuid, _>("id").to_string(),
            email: row.get("email"),
            username: row.get("username"),
            avatar_url: row.get("avatar_url"),
            is_admin: row.get("is_admin"),
            created_at: row.get::<sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>, _>("created_at").to_rfc3339(),
        })
    }

    async fn create_auth_method(
        &self,
        user_id: &str,
        provider: &str,
        provider_id: Option<&str>,
        password_hash: Option<&str>,
    ) -> Result<String, AppError> {
        let id = uuid::Uuid::new_v4();
        let uuid_user_id: uuid::Uuid = user_id.parse().map_err(|_| AppError::BadRequest("Invalid UUID".to_string()))?;
        sqlx::query(
            r#"
            INSERT INTO user_auth_methods (id, user_id, provider, provider_id, password_hash)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(id)
        .bind(uuid_user_id)
        .bind(provider)
        .bind(provider_id)
        .bind(password_hash)
        .execute(&self.pool)
        .await?;

        Ok(id.to_string())
    }

    async fn get_auth_method_by_email(&self, email: &str) -> Result<Option<AuthMethod>, AppError> {
        let row = sqlx::query(
            r#"
            SELECT uam.id, uam.user_id, uam.provider, uam.provider_id, uam.password_hash
            FROM user_auth_methods uam
            JOIN users u ON u.id = uam.user_id
            WHERE u.email = $1 AND uam.provider = 'email'
            "#,
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| AuthMethod {
            id: r.get::<uuid::Uuid, _>("id").to_string(),
            user_id: r.get::<uuid::Uuid, _>("user_id").to_string(),
            provider: r.get("provider"),
            provider_id: r.get("provider_id"),
            password_hash: r.get("password_hash"),
        }))
    }

    async fn is_user_admin(&self, id: &str) -> Result<bool, AppError> {
        let uuid_id: uuid::Uuid = id
            .parse()
            .map_err(|_| AppError::BadRequest("Invalid UUID".to_string()))?;
        let row = sqlx::query("SELECT is_admin FROM users WHERE id = $1")
            .bind(uuid_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row
            .map(|r| r.get::<bool, _>("is_admin"))
            .unwrap_or(false))
    }
}
