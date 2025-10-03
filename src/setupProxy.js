const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api/notion',
    createProxyMiddleware({
      target: 'https://api.notion.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/notion': '', // /api/notion を削除
      },
      headers: {
        'Authorization': `Bearer ${process.env.REACT_APP_NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
      },
    })
  );
};