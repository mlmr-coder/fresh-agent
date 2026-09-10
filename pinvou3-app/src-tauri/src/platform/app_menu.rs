//! Native application-menu branding.

#[cfg(target_os = "macos")]
pub(crate) fn branded_default_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> tauri::Result<tauri::menu::Menu<R>> {
    use tauri::menu::MenuItemKind;

    let menu = tauri::menu::Menu::default(app)?;
    let Some(MenuItemKind::Submenu(app_menu)) = menu.items()?.into_iter().next() else {
        return Ok(menu);
    };

    app_menu.set_text(crate::core::brand::DISPLAY_NAME)?;
    let items = app_menu.items()?;
    // Tauri's default macOS application submenu has About, Hide and Quit at
    // these positions. Supplying explicit labels prevents muda from falling
    // back to NSRunningApplication.localizedName, which is the technical
    // executable name (`pinvou3-tauri`) in development builds.
    for (index, action) in [(0, "About"), (4, "Hide"), (7, "Quit")] {
        if let Some(MenuItemKind::Predefined(item)) = items.get(index) {
            item.set_text(format!("{action} {}", crate::core::brand::DISPLAY_NAME))?;
        }
    }
    Ok(menu)
}
