export function focusDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds)), hours = Math.floor(value / 3600), minutes = Math.floor(value % 3600 / 60), remainder = value % 60;
  return [hours ? `${hours} h` : "", minutes ? `${minutes} min` : "", remainder || !hours && !minutes ? `${remainder} sec` : ""].filter(Boolean).join(" ");
}
