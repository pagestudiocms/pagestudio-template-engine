export class LexParsingException extends Error {
  constructor(message: string, public readonly position?: number) {
    super(position === undefined ? message : `${message} at offset ${position}`);
    this.name = 'LexParsingException';
  }
}