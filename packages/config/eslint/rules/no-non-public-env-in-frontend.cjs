/**
 * ESLint rule: in client-side files of Next.js apps, every `process.env.X`
 * reference MUST start with `NEXT_PUBLIC_`. Backend-only secrets such as
 * `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, etc.
 * MUST NEVER be referenced from frontend client code (FR-CFG-005, FR-SEC-001,
 * SC-005).
 *
 * This rule is intended to run against `apps/dashboard/src/**` and
 * `apps/website/src/**` only. It excludes server-only files: any file under a
 * `server/` segment, any file ending in `.server.ts`/`.server.tsx`, files
 * starting with `'use server'`, route handlers under `app/api/`, middleware
 * files, and `next.config.*`.
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow process.env.<NON_NEXT_PUBLIC> references in frontend client code',
    },
    schema: [],
    messages: {
      nonPublicEnv:
        "Frontend client code must not read non-NEXT_PUBLIC_ env vars. " +
        "Reading '{{name}}' would leak it into the client bundle. " +
        "Either rename the var with a NEXT_PUBLIC_ prefix (if truly public), " +
        "or move this access into a server-only module (route handler, " +
        "server action, *.server.ts file, or 'use server' module).",
    },
  },
  create(context) {
    const filename = context.getFilename().replace(/\\/g, '/');

    // Server-only files are exempt.
    if (
      /\/server\//.test(filename) ||
      /\.server\.(ts|tsx|js|jsx)$/.test(filename) ||
      /\/app\/api\//.test(filename) ||
      /\/middleware\.(ts|js)$/.test(filename) ||
      /\/next\.config\.(mjs|cjs|js|ts)$/.test(filename) ||
      /\/instrumentation\.(ts|js)$/.test(filename)
    ) {
      return {};
    }

    let firstLineUseServer = false;

    return {
      Program(node) {
        const first = node.body[0];
        if (
          first &&
          first.type === 'ExpressionStatement' &&
          first.expression &&
          first.expression.type === 'Literal' &&
          typeof first.expression.value === 'string' &&
          first.expression.value === 'use server'
        ) {
          firstLineUseServer = true;
        }
      },
      MemberExpression(node) {
        if (firstLineUseServer) return;

        // Match process.env.SOMETHING and process.env['SOMETHING']
        const obj = node.object;
        if (
          obj.type !== 'MemberExpression' ||
          obj.object.type !== 'Identifier' ||
          obj.object.name !== 'process' ||
          obj.property.type !== 'Identifier' ||
          obj.property.name !== 'env'
        ) {
          return;
        }

        let name;
        if (node.property.type === 'Identifier' && !node.computed) {
          name = node.property.name;
        } else if (
          node.computed &&
          node.property.type === 'Literal' &&
          typeof node.property.value === 'string'
        ) {
          name = node.property.value;
        } else {
          // Computed access with a non-literal key — flag conservatively.
          context.report({
            node,
            messageId: 'nonPublicEnv',
            data: { name: '<dynamic>' },
          });
          return;
        }

        if (!name.startsWith('NEXT_PUBLIC_') && name !== 'NODE_ENV') {
          context.report({
            node,
            messageId: 'nonPublicEnv',
            data: { name },
          });
        }
      },
    };
  },
};
