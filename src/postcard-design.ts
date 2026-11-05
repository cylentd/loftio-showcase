import { POSTCARD } from "./copy.ts";
import { POSTCARD_BORDERS, type PostcardBorder } from "./postcard-data.ts";

export class PostcardDesign {
  private captionIndex: number;
  private borderIndex = 0;
  showCaption = false;
  constructor(greeting: string, border: PostcardBorder = "storybook", showCaption = false) {
    this.showCaption = showCaption;
    this.captionIndex = Math.max(0, POSTCARD.greetings.indexOf(greeting));
    this.borderIndex = POSTCARD_BORDERS.indexOf(border);
  }
  get greeting(): string { return POSTCARD.greetings[this.captionIndex]!; }
  get border() { return POSTCARD_BORDERS[this.borderIndex]!; }
  get captionNumber(): number { return this.captionIndex + 1; }
  cycleCaption(direction: -1 | 1): void {
    this.captionIndex = (this.captionIndex + direction + POSTCARD.greetings.length) % POSTCARD.greetings.length;
  }
  cycleBorder(direction: -1 | 1): void {
    this.borderIndex = (this.borderIndex + direction + POSTCARD_BORDERS.length) % POSTCARD_BORDERS.length;
  }
}
