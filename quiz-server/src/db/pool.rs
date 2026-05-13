use sqlx::postgres::PgPoolOptions;

pub type PgPool = sqlx::PgPool;

pub async fn create_postgres_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
}
