//! Status line mode: `claude-jauge.exe statusline`.
//! Claude Code runs this command and pipes a JSON on stdin. We record the official
//! `rate_limits` percentages in the history file and print one short line.
//! Same file format and same rules as the Node CLI (src/statusline.ts, src/history.ts).

use chrono::{Datelike, Local, TimeZone, Timelike};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;

/// At most one point per minute, unless a window just changed.
const MIN_INTERVAL_SEC: i64 = 60;
const KEEP_DAYS: i64 = 60;
const PRUNE_ABOVE_BYTES: u64 = 4 * 1024 * 1024;
const WARNING: f64 = 50.0;
const CRITICAL: f64 = 80.0;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Sample {
    pub pct: f64,
    pub reset: i64,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct Point {
    pub t: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub five: Option<Sample>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub week: Option<Sample>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lang {
    Fr,
    En,
}

impl Lang {
    pub fn detect() -> Lang {
        match sys_locale::get_locale() {
            Some(l) if l.to_lowercase().starts_with("fr") => Lang::Fr,
            _ => Lang::En,
        }
    }
}

fn sample(v: Option<&Value>, now: i64) -> Option<Sample> {
    let v = v?;
    let used = v.get("used_percentage")?.as_f64()?;
    let mut reset = v.get("resets_at")?.as_f64()?;
    if !used.is_finite() || !reset.is_finite() {
        return None;
    }
    // The docs say epoch seconds. Be lenient if a future version ever sends milliseconds.
    if reset > 1e12 {
        reset /= 1000.0;
    }
    let reset = reset.round() as i64;
    // Claude Code drops a window once it has reset.
    if reset <= now {
        return None;
    }
    Some(Sample { pct: used.clamp(0.0, 100.0), reset })
}

/// Each window can be missing on its own (not Pro/Max, before the first reply, after a reset).
pub fn extract(raw: &str, now: i64) -> Point {
    let input: Value = serde_json::from_str(raw).unwrap_or(Value::Null);
    let rl = input.get("rate_limits");
    Point {
        t: now,
        five: sample(rl.and_then(|r| r.get("five_hour")), now),
        week: sample(rl.and_then(|r| r.get("seven_day")), now),
    }
}

/// Reads only the end of the file: the status line runs often and must stay fast.
fn last_point(file: &Path) -> Option<Point> {
    let mut f = fs::File::open(file).ok()?;
    let size = f.metadata().ok()?.len();
    let len = size.min(8192);
    f.seek(SeekFrom::Start(size - len)).ok()?;
    let mut buf = Vec::with_capacity(len as usize);
    f.read_to_end(&mut buf).ok()?;
    String::from_utf8_lossy(&buf)
        .lines()
        .rev()
        .find_map(|line| serde_json::from_str::<Point>(line.trim()).ok().filter(|p| p.five.is_some() || p.week.is_some()))
}

fn window_changed(a: Option<Sample>, b: Option<Sample>) -> bool {
    matches!((a, b), (Some(a), Some(b)) if (a.reset - b.reset).abs() >= 60)
}

/// Appends a point unless the last one is less than a minute old. Returns true if written.
pub fn append_point(file: &Path, p: &Point) -> bool {
    if p.five.is_none() && p.week.is_none() {
        return false;
    }
    if let Some(last) = last_point(file) {
        let too_soon = p.t - last.t < MIN_INTERVAL_SEC;
        let changed = window_changed(p.five, last.five) || window_changed(p.week, last.week);
        if too_soon && !changed {
            return false;
        }
    }
    if let Some(dir) = file.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let Ok(line) = serde_json::to_string(p) else { return false };
    let written = OpenOptions::new()
        .create(true)
        .append(true)
        .open(file)
        .and_then(|mut f| f.write_all(format!("{line}\n").as_bytes()))
        .is_ok();
    if written {
        prune_if_large(file, p.t);
    }
    written
}

fn prune_if_large(file: &Path, now: i64) {
    if fs::metadata(file).map(|m| m.len() <= PRUNE_ABOVE_BYTES).unwrap_or(true) {
        return;
    }
    let Ok(text) = fs::read_to_string(file) else { return };
    let cutoff = now - KEEP_DAYS * 86400;
    let kept: String = text
        .lines()
        .filter(|l| serde_json::from_str::<Point>(l.trim()).map(|p| p.t >= cutoff).unwrap_or(false))
        .map(|l| format!("{}\n", l.trim()))
        .collect();
    let tmp = file.with_extension(format!("{}.tmp", std::process::id()));
    if fs::write(&tmp, kept).is_ok() {
        let _ = fs::rename(&tmp, file);
    }
}

/// Small proof of life read by the widget: when the status line last ran, and whether
/// Claude Code sent limits. Lets the widget tell "not plugged" from "no limits sent".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Seen {
    pub t: i64,
    pub limits: bool,
}

pub fn write_seen(file: &Path, seen: Seen) {
    let old = fs::read_to_string(file).ok().and_then(|s| serde_json::from_str::<Seen>(&s).ok());
    if let Some(old) = old {
        if old.limits == seen.limits && seen.t - old.t < MIN_INTERVAL_SEC {
            return;
        }
    }
    if let Some(dir) = file.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(text) = serde_json::to_string(&seen) {
        let _ = fs::write(file, text);
    }
}

pub fn read_seen(file: &Path) -> Option<Seen> {
    fs::read_to_string(file).ok().and_then(|s| serde_json::from_str(&s).ok())
}

const WEEKDAYS_FR: [&str; 7] = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const WEEKDAYS_EN: [&str; 7] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/// "18:00" if the same day as now, otherwise "jeu 9:00" / "Thu 9:00".
pub fn short_when<Tz: TimeZone>(reset: i64, now: i64, tz: &Tz, lang: Lang) -> String {
    let (Some(at), Some(today)) = (tz.timestamp_opt(reset, 0).single(), tz.timestamp_opt(now, 0).single()) else {
        return String::new();
    };
    let time = format!("{}:{:02}", at.hour(), at.minute());
    if at.date_naive() == today.date_naive() {
        return time;
    }
    let i = at.weekday().num_days_from_monday() as usize;
    let day = if lang == Lang::Fr { WEEKDAYS_FR[i] } else { WEEKDAYS_EN[i] };
    format!("{day} {time}")
}

fn paint(color: bool, code: u8, text: &str) -> String {
    if color {
        format!("\x1b[{code}m{text}\x1b[0m")
    } else {
        text.to_string()
    }
}

/// « 5 h : 62 % (reset 18:00) · semaine : 38 % (reset jeu 9:00) »
pub fn render<Tz: TimeZone>(p: &Point, tz: &Tz, lang: Lang, color: bool) -> String {
    let fr = lang == Lang::Fr;
    let segment = |label: &str, s: &Sample| {
        let code = if s.pct >= CRITICAL { 31 } else if s.pct >= WARNING { 33 } else { 32 };
        let value = if fr { format!("{} %", s.pct.round()) } else { format!("{}%", s.pct.round()) };
        let sep = if fr { " : " } else { ": " };
        format!("{label}{sep}{} (reset {})", paint(color, code, &value), short_when(s.reset, p.t, tz, lang))
    };
    let mut parts = Vec::new();
    if let Some(s) = &p.five {
        parts.push(segment(if fr { "5 h" } else { "5h" }, s));
    }
    if let Some(s) = &p.week {
        parts.push(segment(if fr { "semaine" } else { "week" }, s));
    }
    if parts.is_empty() {
        let text = if fr { "claude-jauge · limites : pas encore reçues" } else { "claude-jauge · limits: not received yet" };
        return paint(color, 2, text);
    }
    parts.join(" · ")
}

/// Entry point of `claude-jauge.exe statusline`. Never panics on bad input: Claude Code
/// expects the command to print a line and exit 0.
pub fn run() {
    let mut raw = String::new();
    let _ = std::io::stdin().read_to_string(&mut raw);
    let now = chrono::Utc::now().timestamp();
    let point = extract(&raw, now);
    append_point(&crate::paths::history_file(), &point);
    write_seen(&crate::paths::seen_file(), Seen { t: now, limits: point.five.is_some() || point.week.is_some() });
    let color = std::env::var_os("NO_COLOR").map(|v| v.is_empty()).unwrap_or(true);
    let mut out = std::io::stdout();
    let _ = writeln!(out, "{}", render(&point, &Local, Lang::detect(), color));
    let _ = out.flush();
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::FixedOffset;

    // 2026-11-26 10:00 UTC, a Thursday.
    const NOW: i64 = 1_795_687_200;

    fn temp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("claude-jauge-sl-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn extracts_limits_and_tolerates_bad_input() {
        let raw = format!(
            r#"{{"rate_limits":{{"five_hour":{{"used_percentage":62.4,"resets_at":{}}},"seven_day":{{"used_percentage":130,"resets_at":{}}}}}}}"#,
            NOW + 3600,
            (NOW + 86400) * 1000
        );
        let p = extract(&raw, NOW);
        assert_eq!(p.five, Some(Sample { pct: 62.4, reset: NOW + 3600 }));
        assert_eq!(p.week, Some(Sample { pct: 100.0, reset: NOW + 86400 }));
        assert_eq!(extract("not json", NOW), Point { t: NOW, ..Point::default() });
        let past = format!(r#"{{"rate_limits":{{"five_hour":{{"used_percentage":5,"resets_at":{}}}}}}}"#, NOW - 1);
        assert_eq!(extract(&past, NOW).five, None);
    }

    #[test]
    fn renders_like_the_cli() {
        let paris = FixedOffset::east_opt(3600).unwrap();
        let p = Point {
            t: NOW,
            five: Some(Sample { pct: 62.0, reset: NOW + 7 * 3600 }),
            week: Some(Sample { pct: 38.0, reset: NOW + 7 * 86400 - 2 * 3600 }),
        };
        assert_eq!(render(&p, &paris, Lang::Fr, false), "5 h : 62 % (reset 18:00) · semaine : 38 % (reset jeu 9:00)");
        assert_eq!(render(&p, &paris, Lang::En, false), "5h: 62% (reset 18:00) · week: 38% (reset Thu 9:00)");
        assert!(render(&p, &paris, Lang::Fr, true).contains("\x1b[33m62 %\x1b[0m"));
        let empty = Point { t: NOW, ..Point::default() };
        assert_eq!(render(&empty, &paris, Lang::Fr, false), "claude-jauge · limites : pas encore reçues");
    }

    #[test]
    fn appends_at_most_one_point_per_minute() {
        let dir = temp("append");
        let file = dir.join("historique.jsonl");
        let p = |t: i64, reset: i64| Point { t, five: Some(Sample { pct: 10.0, reset }), week: None };
        assert!(append_point(&file, &p(NOW, NOW + 3600)));
        assert!(!append_point(&file, &p(NOW + 30, NOW + 3600)));
        assert!(append_point(&file, &p(NOW + 40, NOW + 9000)), "a new window is always recorded");
        assert!(append_point(&file, &p(NOW + 120, NOW + 9000)));
        assert!(!append_point(&file, &Point { t: NOW + 500, ..Point::default() }));
        let text = fs::read_to_string(&file).unwrap();
        assert_eq!(text.lines().count(), 3);
        assert_eq!(text.lines().next().unwrap(), format!(r#"{{"t":{NOW},"five":{{"pct":10.0,"reset":{}}}}}"#, NOW + 3600));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn seen_file_is_throttled() {
        let dir = temp("seen");
        let file = dir.join("vu.json");
        write_seen(&file, Seen { t: NOW, limits: false });
        write_seen(&file, Seen { t: NOW + 10, limits: false });
        assert_eq!(read_seen(&file), Some(Seen { t: NOW, limits: false }));
        write_seen(&file, Seen { t: NOW + 20, limits: true });
        assert_eq!(read_seen(&file), Some(Seen { t: NOW + 20, limits: true }));
        fs::remove_dir_all(&dir).unwrap();
    }
}
