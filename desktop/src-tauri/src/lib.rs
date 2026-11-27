//! claude-jauge desktop widget: a small always-on-top window and a tray icon.
//! Data comes only from local files written by Claude Code and by the claude-jauge status line.

mod link;
mod paths;
mod prefs;
pub mod statusline;
mod usage;

use notify::{RecursiveMode, Watcher};
use prefs::{Glass, Prefs};
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Wry};
use tauri_plugin_autostart::ManagerExt;

/// Enough history for the current 7-day window at one point per minute.
const HISTORY_TAIL_BYTES: u64 = 1_200_000;

struct AppState {
    scanner: Mutex<usage::Scanner>,
    prefs: Mutex<Prefs>,
    prefs_file: PathBuf,
    menu: Mutex<Option<MenuItems>>,
}

struct MenuItems {
    on_top: CheckMenuItem<Wry>,
    glass: [(Glass, CheckMenuItem<Wry>); 3],
    autostart: CheckMenuItem<Wry>,
}

#[tauri::command]
fn read_history() -> String {
    usage::tail(&paths::history_file(), HISTORY_TAIL_BYTES)
}

#[tauri::command]
fn daily_usage(state: tauri::State<'_, AppState>) -> usage::DailyUsage {
    let now = chrono::Local::now().fixed_offset();
    state.scanner.lock().map(|mut s| s.refresh(now)).unwrap_or_else(|e| e.into_inner().refresh(now))
}

#[tauri::command]
fn get_prefs(state: tauri::State<'_, AppState>) -> Prefs {
    state.prefs.lock().map(|p| p.clone()).unwrap_or_default()
}

#[tauri::command]
fn link_status() -> link::LinkStatus {
    link::status(&link::Files::default_paths())
}

/// Plugs the widget into Claude Code. `force` replaces another status line (the user said yes).
#[tauri::command]
fn link_claude(force: bool) -> link::LinkStatus {
    match std::env::current_exe() {
        Ok(exe) => link::connect(&link::Files::default_paths(), &link::build_command(&exe), force, &link::stamp_now()),
        Err(_) => link_status(),
    }
}

/// When the status line last ran, and whether Claude Code sent limits that time.
#[tauri::command]
fn statusline_seen() -> Option<statusline::Seen> {
    statusline::read_seen(&paths::seen_file())
}

