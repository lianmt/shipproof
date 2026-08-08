const http = require("node:http");

const port = Number(process.env.PORT || 41739);
const html = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>ShipProof Fixture</title></head>
  <body><main data-testid="ready"><h1>Current implementation ready</h1></main></body>
</html>`;

http
  .createServer((_request, response) => {
    response.statusCode = 200;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(html);
  })
  .listen(port, "127.0.0.1", () => console.log(`fixture ready on ${port}`));
