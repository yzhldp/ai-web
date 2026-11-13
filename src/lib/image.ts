/**
 * 前端图片压缩：控制上传体积，降低多模态请求与 Token 成本。
 * 仅在浏览器端调用。
 */
export async function compressImageFile(
  file: File,
  options: { maxSide?: number; quality?: number } = {}
): Promise<string> {
  const maxSide = options.maxSide ?? 1280;
  const quality = options.quality ?? 0.82;

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("图片处理失败"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("图片读取失败"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}