/// Run by the uninstaller: puts back the status line the user had before.
pub fn disconnect() {
    link::disconnect(&link::Files::default_paths(), &link::stamp_now());
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

fn apply_glass(window: &WebviewWindow, glass: Glass) {
    #[cfg(target_os = "windows")]
    {
        use tauri::window::{Effect, EffectsBuilder};
        let effects = match glass {
            Glass::None => None,
            Glass::Mica => Some(EffectsBuilder::new().effect(Effect::Mica).build()),
            Glass::Acrylic => Some(EffectsBuilder::new().effect(Effect::Acrylic).build()),
        };
        let _ = window.set_effects(effects);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = (window, glass);
}

fn apply_prefs(app: &AppHandle, prefs: &Prefs) {
    if let Some(window) = main_window(app) {
        let _ = window.set_always_on_top(prefs.always_on_top);
        apply_glass(&window, prefs.glass);
    }
    let _ = app.emit("prefs-changed", prefs.clone());
}

fn update_prefs(app: &AppHandle, change: impl FnOnce(&mut Prefs)) {
    let state = app.state::<AppState>();
    let prefs = {
        let mut guard = state.prefs.lock().unwrap_or_else(|e| e.into_inner());
        change(&mut guard);
        guard.clone()
    };
    prefs::save(&state.prefs_file, &prefs);
    apply_prefs(app, &prefs);
    sync_menu(app);
}

fn sync_menu(app: &AppHandle) {
    let state = app.state::<AppState>();
    let prefs = state.prefs.lock().map(|p| p.clone()).unwrap_or_default();
    let autostart = app.autolaunch().is_enabled().unwrap_or(false);
    if let Ok(guard) = state.menu.lock() {
        if let Some(items) = guard.as_ref() {
            let _ = items.on_top.set_checked(prefs.always_on_top);
            let _ = items.autostart.set_checked(autostart);
            for (glass, item) in &items.glass {
                let _ = item.set_checked(*glass == prefs.glass);
            }
        }
    };
}

/// The whole history file, for the dashboard's charts (it is pruned above 4 MB).
#[tauri::command]
fn read_history_all() -> String {
    usage::tail(&paths::history_file(), 8 * 1024 * 1024)
}

/// Tokens per local day and model over the last `days` days, for the dashboard.
/// Reads the session files on a background thread: it can take a moment on a large history.
#[tauri::command]
async fn usage_by_day(days: u32) -> Vec<usage::DayModelTokens> {
    let now = chrono::Local::now().fixed_offset();
    let start = now.date_naive() - chrono::Days::new(u64::from(days.clamp(1, 366)) - 1);
    let since = start
        .and_hms_opt(0, 0, 0)
        .and_then(|d| d.and_local_timezone(*now.offset()).single())
        .unwrap_or(now);
    tauri::async_runtime::spawn_blocking(move || usage::by_day(&paths::projects_dir(), since)).await.unwrap_or_default()
}

/// Opens the dashboard in its own window, or brings it to the front if it is already open.
#[tauri::command]
fn open_dashboard(app: AppHandle) {
    if let Some(window) = app.get_webview_window("dashboard") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }
    let title = labels().dashboard_title;
    let _ = WebviewWindowBuilder::new(&app, "dashboard", WebviewUrl::App("dashboard.html".into()))
        .title(title)
        .inner_size(1080.0, 860.0)
        .min_inner_size(420.0, 480.0)
        .center()
        .build();
}

fn toggle_window(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

struct Labels {
    dashboard: &'static str,
    dashboard_title: &'static str,
    toggle: &'static str,
    on_top: &'static str,
    glass: &'static str,
    none: &'static str,
    mica: &'static str,
    acrylic: &'static str,
    autostart: &'static str,
    quit: &'static str,
}

fn labels() -> Labels {
    let french = sys_locale::get_locale().is_some_and(|l| l.to_lowercase().starts_with("fr"));
    if french {
        Labels {
            dashboard: "Ouvrir le tableau de bord",
            dashboard_title: "claude-jauge, tableau de bord",
            toggle: "Afficher ou masquer",
            on_top: "Toujours au premier plan",
            glass: "Effet verre",
            none: "Fond semi-opaque (le plus léger)",
            mica: "Mica (Windows 11)",
            acrylic: "Acrylique (flou)",
            autostart: "Lancer au démarrage de Windows",
            quit: "Quitter",
        }
    } else {
        Labels {
            dashboard: "Open the dashboard",
            dashboard_title: "claude-jauge, dashboard",
            toggle: "Show or hide",
            on_top: "Always on top",
            glass: "Glass effect",
            none: "Semi-opaque background (lightest)",
            mica: "Mica (Windows 11)",
            acrylic: "Acrylic (blur)",
            autostart: "Start with Windows",
            quit: "Quit",
        }
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let l = labels();
    let prefs = app.state::<AppState>().prefs.lock().map(|p| p.clone()).unwrap_or_default();
    let dashboard = MenuItem::with_id(app, "dashboard", l.dashboard, true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", l.toggle, true, None::<&str>)?;
    let on_top = CheckMenuItem::with_id(app, "on_top", l.on_top, true, prefs.always_on_top, None::<&str>)?;
    let none = CheckMenuItem::with_id(app, "glass_none", l.none, true, prefs.glass == Glass::None, None::<&str>)?;
    let mica = CheckMenuItem::with_id(app, "glass_mica", l.mica, true, prefs.glass == Glass::Mica, None::<&str>)?;
    let acrylic = CheckMenuItem::with_id(app, "glass_acrylic", l.acrylic, true, prefs.glass == Glass::Acrylic, None::<&str>)?;
    let glass = Submenu::with_items(app, l.glass, true, &[&none, &mica, &acrylic])?;
    let autostart_on = app.autolaunch().is_enabled().unwrap_or(false);
    let autostart = CheckMenuItem::with_id(app, "autostart", l.autostart, true, autostart_on, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", l.quit, true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&dashboard, &toggle, &separator, &on_top, &glass, &autostart, &separator, &quit])?;

    if let Ok(mut guard) = app.state::<AppState>().menu.lock() {
        *guard = Some(MenuItems {
            on_top: on_top.clone(),
            glass: [(Glass::None, none.clone()), (Glass::Mica, mica.clone()), (Glass::Acrylic, acrylic.clone())],
            autostart: autostart.clone(),
        });
    }

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("claude-jauge")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "dashboard" => open_dashboard(app.clone()),
            "toggle" => toggle_window(app),
            "on_top" => update_prefs(app, |p| p.always_on_top = !p.always_on_top),
            "glass_none" => update_prefs(app, |p| p.glass = Glass::None),
            "glass_mica" => update_prefs(app, |p| p.glass = Glass::Mica),
            "glass_acrylic" => update_prefs(app, |p| p.glass = Glass::Acrylic),
            "autostart" => {
                let launcher = app.autolaunch();
                let _ = if launcher.is_enabled().unwrap_or(false) { launcher.disable() } else { launcher.enable() };
                sync_menu(app);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                toggle_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// Watches the history file and the session folder, and tells the page when something changed.
/// Events are grouped (about 400 ms) so a burst of writes triggers a single refresh.
fn watch_files(app: AppHandle) {
    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel();
        let Ok(mut watcher) = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            if res.is_ok() {
                let _ = tx.send(());
            }
        }) else {
            return;
        };
        let jauge = paths::jauge_dir();
        let _ = std::fs::create_dir_all(&jauge);
        let _ = watcher.watch(&jauge, RecursiveMode::NonRecursive);
        let projects = paths::projects_dir();
        if projects.is_dir() {
            let _ = watcher.watch(&projects, RecursiveMode::Recursive);
        }
        while rx.recv().is_ok() {
            while rx.recv_timeout(Duration::from_millis(400)).is_ok() {}
            let _ = app.emit("data-changed", ());
        }
    });
}

/// The page shows the window after its first render. If that never comes (slow WebView2
/// start), show it anyway: right after install the widget must be visible, not only in the tray.
fn show_soon(app: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(2500));
        if let Some(window) = main_window(&app) {
            if !window.is_visible().unwrap_or(true) {
                let _ = window.show();
            }
        }
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = main_window(app) {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            let prefs_file = app.path().app_config_dir()?.join("prefs.json");
            let mut prefs = prefs::load(&prefs_file);
            // Start with Windows by default: turned on at the first launch only,
            // so turning it off from the tray menu is respected afterwards.
            if !prefs.autostart_set && app.autolaunch().enable().is_ok() {
                prefs.autostart_set = true;
                prefs::save(&prefs_file, &prefs);
            }
            // Plug into Claude Code at launch, so there is nothing to type. Does nothing if it
            // is already plugged in, and a status line the user already has is left alone:
            // the widget asks first.
            link_claude(false);
            app.manage(AppState {
                scanner: Mutex::new(usage::Scanner::new(paths::projects_dir())),
                prefs: Mutex::new(prefs.clone()),
                prefs_file,
                menu: Mutex::new(None),
            });
            let handle = app.handle().clone();
            build_tray(&handle)?;
            apply_prefs(&handle, &prefs);
            watch_files(handle.clone());
            show_soon(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the widget hides it: the app keeps running in the tray.
            // The dashboard window closes normally.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_history,
            read_history_all,
            daily_usage,
            usage_by_day,
            get_prefs,
            link_status,
            link_claude,
            statusline_seen,
            open_dashboard
        ])
        .run(tauri::generate_context!())
        .expect("claude-jauge failed to start");
}
