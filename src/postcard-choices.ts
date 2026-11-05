import { POSTCARD } from "./copy";
import { icon } from "./icons";
import type { PostcardDesign } from "./postcard-design";
export type PostcardChoice = "caption" | "border" | "words";

export function postcardChoices(onChange: (part: PostcardChoice, step: -1 | 1) => void) {
  const element = document.createElement("div"); element.className = "postcard-choices";
  const buttons: (HTMLButtonElement | HTMLInputElement)[] = [];
  const words = document.createElement("label"); words.className = "postcard-words cue-control";
  const toggle = document.createElement("input"); toggle.type = "checkbox";
  toggle.setAttribute("aria-label", POSTCARD.showCaption);
  toggle.addEventListener("change", () => onChange("words", 1));
  words.append(document.createTextNode(POSTCARD.captionChoice), toggle); element.append(words); buttons.push(toggle);
  const outputs = new Map<PostcardChoice, HTMLOutputElement>();
  for (const part of ["caption", "border"] as const) {
    const group = document.createElement("div"); group.className = "postcard-choice";
    const label = document.createElement("span"); label.className = "postcard-choice-label";
    label.textContent = part === "caption" ? POSTCARD.captionChoice : POSTCARD.borderChoice;
    const output = document.createElement("output"); output.className = part === "border" ? "postcard-border-name" : "postcard-caption-number";
    output.setAttribute("aria-live", "polite"); outputs.set(part,output);
    const middle = document.createElement("div"); middle.append(label,output);
    const arrows = ([-1, 1] as const).map(step => {
      const button = document.createElement("button"); button.type = "button"; button.className = "btn postcard-cycle";
      const title = part === "caption" ? (step === -1 ? POSTCARD.previousCaption : POSTCARD.nextCaption) : (step === -1 ? POSTCARD.previousBorder : POSTCARD.nextBorder);
      button.setAttribute("aria-label",title); button.title = title;
      button.append(icon(step === -1 ? "previous" : "next"));
      button.addEventListener("click",() => onChange(part,step)); buttons.push(button); return button;
    });
    group.append(arrows[0]!,middle,arrows[1]!); element.append(group);
    if (part === "caption") group.classList.add("postcard-caption-choice");
  }
  return { element, buttons, sync(design: PostcardDesign) {
    toggle.checked = design.showCaption;
    element.querySelector<HTMLElement>(".postcard-caption-choice")!.classList.toggle("is-inactive", !design.showCaption);
    element.querySelectorAll<HTMLButtonElement>(".postcard-caption-choice button").forEach(button => { button.disabled = !design.showCaption; });
    outputs.get("caption")!.value = design.captionNumber + " / " + POSTCARD.greetings.length;
    outputs.get("border")!.value = POSTCARD.borders[design.border];
  } };
}
