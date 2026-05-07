use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub database: DatabaseConfig,
    pub server: ServerConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct DatabaseConfig {
    pub path: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            database: DatabaseConfig {
                path: "/mnt/disk3/MedLearnkit/quiz-migrator/data/quiz.db".to_string(),
            },
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 8080,
            },
        }
    }
}
