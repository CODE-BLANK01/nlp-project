export function chunkText(s, size = 1400, overlap = 200) {
  const chunks = [];
  const sentences = s.split(/(?<=[.?!])\s+/);
  let buffer = "";

  for (const sentence of sentences) {
    if ((buffer + " " + sentence).length > size) {
      chunks.push(buffer.trim());
      buffer = sentence;
    } else buffer += " " + sentence;
  }
  if (buffer.trim()) chunks.push(buffer.trim());

  // overlap: include last 200 chars from previous
  const overlapped = [];
  for (let i = 0; i < chunks.length; i++) {
    const prev = i > 0 ? chunks[i - 1].slice(-overlap) : "";
    overlapped.push((prev + " " + chunks[i]).trim());
  }
  return overlapped;
}