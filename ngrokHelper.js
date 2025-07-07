const ngrok = require("ngrok");

async function startNgrok(port) {
  try {
    const url = await ngrok.connect(port);
    console.log(`🌍 Ngrok URL: ${url}`);
    return url;
  } catch (err) {
    console.error("❌ Помилка запуску ngrok:", err);
    return null;
  }
}

module.exports = { startNgrok };