export class Queue<T> {
  private store: T[] = [];
  private indexFront: number = 0;
  private indexBack: number = 0;
  private cleanupThreshold: number;
  private maxLength: number;

  constructor({
    items,
    cleanupThreshold,
    maxLength,
  }: { items?: T[]; cleanupThreshold?: number; maxLength?: number } = {}) {
    this.cleanupThreshold = cleanupThreshold ?? 10_000;
    this.maxLength = maxLength ?? Number.MAX_SAFE_INTEGER - 1;
    this.init(items);
  }

  private init(items?: T[]) {
    // Indexing threshold cannot be negative
    if (this.cleanupThreshold <= 0) {
      throw new Error("Indexing threshold cannot be zero or negative");
    }

    // Max length cannot be negative
    if (this.maxLength && this.maxLength <= 0) {
      throw new Error("Max length cannot be zero or negative");
    }

    // Initial items size cannot exceed max length of Queue
    if (items && this.maxLength && items.length > this.maxLength) {
      throw new Error("Initial items length cannot be greater than max length");
    }

    // Initialize the queue with the provided items
    if (items && items.length > 0) {
      this.indexBack = items.length;
      this.store = items.slice();
    }
  }

  get length() {
    return this.indexBack - this.indexFront;
  }

  get empty() {
    return this.length === 0;
  }

  get full() {
    return this.length >= this.maxLength;
  }

  public enqueue = (item: T) => {
    if (this.full) {
      console.warn("Queue is full, item will not be added");
      return;
    }
    if (this.indexFront >= this.cleanupThreshold) {
      this.updateIndexes();
    }
    this.store[this.indexBack] = item;
    this.indexBack++;
  };

  public dequeue = () => {
    if (this.empty) {
      console.warn("Cannot dequeue, queue is empty");
      return undefined;
    }
    const item = this.store[this.indexFront];
    this.store[this.indexFront] = undefined as unknown as T; // Clear the slot
    this.indexFront++;
    return item;
  };

  public peek = () => {
    if (this.empty) {
      console.warn("Cannot peek, queue is empty");
      return undefined;
    }
    return this.store[this.indexFront];
  };

  private updateIndexes() {
    // Shift all non-undefined elements to the start of the array
    let writeIndex = 0;
    for (let i = this.indexFront; i < this.indexBack; i++) {
      const item = this.store[i];
      if (item !== undefined) {
        this.store[writeIndex] = item;
        if (i !== writeIndex) {
          this.store[i] = undefined as unknown as T;
        }
        writeIndex++;
      }
    }

    this.indexBack = writeIndex;
    this.indexFront = 0;
  }
}
