import { setTimeout } from "node:timers/promises";

type Limit = {
  value: number;
  unit: "seconds" | "milliseconds";
};

export async function timeLimited<T>(
  promise: Promise<T>,
  options: { limit: Limit }
): Promise<T>;

export async function timeLimited<T>(
  promise: Promise<T>,
  options: { limit: Limit; fallback: T }
): Promise<T>;

export async function timeLimited<T>(
  promise: Promise<T>,
  options: { limit: Limit; fallback?: T }
): Promise<T | undefined>;

export async function timeLimited<T>(
  promise: Promise<T>,
  options: { limit: Limit; fallback?: T | undefined }
): Promise<T | undefined> {
  let ms = options.limit.value;
  if (options.limit.unit === "seconds") ms *= 1000;

  const timeoutPromise = new Promise<T | undefined>((resolve, reject) => {
    setTimeout(ms, () => {
      if ("fallback" in options) {
        resolve(options.fallback);
      } else {
        reject(
          new Error(
            `Timed out after ${options.limit.value} ${options.limit.unit}`
          )
        );
      }
    });
  });

  return Promise.race([promise, timeoutPromise]) as Promise<T | undefined>;
}