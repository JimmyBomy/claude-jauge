//! Same folders as the Node CLI: CLAUDE_CONFIG_DIR and CLAUDE_JAUGE_HOME override the defaults.

use std::env;
use std::path::PathBuf;

fn home() -> PathBuf {
    env::var_os("USERPROFILE")
        .or_else(|| env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn from_env(name: &str) -> Option<PathBuf> {
    env::var(name).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty()).map(PathBuf::from)
}

pub fn claude_dir() -> PathBuf {
    from_env("CLAUDE_CONFIG_DIR").unwrap_or_else(|| home().join(".claude"))
}

pub fn projects_dir() -> PathBuf {
    claude_dir().join("projects")
}

pub fn jauge_dir() -> PathBuf {
    from_env("CLAUDE_JAUGE_HOME").unwrap_or_else(|| home().join(".claude-jauge"))
}

pub fn history_file() -> PathBuf {
    jauge_dir().join("historique.jsonl")
}

/// Proof of life written by the status line (see statusline.rs).
pub fn seen_file() -> PathBuf {
    jauge_dir().join("statusline-vu.json")
}

pub fn settings_file() -> PathBuf {
    claude_dir().join("settings.json")
}

/// Shared with the Node CLI: what we installed and the status line that was there before.
pub fn install_state_file() -> PathBuf {
    jauge_dir().join("install.json")
}
