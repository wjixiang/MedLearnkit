use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use parking_lot::RwLock;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct MetricKey {
    pub endpoint: String,
    pub method: String,
    pub status_code: u16,
}

struct AtomicMetricEntry {
    request_count: AtomicU64,
    total_duration_us: AtomicU64,
}

pub struct MetricsCollector {
    entries: RwLock<HashMap<MetricKey, Arc<AtomicMetricEntry>>>,
    pub total_requests: AtomicU64,
    pub total_errors: AtomicU64,
    pub start_time: std::time::Instant,
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
            total_requests: AtomicU64::new(0),
            total_errors: AtomicU64::new(0),
            start_time: std::time::Instant::now(),
        }
    }

    pub fn record(&self, endpoint: &str, method: &str, status_code: u16, duration_us: u64) {
        let key = MetricKey {
            endpoint: endpoint.to_string(),
            method: method.to_string(),
            status_code,
        };

        {
            let read = self.entries.read();
            if let Some(entry) = read.get(&key) {
                entry.request_count.fetch_add(1, Ordering::Relaxed);
                entry
                    .total_duration_us
                    .fetch_add(duration_us, Ordering::Relaxed);
                self.total_requests.fetch_add(1, Ordering::Relaxed);
                if status_code >= 400 {
                    self.total_errors.fetch_add(1, Ordering::Relaxed);
                }
                return;
            }
        }

        {
            let mut write = self.entries.write();
            let entry = write.entry(key).or_insert_with(|| {
                Arc::new(AtomicMetricEntry {
                    request_count: AtomicU64::new(0),
                    total_duration_us: AtomicU64::new(0),
                })
            });
            entry.request_count.fetch_add(1, Ordering::Relaxed);
            entry
                .total_duration_us
                .fetch_add(duration_us, Ordering::Relaxed);
        }

        self.total_requests.fetch_add(1, Ordering::Relaxed);
        if status_code >= 400 {
            self.total_errors.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn drain(&self) -> HashMap<MetricKey, (u64, u64)> {
        let read = self.entries.read();
        let mut snapshot = HashMap::new();
        for (key, entry) in read.iter() {
            let count = entry.request_count.swap(0, Ordering::Relaxed);
            let duration = entry.total_duration_us.swap(0, Ordering::Relaxed);
            if count > 0 {
                snapshot.insert(key.clone(), (count, duration));
            }
        }
        snapshot
    }

    pub fn snapshot(&self) -> Vec<EndpointMetric> {
        let read = self.entries.read();
        let mut metrics = Vec::new();
        for (key, entry) in read.iter() {
            let count = entry.request_count.load(Ordering::Relaxed);
            let duration = entry.total_duration_us.load(Ordering::Relaxed);
            if count > 0 {
                metrics.push(EndpointMetric {
                    endpoint: key.endpoint.clone(),
                    method: key.method.clone(),
                    request_count: count,
                    avg_duration_ms: if count > 0 {
                        (duration as f64 / count as f64) / 1000.0
                    } else {
                        0.0
                    },
                    error_count: if key.status_code >= 400 { count } else { 0 },
                });
            }
        }
        metrics
    }

    pub fn elapsed_secs(&self) -> f64 {
        self.start_time.elapsed().as_secs_f64()
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EndpointMetric {
    pub endpoint: String,
    pub method: String,
    pub request_count: u64,
    pub avg_duration_ms: f64,
    pub error_count: u64,
}
