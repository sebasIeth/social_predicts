import dotenv from 'dotenv';
dotenv.config();

export const getCollectionName = (baseName: string): string => {
    const prefix = process.env.DB_PREFIX || '';
    return `${prefix}${baseName}`;
};
