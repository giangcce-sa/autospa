import "server-only";

import { spawn } from "child_process";

export async function runFfmpeg(args: string[], timeoutMs = 10 * 60_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("FFmpeg quá thời gian xử lý"));
    }, timeoutMs);
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-12_000); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Không chạy được FFmpeg: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg lỗi (${code}): ${stderr.slice(-1200)}`));
    });
  });
}

export async function runFfprobe(args: string[], timeoutMs = 60_000) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("ffprobe", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("FFprobe quá thời gian xử lý"));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${String(chunk)}`.slice(-2_000_000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-12_000); });
    child.on("error", (error) => { clearTimeout(timer); reject(new Error(`Không chạy được FFprobe: ${error.message}`)); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`FFprobe lỗi (${code}): ${stderr.slice(-1200)}`));
    });
  });
}
