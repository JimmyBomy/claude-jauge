//! Today's token totals, read from the Claude Code session files (read only).
//!
//! Files are read incrementally: each refresh only parses the bytes appended since
//! the previous one, so the widget stays cheap even with a large history.

use chrono::{DateTime, FixedOffset, NaiveDate, TimeZone};
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DailyUsage {
    /// Local calendar day, "YYYY-MM-DD".
    pub day: String,
    pub total: u64,
    #[serde(rename = "byModel")]
    pub by_model: BTreeMap<String, u64>,
}

/// One assistant reply: de-duplication key, timestamp, model and token sum.
#[derive(Debug, PartialEq, Eq)]
pub struct Reply {
    pub key: Option<String>,
    pub at: DateTime<FixedOffset>,
    pub model: String,
    pub tokens: u64,
}

fn count(usage: &Value, field: &str) -> u64 {
    usage.get(field).and_then(Value::as_u64).unwrap_or(0)
}

/// Parses one line of a session file. Returns None for anything that is not a reply with usage.
pub fn parse_line(line: &str) -> Option<Reply> {
    if !line.contains("\"usage\"") {
        return None;
    }
    let raw: Value = serde_json::from_str(line).ok()?;
    let message = raw.get("message")?;
    let usage = message.get("usage")?;
    let model = message.get("model").and_then(Value::as_str).unwrap_or("unknown");
    if model == "<synthetic>" {
        return None;
    }
    let tokens = count(usage, "input_tokens")
        + count(usage, "output_tokens")
        + count(usage, "cache_creation_input_tokens")
        + count(usage, "cache_read_input_tokens");
    if tokens == 0 {
        return None;
    }
    let at = DateTime::parse_from_rfc3339(raw.get("timestamp")?.as_str()?).ok()?;
    let id = message.get("id").and_then(Value::as_str).unwrap_or("");
    let request = raw.get("requestId").and_then(Value::as_str).unwrap_or("");
    let key = if id.is_empty() && request.is_empty() { None } else { Some(format!("{id}:{request}")) };
    Some(Reply { key, at, model: model.to_string(), tokens })
}

fn list_jsonl(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let Ok(kind) = entry.file_type() else { continue };
        let path = entry.path();
        if kind.is_dir() {
            list_jsonl(&path, out);
        } else if kind.is_file() && path.extension().is_some_and(|e| e == "jsonl") {
            out.push(path);
        }
    }
}

pub struct Scanner {
    root: PathBuf,
    day: Option<NaiveDate>,
    offsets: HashMap<PathBuf, u64>,
    seen: HashSet<String>,
    total: u64,
    by_model: BTreeMap<String, u64>,
}

impl Scanner {
    pub fn new(root: PathBuf) -> Self {
        Scanner { root, day: None, offsets: HashMap::new(), seen: HashSet::new(), total: 0, by_model: BTreeMap::new() }
    }

    fn reset(&mut self, day: NaiveDate) {
        self.day = Some(day);
        self.offsets.clear();
        self.seen.clear();
        self.total = 0;
        self.by_model.clear();
    }

    /// Updates the totals for the day of `now` (in `now`'s time zone) and returns them.
    pub fn refresh(&mut self, now: DateTime<FixedOffset>) -> DailyUsage {
        let today = now.date_naive();
        if self.day != Some(today) {
            self.reset(today);
        }
        let midnight: SystemTime = now
            .timezone()
            .from_local_datetime(&today.and_hms_opt(0, 0, 0).unwrap_or_default())
            .single()
            .map(SystemTime::from)
            .unwrap_or(SystemTime::UNIX_EPOCH);

        let mut files = Vec::new();
        list_jsonl(&self.root, &mut files);
        for file in files {
            let Ok(meta) = fs::metadata(&file) else { continue };
            if meta.modified().map(|m| m < midnight).unwrap_or(false) {
                continue;
            }
            self.read_new_lines(&file, meta.len(), today, now.offset());
        }
        DailyUsage { day: today.format("%Y-%m-%d").to_string(), total: self.total, by_model: self.by_model.clone() }
    }

