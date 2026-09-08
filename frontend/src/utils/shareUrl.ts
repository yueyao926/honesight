export async function shareUrl(title: string, url: string) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
    }
  }

  try {
    if (typeof navigator.clipboard?.writeText === "function") {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
  } catch {
    // Clipboard permissions can be denied even when the API exists.
  }

  const focusedElement = document.activeElement;
  const input = document.createElement("textarea");
  input.value = url;
  input.readOnly = true;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  try {
    input.select();
    return document.execCommand("copy") ? "copied" : "manual";
  } catch {
    return "manual";
  } finally {
    input.remove();
    if (focusedElement instanceof HTMLElement) focusedElement.focus();
  }
}
