import { createServer } from 'vite';
const server = await createServer({server:{middlewareMode:true,watch:null},appType:'custom'});
try { const module = await server.ssrLoadModule('/scripts/qa-render.jsx'); module.run(); }
finally { await server.close(); }
