module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct Prisma read calls outside softReads()/repository wrappers',
    },
    schema: [],
    messages: {
      noBareRead:
        'Use softReads()/repository helper instead of direct Prisma read calls.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.property &&
          node.property.type === 'Identifier' &&
          ['findMany', 'findFirst', 'findUnique'].includes(node.property.name)
        ) {
          context.report({ node, messageId: 'noBareRead' });
        }
      },
    };
  },
};
