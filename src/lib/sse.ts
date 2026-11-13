/**
 * 通用 SSE 读取器
 * 按 \n\n 分帧，解析 data: 行并回调；支持多帧粘包与末尾残帧。
 */
export async function readSSE(
  response: Response,
  onEvent: (data: unknown) => void
): Promise<void> {
  if (!response.body) throw new Error("服务端未返回流式响应");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (frame: string) => {
    const dataLine = frame
      .split("\n")
      .find((line) => line.startsWith("data:"));
    if (!dataLine) return;
    const payload = dataLine.slice(5).trim();
    if (!payload) return;
    onEvent(JSON.parse(payload));
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) dispatch(frame);
  }

  if (buffer.trim().startsWith("data:")) dispatch(buffer);
}
