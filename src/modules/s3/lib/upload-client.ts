import { IMAGE_SIZE_LIMIT } from "@/constants";
import { UPLOAD_CHUNK_SIZE } from "@/modules/s3/lib/upload-limits";

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

/** 单片上传超时。4MB 在极慢的 1Mbps 上行也只需 32 秒，给到 120 秒足够宽裕。 */
const PART_TIMEOUT_MS = 120 * 1000;

/** 单请求整体上传的超时（仅兜底通道使用） */
const SINGLE_SHOT_TIMEOUT_MS = 5 * 60 * 1000;

/** 单片重试次数 */
const PART_MAX_ATTEMPTS = 3;

interface UploadToS3Options {
  file: File;
  folder: string;
  onProgress?: (progress: number) => void;
  /**
   * @deprecated 浏览器直传 COS 已不再默认使用（跨域失败不可诊断、弱网下易被掐断）。
   * 保留该参数只为兼容既有调用点，不再读取。
   */
  getUploadUrl?: (input: {
    filename: string;
    contentType: AllowedContentType;
    folder: string;
  }) => Promise<{ uploadUrl: string; publicUrl: string }>;
}

interface UploadToS3Result {
  publicUrl: string;
  /** 实际使用的通道，便于排查 */
  via: "multipart" | "proxy";
}

/** 业务错误：重试没有意义（未登录 / 类型不支持 / 超限） */
class FatalUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalUploadError";
  }
}

class UploadError extends Error {
  constructor(
    message: string,
    public status?: number,
    public detail?: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/** 把失败细节上报到服务端日志，方便事后定位（浏览器控制台是看不到用户那边的） */
function reportFailure(stage: string, info: Record<string, unknown>) {
  try {
    const body = JSON.stringify({
      message: `[上传失败] ${stage}`,
      source: "manual",
      url: typeof location !== "undefined" ? location.href : undefined,
      meta: { ...info, stage },
    });
    // keepalive：即使页面即将卸载也能把这条送出去
    void fetch("/api/log/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* 上报本身失败不影响主流程 */
  }
}

function isFatalStatus(status: number): boolean {
  // 401 未登录 / 400 参数 / 413 超限 —— 重试无意义
  return status === 401 || status === 403 || status === 400 || status === 413;
}

export class S3Client {
  private validateFile(file: File) {
    const MAX_FILE_SIZE = IMAGE_SIZE_LIMIT;
    if (file.type.startsWith("image/") && file.size > MAX_FILE_SIZE) {
      throw new FatalUploadError(
        `文件大小 ${(file.size / 1024 / 1024).toFixed(1)}MB 超过 ${MAX_FILE_SIZE / 1024 / 1024}MB 上限`,
      );
    }

    if (!file.type) {
      throw new FatalUploadError("无法识别文件类型，请重新选择文件");
    }
  }

  /** 同源 JSON 请求（自动带 cookie） */
  private async postJson<T>(url: string, payload: unknown, token?: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Upload-Token": token } : {}) },
        body: JSON.stringify(payload),
        credentials: "same-origin",
        signal: AbortSignal.timeout(PART_TIMEOUT_MS),
      });
    } catch {
      throw new UploadError("网络中断，请检查网络后重试");
    }

    if (res.status === 401) {
      throw new FatalUploadError("登录状态已失效，请重新登录后再上传");
    }

    const text = await res.text();
    let data: { error?: string } & Partial<T> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      if (res.ok) throw new UploadError("服务器返回格式异常", 502);
    }

    if (!res.ok) {
      const msg = data.error || `请求失败（HTTP ${res.status}）`;
      if (isFatalStatus(res.status)) throw new FatalUploadError(msg);
      throw new UploadError(msg, res.status, text.slice(0, 300));
    }

