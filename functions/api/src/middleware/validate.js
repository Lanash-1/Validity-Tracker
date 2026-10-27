/**
 * Validates `req[source]` with a zod schema and stores the parsed value on
 * `req.valid[source]`. Throws ZodError (handled by errorHandler).
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    try {
      req.valid ??= {};
      req.valid[source] = schema.parse(req[source] ?? {});
      next();
    } catch (err) {
      next(err);
    }
  };
}
