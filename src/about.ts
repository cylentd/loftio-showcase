import { ABOUT } from "./copy";

export function aboutCorner(): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "room-about";
  const summary = document.createElement("summary");
  summary.textContent = ABOUT.title;
  details.append(summary);
  for (const text of [ABOUT.description, ABOUT.maker, ABOUT.music]) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    details.append(paragraph);
  }
  const rain = document.createElement("p");
  const source = document.createElement("a");
  source.textContent = ABOUT.recording;
  source.href = ABOUT.source;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  rain.append(ABOUT.rain, source, ABOUT.license);
  details.append(rain);
  const sounds = document.createElement("p");
  const pack = document.createElement("a");
  pack.textContent = ABOUT.soundsPack;
  pack.href = ABOUT.soundsSource;
  pack.target = "_blank";
  pack.rel = "noopener noreferrer";
  sounds.append(ABOUT.sounds, pack, ABOUT.soundsLicense);
  details.append(sounds);
  return details;
}
