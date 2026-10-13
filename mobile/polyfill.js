// Polyfill for Node 18 compatibility with modern Metro / Expo
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return this.slice().reverse();
  };
}
if (!Array.prototype.toSorted) {
  Array.prototype.toSorted = function(compareFn) {
    return this.slice().sort(compareFn);
  };
}
if (!Array.prototype.toSpliced) {
  Array.prototype.toSpliced = function(start, deleteCount, ...items) {
    const copy = this.slice();
    copy.splice(start, deleteCount, ...items);
    return copy;
  };
}
if (!Array.prototype.with) {
  Array.prototype.with = function(index, value) {
    const copy = this.slice();
    copy[index] = value;
    return copy;
  };
}
console.log("✓ Applied Node 18 compatibility polyfills (toReversed, toSorted, toSpliced, with)");
