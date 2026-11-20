import { Menu, Point, Rectangle, Size, Tray, screen } from 'electron';

const POPUP_MARGIN = 4;

const LABELS = {
  es: { loading: 'Cargando cotizaciones…', show: 'Ver cotizaciones', refresh: 'Actualizar', preferences: 'Preferencias…', quit: 'Salir' },
  en: { loading: 'Loading quotes…', show: 'Show quotes', refresh: 'Refresh', preferences: 'Preferences…', quit: 'Quit' }
};

export interface TrayMenuActions {
  show(): void;
  refresh(): void;
  preferences(): void;
  quit(): void;
}

const labelsFor = (locale: string) => locale.toLowerCase().startsWith('es') ? LABELS.es : LABELS.en;

/**
 * StatusNotifier hosts (GNOME AppIndicator, KDE, XFCE) only expose the app through this menu, and some of them
 * never deliver a left `click`, so every popup action has to be reachable from here too.
 */
export function buildTrayMenu(header: string | null, locale: string, actions: TrayMenuActions): Menu {
  const labels = labelsFor(locale);
  return Menu.buildFromTemplate([
    { label: header || labels.loading, enabled: false },
    { type: 'separator' },
    { label: labels.show, click: () => actions.show() },
    { label: labels.refresh, click: () => actions.refresh() },
    { label: labels.preferences, click: () => actions.preferences() },
    { type: 'separator' },
    { label: labels.quit, click: () => actions.quit() }
  ]);
}

/** Linux trays usually report empty bounds, so fall back to the cursor, which is on the icon (or its menu) when this runs. */
export function trayAnchor(tray: Tray): Point {
  const bounds = tray.getBounds();
  if (bounds.width > 0 && bounds.height > 0) {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }
  return screen.getCursorScreenPoint();
}

/** Centers the popup on the anchor, docked to the panel edge (top or bottom) and kept inside the work area. */
export function popupPosition(anchor: Point, size: Size, workArea: Rectangle): Point {
  const minX = workArea.x + POPUP_MARGIN;
  const maxX = workArea.x + workArea.width - size.width - POPUP_MARGIN;
  const x = Math.round(Math.min(Math.max(anchor.x - size.width / 2, minX), Math.max(minX, maxX)));
  const panelOnTop = anchor.y < workArea.y + workArea.height / 2;
  const y = panelOnTop
    ? workArea.y + POPUP_MARGIN
    : workArea.y + workArea.height - size.height - POPUP_MARGIN;
  return { x, y: Math.round(Math.max(workArea.y, y)) };
}

export function popupPositionFor(anchor: Point, size: Size): Point {
  return popupPosition(anchor, size, screen.getDisplayNearestPoint(anchor).workArea);
}