    return data as T;
  }

  /** 上传单片，返回 ETag。网络类失败自动重试。 */
  private putPart(
    key: string,
    uploadId: string,
    token: string,
    partNumber: number,
    blob: Blob,
    onChunkProgress?: (loaded: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const attempt = (n: number) => {
        const xhr = new XMLHttpRequest();
        const url =
          `/api/upload/multipart/part?key=${encodeURIComponent(key)}` +
          `&uploadId=${encodeURIComponent(uploadId)}` +
          `&partNumber=${partNumber}`;

        const retryOrFail = (err: UploadError) => {
          const retryable =
            err.status === undefined || err.status >= 500 || err.status === 429;
          if (retryable && n < PART_MAX_ATTEMPTS) {
            setTimeout(() => attempt(n + 1), 600 * n);
            return;
          }
          reject(err);
        };

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) onChunkProgress?.(event.loaded);
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText) as { etag?: string };
              if (!data.etag) {
                reject(new UploadError("服务器未返回分片标识", xhr.status));
                return;
              }
              resolve(data.etag);
            } catch {
              reject(new UploadError("服务器返回格式异常", xhr.status));
            }
            return;
          }

          let msg = `分片上传失败（HTTP ${xhr.status}）`;
          try {
            const data = JSON.parse(xhr.responseText) as { error?: string };
            if (data.error) msg = data.error;
          } catch {
            /* 忽略 */
          }

          if (isFatalStatus(xhr.status)) {
            reject(new FatalUploadError(msg));
            return;
          }
          retryOrFail(new UploadError(msg, xhr.status, xhr.responseText?.slice(0, 300)));
        };

        xhr.onerror = () => retryOrFail(new UploadError("网络中断"));
        xhr.ontimeout = () => retryOrFail(new UploadError("分片上传超时"));
        xhr.onabort = () => reject(new UploadError("上传已取消"));

        xhr.timeout = PART_TIMEOUT_MS;
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
        xhr.setRequestHeader("X-Upload-Token", token);
        xhr.send(blob);
      };

      attempt(1);
    });
  }

  /** 放弃分片上传，清理 COS 上的未合并碎片 */
  private async abortMultipart(key: string, uploadId: string, token: string) {
    try {
      await fetch(
        `/api/upload/multipart/complete?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}`,
        { method: "DELETE", credentials: "same-origin", headers: { "X-Upload-Token": token }, signal: AbortSignal.timeout(15000) },
      );
    } catch {
      /* 清理失败不影响主流程 */
    }
  }

  /**
   * 同源分片上传（默认通道）。
   *
   * 关键点：每片 4MB，单个请求只活几秒。这样既不会出现
   * 「进度 100% 后连接静默十几秒被中间网络设备掐断」的问题，
   * 单片失败也能单独重试，而不是整张图重来。
   */
  private async uploadMultipart(
    file: File,
    folder: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const init = await this.postJson<{ key: string; uploadId: string; token: string }>(
      "/api/upload/multipart/init",
      {
        filename: file.name,
        folder,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      },
    );

    if (!init.key || !init.uploadId || !init.token) throw new UploadError("初始化响应缺少上传凭证", 502);
    const chunkSize = UPLOAD_CHUNK_SIZE;
    const total = Math.max(1, Math.ceil(file.size / chunkSize));
    const parts: { partNumber: number; etag: string }[] = [];
    let uploaded = 0;
    let displayed = 0;
    let merging = false;

    const emit = (inChunk = 0) => {
      // 合并阶段还有一步，先封顶 99%，完成后再置 100%
      const pct = Math.min(99, Math.round(((uploaded + inChunk) / file.size) * 100));
      displayed = Math.max(displayed, pct);
      onProgress?.(displayed);
    };

    try {
      for (let i = 0; i < total; i++) {
        const start = i * chunkSize;
        const blob = file.slice(start, Math.min(start + chunkSize, file.size));
        const etag = await this.putPart(init.key, init.uploadId, init.token, i + 1, blob, emit);
        uploaded += blob.size;
        parts.push({ partNumber: i + 1, etag });
        emit();
      }

      merging = true;
      for (let attempt = 1; attempt <= PART_MAX_ATTEMPTS; attempt++) {
        try {
          const done = await this.postJson<{ key: string }>(
            "/api/upload/multipart/complete",
            { key: init.key, uploadId: init.uploadId, parts }, init.token,
          );
          // 服务端可能对超大图压缩并替换 key（如 .c.jpg），以可信响应的 finalKey 为准
          if (!done.key) throw new UploadError("服务器未确认文件已存储", 502);
          onProgress?.(100);
          return done.key;
        } catch (error) {
          if (error instanceof FatalUploadError || attempt === PART_MAX_ATTEMPTS ||
              (error instanceof UploadError && error.status !== undefined && error.status < 500 && error.status !== 429)) throw error;
          await new Promise(resolve => setTimeout(resolve, 600 * attempt));
        }
      }
      throw new UploadError("无法确认合并状态，请查看后台日志");
    } catch (error) {
      // 合并阶段失败可能只是响应丢失，不自动清理或整体重传，避免重复对象。
      if (!merging) void this.abortMultipart(init.key, init.uploadId, init.token);
      reportFailure(merging ? "multipart-complete" : "multipart-part", { key: init.key, reason: error instanceof Error ? error.message : String(error) });
      // 404 此时来自 part/complete 而非 init，不能触发整体上传。
      if (error instanceof UploadError && error.status === 404) error.status = 502;
      throw error;
    }
  }

  /**
   * 单请求整体代理上传（兜底通道）。
   *
   * 只在小文件或分片通道不可用时使用 —— 大文件在这条路上会长时间静默，
   * 正是历史上「进度 100% 然后失败」的成因。
   */
  private uploadSingleShot(
    file: File,
    folder: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url =
        `/api/upload?filename=${encodeURIComponent(file.name)}` +
        `&folder=${encodeURIComponent(folder)}`;

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as { key?: string; error?: string };
            if (!data.key) {
              reject(new UploadError(data.error || "服务器未返回文件标识", xhr.status));
              return;
            }
            onProgress?.(100);
            resolve(data.key);
          } catch {
            reject(new UploadError("服务器返回格式异常", xhr.status));
          }
          return;
        }

        let msg = `上传失败（HTTP ${xhr.status}）`;
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string };
          if (data.error) msg = data.error;
        } catch {
          /* 忽略 */
        }
        if (isFatalStatus(xhr.status)) {
          reject(new FatalUploadError(msg));
          return;
        }
        reject(new UploadError(msg, xhr.status, xhr.responseText?.slice(0, 300)));
      };

      xhr.onerror = () => reject(new UploadError("网络中断，请检查网络后重试"));
      xhr.ontimeout = () => reject(new UploadError("上传超时，请检查网络后重试"));
      xhr.onabort = () => reject(new UploadError("上传已取消"));

      xhr.timeout = SINGLE_SHOT_TIMEOUT_MS;
      xhr.open("POST", url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  }

  /**
   * 上传文件。
   *
   * 通道优先级：
   * 1. 同源分片上传（默认，抗弱网、抗长连接回收）
   * 2. 同源单请求代理（分片接口不可用时的兜底，例如部署不完整）
   */
  async upload({ file, folder, onProgress }: UploadToS3Options): Promise<UploadToS3Result> {
    this.validateFile(file);

    const started = Date.now();
    const baseInfo = {
      filename: file.name,
      size: file.size,
      type: file.type,
      folder,
      chunkSize: UPLOAD_CHUNK_SIZE,
    };

    try {
      const key = await this.uploadMultipart(file, folder, onProgress);
      return { publicUrl: key, via: "multipart" };
    } catch (error) {
      if (error instanceof FatalUploadError) {
        reportFailure("multipart", { ...baseInfo, reason: error.message, fatal: true });
        throw error;
      }

      const first = error instanceof Error ? error.message : String(error);
      const firstStatus = error instanceof UploadError ? error.status : undefined;

      reportFailure("multipart", {
        ...baseInfo,
        reason: first,
        status: firstStatus,
        detail: error instanceof UploadError ? error.detail : undefined,
        elapsed: Date.now() - started,
      });

      // 仅初始化接口缺失且尚未产生上传会话时可以安全降级。
      if (firstStatus !== 404) throw error;
      onProgress?.(0);

      try {
        const key = await this.uploadSingleShot(file, folder, onProgress);
        return { publicUrl: key, via: "proxy" };
      } catch (proxyError) {
        if (proxyError instanceof FatalUploadError) {
          reportFailure("single-shot", {
            ...baseInfo,
            reason: proxyError.message,
            fatal: true,
          });
          throw proxyError;
        }

        const second = proxyError instanceof Error ? proxyError.message : "未知错误";
        reportFailure("single-shot", {
          ...baseInfo,
          reason: second,
          status: proxyError instanceof UploadError ? proxyError.status : undefined,
          detail: proxyError instanceof UploadError ? proxyError.detail : undefined,
          firstError: first,
          elapsed: Date.now() - started,
        });

        throw new UploadError(
          `上传失败（分片通道：${first}；整体通道：${second}）。请检查网络后重试`,
        );
      }
    }
  }
}

export const s3Client = new S3Client();
