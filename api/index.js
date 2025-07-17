// api/index.js

module.exports = async (req, res) => {
  res.status(200).json({
    message: "✅ GitHub push successful. Vercel deployed this file.",
    version: "test-push-verification",
    timestamp: new Date().toISOString()
  });
};