    fn read_new_lines(&mut self, file: &Path, len: u64, today: NaiveDate, tz: &FixedOffset) {
        let mut offset = self.offsets.get(file).copied().unwrap_or(0);
        if len < offset {
            offset = 0; // File was rewritten.
        }
        if len == offset {
            return;
        }
        let Ok(mut handle) = File::open(file) else { return };
        if handle.seek(SeekFrom::Start(offset)).is_err() {
            return;
        }
        let mut buf = Vec::with_capacity((len - offset) as usize);
        if handle.read_to_end(&mut buf).is_err() {
            return;
        }
        // Only complete lines: a line still being written is read on the next refresh.
        let Some(end) = buf.iter().rposition(|&b| b == b'\n') else { return };
        for line in buf[..end].split(|&b| b == b'\n') {
            let Ok(text) = std::str::from_utf8(line) else { continue };
            if let Some(reply) = parse_line(text) {
                self.add(reply, today, tz);
            }
        }
        self.offsets.insert(file.to_path_buf(), offset + end as u64 + 1);
    }

    fn add(&mut self, reply: Reply, today: NaiveDate, tz: &FixedOffset) {
        if reply.at.with_timezone(tz).date_naive() != today {
            return;
        }
        if let Some(key) = reply.key {
            if !self.seen.insert(key) {
                return;
            }
        }
        self.total += reply.tokens;
        *self.by_model.entry(reply.model).or_insert(0) += reply.tokens;
    }
}

/// Tokens of one local day for one model (the dashboard's daily bars and model table).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DayModelTokens {
    pub day: String,
    pub model: String,
    pub tokens: u64,
}

/// Totals per local day and model since `since` (inclusive), for the dashboard.
/// Files not modified since then are skipped; replies are de-duplicated like the CLI does.
pub fn by_day(root: &Path, since: DateTime<FixedOffset>) -> Vec<DayModelTokens> {
    let tz = *since.offset();
    let start = since.date_naive();
    let since_time = SystemTime::from(since);
    let mut files = Vec::new();
    list_jsonl(root, &mut files);
    let mut seen = HashSet::new();
    let mut totals: BTreeMap<(String, String), u64> = BTreeMap::new();
    for file in files {
        let recent = fs::metadata(&file).and_then(|m| m.modified()).map(|m| m >= since_time).unwrap_or(false);
        if !recent {
            continue;
        }
        let Ok(text) = fs::read_to_string(&file) else { continue };
        for line in text.lines() {
            let Some(reply) = parse_line(line) else { continue };
            let day = reply.at.with_timezone(&tz).date_naive();
            if day < start {
                continue;
            }
            if let Some(key) = reply.key {
                if !seen.insert(key) {
                    continue;
                }
            }
            *totals.entry((day.format("%Y-%m-%d").to_string(), reply.model)).or_insert(0) += reply.tokens;
        }
    }
    totals.into_iter().map(|((day, model), tokens)| DayModelTokens { day, model, tokens }).collect()
}

