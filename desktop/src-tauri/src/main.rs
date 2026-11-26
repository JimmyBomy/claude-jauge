// Hides the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `claude-jauge.exe statusline` is run by Claude Code; `disconnect` by the uninstaller.
    match std::env::args().nth(1).as_deref() {
        Some("statusline") => claude_jauge_lib::statusline::run(),
        Some("disconnect") => claude_jauge_lib::disconnect(),
        _ => claude_jauge_lib::run(),
    }
}
