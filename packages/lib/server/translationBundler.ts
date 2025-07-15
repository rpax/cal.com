import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import path from "path";

import { CALCOM_VERSION } from "@calcom/lib/constants";
import logger from "@calcom/lib/logger";

function getLocalesPath() {
  // Try multiple possible paths and log which one exists
  const possiblePaths = [
    path.join(process.cwd(), "public/locales"),
    path.join(process.cwd(), "locales"),
    path.join(process.cwd(), "apps/web/public/locales"),
    path.join(process.cwd(), "packages/lib/server/locales"),
  ];

  logger.info(`[translationBundler] Testing possible locales paths:`);
  for (const testPath of possiblePaths) {
    const exists = existsSync(testPath);
    logger.info(`[translationBundler] ${testPath} - ${exists ? "EXISTS" : "NOT FOUND"}`);

    if (exists) {
      try {
        const files = readdirSync(testPath);
        logger.info(`[translationBundler] Files in ${testPath}: ${files.join(", ")}`);
      } catch (err) {
        logger.error(`[translationBundler] Could not read directory ${testPath}:`, err);
      }
    }
  }

  // Use the first path that exists, or fall back to the first one
  const localesPath = possiblePaths.find((p) => existsSync(p)) || possiblePaths[0];
  logger.info(`[translationBundler] Using locales path: ${localesPath}`);
  return localesPath;
}

interface LocaleCache {
  [cacheKey: string]: Record<string, string>;
}

let localeCache: LocaleCache = {};
let cacheVersion: string | null = null;

function loadTranslationForLocale(locale: string, ns: string): Record<string, string> {
  const cacheKey = `${locale}-${ns}-${CALCOM_VERSION}`;
  logger.debug(
    `[translationBundler] loadTranslationForLocale: locale=${locale}, ns=${ns}, cacheKey=${cacheKey}`
  );

  if (cacheVersion === CALCOM_VERSION && localeCache[cacheKey]) {
    logger.debug(`[translationBundler] Returning cached translations for ${cacheKey}`);
    return localeCache[cacheKey];
  }

  if (cacheVersion !== CALCOM_VERSION) {
    logger.info(`[translationBundler] CALCOM_VERSION changed or cache empty. Resetting cache.`);
    localeCache = {};
    cacheVersion = CALCOM_VERSION;
  }

  const dirToCheck = join(getLocalesPath(), locale);
  try {
    const files = readdirSync(dirToCheck);
    logger.info(`[translationBundler] Files in ${dirToCheck}: ${files.join(", ")}`);
  } catch (err) {
    logger.error(`[translationBundler] Could not list files in ${dirToCheck}:`, err);
  }

  try {
    const translationPath = join(getLocalesPath(), locale, `${ns}.json`);
    logger.info(`[translationBundler] Attempting to load translation file: ${translationPath}`);
    const translations = JSON.parse(readFileSync(translationPath, "utf-8"));
    localeCache[cacheKey] = translations;
    logger.info(`[translationBundler] Successfully loaded translations for ${locale}/${ns}`);
    return translations;
  } catch (error) {
    logger.error(`[translationBundler] Failed to load translations for ${locale}/${ns}:`, error);
    return {};
  }
}

export function getBundledTranslations(locale: string, ns: string): Record<string, string> {
  const normalizedLocale = locale === "zh" ? "zh-CN" : locale;
  logger.debug(
    `[translationBundler] getBundledTranslations: requested locale=${locale}, normalizedLocale=${normalizedLocale}, ns=${ns}`
  );

  const translations = loadTranslationForLocale(normalizedLocale, ns);
  if (Object.keys(translations).length > 0) {
    logger.info(`[translationBundler] Returning translations for ${normalizedLocale}/${ns}`);
    return translations;
  }

  logger.warn(
    `[translationBundler] No translations found for ${normalizedLocale}/${ns}, falling back to English.`
  );
  const englishTranslations = loadTranslationForLocale("en", ns);
  return englishTranslations;
}