/// Last `max_bytes` of a text file, starting at a line boundary. Empty if missing.
pub fn tail(file: &Path, max_bytes: u64) -> String {
    let Ok(mut handle) = File::open(file) else { return String::new() };
    let len = handle.metadata().map(|m| m.len()).unwrap_or(0);
    let start = len.saturating_sub(max_bytes);
    if handle.seek(SeekFrom::Start(start)).is_err() {
        return String::new();
    }
    let mut buf = Vec::new();
    if handle.read_to_end(&mut buf).is_err() {
        return String::new();
    }
    let text = String::from_utf8_lossy(&buf).into_owned();
    if start == 0 {
        return text;
    }
    match text.find('\n') {
        Some(i) => text[i + 1..].to_string(),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn fixtures() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/claude/projects")
    }

    fn at(s: &str) -> DateTime<FixedOffset> {
        DateTime::parse_from_rfc3339(s).unwrap()
    }

    #[test]
    fn parses_a_reply_and_skips_the_rest() {
        let line = r#"{"type":"assistant","timestamp":"2026-11-23T09:00:00.000Z","requestId":"r1","message":{"id":"m1","model":"claude-opus-4-5","usage":{"input_tokens":10,"output_tokens":5,"cache_read_input_tokens":100}}}"#;
        let reply = parse_line(line).unwrap();
        assert_eq!(reply.tokens, 115);
        assert_eq!(reply.model, "claude-opus-4-5");
        assert_eq!(reply.key.as_deref(), Some("m1:r1"));
        assert!(parse_line(r#"{"type":"user","message":{"content":"hi"}}"#).is_none());
        assert!(parse_line(r#"{"usage": broken"#).is_none());
        assert!(parse_line(r#"{"timestamp":"2026-11-23T09:00:00Z","message":{"model":"<synthetic>","usage":{"input_tokens":3}}}"#).is_none());
    }

    #[test]
    fn totals_for_one_day_with_duplicates_removed() {
        let mut scanner = Scanner::new(fixtures());
        let usage = scanner.refresh(at("2026-11-23T12:00:00+00:00"));
        assert_eq!(usage.day, "2026-11-23");
        assert_eq!(usage.total, 14_200 + 22_000);
        assert_eq!(usage.by_model.get("claude-sonnet-4-5-20250929"), Some(&14_200));
        assert_eq!(usage.by_model.get("claude-opus-4-5-20251101"), Some(&22_000));
        // Second refresh reads nothing new and keeps the same totals.
        assert_eq!(scanner.refresh(at("2026-11-23T12:01:00+00:00")).total, 36_200);
        // New day: totals start again.
        assert_eq!(scanner.refresh(at("2026-11-24T15:00:00+00:00")).total, 8_800);
    }

    #[test]
    fn reads_only_appended_complete_lines() {
        let dir = std::env::temp_dir().join(format!("claude-jauge-scan-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("p")).unwrap();
        let file = dir.join("p").join("s.jsonl");
        let line = |id: &str, n: u64| {
            format!(r#"{{"timestamp":"2026-11-26T10:00:00Z","requestId":"{id}","message":{{"id":"{id}","model":"m","usage":{{"input_tokens":{n}}}}}}}"#)
        };
        fs::write(&file, format!("{}\n{}", line("a", 1), line("b", 2))).unwrap();
        let mut scanner = Scanner::new(dir.clone());
        let now = at("2026-11-26T11:00:00+00:00");
        assert_eq!(scanner.refresh(now).total, 1, "the unfinished line waits");
        let mut f = fs::OpenOptions::new().append(true).open(&file).unwrap();
        writeln!(f).unwrap();
        writeln!(f, "{}", line("c", 4)).unwrap();
        assert_eq!(scanner.refresh(now).total, 7);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn tail_starts_on_a_line_boundary() {
        let dir = std::env::temp_dir().join(format!("claude-jauge-tail-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("h.jsonl");
        fs::write(&file, "first line\nsecond\nthird\n").unwrap();
        assert_eq!(tail(&file, 1000), "first line\nsecond\nthird\n");
        assert_eq!(tail(&file, 10), "third\n");
        assert_eq!(tail(&dir.join("missing"), 10), "");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sums_per_day_and_model_since_a_date() {
        let dir = std::env::temp_dir().join(format!("claude-jauge-byday-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("p")).unwrap();
        let line = |ts: &str, id: &str, model: &str, n: u64| {
            format!(r#"{{"timestamp":"{ts}","requestId":"r{id}","message":{{"id":"m{id}","model":"{model}","usage":{{"input_tokens":{n},"output_tokens":0}}}}}}"#)
        };
        let text = [
            line("2026-11-20T10:00:00Z", "0", "claude-opus-4-5", 999),
            line("2026-11-25T10:00:00Z", "1", "claude-opus-4-5", 100),
            line("2026-11-25T11:00:00Z", "1", "claude-opus-4-5", 100),
            line("2026-11-25T23:30:00Z", "2", "claude-haiku-4-5", 7),
            line("2026-11-26T08:00:00Z", "3", "claude-opus-4-5", 50),
        ]
        .join("\n");
        fs::write(dir.join("p/s.jsonl"), text + "\n").unwrap();
        let paris = FixedOffset::east_opt(3600).unwrap();
        let since = paris.with_ymd_and_hms(2026, 11, 22, 0, 0, 0).unwrap();
        let rows = by_day(&dir, since);
        let got: Vec<_> = rows.iter().map(|r| (r.day.as_str(), r.model.as_str(), r.tokens)).collect();
        assert_eq!(
            got,
            [("2026-11-25", "claude-opus-4-5", 100), ("2026-11-26", "claude-haiku-4-5", 7), ("2026-11-26", "claude-opus-4-5", 50)],
            "duplicates removed, older days skipped, days in local time"
        );
        fs::remove_dir_all(&dir).unwrap();
    }
}
