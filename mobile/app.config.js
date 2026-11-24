const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || path.join(__dirname, 'google-services.json');
  return {
    ...config,
    ...(projectId ? { extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } } } : {}),
    android: { ...config.android, ...(fs.existsSync(googleServicesFile) ? { googleServicesFile } : {}) },
  };
};