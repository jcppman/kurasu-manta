import { defineConfig } from '@adonisjs/lucid'
import { test } from '@japa/runner'
import env from '#start/env'

test.group('Database Configuration', (group) => {
  let originalEnv: NodeJS.ProcessEnv

  group.each.setup(() => {
    // Store original env variables
    originalEnv = { ...process.env }
  })

  group.each.teardown(() => {
    // Restore original env variables
    process.env = originalEnv
  })

  test('should use postgres when DB_CONNECTION is not configured', async ({ assert }) => {
    // Remove DB_CONNECTION if exists
    process.env.DB_CONNECTION = undefined

    // Set PostgreSQL env variables
    process.env.DB_HOST = '127.0.0.1'
    process.env.DB_PORT = '5432'
    process.env.DB_USER = 'test_user'
    process.env.DB_PASSWORD = 'test_pass'
    process.env.DB_DATABASE = 'test_db'

    const config = (await import('../config/database')).default

    assert.equal(config.connection, 'postgres')
    assert.deepEqual(config.connections.postgres.connection, {
      host: '127.0.0.1',
      port: '5432',
      user: 'test_user',
      password: 'test_pass',
      database: 'test_db',
    })
  })

  test('should use postgres when DB_CONNECTION=postgres', async ({ assert }) => {
    process.env.DB_CONNECTION = 'postgres'
    process.env.DB_HOST = '127.0.0.1'
    process.env.DB_PORT = '5432'
    process.env.DB_USER = 'test_user'
    process.env.DB_PASSWORD = 'test_pass'
    process.env.DB_DATABASE = 'test_db'

    const config = (await import('../config/database')).default

    assert.equal(config.connection, 'postgres')
    assert.deepEqual(config.connections.postgres.connection, {
      host: '127.0.0.1',
      port: '5432',
      user: 'test_user',
      password: 'test_pass',
      database: 'test_db',
    })
  })

  test('should use sqlite when DB_CONNECTION=sqlite', async ({ assert }) => {
    process.env.DB_CONNECTION = 'sqlite'
    process.env.DB_FILE = 'test.sqlite3'

    const config = (await import('../config/database')).default

    assert.equal(config.connection, 'sqlite')
    assert.deepEqual(config.connections.sqlite.connection, {
      filename: 'test.sqlite3',
    })
    assert.isTrue(config.connections.sqlite.useNullAsDefault)
  })
})
