import { POSTCARD } from "./copy";
import { icon } from "./icons";
import { PostcardDesign } from "./postcard-design";
import { postcardChoices, type PostcardChoice } from "./postcard-choices";
import { containFocus, dismissOnBackdrop } from "./world-ui";

function action(label: string, name: "close" | "copy" | "download"): HTMLButtonElement {
  const button = document.createElement("button"); button.type = "button"; button.className = "btn";
  const text = document.createElement("span"); text.textContent = label;
  button.setAttribute("aria-label", label); button.title = label;
  button.append(icon(name), text); return button;
}

async function copyImage(blob: Blob, button: HTMLButtonElement, status: HTMLElement): Promise<void> {
  button.disabled = true; status.textContent = POSTCARD.copying;
  try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); status.textContent = POSTCARD.copied; }
  catch { status.textContent = POSTCARD.copyError; }
  finally { button.disabled = false; }
}

export function previewPostcard(blob: Blob, initial: PostcardDesign, render: (design: PostcardDesign) => Promise<Blob>, trigger: HTMLElement): void {
  let url = URL.createObjectURL(blob);
  let design = initial;
  let rendering = false;
  const dialog = document.createElement("dialog"); dialog.className = "postcard-preview world-frame world-modal"; dialog.setAttribute("aria-labelledby", "postcard-title");
  const header = document.createElement("header"); header.className = "postcard-header world-header";
  const title = document.createElement("h2"); title.id = "postcard-title"; title.textContent = POSTCARD.title;
  const close = action(POSTCARD.close, "close"); close.classList.add("postcard-close"); close.addEventListener("click", () => dialog.close());
  close.classList.add("world-button", "world-close");
  close.replaceChildren(icon("close")); close.setAttribute("aria-label", POSTCARD.close); close.title = POSTCARD.close;
  header.append(title, close);
  const image = document.createElement("img"); image.src = url; image.alt = POSTCARD.alt; image.className = "postcard-image";
  const viewport = document.createElement("div"); viewport.className = "postcard-viewport";
  image.addEventListener("load", () => {
    viewport.style.aspectRatio = image.naturalWidth + " / " + image.naturalHeight;
  }, { once: true });
  viewport.append(image);
  const caption = document.createElement("p"); caption.className = "postcard-greeting visually-hidden";
  caption.id = "postcard-greeting"; caption.textContent = design.greeting;
  if (design.showCaption) image.setAttribute("aria-describedby", caption.id);
  const footer = document.createElement("footer"); footer.className = "postcard-footer";
  const toolbar = document.createElement("div"); toolbar.className = "postcard-toolbar";
  const status = document.createElement("p"); status.className = "postcard-feedback"; status.setAttribute("role", "status");
  const download = action(POSTCARD.download, "download"); download.classList.add("btn-primary");
  download.addEventListener("click", () => { const link = document.createElement("a"); link.href = url; link.download = POSTCARD.file; link.click(); status.textContent = POSTCARD.downloaded; });
  const copy = action(POSTCARD.copy, "copy"); copy.addEventListener("click", () => { void copyImage(blob, copy, status); });
  const choices = postcardChoices((part,step) => { void refresh(part,step); });
  choices.sync(design);
  async function refresh(part: PostcardChoice, step: -1 | 1): Promise<void> {
    if (rendering) return;
    rendering = true; status.textContent = POSTCARD.working;
    const actions = [...choices.buttons,download,copy]; actions.forEach(button => { button.disabled = true; });
    dialog.setAttribute("aria-busy","true");
    const next = new PostcardDesign(design.greeting,design.border,design.showCaption);
    if (part === "words") next.showCaption = !design.showCaption;
    else if (part === "caption") next.cycleCaption(step); else next.cycleBorder(step);
    try {
      const result = await render(next);
      if (!dialog.isConnected) return;
      const nextUrl = URL.createObjectURL(result); const oldUrl = url;
      blob = result; url = nextUrl; design = next; image.src = url;
      caption.textContent = design.greeting; choices.sync(design); status.textContent = "";
      if (design.showCaption) image.setAttribute("aria-describedby", caption.id); else image.removeAttribute("aria-describedby");
      URL.revokeObjectURL(oldUrl);
    } catch { status.textContent = POSTCARD.error; }
    finally { rendering = false; actions.forEach(button => { button.disabled = false; }); choices.sync(design); dialog.setAttribute("aria-busy","false"); }
  }
  footer.append(download, copy); toolbar.append(choices.element, footer, status);
  dialog.append(header, viewport, toolbar, caption); document.body.append(dialog);
  containFocus(dialog, () => dialog.close());
  const leave = () => dialog.close();
  addEventListener("pagehide", leave);
  dialog.addEventListener("close", () => {
    URL.revokeObjectURL(url); removeEventListener("pagehide", leave); dialog.remove(); trigger.focus();
  }, { once: true });
  dismissOnBackdrop(dialog);
  document.querySelector<HTMLDetailsElement>(".scene-settings")!.open = false;
  dialog.showModal();
}
