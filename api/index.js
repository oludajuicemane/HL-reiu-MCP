// Temporary handler for debugging
module.exports = async (req, res) => {
  try {
    console.log("[DEBUG] Incoming request:", req.method, req.url);
    res.status(200).json({
      status: "online",
      message: "Minimal handler is running."
    });
  } catch (e) {
    console.error("[ERROR] Serverless crash:", e);
    res.status(500).json({
      error: "Function crash",
      details: e.message
    });
  }
};
