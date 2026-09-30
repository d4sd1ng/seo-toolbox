/** Webpack stub — Next must never bundle Playwright. */
module.exports = new Proxy(
  {},
  {
    get: () => () => undefined,
  },
);
