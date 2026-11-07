import path from 'node:path';
import dotenv from 'dotenv';

// .env лежить у корені монорепо, а процес стартує з api/,
// тому шлях задаємо явно. У Docker змінні приходять через env_file,
// і відсутність файлу тут не проблема.
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
dotenv.config();

/**
 * Читає змінну оточення. Без значення й без дефолта — падаємо одразу
 * на старті, а не на першому запиті користувача.
 */
export const getEnvVar = (name, defaultValue) => {
  const value = process.env[name];

  if (value !== undefined && value !== '') return value;
  if (defaultValue !== undefined) return defaultValue;

  throw new Error(`Не задано process.env.${name}`);
};
