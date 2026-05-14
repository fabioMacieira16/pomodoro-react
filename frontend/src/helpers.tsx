function pad2(num: number): string | number {
  return num > 9 ? num : `0${num}`;
}

export function formatTime(time: number): string {
  const minutes = pad2(Math.floor(time / 60));
  const seconds = pad2(Math.floor(time % 60));

  return `${minutes}:${seconds}`;
}
