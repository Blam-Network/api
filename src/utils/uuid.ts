import { z } from "zod";

export const dashedUuidFromHex = z.preprocess((val) => {
  if (typeof val !== 'string') return val;

  let str = val.trim();

  if (str.startsWith('"')) str = str.slice(1);
  if (str.endsWith('"')) str = str.slice(0, -1);

  // validate: must be exactly 32 hex chars
  if (!/^[0-9a-fA-F]{32}$/.test(str)) return val;

  // insert standard UUID dashes (8-4-4-4-12)
  str = str.toLowerCase();
  const dashed = `${str.slice(0, 8)}-${str.slice(8, 12)}-${str.slice(12, 16)}-${str.slice(16, 20)}-${str.slice(20)}`;

  return dashed;
}, z.string().uuid());