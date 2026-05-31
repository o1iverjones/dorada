const API_URLS = {
  dev: "https://api-dev-7dbe.up.railway.app/api/v1",
  production: "https://api.dorada.app/api/v1",
};

module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV ?? "dev";
  const apiUrl = API_URLS[appEnv] ?? API_URLS.dev;

  return {
    ...config,
    extra: {
      ...config.extra,
      apiUrl,
      appEnv,
    },
  };
};
