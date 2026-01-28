const yaml = require("js-yaml");

function parseIupipes(yamlText) {
  try {
    const obj = yaml.load(yamlText);
    if (!obj || typeof obj !== "object") return {};
    return obj;
  } catch (e) {
    // Fail fast: config should be correct
    throw new Error(`Failed to parse .iupipes.yml: ${e.message}`);
  }
}

module.exports = { parseIupipes };