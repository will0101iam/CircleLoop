function isReadOnlySql(sql: string) {
  return /^\s*select\b/i.test(sql.trim())
}

export function createQuerySqlTool(deps: {
  db: { query: (sql: string) => Promise<unknown[]> }
}) {
  return {
    name: 'query_sql',
    description: 'Run a read-only SQL query (SELECT only) against the app database.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string' },
      },
      required: ['sql'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'safe' as const },
    async handler(args: { sql: string }) {
      if (!isReadOnlySql(args.sql)) {
        return {
          ok: false as const,
          error: {
            code: 'READ_ONLY_SQL_REQUIRED',
            message: 'Only SELECT queries are allowed',
          },
        }
      }

      const rows = await deps.db.query(args.sql)

      return {
        ok: true as const,
        data: { rows },
      }
    },
  }
}
