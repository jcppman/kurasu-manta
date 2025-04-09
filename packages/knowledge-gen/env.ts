if (!process.env.DB_FILE_NAME) {
  throw new Error('DB_FILE_NAME not specified')
}

export const DB_FILE_NAME = process.env.DB_FILE_NAME
