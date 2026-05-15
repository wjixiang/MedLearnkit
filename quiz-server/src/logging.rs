use std::fs;
use std::time::Duration;

use chrono::Local;
use tracing_appender::non_blocking;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

const DEFAULT_LOG_DIR: &str = "./logs";
const DEFAULT_RETENTION_DAYS: u64 = 7;

pub struct LogGuard {
    _file_guard: tracing_appender::non_blocking::WorkerGuard,
}

pub fn init() -> LogGuard {
    let log_dir = std::env::var("LOG_DIR").unwrap_or_else(|_| DEFAULT_LOG_DIR.to_string());
    let retention_days = std::env::var("LOG_RETENTION_DAYS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(DEFAULT_RETENTION_DAYS);

    let log_dir_clone = log_dir.clone();
    let guard = init_subscriber(&log_dir);

    spawn_cleanup_task(log_dir_clone, retention_days);

    guard
}

fn init_subscriber(log_dir: &str) -> LogGuard {
    fs::create_dir_all(log_dir).expect("Failed to create log directory");

    cleanup_old_logs(log_dir, DEFAULT_RETENTION_DAYS);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("quiz_server=info,tower_http=debug"));

    let file_appender = tracing_appender::rolling::daily(log_dir, "quiz-server.log");
    let (non_blocking_file, file_guard) = non_blocking(file_appender);

    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            tracing_subscriber::fmt::layer()
                .compact()
                .with_target(true),
        )
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(non_blocking_file)
                .with_ansi(false)
                .with_target(true)
                .with_file(true)
                .with_line_number(true),
        )
        .init();

    LogGuard {
        _file_guard: file_guard,
    }
}

fn cleanup_old_logs(log_dir: &str, retention_days: u64) {
    let cutoff = Local::now() - chrono::Duration::days(retention_days as i64);

    let Ok(entries) = fs::read_dir(log_dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(filename) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };

        if !filename.starts_with("quiz-server.log.") {
            continue;
        }

        let date_str = filename.trim_start_matches("quiz-server.log.");
        if let Ok(file_date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            if file_date < cutoff.date_naive() {
                match fs::remove_file(&path) {
                    Ok(()) => tracing::info!(log_file = filename, "Removed old log file"),
                    Err(e) => {
                        eprintln!("Failed to remove log {}: {}", filename, e)
                    }
                }
            }
        }
    }
}

fn spawn_cleanup_task(log_dir: String, retention_days: u64) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;
            cleanup_old_logs(&log_dir, retention_days);
        }
    });
}
