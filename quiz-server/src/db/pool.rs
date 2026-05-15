use sqlx::postgres::PgPoolOptions;

pub type PgPool = sqlx::PgPool;

pub async fn create_postgres_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    tracing::info!("Connecting to PostgreSQL database");

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;

    tracing::info!("PostgreSQL connection pool established (max 10 connections)");
    Ok(pool)
}
