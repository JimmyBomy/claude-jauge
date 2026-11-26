//! Plugs the widget into Claude Code: writes the `statusLine` entry of ~/.claude/settings.json
//! so that Claude Code runs `claude-jauge.exe statusline`. Same rules as the Node CLI
//! (src/settings.ts): a backup before every change, a foreign status line is never replaced
//! without consent, and the previous one is restored when unplugging.

use serde::Serialize;
use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

const MARKER: &str = "claude-jauge";

pub struct Files {
    pub settings: PathBuf,
    pub state: PathBuf,
}

impl Files {
    pub fn default_paths() -> Files {
        Files { settings: crate::paths::settings_file(), state: crate::paths::install_state_file() }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum LinkStatus {
    /// Our status line (from the widget or the Node CLI) is in settings.json.
    Linked,
    NotLinked,
    /// Another status line is there: replacing it needs the user's go.
    Foreign { command: String },
    /// settings.json exists but is not valid JSON: we never touch it.
    BadJson,
}

/// The command Claude Code will run. Forward slashes work in Git Bash and PowerShell;
/// quotes only when needed, since a quoted path is not a command in PowerShell.
pub fn build_command(exe: &Path) -> String {
    let path = exe.to_string_lossy().replace('\\', "/");
    if path.contains(' ') {
        format!("\"{path}\" statusline")
    } else {
        format!("{path} statusline")
    }
}

enum Read {
    Missing,
    Bad,
    Ok(Map<String, Value>),
}

fn read_object(file: &Path) -> Read {
    let Ok(text) = fs::read_to_string(file) else { return Read::Missing };
    let text = text.trim_start_matches('\u{feff}');
    if text.trim().is_empty() {
        return Read::Ok(Map::new());
    }
    match serde_json::from_str::<Value>(text) {
        Ok(Value::Object(map)) => Read::Ok(map),
        _ => Read::Bad,
    }
}

/// Write to a temp file then rename, so a crash never leaves a half-written settings.json.
fn write_atomic(file: &Path, value: &Value) -> bool {
    if let Some(dir) = file.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let Ok(text) = serde_json::to_string_pretty(value) else { return false };
    let tmp = file.with_extension(format!("claude-jauge-{}.tmp", std::process::id()));
    fs::write(&tmp, format!("{text}\n")).is_ok() && fs::rename(&tmp, file).is_ok()
}

fn backup(file: &Path, stamp: &str) {
    if file.exists() {
        let mut name = file.as_os_str().to_owned();
        name.push(format!(".claude-jauge-{stamp}.bak"));
        let _ = fs::copy(file, PathBuf::from(name));
    }
}

fn command_of(setting: Option<&Value>) -> Option<String> {
    setting?.get("command")?.as_str().map(str::to_string)
}

fn installed_command(files: &Files) -> Option<String> {
    match read_object(&files.state) {
        Read::Ok(state) => state.get("command").and_then(Value::as_str).map(str::to_string),
        _ => None,
    }
}

/// Ours if it is the exact command we wrote last time, or if it points to a claude-jauge install.
pub fn is_ours(command: &str, installed: Option<&str>) -> bool {
    installed == Some(command)
        || (command.contains(MARKER) && command.split(|c: char| !c.is_alphanumeric()).any(|w| w == "statusline"))
}

pub fn status(files: &Files) -> LinkStatus {
    let settings = match read_object(&files.settings) {
        Read::Bad => return LinkStatus::BadJson,
        Read::Missing => Map::new(),
        Read::Ok(map) => map,
    };
    let Some(existing) = settings.get("statusLine") else { return LinkStatus::NotLinked };
    let command = command_of(Some(existing)).unwrap_or_else(|| existing.to_string());
    if is_ours(&command, installed_command(files).as_deref()) {
        LinkStatus::Linked
    } else {
        LinkStatus::Foreign { command }
    }
}

/// Plugs our status line in. A foreign one is replaced only with `force`, and kept in the
/// state file so `disconnect` can put it back.
pub fn connect(files: &Files, command: &str, force: bool, stamp: &str) -> LinkStatus {
    let current = status(files);
    match &current {
        LinkStatus::Linked | LinkStatus::BadJson => return current,
        LinkStatus::Foreign { .. } if !force => return current,
        _ => {}
    }
    let mut settings = match read_object(&files.settings) {
        Read::Ok(map) => map,
        Read::Missing => Map::new(),
        Read::Bad => return LinkStatus::BadJson,
    };
    let previous = settings.get("statusLine").cloned().unwrap_or(Value::Null);
    backup(&files.settings, stamp);
    settings.insert("statusLine".into(), json!({ "type": "command", "command": command, "padding": 0 }));
    if !write_atomic(&files.settings, &Value::Object(settings)) {
        return current;
    }
    let state = json!({
        "installedAt": stamp,
        "settingsFile": files.settings.to_string_lossy(),
        "command": command,
        "previous": previous,
    });
    write_atomic(&files.state, &state);
    LinkStatus::Linked
}

/// Removes our status line and restores the previous one. Returns true if settings changed.
pub fn disconnect(files: &Files, stamp: &str) -> bool {
    let Read::Ok(mut settings) = read_object(&files.settings) else { return false };
    let installed = installed_command(files);
    let ours = command_of(settings.get("statusLine")).is_some_and(|c| is_ours(&c, installed.as_deref()));
    if !ours {
        return false;
    }
    let previous = match read_object(&files.state) {
        Read::Ok(state) => state.get("previous").cloned().filter(Value::is_object),
        _ => None,
    };
    backup(&files.settings, stamp);
    match previous {
        Some(p) => {
            settings.insert("statusLine".into(), p);
        }
        None => {
            settings.remove("statusLine");
        }
    }
    let done = write_atomic(&files.settings, &Value::Object(settings));
    if done {
        let _ = fs::remove_file(&files.state);
    }
    done
}

pub fn stamp_now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup(name: &str, settings: Option<&str>) -> (PathBuf, Files) {
        let dir = std::env::temp_dir().join(format!("claude-jauge-link-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("claude")).unwrap();
        let files = Files { settings: dir.join("claude/settings.json"), state: dir.join("jauge/install.json") };
        if let Some(s) = settings {
            fs::write(&files.settings, s).unwrap();
        }
        (dir, files)
    }

    fn read(file: &Path) -> Value {
        serde_json::from_str(&fs::read_to_string(file).unwrap()).unwrap()
    }

    const CMD: &str = "C:/Users/jimmy/AppData/Local/claude-jauge/claude-jauge.exe statusline";

    #[test]
    fn command_quotes_only_paths_with_spaces() {
        assert_eq!(build_command(Path::new(r"C:\Users\jimmy\AppData\Local\claude-jauge\claude-jauge.exe")), CMD);
        assert_eq!(build_command(Path::new(r"C:\Users\Jean Luc\x\claude-jauge.exe")), "\"C:/Users/Jean Luc/x/claude-jauge.exe\" statusline");
    }

    #[test]
    fn connects_when_free_and_keeps_other_settings() {
        let (dir, files) = setup("free", Some("\u{feff}{\"model\":\"opus\",\"theme\":\"dark\"}"));
        assert_eq!(status(&files), LinkStatus::NotLinked);
        assert_eq!(connect(&files, CMD, false, "s1"), LinkStatus::Linked);
        let s = read(&files.settings);
        assert_eq!(s["model"], "opus");
        assert_eq!(s["statusLine"], json!({ "type": "command", "command": CMD, "padding": 0 }));
        let keys: Vec<_> = s.as_object().unwrap().keys().cloned().collect();
        assert_eq!(keys, ["model", "theme", "statusLine"], "key order is kept");
        assert!(dir.join("claude/settings.json.claude-jauge-s1.bak").exists());
        assert_eq!(status(&files), LinkStatus::Linked);
        assert!(disconnect(&files, "s2"));
        assert!(read(&files.settings).get("statusLine").is_none());
        assert!(!files.state.exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn creates_settings_when_missing() {
        let (dir, files) = setup("missing", None);
        assert_eq!(connect(&files, CMD, false, "s1"), LinkStatus::Linked);
        assert_eq!(read(&files.settings)["statusLine"]["command"], CMD);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn foreign_status_line_needs_consent_and_is_restored() {
        let mine = r#"{"statusLine":{"type":"command","command":"~/bin/my-line.sh"}}"#;
        let (dir, files) = setup("foreign", Some(mine));
        let foreign = LinkStatus::Foreign { command: "~/bin/my-line.sh".into() };
        assert_eq!(connect(&files, CMD, false, "s1"), foreign);
        assert_eq!(fs::read_to_string(&files.settings).unwrap(), mine, "untouched without consent");
        assert_eq!(connect(&files, CMD, true, "s2"), LinkStatus::Linked);
        assert!(disconnect(&files, "s3"));
        assert_eq!(read(&files.settings)["statusLine"]["command"], "~/bin/my-line.sh");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn recognises_the_node_cli_and_never_touches_broken_json() {
        let node = r#"{"statusLine":{"type":"command","command":"node \"C:/Users/j/.claude-jauge/app/cli.js\" statusline"}}"#;
        let (dir, files) = setup("node", Some(node));
        assert_eq!(connect(&files, CMD, false, "s1"), LinkStatus::Linked);
        assert_eq!(fs::read_to_string(&files.settings).unwrap(), node, "a working CLI install is kept");
        fs::write(&files.settings, "{ oops").unwrap();
        assert_eq!(connect(&files, CMD, true, "s2"), LinkStatus::BadJson);
        assert!(!disconnect(&files, "s3"));
        assert_eq!(fs::read_to_string(&files.settings).unwrap(), "{ oops");
        fs::remove_dir_all(&dir).unwrap();
    }
}
