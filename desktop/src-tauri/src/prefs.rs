//! Widget preferences, stored as a small JSON file in the app config folder.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Glass {
    /// Semi-opaque background drawn by the page: the lightest option, the default.
    #[default]
    None,
    /// Windows 11 Mica material: cheap, tinted by the wallpaper.
    Mica,
    /// Windows Acrylic blur: prettiest, but can lag while dragging the window.
    Acrylic,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase")]
pub struct Prefs {
    pub glass: Glass,
    pub always_on_top: bool,
}

impl Default for Prefs {
    fn default() -> Self {
        Prefs { glass: Glass::None, always_on_top: true }
    }
}

pub fn load(file: &Path) -> Prefs {
    fs::read_to_string(file).ok().and_then(|text| serde_json::from_str(&text).ok()).unwrap_or_default()
}

pub fn save(file: &Path, prefs: &Prefs) {
    if let Some(dir) = file.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(text) = serde_json::to_string_pretty(prefs) {
        let _ = fs::write(file, text);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_and_defaults() {
        let dir = std::env::temp_dir().join(format!("claude-jauge-prefs-{}", std::process::id()));
        let file = dir.join("prefs.json");
        assert_eq!(load(&file), Prefs::default());
        let p = Prefs { glass: Glass::Mica, always_on_top: false };
        save(&file, &p);
        assert_eq!(load(&file), p);
        fs::write(&file, r#"{"glass":"acrylic"}"#).unwrap();
        assert_eq!(load(&file), Prefs { glass: Glass::Acrylic, always_on_top: true });
        fs::write(&file, "not json").unwrap();
        assert_eq!(load(&file), Prefs::default());
        fs::remove_dir_all(&dir).unwrap();
    }
}
