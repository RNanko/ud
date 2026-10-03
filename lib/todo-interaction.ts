// Ignore actual controls inside the card, but not the card's own draggable button role.
export const todoInteractiveSelector = "button, input, textarea, select, label, a, [role='button'], [role='checkbox'], [role='switch'], [role='combobox'], [role='textbox'], [role='slider'], [role='spinbutton'], [role='link'], [role='menuitem'], [contenteditable]:not([contenteditable='false']), [data-no-drag]";
export function isTodoControl(target: EventTarget | null, card: EventTarget | null) {
  if (!target || !("closest" in target) || typeof target.closest !== "function") return false;
  const control = target.closest(todoInteractiveSelector);
  return Boolean(control && control !== card);
}
